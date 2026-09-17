/* ==========================================================================
   CỔNG THÔNG TIN CỤC QUẢN LÝ DƯỢC — Giao diện người dùng
   main.js: tiện ích dùng chung mọi trang (không phụ thuộc thư viện ngoài)
   ========================================================================== */

(function () {
  'use strict';

  /* ----- Menu mobile: bật/tắt nav khi bấm nút ☰ ----- */
  var toggle = document.querySelector('.nav-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var header = document.querySelector('.site-header');
      var open = header.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
      toggle.textContent = open ? '✕' : '☰';
    });
  }

  /* ----- Gắn class is-active cho menu theo tên file hiện tại ----- */
  var page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  document.querySelectorAll('.main-nav a').forEach(function (a) {
    var target = (a.getAttribute('href') || '').toLowerCase();
    if (target === page) {
      document.querySelectorAll('.main-nav a.is-active').forEach(function (x) {
        x.classList.remove('is-active');
      });
      a.classList.add('is-active');
    }
  });

  /* ----- Năm bản quyền ở footer ----- */
  document.querySelectorAll('[data-role="year"]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ----- Sinh bảng chữ cái A–Z cho .az-grid ----- */
  var az = document.querySelector('.az-grid');
  if (az && az.children.length === 0) {
    for (var i = 65; i <= 90; i++) {
      var ch = String.fromCharCode(i);
      var a = document.createElement('a');
      a.href = 'tra-cuu-duoc-pham.html?letter=' + ch;
      a.textContent = ch;
      az.appendChild(a);
    }
  }

  /* ----- Trang tra cứu: điền sẵn từ khoá/chữ cái từ URL (?q=, ?letter=) ----- */
  var params = new URLSearchParams(location.search);
  var qInput = document.querySelector('[data-role="search-q"]');
  if (qInput) {
    var q = params.get('q') || '';
    var letter = params.get('letter') || '';
    if (q) qInput.value = q;
    else if (letter) qInput.value = 'Tên bắt đầu bằng "' + letter + '"';
  }

  /* ----- Lọc chip danh mục (chỉ chuyển trạng thái giao diện, demo) ----- */
  document.querySelectorAll('.search-chips .chip').forEach(function (chip) {
    chip.addEventListener('click', function (e) {
      // Chip là link thật thì cho điều hướng; chip là button thì toggle active
      if (chip.tagName === 'BUTTON') {
        e.preventDefault();
        var group = chip.closest('.search-chips');
        group.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('is-active'); });
        chip.classList.add('is-active');
      }
    });
  });

  /* ----- Form mô phỏng (không backend): chặn submit, hiện thông báo ----- */
  document.querySelectorAll('form[data-demo]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var success = form.querySelector('.form-success') || form.parentElement.querySelector('.form-success');
      if (success) success.hidden = false;
    });
  });
})();
