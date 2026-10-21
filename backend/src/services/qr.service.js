const QRCode = require('qrcode');
const config = require('../config');

function publicEquipmentUrl(uuid) {
    const base = String(
        config.publicEquipmentBaseUrl ||
        'http://localhost:3000/api/public/equipment'
    ).replace(/\/+$/, '');

    return `${base}/${encodeURIComponent(uuid)}`;
}

async function generateEquipmentQR(uuid) {
    if (!uuid || typeof uuid !== 'string' || !uuid.trim()) {
        const error = new Error('UUID thiết bị không hợp lệ');
        error.status = 400;
        throw error;
    }

    return QRCode.toBuffer(publicEquipmentUrl(uuid.trim()), {
        type: 'png',
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 512,
        color: {
            dark: '#000000',
            light: '#FFFFFF',
        },
    });
}

module.exports = {
    generateEquipmentQR,
    publicEquipmentUrl,
};
