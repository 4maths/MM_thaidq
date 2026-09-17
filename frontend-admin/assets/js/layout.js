/* Chèn khung giao diện dùng chung (sidebar + topbar) vào mọi trang quản trị.
   Trang chỉ cần đặt <div id="sidebar-root"></div> và <div id="topbar-root"></div>
   đúng vị trí; script này chạy ngay khi load (trước admin.js). */
(function () {
  const sidebarRoot = document.getElementById('sidebar-root');
  const topbarRoot = document.getElementById('topbar-root');
  if (!sidebarRoot || !topbarRoot) return;

  const user = API.user || { name: 'Khách', role: '' };
  const roleNames = {
    VAN_PHONG_CUC: 'Văn phòng Cục', LANH_DAO_CUC: 'Lãnh đạo Cục', QMS: 'Ban QMS',
    DON_VI: 'Đơn vị sử dụng', NHA_THAU: 'Nhà thầu',
  };

  sidebarRoot.outerHTML = `
  <aside class="sidebar" id="sidebar" aria-label="Menu quản trị">
    <a class="sidebar__logo" href="index.html">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="2.5" y="2.5" width="19" height="19" rx="6.5" fill="currentColor"/>
        <path d="M12 6.5v11M7 9.5h10M7 14.5h6" stroke="#fff" stroke-width="1.9" stroke-linecap="round"/>
      </svg>
      <span>
        <span class="brand-name">Quản lý <em>Thiết bị</em></span>
        <span class="brand-sub">CỤC QUẢN LÝ DƯỢC</span>
      </span>
    </a>

    <nav class="nav-group">
      <p class="nav-group__label">Nghiệp vụ</p>
      <a class="nav-item" href="index.html">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/></svg>
        Tổng quan
      </a>
      <a class="nav-item" href="thiet-bi.html">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>
        Danh mục thiết bị
      </a>
      <a class="nav-item" href="su-co.html">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2.5 20h19L12 3z"/><path d="M12 10v4M12 17h.01"/></svg>
        Sự cố
      </a>
      <a class="nav-item" href="phuong-an.html">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 14l2 2 4-4"/></svg>
        Phương án sửa chữa
      </a>
      <a class="nav-item" href="ke-hoach.html">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>
        Kế hoạch bảo dưỡng
      </a>
      <a class="nav-item" href="nghiem-thu.html">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 12.5 11.5 15 16 9.5"/><rect x="4" y="3.5" width="16" height="17" rx="2"/></svg>
        Nghiệm thu
      </a>
      <a class="nav-item" href="nha-thau.html">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-6h6v6"/></svg>
        Nhà thầu ngoài
      </a>
    </nav>

    <nav class="nav-group">
      <p class="nav-group__label">Quản trị</p>
      <a class="nav-item" href="nguoi-dung.html">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.6c2.6.5 4.5 2.7 4.5 5.4"/></svg>
        Người dùng &amp; phân quyền
      </a>
      <a class="nav-item" href="bao-cao.html">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M5 20v-7M12 20V5M19 20v-4"/></svg>
        Báo cáo thống kê
      </a>
      <a class="nav-item" href="nhat-ky.html">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16M4 12h16M4 19h10"/><circle cx="19" cy="19" r="2.5"/></svg>
        Nhật ký thao tác
      </a>
    </nav>

    <nav class="nav-group">
      <p class="nav-group__label">Tài khoản</p>
      <a class="nav-item" href="#" id="navLogout">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="m10 17-5-5 5-5M5 12h11"/></svg>
        Đăng xuất
      </a>
    </nav>
  </aside>
  <div class="sidebar-overlay" id="sidebarOverlay" hidden></div>`;

  topbarRoot.outerHTML = `
  <header class="topbar">
    <button class="burger" id="burger" aria-label="Mở menu">☰</button>
    <label class="topbar__search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input type="search" placeholder="Tìm thiết bị, sự cố, kế hoạch…" aria-label="Tìm kiếm"
             onkeydown="if(event.key==='Enter'){location.href='thiet-bi.html?q='+encodeURIComponent(this.value)}">
    </label>
    <span class="topbar__spacer"></span>
    <button class="icon-btn" aria-label="Thông báo" onclick="location.href='index.html'" title="Thông báo">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>
      <span class="dot" id="notif-dot" aria-hidden="true" hidden></span>
    </button>
    <span class="topbar__sep" aria-hidden="true"></span>
    <div class="user-chip" title="Đăng xuất — bấm để thoát">
      <span class="user-chip__avatar">${UI.initials(user.name)}</span>
      <span class="user-chip__meta">
        <b>${user.name || 'Khách'}</b>
        <span>${roleNames[user.role] || user.role || ''}</span>
      </span>
    </div>
  </header>`;

  document.getElementById('navLogout').addEventListener('click', (e) => {
    e.preventDefault();
    API.logout();
    location.href = 'dang-nhap.html';
  });
  document.querySelector('.user-chip').addEventListener('click', () => {
    if (confirm('Đăng xuất khỏi hệ thống?')) { API.logout(); location.href = 'dang-nhap.html'; }
  });

  // Chấm đỏ thông báo khi có thông báo chưa đọc
  if (API.token) {
    API.get('/notifications').then((r) => {
      if (r.unread > 0) {
        const dot = document.getElementById('notif-dot');
        if (dot) dot.hidden = false;
      }
    }).catch(() => {});
  }
})();
