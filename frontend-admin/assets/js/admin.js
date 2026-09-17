/* ==========================================================================
   CỔNG QUẢN TRỊ CỤC QUẢN LÝ DƯỢC — Role admin
   admin.js: tiện ích dùng chung (không phụ thuộc thư viện ngoài)
   ========================================================================== */

(function () {
  'use strict';

  /* ----- Toast thông báo mô phỏng ----- */
  var toast = document.getElementById('toast');
  var toastTimer = null;
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('is-visible'); }, 2400);
  }
  window.showToast = showToast; /* dùng chung cho các trang gọi từ script inline */

  /* ----- Sidebar drawer (mobile) ----- */
  var sidebar = document.getElementById('sidebar');
  var overlay = document.getElementById('sidebarOverlay');
  var burger = document.getElementById('burger');
  function closeSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove('is-open');
    if (overlay) { overlay.classList.remove('is-visible'); overlay.hidden = true; }
  }
  if (burger && sidebar) {
    burger.addEventListener('click', function () {
      var open = sidebar.classList.toggle('is-open');
      if (overlay) { overlay.hidden = !open; overlay.classList.toggle('is-visible', open); }
    });
  }
  if (overlay) overlay.addEventListener('click', closeSidebar);

  /* ----- Menu active theo tên file hiện tại ----- */
  var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  document.querySelectorAll('.nav-item').forEach(function (a) {
    var target = (a.getAttribute('href') || '').toLowerCase();
    if (target === page) {
      document.querySelectorAll('.nav-item.is-active').forEach(function (x) { x.classList.remove('is-active'); });
      a.classList.add('is-active');
    }
  });

  /* ----- Chip: chọn một trong nhóm (lọc, chọn tháng…) ----- */
  document.querySelectorAll('.chip-row, .chart-months').forEach(function (group) {
    group.querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        if (chip.hasAttribute('data-keep')) return;
        var multi = group.hasAttribute('data-multi');
        if (!multi) group.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('is-active'); });
        chip.classList.toggle('is-active', multi ? !chip.classList.contains('is-active') : true);
      });
    });
  });

  /* ----- Modal ----- */
  function openModal(id) {
    var m = document.getElementById(id);
    if (!m) return;
    m.classList.add('is-open');
  }
  function closeModals() {
    document.querySelectorAll('.modal.is-open').forEach(function (m) { m.classList.remove('is-open'); });
  }
  document.querySelectorAll('[data-open-modal]').forEach(function (btn) {
    btn.addEventListener('click', function () { openModal(btn.getAttribute('data-open-modal')); });
  });
  document.querySelectorAll('[data-close-modal]').forEach(function (el) {
    el.addEventListener('click', closeModals);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeModals(); closeSidebar(); }
  });

  /* ----- Form mô phỏng: chặn submit, toast, đóng modal ----- */
  document.querySelectorAll('form[data-demo]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      showToast('Đã lưu (mô phỏng) — không gửi lên hệ thống thật.');
      if (form.hasAttribute('data-close-after')) closeModals();
      form.reset();
    });
  });

  /* ----- Hành động trên bảng: xem / duyệt / từ chối (mô phỏng) ----- */
  document.querySelectorAll('[data-action]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var action = btn.getAttribute('data-action');
      var row = btn.closest('tr');
      if (action === 'approve' && row) {
        var badge = row.querySelector('.badge');
        if (badge) {
          badge.className = 'badge badge--ok';
          badge.textContent = 'Đã trả kết quả';
        }
        showToast('Đã trả kết quả hồ sơ (mô phỏng).');
      } else if (action === 'reject' && row) {
        var badge2 = row.querySelector('.badge');
        if (badge2) {
          badge2.className = 'badge badge--danger';
          badge2.textContent = 'Từ chối';
        }
        showToast('Đã từ chối hồ sơ (mô phỏng).');
      } else if (action === 'view') {
        showToast('Mở chi tiết (mô phỏng).');
      } else if (action === 'delete') {
        if (row) row.remove();
        showToast('Đã xoá (mô phỏng).');
      } else if (action === 'toggle-lock') {
        var badge3 = row && row.querySelector('.badge');
        if (badge3) {
          var locked = badge3.classList.contains('badge--danger');
          badge3.className = 'badge ' + (locked ? 'badge--ok' : 'badge--danger');
          badge3.textContent = locked ? 'Hoạt động' : 'Đã khoá';
          showToast(locked ? 'Đã mở khoá tài khoản (mô phỏng).' : 'Đã khoá tài khoản (mô phỏng).');
        }
      }
    });
  });
})();
