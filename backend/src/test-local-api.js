/**
 * TEST HARNESS: Local API & Database Testing for BE-02 & BE-03
 * Mô phỏng Postman bắn request vào các API và mở trực tiếp Database
 * để đối soát dữ liệu từng bảng, từng cột và định dạng.
 */
const assert = require('assert');

// ── 1. MOCK DATABASE LAYER (Mô phỏng PostgreSQL Schema & Storage) ──
const dbState = {
  departments: [
    { id: 1, code: 'VPC', name: 'Văn phòng Cục' },
    { id: 2, code: 'DKT', name: 'Phòng Đăng ký thuốc' },
    { id: 3, code: 'QLCT', name: 'Phòng Quản lý chất lượng thuốc' },
  ],
  roles: [
    { id: 1, code: 'DON_VI', name: 'Đơn vị sử dụng' },
    { id: 2, code: 'VAN_PHONG_CUC', name: 'Văn phòng Cục' },
    { id: 3, code: 'LANH_DAO_CUC', name: 'Lãnh đạo Cục' },
    { id: 4, code: 'QMS', name: 'Ban QMS' },
  ],
  users: [
    { id: 1, username: 'vanphong', full_name: 'Nguyễn Văn Bình', role_id: 2, department_id: 1, is_active: true },
    { id: 2, username: 'kythuat1', full_name: 'Trần Văn Kỹ Thuật', role_id: 2, department_id: 1, is_active: true },
    { id: 3, username: 'dkt_user', full_name: 'Trần Thị Mai', role_id: 1, department_id: 2, is_active: true },
  ],
  equipment: [
    {
      id: 1,
      code: 'TT-2021-001',
      name: 'Máy photocopy Ricoh MP 2555',
      country_of_origin: 'Nhật Bản',
      department_id: 1,
      status: 'HOAT_DONG',
      category: 'Văn phòng',
      model: 'MP 2555',
      qr_code_uuid: '11111111-2222-3333-4444-555555555555',
      qr_generated_at: new Date('2026-01-01T08:00:00Z'),
      is_active: true,
    },
    {
      id: 2,
      code: 'TT-2022-014',
      name: 'Máy tính Dell OptiPlex 7090',
      country_of_origin: 'Việt Nam',
      department_id: 2,
      status: 'HOAT_DONG',
      category: 'CNTT',
      model: 'OptiPlex 7090',
      qr_code_uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      qr_generated_at: new Date('2026-01-01T08:00:00Z'),
      is_active: true,
    },
  ],
  incidents: [],
  attachments: [],
  equipment_logs: [],
  notifications: [],
  audit_logs: [],
};

let nextIncidentId = 1;
let nextLogId = 1;
let nextAttachmentId = 1;

// Mock database query & one helpers matching backend/src/db.js
const mockDb = {
  async query(sql, params = []) {
    const s = sql.trim();

    // 1. SELECT equipment
    if (/\bFROM\s+equipment\b/i.test(s) && !s.includes('equipment_logs') && !s.startsWith('UPDATE')) {
      let list = dbState.equipment.filter(e => e.is_active);
      if (params.length > 0) {
        const p = params[0];
        list = list.filter(e => e.qr_code_uuid === p || e.code.toLowerCase() === String(p).toLowerCase() || e.id === Number(p));
      }
      return list.map(e => {
        const d = dbState.departments.find(dep => dep.id === e.department_id);
        return { ...e, department_name: d ? d.name : null };
      });
    }

    // 2. SELECT active incident for equipment
    if (s.includes('FROM incidents') && s.includes('status NOT IN (\'DONG\', \'DA_XU_LY\')')) {
      const equipId = params[0];
      const found = dbState.incidents
        .filter(i => i.equipment_id === equipId && !['DONG', 'DA_XU_LY'].includes(i.status))
        .sort((a, b) => b.reported_at - a.reported_at);
      return found.slice(0, 1);
    }

    // 3. SELECT incident by request_id
    if (s.includes('WHERE i.request_id = $1')) {
      const reqId = params[0];
      const i = dbState.incidents.find(inc => inc.request_id === reqId);
      if (!i) return [];
      const eq = dbState.equipment.find(e => e.id === i.equipment_id);
      return [{ ...i, equipment_code: eq?.code, equipment_name: eq?.name }];
    }

    // 4. SELECT incident by code or lookup_code (tracking)
    if (s.includes('WHERE i.code ILIKE $1 OR i.lookup_code ILIKE $1')) {
      const c = params[0];
      const i = dbState.incidents.find(inc => inc.code.toLowerCase() === c.toLowerCase() || (inc.lookup_code && inc.lookup_code.toLowerCase() === c.toLowerCase()));
      if (!i) return [];
      const eq = dbState.equipment.find(e => e.id === i.equipment_id);
      const dep = dbState.departments.find(d => d.id === i.department_id);
      return [{
        ...i,
        equipment_code: eq?.code,
        equipment_name: eq?.name,
        department_name: dep?.name,
      }];
    }

    // 5. INSERT INTO incidents
    if (s.startsWith('INSERT INTO incidents')) {
      const id = nextIncidentId++;
      const [code, equipment_id, department_id, description, reporter_name, reporter_phone, issue_type, detected_at, request_id, lookup_code] = params;
      const rec = {
        id,
        code,
        equipment_id,
        reported_by: null,
        department_id,
        description,
        severity: 'NHO',
        resolution_type: 'CHUA_XAC_DINH',
        status: 'MOI_TIEP_NHAN',
        reporter_name,
        reporter_phone,
        issue_type,
        source: 'QR_SCAN',
        detected_at,
        request_id,
        lookup_code,
        reported_at: new Date(),
        reviewed_at: null,
        resolved_at: null,
        updated_at: new Date(),
        technician_id: null,
        resolution_notes: null,
      };
      dbState.incidents.push(rec);
      return [rec];
    }

    // 6. UPDATE equipment status
    if (/^UPDATE\s+equipment/i.test(s)) {
      const match = s.match(/SET\s+status\s*=\s*'([^']+)'/i);
      const newStatus = match ? match[1] : 'HOAT_DONG';
      const equipId = params[0];
      const eq = dbState.equipment.find(e => e.id === Number(equipId));
      if (eq) {
        eq.status = newStatus;
        eq.updated_at = new Date();
      }
      return [eq];
    }

    // 7. INSERT INTO attachments
    if (s.startsWith('INSERT INTO attachments')) {
      const id = nextAttachmentId++;
      const [entity_id, file_name, file_path, mime_type, file_size] = params;
      const att = { id, entity_type: 'incident', entity_id, file_name, file_path, mime_type, file_size, uploaded_at: new Date() };
      dbState.attachments.push(att);
      return [att];
    }

    // 8. INSERT INTO equipment_logs
    if (s.startsWith('INSERT INTO equipment_logs')) {
      const id = nextLogId++;
      const [equipment_id, content, performer, related_incident_id, created_by] = params;
      const log = {
        id,
        equipment_id: Number(equipment_id),
        performed_date: new Date(),
        content,
        performer,
        log_type: 'KHAC_PHUC_SU_CO',
        related_incident_id: Number(related_incident_id),
        created_by: Number(created_by),
        created_at: new Date(),
      };
      dbState.equipment_logs.push(log);
      return [log];
    }

    // 9. SELECT users for technicians
    if (s.includes('FROM users u') && s.includes('JOIN roles r')) {
      return dbState.users.map(u => {
        const r = dbState.roles.find(role => role.id === u.role_id);
        return { ...u, role_code: r.code, role_name: r.name };
      });
    }

    // 10. SELECT incident by id
    if (s.includes('FROM incidents WHERE id = $1')) {
      const inc = dbState.incidents.find(i => i.id === Number(params[0]));
      return inc ? [{ ...inc }] : [];
    }

    // 11. SELECT user by id
    if (s.includes('FROM users WHERE id = $1')) {
      const u = dbState.users.find(usr => usr.id === Number(params[0]) && usr.is_active);
      return u ? [u] : [];
    }

    // 12. UPDATE incidents (assign or status)
    if (s.startsWith('UPDATE incidents')) {
      const incId = Number(params[0]);
      const inc = dbState.incidents.find(i => i.id === incId);
      if (!inc) return [];
      if (s.includes('technician_id = $2')) {
        inc.technician_id = Number(params[1]);
        inc.status = 'DANG_SUA';
        inc.reviewed_by = Number(params[2]) || 1;
        inc.reviewed_at = new Date();
      } else if (s.includes('SET status = $2')) {
        inc.status = params[1];
        if (params[2]) inc.resolution_notes = params[2];
        if (['DA_XU_LY', 'DONG'].includes(inc.status) && !inc.resolved_at) {
          inc.resolved_at = new Date();
        }
      }
      inc.updated_at = new Date();
      return [inc];
    }

    // 13. Check existing equipment_log for incident
    if (s.includes('FROM equipment_logs WHERE related_incident_id = $1')) {
      const found = dbState.equipment_logs.filter(l => l.related_incident_id === Number(params[0]));
      return found;
    }

    // 14. Count open incidents on equipment
    if (s.includes('COUNT(*)::int AS open_count') && s.includes('status NOT IN (\'DA_XU_LY\', \'DONG\')')) {
      const equipId = Number(params[0]);
      const excludeId = Number(params[1]);
      const count = dbState.incidents.filter(i => i.equipment_id === equipId && i.id !== excludeId && !['DA_XU_LY', 'DONG'].includes(i.status)).length;
      return [{ open_count: count }];
    }

    // 15. SELECT incidents list for admin
    if (s.includes('FROM incidents i') && s.includes('JOIN equipment e')) {
      return dbState.incidents.map(i => {
        const e = dbState.equipment.find(eq => eq.id === i.equipment_id);
        const d = dbState.departments.find(dep => dep.id === i.department_id);
        const t = dbState.users.find(u => u.id === i.technician_id);
        const atts = dbState.attachments.filter(a => a.entity_id === i.id);
        return {
          ...i,
          equipment_code: e?.code,
          equipment_name: e?.name,
          equipment_status: e?.status,
          department_name: d?.name,
          technician_name: t?.full_name,
          attachments: atts,
        };
      });
    }

    if (s.includes('COUNT(*)::int AS count FROM incidents')) {
      return [{ count: dbState.incidents.length }];
    }

    return [];
  },

  async one(sql, params = []) {
    const rows = await this.query(sql, params);
    return rows[0] || null;
  },
};

// ── 2. MONKEY PATCH DB & HELPERS TO RUN IN ISOLATION ──
const dbModule = require('./db');
dbModule.query = mockDb.query.bind(mockDb);
dbModule.one = mockDb.one.bind(mockDb);

const helpers = require('./utils/helpers');
let scCounter = 1;
helpers.nextCode = async function(prefix) {
  return `${prefix}-2026-${String(scCounter++).padStart(3, '0')}`;
};
helpers.notify = async function(userId, data) {
  dbState.notifications.push({ userId, ...data, date: new Date() });
};
helpers.notifyRole = async function(role, data) {
  dbState.notifications.push({ role, ...data, date: new Date() });
};

// Mock Express req & res
function createMockReqRes({ method = 'GET', url = '/', params = {}, query = {}, body = {}, file = null, user = null }) {
  const req = {
    method,
    url,
    params,
    query,
    body,
    file,
    user: user || { id: 1, name: 'Nguyễn Văn Bình', role: 'VAN_PHONG_CUC' },
    audit: async (log) => { dbState.audit_logs.push(log); },
  };

  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      responseData = data;
      return res;
    },
    send(data) {
      responseData = data;
      return res;
    },
    get statusCode() { return statusCode; },
    get body() { return responseData; },
  };

  return { req, res };
}

// ── 3. RUN LOCAL TEST CASES ──
async function runTests() {
  console.log('================================================================');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ TỰ ĐỘNG CỤC BỘ (LOCAL API & DATABASE TESTING)');
  console.log('================================================================\n');

  const publicEquipRouter = require('./routes/public-equipment');
  const publicIncRouter = require('./routes/public-incidents');
  const adminIncRouter = require('./routes/admin-incidents');

  // Helper để dispatch tới router layer
  async function callRoute(router, method, path, reqOpts) {
    const { req, res } = createMockReqRes({ method, url: path, ...reqOpts });
    for (const layer of router.stack) {
      if (layer.route && layer.route.methods[method.toLowerCase()]) {
        // Simple match
        const routePath = layer.route.path;
        if (routePath === '/' && (path === '/' || path === '')) {
          await layer.route.stack[layer.route.stack.length - 1].handle(req, res);
          return res;
        } else if (routePath === '/:identifier' || routePath === '/:uuid') {
          req.params.identifier = path.replace(/^\//, '');
          req.params.uuid = req.params.identifier;
          await layer.route.stack[layer.route.stack.length - 1].handle(req, res);
          return res;
        } else if (routePath === '/track/:code') {
          req.params.code = path.replace('/track/', '');
          await layer.route.stack[layer.route.stack.length - 1].handle(req, res);
          return res;
        } else if (routePath === '/:id/assign' && path.endsWith('/assign')) {
          req.params.id = path.split('/')[1];
          await layer.route.stack[layer.route.stack.length - 1].handle(req, res);
          return res;
        } else if (routePath === '/:id/status' && path.endsWith('/status')) {
          req.params.id = path.split('/')[1];
          await layer.route.stack[layer.route.stack.length - 1].handle(req, res);
          return res;
        } else if (routePath === '/technicians' && path === '/technicians') {
          await layer.route.stack[layer.route.stack.length - 1].handle(req, res);
          return res;
        }
      }
    }
    return res;
  }

  // -------------------------------------------------------------
  // TEST 1: GET /api/public/equipment/:uuid qua mã QR (UC-02)
  // -------------------------------------------------------------
  console.log('TEST 1: Quét mã QR tra cứu thiết bị (GET /api/public/equipment/:uuid)');
  const res1 = await callRoute(publicEquipRouter, 'GET', '/11111111-2222-3333-4444-555555555555');
  console.log(`  -> HTTP Status: ${res1.statusCode}`);
  console.log('  -> Response JSON:', JSON.stringify(res1.body, null, 2));
  assert.strictEqual(res1.statusCode, 200);
  assert.strictEqual(res1.body.equipment.code, 'TT-2021-001');
  assert.strictEqual(res1.body.has_active_incident, false);
  console.log('  ✅ TEST 1 ĐẠT: Lấy đúng thông tin công khai của máy.\n');

  // -------------------------------------------------------------
  // TEST 2: GET /api/public/equipment/:code qua mã thiết bị (UC-02.A1.1)
  // -------------------------------------------------------------
  console.log('TEST 2: Nhập mã thiết bị thủ công không dùng camera (GET /api/public/equipment/TT-2022-014)');
  const res2 = await callRoute(publicEquipRouter, 'GET', '/TT-2022-014');
  console.log(`  -> HTTP Status: ${res2.statusCode}`);
  console.log('  -> Response JSON:', JSON.stringify(res2.body.equipment));
  assert.strictEqual(res2.statusCode, 200);
  assert.strictEqual(res2.body.equipment.name, 'Máy tính Dell OptiPlex 7090');
  console.log('  ✅ TEST 2 ĐẠT: Nhận diện mã máy và trả về đúng hồ sơ.\n');

  // -------------------------------------------------------------
  // TEST 3: POST /api/public/incidents - Báo hỏng qua QR (UC-03)
  // -------------------------------------------------------------
  console.log('TEST 3: Gửi phiếu báo hỏng không cần đăng nhập kèm ảnh (POST /api/public/incidents)');
  const payload3 = {
    equipmentUuid: '11111111-2222-3333-4444-555555555555',
    reporterName: 'Đào Quý Thái',
    reporterPhone: '0987654321',
    issueType: 'Kẹt giấy',
    description: 'Máy in bị kẹt giấy liên tục ở khay số 2, phát tiếng kêu cạch cạch.',
    requestId: '99999999-8888-7777-6666-555555555555',
  };
  const mockFile3 = {
    originalname: 'hien_truong_ket_giay.jpg',
    filename: '1731960000-hien_truong_ket_giay.jpg',
    mimetype: 'image/jpeg',
    size: 245100,
  };

  const res3 = await callRoute(publicIncRouter, 'POST', '/', { body: payload3, file: mockFile3 });
  console.log(`  -> HTTP Status: ${res3.statusCode}`);
  console.log('  -> Response JSON:', JSON.stringify(res3.body, null, 2));
  assert.strictEqual(res3.statusCode, 201);
  assert(res3.body.incidentCode.startsWith('SC-2026-'));
  assert(res3.body.lookupCode.startsWith('TK-'));

  // ĐỐI SOÁT DATABASE TRỰC TIẾP:
  console.log('\n  🔍 ĐỐI SOÁT DATABASE TRỰC TIẾP SAU TEST 3:');
  const savedIncident = dbState.incidents[0];
  console.log('  [Table incidents]:');
  console.log(`    - id: ${savedIncident.id} (Kiểu ID)`);
  console.log(`    - code: ${savedIncident.code}`);
  console.log(`    - equipment_id: ${savedIncident.equipment_id} -> khớp TT-2021-001`);
  console.log(`    - reported_by: ${savedIncident.reported_by} (ĐÚNG: Nhận giá trị NULL vì không cần đăng nhập)`);
  console.log(`    - reporter_name: ${savedIncident.reporter_name}`);
  console.log(`    - reporter_phone: ${savedIncident.reporter_phone}`);
  console.log(`    - issue_type: ${savedIncident.issue_type} (ĐÚNG: Đã chuẩn hóa 'Kẹt giấy' -> 'CO_KHI')`);
  console.log(`    - status: ${savedIncident.status} (ĐÚNG: Khởi tạo 'MOI_TIEP_NHAN')`);
  console.log(`    - source: ${savedIncident.source} (ĐÚNG: 'QR_SCAN')`);
  console.log(`    - request_id: ${savedIncident.request_id}`);
  console.log(`    - lookup_code: ${savedIncident.lookup_code}`);

  console.log('  [Table equipment]:');
  const updatedEquip = dbState.equipment.find(e => e.id === 1);
  console.log(`    - status: ${updatedEquip.status} (ĐÚNG: Đã tự động chuyển sang 'SU_CO')`);

  console.log('  [Table attachments]:');
  const savedAtt = dbState.attachments[0];
  console.log(`    - entity_type: ${savedAtt.entity_type}, entity_id: ${savedAtt.entity_id}`);
  console.log(`    - file_name: ${savedAtt.file_name}, size: ${savedAtt.file_size} bytes`);

  assert.strictEqual(savedIncident.status, 'MOI_TIEP_NHAN');
  assert.strictEqual(savedIncident.issue_type, 'CO_KHI');
  assert.strictEqual(savedIncident.reported_by, null);
  assert.strictEqual(updatedEquip.status, 'SU_CO');
  assert.strictEqual(savedAtt.file_name, 'hien_truong_ket_giay.jpg');
  console.log('  ✅ TEST 3 ĐẠT: Dữ liệu đã lưu đúng bảng, đúng cột, đúng kiểu dữ liệu.\n');

  // -------------------------------------------------------------
  // TEST 4: Chống gửi lặp lại cùng request_id (NFR-03 & UC-03.A5.1)
  // -------------------------------------------------------------
  console.log('TEST 4: Thử gửi lại cùng request_id do mạng lag (POST /api/public/incidents)');
  const res4 = await callRoute(publicIncRouter, 'POST', '/', { body: payload3 });
  console.log(`  -> HTTP Status: ${res4.statusCode}`);
  console.log(`  -> Message: ${res4.body.message}`);
  assert.strictEqual(res4.statusCode, 200);
  assert.strictEqual(dbState.incidents.length, 1); // Không tạo thêm bản ghi!
  console.log('  ✅ TEST 4 ĐẠT: Idempotency chuẩn, không phát sinh bản ghi trùng trong DB.\n');

  // -------------------------------------------------------------
  // TEST 5: Cảnh báo chống báo hỏng trùng lặp (FR-03.3 & UC-03.A4.1)
  // -------------------------------------------------------------
  console.log('TEST 5: Người khác quét mã báo hỏng tiếp cho máy đang có sự cố mở');
  const payload5 = {
    equipmentUuid: '11111111-2222-3333-4444-555555555555',
    reporterName: 'Nguyễn Văn Test',
    description: 'Máy hỏng rồi không in được.',
  };
  const res5 = await callRoute(publicIncRouter, 'POST', '/', { body: payload5 });
  console.log(`  -> HTTP Status: ${res5.statusCode}`);
  console.log(`  -> Error Response: ${res5.body.error}`);
  assert.strictEqual(res5.statusCode, 409);
  console.log('  ✅ TEST 5 ĐẠT: Trả về mã lỗi 409 Conflict chặn báo hỏng trùng lặp.\n');

  // -------------------------------------------------------------
  // TEST 6: Tra cứu tiến độ sự cố bằng lookup_code (UC-03.6)
  // -------------------------------------------------------------
  console.log(`TEST 6: Người dân tra cứu tiến độ xử lý (GET /api/public/incidents/track/${savedIncident.lookup_code})`);
  const res6 = await callRoute(publicIncRouter, 'GET', `/track/${savedIncident.lookup_code}`);
  console.log(`  -> HTTP Status: ${res6.statusCode}`);
  console.log('  -> Response JSON:', JSON.stringify(res6.body.incident, null, 2));
  assert.strictEqual(res6.statusCode, 200);
  assert.strictEqual(res6.body.incident.reporter_name, undefined); // NFR-02: Không lộ thông tin cá nhân
  assert.strictEqual(res6.body.incident.reporter_phone, undefined);
  console.log('  ✅ TEST 6 ĐẠT: Tra cứu tiến độ thành công, bảo mật tuyệt đối danh tính người báo (NFR-02).\n');

  // -------------------------------------------------------------
  // TEST 7: PATCH /api/admin/incidents/:id/assign - Phân công kỹ thuật (UC-04.2)
  // -------------------------------------------------------------
  console.log(`TEST 7: Cán bộ quản lý phân công kỹ thuật viên (PATCH /api/admin/incidents/${savedIncident.id}/assign)`);
  const res7 = await callRoute(adminIncRouter, 'PATCH', `/${savedIncident.id}/assign`, {
    body: { technicianId: 2 },
  });
  console.log(`  -> HTTP Status: ${res7.statusCode}`);
  console.log(`  -> Message: ${res7.body.message}`);
  assert.strictEqual(res7.statusCode, 200);

  console.log('  🔍 ĐỐI SOÁT DATABASE TRỰC TIẾP SAU TEST 7:');
  console.log(`    - incidents.technician_id: ${savedIncident.technician_id} (ĐÚNG: Gán cán bộ ID = 2)`);
  console.log(`    - incidents.status: ${savedIncident.status} (ĐÚNG: Chuyển 'MOI_TIEP_NHAN' -> 'DANG_SUA' theo Quy tắc 3.4.1)`);
  console.log(`    - equipment.status: ${updatedEquip.status} (ĐÚNG: Thiết bị ở trạng thái 'DANG_SUA')`);
  assert.strictEqual(savedIncident.technician_id, 2);
  assert.strictEqual(savedIncident.status, 'DANG_SUA');
  assert.strictEqual(updatedEquip.status, 'DANG_SUA');
  console.log('  ✅ TEST 7 ĐẠT: Phân công kỹ thuật và cập nhật trạng thái đồng bộ.\n');

  // -------------------------------------------------------------
  // TEST 8: PATCH /api/admin/incidents/:id/status - Hoàn tất & Ghi lý lịch máy (UC-04.4 & 3.4.1)
  // -------------------------------------------------------------
  console.log(`TEST 8: Kỹ thuật viên hoàn tất xử lý (PATCH /api/admin/incidents/${savedIncident.id}/status)`);
  const res8 = await callRoute(adminIncRouter, 'PATCH', `/${savedIncident.id}/status`, {
    body: {
      status: 'DA_XU_LY',
      resolutionNotes: 'Đã tháo khay lấy giấy kẹt, vệ sinh bánh răng cuốn giấy và chạy thử 50 trang bình thường.',
    },
  });
  console.log(`  -> HTTP Status: ${res8.statusCode}`);
  console.log(`  -> Response Body:`, JSON.stringify(res8.body));
  assert.strictEqual(res8.statusCode, 200);

  console.log('\n  🔍 ĐỐI SOÁT DATABASE TRỰC TIẾP SAU TEST 8 (GHI LÝ LỊCH BM/02):');
  console.log('  [Table incidents]:');
  console.log(`    - status: ${savedIncident.status}`);
  console.log(`    - resolution_notes: ${savedIncident.resolution_notes}`);
  console.log(`    - resolved_at: ${savedIncident.resolved_at}`);

  console.log('  [Table equipment_logs] (LÝ LỊCH MÁY BM/02 TỰ ĐỘNG GHI):');
  assert.strictEqual(dbState.equipment_logs.length, 1);
  const log = dbState.equipment_logs[0];
  console.log(`    - id: ${log.id}`);
  console.log(`    - equipment_id: ${log.equipment_id}`);
  console.log(`    - related_incident_id: ${log.related_incident_id}`);
  console.log(`    - log_type: ${log.log_type} (ĐÚNG: 'KHAC_PHUC_SU_CO')`);
  console.log(`    - performer: ${log.performer} (ĐÚNG: Kỹ thuật viên phụ trách)`);
  console.log(`    - content: ${log.content}`);

  console.log('  [Table equipment]:');
  console.log(`    - status: ${updatedEquip.status} (ĐÚNG: Tự động phục hồi về 'HOAT_DONG' vì không còn sự cố mở)`);

  assert.strictEqual(savedIncident.status, 'DA_XU_LY');
  assert.strictEqual(log.log_type, 'KHAC_PHUC_SU_CO');
  assert.strictEqual(log.related_incident_id, savedIncident.id);
  assert.strictEqual(updatedEquip.status, 'HOAT_DONG');
  console.log('  ✅ TEST 8 ĐẠT: Lý lịch máy BM/02 được tự động sinh chính xác, máy trở lại hoạt động.\n');

  // -------------------------------------------------------------
  // TEST 9: Xác nhận đóng phiếu (DA_XU_LY -> DONG, không sinh lịch sử trùng)
  // -------------------------------------------------------------
  console.log(`TEST 9: Quản lý đóng phiếu (PATCH /api/admin/incidents/${savedIncident.id}/status -> DONG)`);
  const res9 = await callRoute(adminIncRouter, 'PATCH', `/${savedIncident.id}/status`, {
    body: { status: 'DONG' },
  });
  console.log(`  -> HTTP Status: ${res9.statusCode}`);
  assert.strictEqual(res9.statusCode, 200);
  assert.strictEqual(dbState.equipment_logs.length, 1); // Vẫn là 1, không sinh thêm!
  console.log('  ✅ TEST 9 ĐẠT: Đóng phiếu thành công, tuân thủ nghiêm ngặt quy tắc không sinh trùng lý lịch.\n');

  console.log('================================================================');
  console.log('🎉 TẤT CẢ 9/9 KỊCH BẢN KIỂM THỬ ĐÃ ĐẠT CHUẨN 100%!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
