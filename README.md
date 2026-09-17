# Hệ thống Quản lý Trang thiết bị — Cục Quản lý Dược (QT.QLD.09.01)

Bài tập lớn môn **ET3161 — Phân tích và Thiết kế Hệ thống Phần mềm** (HUST).
Số hóa quy trình quản lý trang thiết bị QT.QLD.09.01 (Cục Quản lý Dược, ban hành 07/8/2018) — thay thế 4 biểu mẫu giấy **BM.QLD.09.01/01 → /04** bằng hệ thống điện tử.

## Kiến trúc & công nghệ

| Thành phần | Công nghệ |
|---|---|
| Cổng đơn vị sử dụng (`frontend/`) | HTML/CSS/JS tĩnh, theme tối gold |
| Cổng quản trị (`frontend-admin/`) | HTML/CSS/JS tĩnh, theme sáng pastel |
| API (`backend/`) | Node.js 20 + Express, JWT auth |
| CSDL | PostgreSQL 16 (15 bảng) |
| Triển khai | Docker Compose — 5 container (2 nginx + api + db + volume) |

```
Trình duyệt ──HTTPS──► Nginx (8080 / 8081) ──proxy /api──► Express :3000 ──TCP 5432──► PostgreSQL
                                                            └── uploads/ (biên bản, ảnh sự cố)
```

## Chạy nhanh (Docker)

```bash
# yêu cầu: Docker Desktop đã chạy
docker compose up -d --build

# lần đầu: migration + seed tự chạy trong container api
#  - cổng đơn vị sử dụng :  http://localhost:8080
#  - cổng quản trị       :  http://localhost:8081
#  - API trực tiếp       :  http://localhost:3001/api/v1/health
```

Tắt/giữ dữ liệu: `docker compose down` (volume `pgdata` được giữ lại).
Xoá sạch dữ liệu: `docker compose down -v`.

### Tài khoản demo (mật khẩu chung `Abc@12345`)

| Tài khoản | Vai trò | Cổng |
|---|---|---|
| `vanphong` | Văn phòng Cục | frontend-admin (8081) |
| `lanhdao` | Lãnh đạo Cục (phê duyệt) | frontend-admin (8081) |
| `qms` | Ban QMS (kiểm tra, báo cáo) | frontend-admin (8081) |
| `dkt`, `qlct` | Đơn vị sử dụng | frontend (8080) |

## Ánh xạ quy trình ↔ hệ thống

| Quy trình gốc | Trong hệ thống |
|---|---|
| 6.2.1 + BM/01 Danh mục | `frontend-admin/thiet-bi.html` — CRUD, xuất Excel |
| 6.2.2 + BM/02 Hồ sơ | `frontend/chi-tiet-thiet-bi.html` — timeline lịch sử; tự ghi khi hoàn thành bảo dưỡng/khắc phục/nghiệm thu |
| 6.2.3a + BM/03 Kế hoạch | `frontend-admin/ke-hoach.html` — lập → trình → phê duyệt; nhắc lịch tự động 07:00 hằng ngày |
| 6.2.3b Sự cố nhỏ | `frontend/bao-su-co.html` → review → **tự khắc phục không cần phê duyệt** → đóng |
| 6.2.3b Sự cố lớn / thuê ngoài | review → `phuong-an.html` (lập + Lãnh đạo Cục duyệt) → thực hiện → nghiệm thu |
| 6.2.5 + BM/04 Nghiệm thu | `frontend-admin/nghiem-thu.html` — 2 đại diện/bên, đủ chữ ký → thiết bị về HOẠT ĐỘNG |
| Mục 7 Lưu trữ hồ sơ | retention hiển thị trong UI; audit trail append-only (ISO 9001:2015) |

## API chính (`/api/v1`)

- `POST /auth/login`, `GET /auth/me`
- `GET|POST|PUT|DELETE /equipment`, `GET /equipment/:id` (kèm hồ sơ), `POST /equipment/:id/logs`, `GET /equipment/export.xlsx`
- `GET|POST /plans`, `POST /plans/:id/submit|approve|reject`, `PATCH /plans/items/:id`, `GET /plans/reminder/due`
- `GET|POST /incidents`, `POST /incidents/:id/review|self-resolve`
- `GET|POST /repair-plans`, `POST /repair-plans/:id/approve|reject|complete`
- `GET|POST /acceptances`, `POST /acceptances/:id/sign`
- `GET /reports/summary|equipment-by-department|incident-frequency|plan-progress|audit`
- `POST|GET /attachments`, `GET /notifications`, `/users`, `/vendors`, `/departments`

Phân quyền qua JWT role: `DON_VI`, `VAN_PHONG_CUC`, `LANH_DAO_CUC`, `QMS`, `NHA_THAU`.

## Tài liệu phân tích thiết kế (`docs/`)

- `docs/diagrams/*.drawio` — bộ sơ đồ UML: use case, activity (×2), class, sequence (×2), state machine (×2), ERD, deployment — mở bằng [draw.io](https://app.diagrams.net).
- `docs/report/` — báo cáo LaTeX (biên dịch bằng XeLaTeX: `xelatex main.tex`).
- `docs/slides/` — slide thuyết trình.

## Deploy lên server chủ quản (VPS)

1. Cài Docker + Docker Compose trên server.
2. Copy toàn bộ thư mục dự án (hoặc `git clone`).
3. Tạo `.env` từ `.env.example`, đổi `JWT_SECRET` và mật khẩu PostgreSQL.
4. `docker compose up -d --build` — mở port 8080/8081 (hoặc đặt reverse proxy/TLS phía trước).
5. Sao lưu định kỳ: `docker exec qltt-db-1 pg_dump -U qltt qltt > backup_$(date +%F).sql`.

## Ghi chú thiết kế

- Các trường **[mở rộng]** trong CSDL (chi phí, mức độ ưu tiên, SLA…) là bổ sung đề xuất — quy trình gốc không có; tách bạch rõ trong báo cáo.
- Sự cố nhỏ giữ đúng ngữ nghĩa gốc: **không bắt buộc qua phê duyệt** để không làm nặng quy trình.
- Kịch bản chạy song song giấy/điện tử cần Ban QMS phê duyệt (xem mục Rủi ro trong báo cáo).
