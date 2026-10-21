# Module QR và tem nhãn thiết bị

## API

Các endpoint theo Collection Postman được hỗ trợ tại `/api`; router thiết bị hiện tại vẫn giữ đường dẫn `/api/v1`.

- `GET /api/equipment/:id/qr-code`: yêu cầu Bearer token, trả ảnh PNG (`Content-Type: image/png`).
- `POST /api/equipment/export-qr-labels`: yêu cầu Bearer token của vai trò `VAN_PHONG_CUC`, `QMS` hoặc `LANH_DAO_CUC`; trả PDF (`Content-Type: application/pdf`).
- `GET /api/public/equipment/:qr_code_uuid`: API tra cứu công khai, không yêu cầu đăng nhập.

Request xuất PDF:

```json
{
  "equipment_ids": [1, 2, 3, 4],
  "template_type": "DECAL_A4_30"
}
```

## Mẫu `DECAL_A4_30` (giả định ban đầu)

- Khổ A4: 210 × 297 mm, dọc.
- 30 tem/trang, bố cục 3 cột × 10 hàng.
- Tem: 60 × 25 mm.
- Lề trái/phải: 9 mm; lề trên/dưới: 10 mm.
- Khe ngang: 6 mm; khe dọc: 3 mm.
- QR 17 × 17 mm; in mã thiết bị, tên thiết bị và đơn vị sử dụng nếu có.
- PDF có đường viền xám nhạt để hỗ trợ kiểm tra căn chỉnh trên giấy thường.

Đây là kích thước tham khảo để phát triển; trước khi in decal hàng loạt cần thử trên giấy thường và đối chiếu với loại giấy tem thực tế. In ở 100% / Actual Size, tắt Fit to Page.

## Cấu hình URL được mã hóa vào QR

Thiết lập `PUBLIC_EQUIPMENT_BASE_URL` thành URL công khai mà điện thoại có thể truy cập, ví dụ:

```env
PUBLIC_EQUIPMENT_BASE_URL=https://your-domain.example/api/public/equipment
```

Mỗi QR chứa URL `/api/public/equipment/<qr_code_uuid>`. UUID được lưu cố định trong `equipment.qr_code_uuid`, không đổi theo mã thiết bị. Nếu muốn quét QR mở giao diện frontend thay vì trả JSON, hãy đổi URL này sang route frontend sau khi nhóm thống nhất route đó.

## Cài đặt và migration

```bash
cd backend
npm install
npm run migrate
```

Migration `002_equipment_qr_uuid.sql` thêm UUID cho các thiết bị cũ và đặt UUID mặc định cho thiết bị tạo mới. Hai font Noto Sans được đóng kèm để PDF hiển thị tiếng Việt.
