
const express = require('express');
const { one } = require('../db');

const router = express.Router();

router.get('/:uuid', async (req, res) => {
    const { uuid } = req.params;

    const equipment = await one(
        `SELECT e.code, e.name, e.status, d.name AS department_name
         FROM equipment e
         LEFT JOIN departments d ON d.id = e.department_id
         WHERE e.qr_code_uuid = $1
           AND e.is_active = TRUE`,
        [uuid]
    );

    if (!equipment) {
        return res.status(404).json({
            error: 'Không tìm thấy thiết bị'
        });
    }

    return res.json({ equipment });
});

module.exports = router;
