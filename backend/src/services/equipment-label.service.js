const PDFDocument = require('pdfkit');
const path = require('path');
const config = require('../config');
const { one, query } = require('../db');
const { generateEquipmentQR } = require('./qr.service');

const MM = 72 / 25.4;
const TEMPLATE = {
  DECAL_A4_30: {
    pageWidth: 210 * MM,
    pageHeight: 297 * MM,
    labelWidth: 60 * MM,
    labelHeight: 25 * MM,
    marginLeft: 9 * MM,
    marginTop: 10 * MM,
    gapX: 6 * MM,
    gapY: 3 * MM,
    columns: 3,
    rows: 10,
  },
};

async function getEquipmentForQr(id) {
  return one(
    `SELECT e.id, e.code, e.name, e.status, e.department_id, e.qr_code_uuid,
            d.name AS department_name
       FROM equipment e
       LEFT JOIN departments d ON d.id = e.department_id
      WHERE e.id = $1`,
    [id]
  );
}

async function createQrPng(equipment) {
    if (!equipment || !equipment.qr_code_uuid) {
        const error = new Error('Thiết bị chưa có QR UUID');
        error.status = 400;
        throw error;
    }

    return generateEquipmentQR(equipment.qr_code_uuid);
}

function drawLabel(doc, equipment, qrPng, x, y, layout) {
  const { labelWidth, labelHeight } = layout;
  const pad = 2.2 * MM;
  const qrSize = 17 * MM;

  // Đường viền xám nhạt hỗ trợ căn chỉnh khi in thử trên giấy thường.
  doc.save();
  doc.lineWidth(0.35).strokeColor('#B8B8B8').rect(x, y, labelWidth, labelHeight).stroke();
  doc.restore();

  doc.image(qrPng, x + pad, y + (labelHeight - qrSize) / 2, { width: qrSize, height: qrSize });

  const textX = x + pad + qrSize + 1.6 * MM;
  const textWidth = labelWidth - (textX - x) - pad;
  const name = String(equipment.name || '').trim();
  const code = String(equipment.code || '').trim();
  const department = String(equipment.department_name || '').trim();

  doc.font('NotoSans-Bold').fontSize(7.5).fillColor('#111111')
    .text(code, textX, y + 3.1 * MM, { width: textWidth, height: 3.4 * MM, ellipsis: true, lineBreak: false });
  doc.font('NotoSans').fontSize(6.5).fillColor('#222222')
    .text(name, textX, y + 7.4 * MM, { width: textWidth, height: 6.4 * MM, ellipsis: true, lineBreak: false });
  if (department) {
    doc.font('NotoSans').fontSize(5.5).fillColor('#555555')
      .text(department, textX, y + 15.1 * MM, { width: textWidth, height: 4.2 * MM, ellipsis: true, lineBreak: false });
  }
}

async function createLabelsPdf(equipmentRows, templateType = 'DECAL_A4_30') {
  const layout = TEMPLATE[templateType];
  if (!layout) {
    const error = new Error(`Mẫu tem không được hỗ trợ: ${templateType}`);
    error.status = 400;
    throw error;
  }

  const qrImages = await Promise.all(equipmentRows.map((equipment) => createQrPng(equipment)));
  const fontRegular = path.join(__dirname, '..', '..', 'assets', 'fonts', 'NotoSans-Regular.ttf');
  const fontBold = path.join(__dirname, '..', '..', 'assets', 'fonts', 'NotoSans-Bold.ttf');
  const doc = new PDFDocument({
    size: [layout.pageWidth, layout.pageHeight],
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
    autoFirstPage: true,
    compress: true,
    info: { Title: 'Tem nhãn QR thiết bị', Author: 'Hệ thống quản lý trang thiết bị' },
  });
  doc.registerFont('NotoSans', fontRegular);
  doc.registerFont('NotoSans-Bold', fontBold);

  const chunks = [];
  const pdfPromise = new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  equipmentRows.forEach((equipment, index) => {
    if (index > 0 && index % (layout.columns * layout.rows) === 0) doc.addPage();
    const slot = index % (layout.columns * layout.rows);
    const col = slot % layout.columns;
    const row = Math.floor(slot / layout.columns);
    const x = layout.marginLeft + col * (layout.labelWidth + layout.gapX);
    const y = layout.marginTop + row * (layout.labelHeight + layout.gapY);
    drawLabel(doc, equipment, qrImages[index], x, y, layout);
  });

  doc.end();
  return pdfPromise;
}

async function getEquipmentRowsByIds(ids) {
  return query(
    `SELECT e.id, e.code, e.name, e.status, e.department_id, e.qr_code_uuid,
            d.name AS department_name
       FROM equipment e
       LEFT JOIN departments d ON d.id = e.department_id
      WHERE e.id = ANY($1::int[])
      ORDER BY array_position($1::int[], e.id)`,
    [ids]
  );
}

module.exports = {
    createQrPng,
    createLabelsPdf,
    getEquipmentForQr,
    getEquipmentRowsByIds,
};