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
  toast('Đã
