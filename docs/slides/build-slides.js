/* Slide thuyết trình BTL ET3161 — Hệ thống Quản lý Trang thiết bị QT.QLD.09.01
   Palette: BG dark #131A1C / light #F8F9FD · PRIMARY teal-ink #1F3A40 · ACCENT gold #AE8D3C */
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");

const FIG = path.resolve(__dirname, "..", "report", "figures");
const BG_DARK = "131A1C", BG_LIGHT = "F8F9FD", PRIMARY = "1F3A40", GOLD = "AE8D3C",
      INK = "1E2528", MUTED = "64707A", TEAL = "6FA7B4", WHITE = "FFFFFF", LINE = "E2E6EA";
const FONT = "Calibri";

/* Đọc kích thước PNG từ header IHDR */
function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
/** Chèn ảnh fit trong khung (giữ tỉ lệ, căn giữa) */
function fitImage(slide, file, x, y, maxW, maxH, shadow = true) {
  const { w, h } = pngSize(file);
  const r = Math.min(maxW / w, maxH / h);
  const dw = w * r, dh = h * r;
  slide.addImage({
    path: file, x: x + (maxW - dw) / 2, y: y + (maxH - dh) / 2, w: dw, h: dh,
    shadow: shadow ? { type: "outer", color: "1E2528", blur: 10, offset: 3, angle: 90, opacity: 0.22 } : undefined,
  });
  return { dw, dh };
}
const kicker = (s, text, color = GOLD, y = 0.42) =>
  s.addText(text.toUpperCase(), { x: 0.55, y, w: 9, h: 0.3, fontSize: 12.5, bold: true, color, charSpacing: 3, fontFace: FONT, margin: 0 });
const title = (s, text, color = INK, y = 0.72, size = 30, w = 12.2) =>
  s.addText(text, { x: 0.55, y, w, h: 0.72, fontSize: size, bold: true, color, fontFace: FONT, margin: 0 });
const source = (s, text) =>
  s.addText(text, { x: 0.55, y: 7.08, w: 12.2, h: 0.28, fontSize: 11.5, color: MUTED, fontFace: FONT, margin: 0 });

let p = new pptxgen();
p.layout = "LAYOUT_WIDE";
p.author = "BTL ET3161";
p.title = "Hệ thống hỗ trợ QT.QLD.09.01 — Quản lý trang thiết bị";

/* ============ 1. BÌA (dark) ============ */
let s = p.addSlide();
s.background = { color: BG_DARK };
s.addShape(p.shapes.OVAL, { x: 9.1, y: -2.6, w: 7.4, h: 7.4, fill: { color: "1A2E33" } });
s.addShape(p.shapes.OVAL, { x: 10.6, y: -1.2, w: 4.6, h: 4.6, fill: { color: "22424A" } });
s.addShape(p.shapes.OVAL, { x: 11.8, y: 0.1, w: 2.2, h: 2.2, fill: { color: GOLD, transparency: 25 } });
s.addText("BÀI TẬP LỚN · ET3161 — PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG PHẦN MỀM", {
  x: 0.8, y: 1.5, w: 11.5, h: 0.35, fontSize: 14, bold: true, color: TEAL, charSpacing: 3, fontFace: FONT, margin: 0 });
s.addText("Hệ thống hỗ trợ quy trình\nQuản lý Trang thiết bị", {
  x: 0.8, y: 2.0, w: 11.7, h: 2.3, fontSize: 48, bold: true, color: WHITE, fontFace: FONT, margin: 0, lineSpacing: 58 });
s.addText([
  { text: "QT.QLD.09.01", options: { color: GOLD, bold: true } },
  { text: "  ·  Cục Quản lý Dược — Bộ Y tế  ·  Số hóa 4 biểu mẫu BM.QLD.09.01/01 → /04", options: { color: "9FB3B8" } },
], { x: 0.8, y: 4.45, w: 11.7, h: 0.4, fontSize: 17, fontFace: FONT, margin: 0 });
s.addShape(p.shapes.LINE, { x: 0.85, y: 5.25, w: 3.2, h: 0, line: { color: GOLD, width: 2.5 } });
s.addText("Sinh viên: ....................   ·   MSSV: ....................   ·   GVHD: ....................   ·   Hà Nội, 2026", {
  x: 0.8, y: 5.45, w: 11.7, h: 0.4, fontSize: 14, color: "9FB3B8", fontFace: FONT, margin: 0 });

/* ============ 2. VẤN ĐỀ (light) ============ */
s = p.addSlide();
s.background = { color: BG_LIGHT };
kicker(s, "Khảo sát quy trình hiện tại");
title(s, "Quản lý thiết bị đang vận hành hoàn toàn trên giấy");
s.addText("4", { x: 0.55, y: 2.0, w: 2.9, h: 1.8, fontSize: 96, bold: true, color: GOLD, fontFace: FONT, margin: 0 });
s.addText("biểu mẫu giấy/Excel\nBM.QLD.09.01/01 → /04", { x: 0.6, y: 3.85, w: 2.9, h: 0.75, fontSize: 14, color: MUTED, fontFace: FONT, margin: 0 });
s.addShape(p.shapes.LINE, { x: 3.9, y: 2.15, w: 0, h: 4.35, line: { color: LINE, width: 1 } });
const probs = [
  ["Hồ sơ phân tán", "Mỗi đơn vị giữ danh mục, hồ sơ riêng — mất đồng bộ với danh mục tổng của Văn phòng Cục"],
  ["Không truy vết", "Cập nhật BM/02 thủ công, không bắt buộc — Ban QMS khó kiểm tra tuân thủ ISO 9001"],
  ["Bỏ sót bảo dưỡng", "Kế hoạch năm lưu 1 năm, không nhắc lịch — hạng mục đến hạn dễ bị quên"],
  ["Phê duyệt chậm", "Văn bản giấy đi qua 3 cấp, không theo dõi được trạng thái xử lý"],
  ["Nghiệm thu khó tra cứu", "Biên bản lưu 1 năm tại đơn vị — tranh chấp nhà thầu, không thống kê được chi phí"],
];
probs.forEach(([h, d], i) => {
  const y = 1.95 + i * 0.98;
  s.addText(String(i + 1), { x: 4.35, y, w: 0.55, h: 0.55, fontSize: 26, bold: true, color: GOLD, fontFace: FONT, margin: 0 });
  s.addText([
    { text: h + "   ", options: { bold: true, fontSize: 16, color: INK } },
    { text: d, options: { fontSize: 13.5, color: MUTED } },
  ], { x: 5.0, y: y + 0.02, w: 7.75, h: 0.9, fontFace: FONT, margin: 0, valign: "top" });
  if (i < 4) s.addShape(p.shapes.LINE, { x: 5.0, y: y + 0.83, w: 7.6, h: 0, line: { color: LINE, width: 0.75 } });
});

/* ============ 3. QUY TRÌNH GỐC — 2 LUỒNG (light) ============ */
s = p.addSlide();
s.background = { color: BG_LIGHT };
kicker(s, "QT.QLD.09.01 — mục 6.2");
title(s, "Hai luồng nghiệp vụ gốc và một điểm rẽ nhánh then chốt");
const box = (x, y, w, txt, dark = false, fs2 = 13) => {
  s.addShape(p.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h: 0.62, rectRadius: 0.09,
    fill: { color: dark ? PRIMARY : WHITE }, line: { color: dark ? PRIMARY : "C9D2D8", width: 1 },
    shadow: { type: "outer", color: "1E2528", blur: 5, offset: 2, angle: 90, opacity: 0.14 },
  });
  s.addText(txt, { x, y, w, h: 0.62, align: "center", valign: "middle", fontSize: fs2, bold: true,
    color: dark ? WHITE : INK, fontFace: FONT, margin: 0.03 });
};
const arrow = (x1, y1, x2, y2) =>
  s.addShape(p.shapes.LINE, { x: x1, y: y1, w: x2 - x1, h: y2 - y1, line: { color: MUTED, width: 1.5, endArrowType: "triangle" } });
s.addText("LUỒNG A — XỬ LÝ SỰ CỐ (6.2.3b)", { x: 0.55, y: 1.72, w: 8, h: 0.3, fontSize: 12.5, bold: true, color: TEAL, charSpacing: 2, fontFace: FONT, margin: 0 });
box(0.55, 2.15, 2.15, "Đơn vị\nbáo sự cố");
box(3.05, 2.15, 2.15, "VP Cục xem xét\nnguyên nhân");
box(5.55, 2.15, 2.35, "Sự cố NHỎ?\nđiểm quyết định", true);
box(8.25, 1.45, 2.5, "Tự khắc phục\n+ cập nhật hồ sơ", false, 12.5);
box(8.25, 2.95, 2.5, "Lập phương án\n→ Lãnh đạo Cục duyệt", false, 12.5);
box(11.1, 2.95, 1.7, "Thực hiện →\nnghiệm thu", true, 12);
arrow(2.7, 2.46, 3.05, 2.46); arrow(5.2, 2.46, 5.55, 2.46);
arrow(7.9, 2.35, 8.25, 1.78); arrow(7.9, 2.6, 8.25, 3.2);
arrow(10.75, 3.26, 11.1, 3.26);
s.addText("không cần phê duyệt", { x: 8.3, y: 2.12, w: 2.4, h: 0.25, fontSize: 10.5, italic: true, color: GOLD, fontFace: FONT, margin: 0 });
s.addText("LUỒNG B — KẾ HOẠCH HÀNG NĂM (6.2.3a)", { x: 0.55, y: 4.35, w: 8, h: 0.3, fontSize: 12.5, bold: true, color: TEAL, charSpacing: 2, fontFace: FONT, margin: 0 });
box(0.55, 4.78, 2.6, "VP Cục lập kế hoạch\nbảo dưỡng năm (BM/03)");
box(3.5, 4.78, 2.3, "Lãnh đạo Cục\nphê duyệt");
box(6.15, 4.78, 2.3, "Phát hành,\nđơn vị thực hiện");
box(8.8, 4.78, 2.15, "Kiểm tra,\nnghiệm thu (BM/04)");
box(11.3, 4.78, 1.5, "Cập nhật\nhồ sơ", true, 12);
arrow(3.15, 5.09, 3.5, 5.09); arrow(5.8, 5.09, 6.15, 5.09); arrow(8.45, 5.09, 8.8, 5.09); arrow(10.95, 5.09, 11.3, 5.09);
source(s, "Nguồn: QT.QLD.09.01 — Cục Quản lý Dược, ban hành 07/8/2018 (lần ban hành 01)");

/* ============ 4. MỤC TIÊU (light) ============ */
s = p.addSlide();
s.background = { color: BG_LIGHT };
kicker(s, "Định hướng giải pháp");
title(s, "Năm mục tiêu của hệ thống — bám đúng quy trình gốc");
const goals = [
  ["Số hóa 4 biểu mẫu", "Danh mục, hồ sơ, kế hoạch, nghiệm thu thành dữ liệu có cấu trúc — hết thất lạc, trùng lặp"],
  ["Tự động hóa phê duyệt", "Đơn vị → Văn phòng Cục → Lãnh đạo Cục, theo dõi trạng thái thời gian thực"],
  ["Nhắc lịch bảo dưỡng", "Job 07:00 hằng ngày: hạng mục đến hạn chưa xong → thông báo đúng người"],
  ["Truy vết toàn bộ", "Timeline thiết bị + audit trail append-only theo ISO 9001:2015"],
  ["Báo cáo quản trị", "Thiết bị theo đơn vị, tần suất sự cố, tiến độ kế hoạch, chi phí — cho QMS và Lãnh đạo"],
];
goals.forEach(([h, d], i) => {
  const y = 1.98 + i * 0.99;
  s.addText("0" + (i + 1), { x: 0.55, y, w: 1.0, h: 0.7, fontSize: 30, bold: true, color: GOLD, fontFace: FONT, margin: 0 });
  s.addText([
    { text: h, options: { bold: true, fontSize: 17, color: INK, breakLine: true } },
    { text: d, options: { fontSize: 13.5, color: MUTED } },
  ], { x: 1.75, y: y + 0.01, w: 10.9, h: 0.92, fontFace: FONT, margin: 0, valign: "top" });
  if (i < 4) s.addShape(p.shapes.LINE, { x: 1.75, y: y + 0.86, w: 10.7, h: 0, line: { color: LINE, width: 0.75 } });
});

/* ============ 5. USE CASE (light) ============ */
s = p.addSlide();
s.background = { color: BG_LIGHT };
kicker(s, "Mô hình hóa chức năng");
title(s, "Sơ đồ use case — 6 tác nhân, 15 use case");
fitImage(s, path.join(FIG, "use-case.png"), 0.55, 1.62, 8.6, 5.3);
const ucnotes = [["6", "tác nhân: Đơn vị, VP Cục, Lãnh đạo, QMS, Nhà thầu, Bộ nhắc lịch"],
  ["15", "use case truy vết được về mục 6.2.x của quy trình"],
  ["2×«include»", "Lập phương án / Lập kế hoạch → Trình phê duyệt"],
  ["3×«extend»", "Tự khắc phục {sự cố nhỏ}; Nghiệm thu {thuê ngoài}"]];
ucnotes.forEach(([n, d], i) => {
  const y = 1.95 + i * 1.22;
  s.addText(n, { x: 9.55, y, w: 1.35, h: 0.5, fontSize: 21, bold: true, color: GOLD, fontFace: FONT, margin: 0 });
  s.addText(d, { x: 9.55, y: y + 0.44, w: 3.25, h: 0.75, fontSize: 12, color: MUTED, fontFace: FONT, margin: 0 });
});
source(s, "Bộ sơ đồ đầy đủ: docs/diagrams/*.drawio (draw.io, 10 trang)");

/* ============ 6. ACTIVITY (light) ============ */
s = p.addSlide();
s.background = { color: BG_LIGHT };
kicker(s, "Mô hình hóa chức năng");
title(s, "Sơ đồ hoạt động — đúng rẽ nhánh của mục 6.2.3b");
fitImage(s, path.join(FIG, "activity-incident.png"), 0.4, 1.7, 8.9, 5.25);
s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: 9.5, y: 2.2, w: 3.3, h: 1.7, rectRadius: 0.09, fill: { color: "FFF6E3" }, line: { color: GOLD, width: 1 } });
s.addText([
  { text: "Điểm mấu chốt\n", options: { bold: true, fontSize: 14, color: INK } },
  { text: "Sự cố NHỎ: đơn vị tự khắc phục — không qua phê duyệt, giữ đúng tinh thần quy trình.", options: { fontSize: 12.5, color: MUTED } },
], { x: 9.7, y: 2.38, w: 2.95, h: 1.4, fontFace: FONT, margin: 0, valign: "top" });
s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: 9.5, y: 4.2, w: 3.3, h: 1.7, rectRadius: 0.09, fill: { color: WHITE }, line: { color: "C9D2D8", width: 1 } });
s.addText([
  { text: "4 phân làn\n", options: { bold: true, fontSize: 14, color: INK } },
  { text: "Đơn vị · Văn phòng Cục · Lãnh đạo Cục · Nhà thầu ngoài", options: { fontSize: 12.5, color: MUTED } },
], { x: 9.7, y: 4.38, w: 2.95, h: 1.4, fontFace: FONT, margin: 0, valign: "top" });
source(s, "Kèm 1 sơ đồ hoạt động thứ hai cho luồng kế hoạch bảo dưỡng năm (02-activity.drawio, trang 2)");

/* ============ 7. CLASS (light) ============ */
s = p.addSlide();
s.background = { color: BG_LIGHT };
kicker(s, "Mô hình hóa cấu trúc");
title(s, "Sơ đồ lớp — 15 lớp, truy vết về biểu mẫu");
fitImage(s, path.join(FIG, "class.png"), 0.4, 1.7, 9.4, 5.25);
const clnotes = [["Kế thừa", "Lớp trừu tượng TaiLieu ← Kế hoạch · Phương án · Biên bản (đều qua trình duyệt)"],
  ["Hợp thành", "Kế hoạch ◆ 1..* Chi tiết · Biên bản ◆ 2..4 Đại diện (đúng BM/04)"],
  ["Truy vết", "Trường gắn {BM/0x} = nguyên văn biểu mẫu; [mở rộng] = bổ sung đề xuất"]];
clnotes.forEach(([h, d], i) => {
  const y = 2.1 + i * 1.55;
  s.addText(h.toUpperCase(), { x: 10.0, y, w: 2.8, h: 0.3, fontSize: 12.5, bold: true, color: GOLD, charSpacing: 2, fontFace: FONT, margin: 0 });
  s.addText(d, { x: 10.0, y: y + 0.32, w: 2.85, h: 1.1, fontSize: 12, color: MUTED, fontFace: FONT, margin: 0 });
});
source(s, "Kèm thẻ CRC cho 3 lớp then chốt: TrangThietBi · SuCo · BienBanNghiemThu (Chương 4 báo cáo)");

/* ============ 8. SEQUENCE + STATE (light) ============ */
s = p.addSlide();
s.background = { color: BG_LIGHT };
kicker(s, "Mô hình hóa hành vi");
title(s, "Trình tự và trạng thái — hai luồng cốt lõi");
s.addText("Sequence — xử lý sự cố thuê ngoài", { x: 0.55, y: 1.62, w: 6, h: 0.3, fontSize: 14, bold: true, color: PRIMARY, fontFace: FONT, margin: 0 });
fitImage(s, path.join(FIG, "sequence-incident.png"), 0.55, 1.98, 6.1, 3.3);
s.addText("State machine — vòng đời SuCo", { x: 6.95, y: 1.62, w: 6, h: 0.3, fontSize: 14, bold: true, color: PRIMARY, fontFace: FONT, margin: 0 });
fitImage(s, path.join(FIG, "state-incident.png"), 6.95, 1.98, 5.85, 3.3);
s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: 0.55, y: 5.55, w: 12.2, h: 1.15, rectRadius: 0.09, fill: { color: "FFF6E3" }, line: { color: GOLD, width: 1 } });
s.addText([
  { text: "Nhất quán ba mô hình:  ", options: { bold: true, fontSize: 14, color: INK } },
  { text: "state machine cài thẳng vào API (UPDATE ... WHERE status = ...) — không duyệt khi chưa trình, không ký hai lần, sự cố nhỏ đi đường tắt đúng quy trình.", options: { fontSize: 13, color: MUTED } },
], { x: 0.85, y: 5.75, w: 11.7, h: 0.8, fontFace: FONT, margin: 0, valign: "top" });
source(s, "Đầy đủ: 2 sequence (sự cố, kế hoạch) + 2 state machine (TrangThietBi, SuCo)");

/* ============ 9. KIẾN TRÚC (light) ============ */
s = p.addSlide();
s.background = { color: BG_LIGHT };
kicker(s, "Thiết kế hệ thống");
title(s, "Kiến trúc ba lớp — đóng gói Docker Compose");
fitImage(s, path.join(FIG, "deployment.png"), 0.4, 1.75, 8.3, 5.15);
const arch = [["5", "container: 2 nginx + api Node.js/Express + PostgreSQL 16 + volume uploads"],
  ["15", "bảng PostgreSQL bám đúng 4 biểu mẫu gốc + audit_logs append-only"],
  ["~30", "REST endpoint /api/v1 · JWT 8h · bcrypt · phân quyền 5 vai trò"]];
arch.forEach(([n, d], i) => {
  const y = 2.0 + i * 1.6;
  s.addText(n, { x: 9.1, y, w: 1.2, h: 0.6, fontSize: 32, bold: true, color: GOLD, fontFace: FONT, margin: 0 });
  s.addText(d, { x: 9.1, y: y + 0.55, w: 3.7, h: 1.0, fontSize: 12.5, color: MUTED, fontFace: FONT, margin: 0 });
});
source(s, "docker compose up -d --build → cổng đơn vị :8080 · cổng quản trị :8081 · API :3001");

/* ============ 10. CÀI ĐẶT — SCREENSHOTS (light) ============ */
s = p.addSlide();
s.background = { color: BG_LIGHT };
kicker(s, "Cài đặt thử nghiệm");
title(s, "Nguyên mẫu chạy thật — dữ liệu thật");
s.addText("Cổng quản trị — Văn phòng Cục (theme sáng)", { x: 0.55, y: 1.62, w: 6, h: 0.28, fontSize: 13, bold: true, color: PRIMARY, fontFace: FONT, margin: 0 });
fitImage(s, path.join(FIG, "screen-admin-dashboard.png"), 0.55, 1.95, 6.05, 3.6);
s.addText("Hồ sơ thiết bị BM/02 — timeline truy vết", { x: 6.95, y: 1.62, w: 6, h: 0.28, fontSize: 13, bold: true, color: PRIMARY, fontFace: FONT, margin: 0 });
fitImage(s, path.join(FIG, "screen-profile.png"), 6.95, 1.95, 5.85, 3.6);
s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: 0.55, y: 5.75, w: 12.2, h: 1.0, rectRadius: 0.09, fill: { color: WHITE }, line: { color: "C9D2D8", width: 1 } });
s.addText([
  { text: "Hai cổng giao diện tái hiện đúng các cột biểu mẫu giấy  ", options: { bold: true, fontSize: 13.5, color: INK } },
  { text: "— người dùng chuyển từ giấy sang điện tử không phải học lại; responsive cho báo sự cố trên điện thoại.", options: { fontSize: 13, color: MUTED } },
], { x: 0.85, y: 5.93, w: 11.7, h: 0.7, fontFace: FONT, margin: 0, valign: "top" });

/* ============ 11. KẾT QUẢ KIỂM THỬ (light) ============ */
s = p.addSlide();
s.background = { color: BG_LIGHT };
kicker(s, "Thử nghiệm end-to-end");
title(s, "10/10 kịch bản kiểm thử đạt");
s.addText("10/10", { x: 0.55, y: 1.95, w: 3.6, h: 1.5, fontSize: 72, bold: true, color: GOLD, fontFace: FONT, margin: 0 });
s.addText("kịch bản kiểm thử chính\nđạt trên hệ thống Docker thật", { x: 0.6, y: 3.5, w: 3.6, h: 0.8, fontSize: 14, color: MUTED, fontFace: FONT, margin: 0 });
s.addShape(p.shapes.LINE, { x: 4.45, y: 2.1, w: 0, h: 4.4, line: { color: LINE, width: 1 } });
const tests = [
  "Đăng nhập 4 vai trò — JWT đúng quyền, sai mật khẩu chặn 401",
  "Báo sự cố nhỏ → tự khắc phục → hồ sơ BM/02 tự ghi, KHÔNG phê duyệt",
  "Sự cố lớn → phương án thuê ngoài → Lãnh đạo Cục duyệt → thực hiện",
  "Nghiệm thu BM/04 đủ chữ ký → đóng sự cố, thiết bị về Hoạt động",
  "Kế hoạch năm 2026: lập 4 hạng mục → trình → duyệt → hoàn thành",
  "Nhắc lịch 07:00 hằng ngày + phân quyền chặn 403 + audit trail đầy đủ",
];
tests.forEach((t, i) => {
  const y = 2.0 + i * 0.75;
  s.addShape(p.shapes.OVAL, { x: 4.85, y: y + 0.08, w: 0.26, h: 0.26, fill: { color: "DFF0E4" } });
  s.addText("✓", { x: 4.85, y: y + 0.055, w: 0.26, h: 0.28, fontSize: 13, bold: true, color: "3E8E5A", align: "center", fontFace: FONT, margin: 0 });
  s.addText(t, { x: 5.3, y, w: 7.5, h: 0.55, fontSize: 14.5, color: INK, fontFace: FONT, margin: 0, valign: "middle" });
});
source(s, "Chi tiết 10 kịch bản: Bảng 7.1, Chương 7 báo cáo");

/* ============ 12. TRIỂN KHAI & DEMO (light) ============ */
s = p.addSlide();
s.background = { color: BG_LIGHT };
kicker(s, "Triển khai");
title(s, "Chạy bằng ba lệnh — deploy lên server chủ quản");
s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: 0.55, y: 1.95, w: 6.1, h: 2.6, rectRadius: 0.1, fill: { color: BG_DARK } });
s.addText([
  { text: "# khởi động toàn hệ thống\n", options: { color: "7E8C91" } },
  { text: "docker compose up -d --build\n\n", options: { color: "9FD3B0", breakLine: false } },
  { text: "# sao lưu định kỳ\n", options: { color: "7E8C91" } },
  { text: "docker exec qltt-db-1 pg_dump -U qltt qltt > backup.sql", options: { color: "9FD3B0" } },
], { x: 0.85, y: 2.2, w: 5.6, h: 2.1, fontSize: 13, fontFace: "Consolas", margin: 0, valign: "top" });
const ports = [["8080", "Cổng đơn vị sử dụng — báo sự cố, tra cứu, theo dõi"],
  ["8081", "Cổng quản trị — VP Cục, Lãnh đạo Cục, Ban QMS"],
  ["3001", "API trực tiếp — /api/v1/health"]];
ports.forEach(([pt, d], i) => {
  const y = 4.85 + i * 0.68;
  s.addText(pt, { x: 0.55, y, w: 1.0, h: 0.5, fontSize: 19, bold: true, color: GOLD, fontFace: FONT, margin: 0 });
  s.addText(d, { x: 1.7, y: y + 0.05, w: 4.9, h: 0.5, fontSize: 13, color: MUTED, fontFace: FONT, margin: 0 });
});
s.addShape(p.shapes.LINE, { x: 7.05, y: 2.1, w: 0, h: 4.4, line: { color: LINE, width: 1 } });
s.addText("TÀI KHOẢN DEMO — MẬT KHẨU Abc@12345", { x: 7.45, y: 2.1, w: 5.4, h: 0.3, fontSize: 12.5, bold: true, color: TEAL, charSpacing: 2, fontFace: FONT, margin: 0 });
const accs = [["vanphong", "Văn phòng Cục — quản trị nghiệp vụ"], ["lanhdao", "Lãnh đạo Cục — phê duyệt"], ["qms", "Ban QMS — giám sát, nhật ký"], ["dkt / qlct", "Đơn vị sử dụng — báo sự cố"]];
accs.forEach(([u, d], i) => {
  const y = 2.55 + i * 0.85;
  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x: 7.45, y, w: 5.35, h: 0.68, rectRadius: 0.08, fill: { color: WHITE }, line: { color: "C9D2D8", width: 1 } });
  s.addText([
    { text: u + "   ", options: { bold: true, fontSize: 14, color: INK, fontFace: "Consolas" } },
    { text: d, options: { fontSize: 12, color: MUTED } },
  ], { x: 7.7, y: y + 0.06, w: 4.9, h: 0.56, fontFace: FONT, margin: 0, valign: "middle" });
});
source(s, "Hướng dẫn chi tiết + biến môi trường: README.md và .env.example");

/* ============ 13. KẾT LUẬN (dark) ============ */
s = p.addSlide();
s.background = { color: BG_DARK };
s.addShape(p.shapes.OVAL, { x: -2.2, y: 4.4, w: 6.4, h: 6.4, fill: { color: "1A2E33" } });
s.addText("KẾT LUẬN", { x: 0.8, y: 0.75, w: 6, h: 0.35, fontSize: 13, bold: true, color: GOLD, charSpacing: 4, fontFace: FONT, margin: 0 });
s.addText("Từ quy trình giấy\nđến hệ thống chạy thật", { x: 0.8, y: 1.15, w: 11.7, h: 1.7, fontSize: 40, bold: true, color: WHITE, fontFace: FONT, margin: 0, lineSpacing: 50 });
const done = [
  ["Báo cáo 44 trang", "phân tích thiết kế chuẩn UML: use case, activity, class, sequence, state, ERD, deployment"],
  ["Nguyên mẫu hoàn chỉnh", "2 cổng giao diện + API + PostgreSQL + Docker — kiểm thử 10/10 đạt"],
  ["Truy vết hai chiều", "mỗi màn hình, endpoint, bảng CSDL đều tra ngược về điều khoản quy trình gốc"],
];
done.forEach(([h, d], i) => {
  const x = 0.8 + i * 4.05;
  s.addShape(p.shapes.ROUNDED_RECTANGLE, { x, y: 3.25, w: 3.75, h: 1.85, rectRadius: 0.1, fill: { color: "1C2B30" }, line: { color: "2A4048", width: 1 } });
  s.addText([
    { text: h + "\n", options: { bold: true, fontSize: 16, color: GOLD } },
    { text: d, options: { fontSize: 12.5, color: "AEBFC4" } },
  ], { x: x + 0.25, y: 3.45, w: 3.25, h: 1.5, fontFace: FONT, margin: 0, valign: "top" });
});
s.addText([
  { text: "Hướng phát triển:  ", options: { bold: true, color: WHITE, fontSize: 14 } },
  { text: "chữ ký số (NĐ 130/2020) · SSO/AD · mobile app đẩy thông báo · mở rộng CSHT · tích hợp hệ thống tài sản", options: { color: "AEBFC4", fontSize: 14 } },
], { x: 0.8, y: 5.5, w: 11.7, h: 0.5, fontFace: FONT, margin: 0 });
s.addShape(p.shapes.LINE, { x: 0.85, y: 6.35, w: 3.2, h: 0, line: { color: GOLD, width: 2.5 } });
s.addText("Cảm ơn thầy/cô và các bạn đã lắng nghe — sẵn sàng demo trực tiếp.", { x: 0.8, y: 6.55, w: 11.7, h: 0.4, fontSize: 15, color: "9FB3B8", fontFace: FONT, margin: 0 });

p.writeFile({ fileName: path.resolve(__dirname, "BTL-ET3161-Quan-ly-trang-thiet-bi.pptx") })
  .then((f) => console.log("written:", f));
