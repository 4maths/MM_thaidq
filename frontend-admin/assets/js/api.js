/* Tầng API dùng chung cho hệ quản trị — gọi backend qua nginx reverse proxy (/api/v1). */
const API = {
  base: '/api/v1',

  get token() { return localStorage.getItem('qltt_token'); },
  get user() { try { return JSON.parse(localStorage.getItem('qltt_user') || 'null'); } catch { return null; } },

  saveSession(token, user) {
    localStorage.setItem('qltt_token', token);
    localStorage.setItem('qltt_user', JSON.stringify(user));
  },
  logout() { localStorage.removeItem('qltt_token'); localStorage.removeItem('qltt_user'); },

  async request(method, path, body) {
    const headers = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(this.base + path, {
      method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `Lỗi ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  },
  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },
  put(path, body) { return this.request('PUT', path, body); },
  patch(path, body) { return this.request('PATCH', path, body); },
};

const UI = {
  badge(status) {
    const map = {
      HOAT_DONG: ['ok', 'Hoạt động'], SU_CO: ['danger', 'Sự cố'], DANG_SUA: ['warn', 'Đang sửa chữa'],
      DANG_BAO_DUONG: ['warn', 'Đang bảo dưỡng'], NGUNG_SU_DUNG: ['info', 'Ngừng sử dụng'], THANH_LY: ['info', 'Đã thanh lý'],
      MOI: ['warn', 'Mới'], DANG_XEM_XET: ['info', 'Đang xem xét'], CHO_DUYET: ['violet', 'Chờ phê duyệt'],
      TU_CHOI: ['danger', 'Bị từ chối'], CHO_NGHIEM_THU: ['warn', 'Chờ nghiệm thu'], DA_XU_LY: ['ok', 'Đã xử lý'], DONG: ['ok', 'Đóng'],
      DA_DUYET: ['ok', 'Đã duyệt'], NHAP: ['info', 'Nháp'], DANG_THUC_HIEN: ['warn', 'Đang thực hiện'], HOAN_THANH: ['ok', 'Hoàn thành'],
      CHO_THUC_HIEN: ['info', 'Chờ thực hiện'], TRE_TIEN_DO: ['danger', 'Trễ tiến độ'], DA_KY: ['ok', 'Đã ký'],
      NOI_BO: ['info', 'Nội bộ'], BEN_NGOAI: ['violet', 'Bên ngoài'], TU_KHAC_PHUC: ['ok', 'Tự khắc phục'],
      THUE_NGOAI: ['violet', 'Thuê ngoài'],
      CAO: ['danger', 'Cao'], BINH_THUONG: ['info', 'Bình thường'], THAP: ['info', 'Thấp'],
    };
    const [cls, label] = map[status] || ['info', status];
    return `<span class="badge badge--${cls}">${label}</span>`;
  },
  date(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },
  datetime(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  },
  money(n) {
    if (n === null || n === undefined) return '—';
    return Number(n).toLocaleString('vi-VN') + ' đ';
  },
  initials(name) {
    return (name || '?').split(' ').filter(Boolean).slice(-2).map((w) => w[0]).join('').toUpperCase();
  },
  monthName(m) { return m ? `Tháng ${m}` : '—'; },
};

/** Chặn truy cập khi chưa đăng nhập (dùng ở đầu script trang, trừ dang-nhap.html) */
function guardPage() {
  if (!API.token || !API.user) {
    location.href = 'dang-nhap.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search);
    return false;
  }
  return true;
}
