const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── State ───────────────────────────────────────────────
let trucks = [], romorocs = [], taiXes = [], chuyenHangs = [];
let currentSection = 'calendar';
let calendarMonth = new Date().getMonth();
let calendarYear = new Date().getFullYear();
let modalShipment = null;

// ─── Boot ─────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  renderShell();
  await loadAll();
  navigate('calendar');
});

async function loadAll() {
  const [t, r, tx, ch] = await Promise.all([
    db.from('trucks').select('*').order('created_at', { ascending: false }),
    db.from('romorocs').select('*').order('created_at', { ascending: false }),
    db.from('tai_xes').select('*').order('created_at', { ascending: false }),
    db.from('chuyen_hangs').select('*, trucks(*), romorocs(*), tai_xes(*), kien_hangs(*)').order('ngay_khoi_hanh', { ascending: true }),
  ]);
  trucks = t.data || [];
  romorocs = r.data || [];
  taiXes = tx.data || [];
  chuyenHangs = ch.data || [];
}

// ─── Shell ────────────────────────────────────────────────
function renderShell() {
  document.getElementById('app').innerHTML = `
    <nav>
      <h1>🚛 Theo Dõi Chuyến Hàng</h1>
      <button onclick="navigate('calendar')" id="nav-calendar">📅 Lịch</button>
      <button onclick="navigate('shipments')" id="nav-shipments">📦 Chuyến Hàng</button>
      <button onclick="navigate('profiles')" id="nav-profiles">🗂️ Hồ Sơ</button>
    </nav>
    <div id="section-calendar" class="section"></div>
    <div id="section-shipments" class="section"></div>
    <div id="section-profiles" class="section"></div>
    <div class="modal-overlay" id="modal-overlay" onclick="closeModal(event)">
      <div class="modal" id="modal-content"></div>
    </div>
    <div class="toast" id="toast"></div>
  `;
}

function navigate(section) {
  currentSection = section;
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('nav-' + section).classList.add('active');
  document.getElementById('section-' + section).classList.add('active');
  if (section === 'calendar') renderCalendar();
  if (section === 'shipments') renderShipments();
  if (section === 'profiles') renderProfiles();
}

// ─── Toast ────────────────────────────────────────────────
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

// ─── Modal ────────────────────────────────────────────────
function openModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('open');
}
function closeModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').classList.remove('open');
}
function forceCloseModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

// ─── CALENDAR ─────────────────────────────────────────────
function renderCalendar() {
  const el = document.getElementById('section-calendar');
  const monthNames = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const today = new Date();

  // days header
  let daysHeader = '<th class="truck-label" style="position:sticky;left:0;z-index:2;background:#f1f5f9;">Xe</th>';
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = today.getDate() === d && today.getMonth() === calendarMonth && today.getFullYear() === calendarYear;
    daysHeader += `<th class="${isToday ? 'today-header' : ''}">${d}<br><span style="font-weight:400;font-size:10px;">${['CN','T2','T3','T4','T5','T6','T7'][new Date(calendarYear, calendarMonth, d).getDay()]}</span></th>`;
  }

  // rows per truck
  let rows = '';
  if (trucks.length === 0) {
    rows = `<tr><td colspan="${daysInMonth + 1}" style="text-align:center;padding:32px;color:#94a3b8;">Chưa có xe nào. Thêm xe trong mục Hồ Sơ.</td></tr>`;
  } else {
    trucks.forEach(truck => {
      let cells = `<td class="truck-label"><strong>${truck.bien_so_xe}</strong><small>${truck.ten_nha_xe || ''} · ${truck.loai_xe || ''}</small></td>`;
      for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = `${calendarYear}-${String(calendarMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const active = chuyenHangs.filter(ch => ch.truck_id === truck.id && ch.ngay_khoi_hanh <= dayStr && ch.ngay_den >= dayStr);
        let cellContent = '';
        active.forEach(ch => {
          const label = ch.kien_hangs && ch.kien_hangs.length > 0 ? ch.kien_hangs[0].ten_kien_hang || 'Chuyến hàng' : 'Chuyến hàng';
          cellContent += `<span class="cal-chip cal-chip-${ch.trang_thai}" onclick="viewShipment('${ch.id}')" title="${label}">${label}</span>`;
        });
        cells += `<td>${cellContent}</td>`;
      }
      rows += `<tr>${cells}</tr>`;
    });
  }

  el.innerHTML = `
    <div class="calendar-header">
      <button class="btn btn-secondary btn-sm" onclick="shiftMonth(-1)">← Trước</button>
      <h2>${monthNames[calendarMonth]} ${calendarYear}</h2>
      <button class="btn btn-secondary btn-sm" onclick="shiftMonth(1)">Sau →</button>
      <button class="btn btn-primary btn-sm" style="margin-left:auto;" onclick="openNewShipmentModal()">+ Chuyến mới</button>
    </div>
    <div class="calendar-grid">
      <table class="calendar-table">
        <thead><tr>${daysHeader}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function shiftMonth(dir) {
  calendarMonth += dir;
  if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
  if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
  renderCalendar();
}

// ─── SHIPMENTS LIST ───────────────────────────────────────
function renderShipments() {
  const el = document.getElementById('section-shipments');
  const statusLabel = { cho: 'Chờ', 'dang-chay': 'Đang chạy', 'hoan-thanh': 'Hoàn thành' };

  let cards = '';
  if (chuyenHangs.length === 0) {
    cards = `<div class="empty-state"><div class="icon">📦</div>Chưa có chuyến hàng nào.</div>`;
  } else {
    chuyenHangs.forEach(ch => {
      const cargo = (ch.kien_hangs || []).map(k => `<span style="font-size:12px;color:#475569;">• ${k.ten_kien_hang || '(chưa đặt tên)'} ${k.noi_xuat_hang ? '→ ' + k.noi_nhan_hang : ''}</span>`).join('<br>');
      cards += `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;">
            <div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                <strong style="font-size:15px;">${ch.trucks?.bien_so_xe || '—'}</strong>
                <span class="badge badge-${ch.trang_thai}">${statusLabel[ch.trang_thai] || ch.trang_thai}</span>
              </div>
              <div style="font-size:13px;color:#64748b;">
                🗓️ ${ch.ngay_khoi_hanh || '—'} → ${ch.ngay_den || '—'} &nbsp;|&nbsp;
                🚛 ${ch.trucks?.loai_xe || '—'} &nbsp;|&nbsp;
                👤 ${ch.tai_xes?.ten_tai_xe || '—'}
              </div>
              ${cargo ? `<div style="margin-top:6px;">${cargo}</div>` : ''}
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="btn btn-sm btn-secondary" onclick="viewShipment('${ch.id}')">Chi tiết</button>
              <button class="btn btn-sm btn-danger" onclick="deleteShipment('${ch.id}')">Xóa</button>
            </div>
          </div>
        </div>
      `;
    });
  }

  el.innerHTML = `
    <div class="section-header">
      <h2>Danh Sách Chuyến Hàng</h2>
      <button class="btn btn-primary" onclick="openNewShipmentModal()">+ Chuyến mới</button>
    </div>
    ${cards}
  `;
}

// ─── VIEW SHIPMENT MODAL ──────────────────────────────────
function viewShipment(id) {
  const ch = chuyenHangs.find(c => c.id === id);
  if (!ch) return;
  const statusLabel = { cho: 'Chờ', 'dang-chay': 'Đang chạy', 'hoan-thanh': 'Hoàn thành' };
  const cargo = (ch.kien_hangs || []).map(k => `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin-bottom:8px;font-size:13px;">
      <strong>${k.ten_kien_hang || '(chưa đặt tên)'}</strong><br>
      ${k.chieu_dai ? `📏 Dài: ${k.chieu_dai} &nbsp;` : ''}
      ${k.chieu_cao ? `📐 Cao: ${k.chieu_cao}` : ''}<br>
      ${k.noi_xuat_hang ? `📤 Từ: ${k.noi_xuat_hang}` : ''}
      ${k.noi_nhan_hang ? ` → 📥 Đến: ${k.noi_nhan_hang}` : ''}
    </div>
  `).join('');

  openModal(`
    <h3>Chi Tiết Chuyến Hàng</h3>
    <div style="font-size:13px;display:grid;gap:6px;margin-bottom:12px;">
      <div><strong>Biển số xe:</strong> ${ch.trucks?.bien_so_xe || '—'} (${ch.trucks?.loai_xe || '—'})</div>
      <div><strong>Nhà xe:</strong> ${ch.trucks?.ten_nha_xe || '—'}</div>
      <div><strong>Rơ moóc:</strong> ${ch.romorocs?.bien_so || '—'} (${ch.romorocs?.loai_romoroc || '—'})</div>
      <div><strong>Tài xế:</strong> ${ch.tai_xes?.ten_tai_xe || '—'}</div>
      <div><strong>CCCD:</strong> ${ch.tai_xes?.can_cuoc || '—'} &nbsp;|&nbsp; <strong>Bằng lái:</strong> ${ch.tai_xes?.so_bang_lai || '—'}</div>
      <div><strong>Khởi hành:</strong> ${ch.ngay_khoi_hanh || '—'} &nbsp;→&nbsp; <strong>Đến:</strong> ${ch.ngay_den || '—'}</div>
      <div><strong>Trạng thái:</strong> <span class="badge badge-${ch.trang_thai}">${statusLabel[ch.trang_thai]}</span></div>
    </div>
    <hr class="divider"/>
    <div style="font-size:13px;font-weight:600;margin-bottom:8px;">Kiện Hàng</div>
    ${cargo || '<div style="color:#94a3b8;font-size:13px;">Không có kiện hàng.</div>'}
    <hr class="divider"/>
    <div style="font-size:13px;font-weight:600;margin-bottom:8px;">Cập nhật trạng thái</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn btn-sm btn-secondary" onclick="updateStatus('${ch.id}','cho')">Chờ</button>
      <button class="btn btn-sm" style="background:#dbeafe;color:#1d4ed8;" onclick="updateStatus('${ch.id}','dang-chay')">Đang chạy</button>
      <button class="btn btn-sm btn-success" onclick="updateStatus('${ch.id}','hoan-thanh')">Hoàn thành</button>
    </div>
    <div style="margin-top:16px;">
      <button class="btn btn-secondary" onclick="forceCloseModal()">Đóng</button>
    </div>
  `);
}

async function updateStatus(id, status) {
  await db.from('chuyen_hangs').update({ trang_thai: status }).eq('id', id);
  await loadAll();
  forceCloseModal();
  toast('Đã cập nhật trạng thái!');
  navigate(currentSection);
}

async function deleteShipment(id) {
  if (!confirm('Xóa chuyến hàng này?')) return;
  await db.from('chuyen_hangs').delete().eq('id', id);
  await loadAll();
  toast('Đã xóa chuyến hàng.');
  navigate(currentSection);
}

// ─── NEW SHIPMENT MODAL ───────────────────────────────────
function openNewShipmentModal() {
  let cargoCount = 1;

  function cargoField(i) {
    return `
      <div class="cargo-item" id="cargo-${i}">
        <button type="button" class="remove-cargo" onclick="document.getElementById('cargo-${i}').remove()">✕</button>
        <div class="form-grid">
          <div class="form-group"><label>Tên Kiện Hàng</label><input name="ten_kien_hang_${i}" placeholder="VD: Thép hộp" /></div>
          <div class="form-group"><label>Chiều Dài</label><input name="chieu_dai_${i}" placeholder="VD: 6m" /></div>
          <div class="form-group"><label>Chiều Cao</label><input name="chieu_cao_${i}" placeholder="VD: 2m" /></div>
          <div class="form-group"><label>Nơi Xuất Hàng</label><input name="noi_xuat_${i}" placeholder="VD: Hà Nội" /></div>
          <div class="form-group"><label>Nơi Nhận Hàng</label><input name="noi_nhan_${i}" placeholder="VD: TP.HCM" /></div>
        </div>
      </div>
    `;
  }

  const truckOptions = trucks.map(t => `<option value="${t.id}">${t.bien_so_xe} — ${t.ten_nha_xe || ''} ${t.loai_xe || ''}</option>`).join('');
  const romorocOptions = romorocs.map(r => `<option value="${r.id}">${r.bien_so} — ${r.loai_romoroc || ''}</option>`).join('');
  const taiXeOptions = taiXes.map(tx => `<option value="${tx.id}">${tx.ten_tai_xe}</option>`).join('');

  openModal(`
    <h3>+ Chuyến Hàng Mới</h3>
    <form id="shipment-form">
      <div class="form-grid" style="margin-bottom:12px;">
        <div class="form-group">
          <label>Xe</label>
          <select name="truck_id" required>
            <option value="">-- Chọn xe --</option>
            ${truckOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Rơ Moóc</label>
          <select name="romoroc_id">
            <option value="">-- Chọn rơ moóc --</option>
            ${romorocOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Tài Xế</label>
          <select name="tai_xe_id">
            <option value="">-- Chọn tài xế --</option>
            ${taiXeOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Ngày Khởi Hành</label>
          <input type="date" name="ngay_khoi_hanh" required />
        </div>
        <div class="form-group">
          <label>Ngày Đến</label>
          <input type="date" name="ngay_den" required />
        </div>
        <div class="form-group">
          <label>Trạng Thái</label>
          <select name="trang_thai">
            <option value="cho">Chờ</option>
            <option value="dang-chay">Đang chạy</option>
            <option value="hoan-thanh">Hoàn thành</option>
          </select>
        </div>
      </div>
      <hr class="divider"/>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <strong style="font-size:13px;">Kiện Hàng <span style="color:#94a3b8;font-weight:400;">(tùy chọn)</span></strong>
        <button type="button" class="btn btn-sm btn-secondary" onclick="addCargo()">+ Thêm kiện</button>
      </div>
      <div id="cargo-container">${cargoField(1)}</div>
      <div style="display:flex;gap:8px;margin-top:16px;">
        <button type="submit" class="btn btn-primary">Lưu chuyến hàng</button>
        <button type="button" class="btn btn-secondary" onclick="forceCloseModal()">Hủy</button>
      </div>
    </form>
  `);

  window.addCargo = () => {
    cargoCount++;
    const container = document.getElementById('cargo-container');
    container.insertAdjacentHTML('beforeend', cargoField(cargoCount));
  };

  document.getElementById('shipment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const { data: ch, error } = await db.from('chuyen_hangs').insert({
      truck_id: fd.get('truck_id') || null,
      romoroc_id: fd.get('romoroc_id') || null,
      tai_xe_id: fd.get('tai_xe_id') || null,
      ngay_khoi_hanh: fd.get('ngay_khoi_hanh'),
      ngay_den: fd.get('ngay_den'),
      trang_thai: fd.get('trang_thai'),
    }).select().single();

    if (error) { toast('Lỗi: ' + error.message); return; }

    // save cargo items
    const cargoItems = document.querySelectorAll('.cargo-item');
    for (const item of cargoItems) {
      const id = item.id.split('-')[1];
      const ten = item.querySelector(`[name="ten_kien_hang_${id}"]`)?.value;
      const dai = item.querySelector(`[name="chieu_dai_${id}"]`)?.value;
      const cao = item.querySelector(`[name="chieu_cao_${id}"]`)?.value;
      const xuat = item.querySelector(`[name="noi_xuat_${id}"]`)?.value;
      const nhan = item.querySelector(`[name="noi_nhan_${id}"]`)?.value;
      if (ten || dai || cao || xuat || nhan) {
        await db.from('kien_hangs').insert({
          chuyen_hang_id: ch.id,
          ten_kien_hang: ten, chieu_dai: dai, chieu_cao: cao,
          noi_xuat_hang: xuat, noi_nhan_hang: nhan,
        });
      }
    }

    await loadAll();
    forceCloseModal();
    toast('Đã lưu chuyến hàng!');
    navigate(currentSection);
  });
}

// ─── PROFILES ─────────────────────────────────────────────
function renderProfiles() {
  const el = document.getElementById('section-profiles');

  const truckCards = trucks.length === 0
    ? `<div class="empty-state"><div class="icon">🚛</div>Chưa có xe nào.</div>`
    : trucks.map(t => `
      <div class="profile-card">
        <div class="profile-card-info">
          <strong>${t.bien_so_xe}</strong>
          <p>${t.ten_nha_xe || '—'} · ${t.loai_xe || '—'}</p>
        </div>
        <div class="profile-card-actions">
          <button class="btn btn-sm btn-danger" onclick="deleteTruck('${t.id}')">Xóa</button>
        </div>
      </div>`).join('');

  const romorocCards = romorocs.length === 0
    ? `<div class="empty-state"><div class="icon">🔗</div>Chưa có rơ moóc nào.</div>`
    : romorocs.map(r => `
      <div class="profile-card">
        <div class="profile-card-info">
          <strong>${r.bien_so}</strong>
          <p>${r.loai_romoroc || '—'}</p>
        </div>
        <div class="profile-card-actions">
          <button class="btn btn-sm btn-danger" onclick="deleteRomoroc('${r.id}')">Xóa</button>
        </div>
      </div>`).join('');

  const driverCards = taiXes.length === 0
    ? `<div class="empty-state"><div class="icon">👤</div>Chưa có tài xế nào.</div>`
    : taiXes.map(tx => `
      <div class="profile-card">
        <div class="profile-card-info">
          <strong>${tx.ten_tai_xe}</strong>
          <p>CCCD: ${tx.can_cuoc || '—'} · Bằng lái: ${tx.so_bang_lai || '—'}</p>
        </div>
        <div class="profile-card-actions">
          <button class="btn btn-sm btn-danger" onclick="deleteTaiXe('${tx.id}')">Xóa</button>
        </div>
      </div>`).join('');

  el.innerHTML = `
    <div style="display:grid;gap:24px;">
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div class="card-title" style="margin:0;">🚛 Xe</div>
          <button class="btn btn-primary btn-sm" onclick="openAddTruck()">+ Thêm xe</button>
        </div>
        <div class="profile-list">${truckCards}</div>
      </div>
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div class="card-title" style="margin:0;">🔗 Rơ Moóc</div>
          <button class="btn btn-primary btn-sm" onclick="openAddRomoroc()">+ Thêm rơ moóc</button>
        </div>
        <div class="profile-list">${romorocCards}</div>
      </div>
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div class="card-title" style="margin:0;">👤 Tài Xế</div>
          <button class="btn btn-primary btn-sm" onclick="openAddTaiXe()">+ Thêm tài xế</button>
        </div>
        <div class="profile-list">${driverCards}</div>
      </div>
    </div>
  `;
}

function openAddTruck() {
  openModal(`
    <h3>+ Thêm Xe</h3>
    <form id="truck-form">
      <div class="form-grid" style="margin-bottom:16px;">
        <div class="form-group"><label>Tên Nhà Xe</label><input name="ten_nha_xe" placeholder="VD: Công ty ABC" /></div>
        <div class="form-group"><label>Loại Xe</label><input name="loai_xe" placeholder="VD: Đầu kéo" /></div>
        <div class="form-group"><label>Biển Số Xe *</label><input name="bien_so_xe" placeholder="VD: 51C-123.45" required /></div>
      </div>
      <div style="display:flex;gap:8px;">
        <button type="submit" class="btn btn-primary">Lưu</button>
        <button type="button" class="btn btn-secondary" onclick="forceCloseModal()">Hủy</button>
      </div>
    </form>
  `);
  document.getElementById('truck-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await db.from('trucks').insert({ ten_nha_xe: fd.get('ten_nha_xe'), loai_xe: fd.get('loai_xe'), bien_so_xe: fd.get('bien_so_xe') });
    await loadAll(); forceCloseModal(); toast('Đã thêm xe!'); renderProfiles();
  });
}

function openAddRomoroc() {
  openModal(`
    <h3>+ Thêm Rơ Moóc</h3>
    <form id="romoroc-form">
      <div class="form-grid" style="margin-bottom:16px;">
        <div class="form-group"><label>Loại Rơ Moóc</label><input name="loai_romoroc" placeholder="VD: Sàn, Bồn, Container" /></div>
        <div class="form-group"><label>Biển Số *</label><input name="bien_so" placeholder="VD: 51R-123.45" required /></div>
      </div>
      <div style="display:flex;gap:8px;">
        <button type="submit" class="btn btn-primary">Lưu</button>
        <button type="button" class="btn btn-secondary" onclick="forceCloseModal()">Hủy</button>
      </div>
    </form>
  `);
  document.getElementById('romoroc-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await db.from('romorocs').insert({ loai_romoroc: fd.get('loai_romoroc'), bien_so: fd.get('bien_so') });
    await loadAll(); forceCloseModal(); toast('Đã thêm rơ moóc!'); renderProfiles();
  });
}

function openAddTaiXe() {
  openModal(`
    <h3>+ Thêm Tài Xế</h3>
    <form id="taixe-form">
      <div class="form-grid" style="margin-bottom:16px;">
        <div class="form-group"><label>Tên Tài Xế *</label><input name="ten_tai_xe" placeholder="VD: Nguyễn Văn A" required /></div>
        <div class="form-group"><label>Căn Cước Công Dân</label><input name="can_cuoc" placeholder="VD: 079012345678" /></div>
        <div class="form-group"><label>Số Bằng Lái</label><input name="so_bang_lai" placeholder="VD: 079012345678" /></div>
      </div>
      <div style="display:flex;gap:8px;">
        <button type="submit" class="btn btn-primary">Lưu</button>
        <button type="button" class="btn btn-secondary" onclick="forceCloseModal()">Hủy</button>
      </div>
    </form>
  `);
  document.getElementById('taixe-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await db.from('tai_xes').insert({ ten_tai_xe: fd.get('ten_tai_xe'), can_cuoc: fd.get('can_cuoc'), so_bang_lai: fd.get('so_bang_lai') });
    await loadAll(); forceCloseModal(); toast('Đã thêm tài xế!'); renderProfiles();
  });
}

async function deleteTruck(id) {
  if (!confirm('Xóa xe này?')) return;
  await db.from('trucks').delete().eq('id', id);
  await loadAll(); toast('Đã xóa xe.'); renderProfiles();
}
async function deleteRomoroc(id) {
  if (!confirm('Xóa rơ moóc này?')) return;
  await db.from('romorocs').delete().eq('id', id);
  await loadAll(); toast('Đã xóa rơ moóc.'); renderProfiles();
}
async function deleteTaiXe(id) {
  if (!confirm('Xóa tài xế này?')) return;
  await db.from('tai_xes').delete().eq('id', id);
  await loadAll(); toast('Đã xóa tài xế.'); renderProfiles();
}
