/**
 * ==============================================================================
 * BỘ KIỂM THỬ ĐƠN VỊ (UNIT TEST SUITE) - CỤC QUẢN LÝ DƯỢC (QT.QLD.09.01)
 * Kiểm tra các hàm nghiệp vụ độc lập, kiểm thử giá trị biên, null, số âm,
 * ký tự đặc biệt, injection và bảo mật phân quyền.
 * ==============================================================================
 */

const assert = require('assert');
const {
  isValidUuid,
  isValidPhone,
  normalizeIssueType,
  generateLookupCode,
  formatNextSequence,
  canRestoreEquipmentStatus,
} = require('../src/utils/helpers');
const { authenticate, requireRole } = require('../src/middleware/auth');

let totalTests = 0;
let passedTests = 0;

function it(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✔ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ✖ [FAIL] ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

function describe(suiteName, fn) {
  console.log(`\n📦 ${suiteName}`);
  fn();
}

console.log('================================================================');
console.log('🧪 BẮT ĐẦU CHẠY UNIT TEST (KIỂM THỬ ĐƠN VỊ TỪNG FUNCTION)');
console.log('================================================================');

// -------------------------------------------------------------
// 1. UNIT TEST: isValidUuid
// -------------------------------------------------------------
describe('1. Hàm isValidUuid(val) - Kiểm định mã QR UUID của thiết bị', () => {
  it('Chấp nhận chuỗi UUID v4 chuẩn (chữ thường & hoa)', () => {
    assert.strictEqual(isValidUuid('11111111-2222-3333-4444-555555555555'), true);
    assert.strictEqual(isValidUuid('C0A80101-ABCD-1234-EF01-999988887777'), true);
    assert.strictEqual(isValidUuid('  c0a80101-abcd-1234-ef01-999988887777  '), true); // tự trim
  });

  it('Từ chối chuỗi rỗng, khoảng trắng, null, undefined', () => {
    assert.strictEqual(isValidUuid(''), false);
    assert.strictEqual(isValidUuid('   '), false);
    assert.strictEqual(isValidUuid(null), false);
    assert.strictEqual(isValidUuid(undefined), false);
  });

  it('Từ chối chuỗi sai độ dài hoặc chứa ký tự không phải hex', () => {
    assert.strictEqual(isValidUuid('11111111-2222-3333-4444'), false);
    assert.strictEqual(isValidUuid('11111111-2222-3333-4444-55555555555Z'), false); // Chứa Z
    assert.strictEqual(isValidUuid('TT-2021-001'), false); // Mã máy truyền thống không phải UUID
  });

  it('Chống crash khi nhận kiểu dữ liệu dị thường (số âm, object, SQL injection)', () => {
    assert.strictEqual(isValidUuid(-1), false);
    assert.strictEqual(isValidUuid(12345), false);
    assert.strictEqual(isValidUuid({ id: 'uuid' }), false);
    assert.strictEqual(isValidUuid(["uuid"]), false);
    assert.strictEqual(isValidUuid("' OR '1'='1"), false);
  });
});

// -------------------------------------------------------------
// 2. UNIT TEST: isValidPhone
// -------------------------------------------------------------
describe('2. Hàm isValidPhone(val) - Kiểm tra định dạng số điện thoại người báo', () => {
  it('Chấp nhận các đầu số di động hợp lệ tại Việt Nam', () => {
    assert.strictEqual(isValidPhone('0987654321'), true); // Viettel 098
    assert.strictEqual(isValidPhone('0903123456'), true); // MobiFone 090
    assert.strictEqual(isValidPhone('0888123456'), true); // VinaPhone 088
    assert.strictEqual(isValidPhone('0398765432'), true); // Viettel 039
    assert.strictEqual(isValidPhone('+84987654321'), true); // Mã quốc tế +84
    assert.strictEqual(isValidPhone('098 765 4321'), true); // Có dấu cách giữa các cụm
  });

  it('Từ chối khi đầu vào rỗng, null, undefined', () => {
    assert.strictEqual(isValidPhone(''), false);
    assert.strictEqual(isValidPhone(null), false);
    assert.strictEqual(isValidPhone(undefined), false);
  });

  it('Từ chối số điện thoại quá ngắn, quá dài hoặc chứa ký tự chữ', () => {
    assert.strictEqual(isValidPhone('09876'), false); // quá ngắn
    assert.strictEqual(isValidPhone('0987654321000'), false); // quá dài
    assert.strictEqual(isValidPhone('098abc4321'), false); // chứa chữ
    assert.strictEqual(isValidPhone('19001000'), false); // đầu số tổng đài
  });

  it('Chống crash khi nhận số âm hoặc kiểu dữ liệu bất thường', () => {
    assert.strictEqual(isValidPhone(-987654321), false);
    assert.strictEqual(isValidPhone({ phone: '0987' }), false);
  });
});

// -------------------------------------------------------------
// 3. UNIT TEST: normalizeIssueType
// -------------------------------------------------------------
describe('3. Hàm normalizeIssueType(raw) - Chuẩn hóa phân loại sự cố sang Enum', () => {
  it('Ánh xạ chính xác các từ khóa có dấu tiếng Việt thông dụng', () => {
    assert.strictEqual(normalizeIssueType('Kẹt giấy'), 'CO_KHI');
    assert.strictEqual(normalizeIssueType('kẹt giấy'), 'CO_KHI');
    assert.strictEqual(normalizeIssueType('cơ khí'), 'CO_KHI');
    assert.strictEqual(normalizeIssueType('Màn hình'), 'MAN_HINH');
    assert.strictEqual(normalizeIssueType('Nguồn điện'), 'NGUON_DIEN');
    assert.strictEqual(normalizeIssueType('Điện'), 'NGUON_DIEN');
    assert.strictEqual(normalizeIssueType('Phần mềm'), 'PHAN_MEM');
  });

  it('Giữ nguyên các Enum viết chuẩn không phân biệt hoa thường', () => {
    assert.strictEqual(normalizeIssueType('CO_KHI'), 'CO_KHI');
    assert.strictEqual(normalizeIssueType('nguon_dien'), 'NGUON_DIEN');
    assert.strictEqual(normalizeIssueType('   PHAN_MEM   '), 'PHAN_MEM');
  });

  it('Xử lý an toàn khi đầu vào rỗng, null, undefined -> Trả về "KHAC"', () => {
    assert.strictEqual(normalizeIssueType(''), 'KHAC');
    assert.strictEqual(normalizeIssueType('   '), 'KHAC');
    assert.strictEqual(normalizeIssueType(null), 'KHAC');
    assert.strictEqual(normalizeIssueType(undefined), 'KHAC');
  });

  it('Xử lý an toàn với giá trị ngoại lệ, số âm, script injection -> Trả về "KHAC"', () => {
    assert.strictEqual(normalizeIssueType(-999), 'KHAC');
    assert.strictEqual(normalizeIssueType('<script>alert(1)</script>'), 'KHAC');
    assert.strictEqual(normalizeIssueType('Lỗi không xác định lạ lùng'), 'KHAC');
  });
});

// -------------------------------------------------------------
// 4. UNIT TEST: generateLookupCode
// -------------------------------------------------------------
describe('4. Hàm generateLookupCode() - Sinh mã bí mật tra cứu tiến độ (UC-03.5)', () => {
  it('Luôn bắt đầu bằng tiền tố "TK-" và có đúng 11 ký tự', () => {
    const code = generateLookupCode();
    assert.strictEqual(code.startsWith('TK-'), true);
    assert.strictEqual(code.length, 11);
    assert.strictEqual(/^TK-[0-9A-F]{8}$/.test(code), true);
  });

  it('Độ ngẫu nhiên cao: Sinh 1,000 mã liên tiếp không xảy ra trùng lặp (Zero Collision)', () => {
    const set = new Set();
    const count = 1000;
    for (let i = 0; i < count; i++) {
      const c = generateLookupCode();
      assert.strictEqual(set.has(c), false, `Phát hiện mã trùng: ${c}`);
      set.add(c);
    }
    assert.strictEqual(set.size, count);
  });
});

// -------------------------------------------------------------
// 5. UNIT TEST: formatNextSequence
// -------------------------------------------------------------
describe('5. Hàm formatNextSequence(prefix, year, lastCode) - Quy tắc sinh mã tuần tự', () => {
  it('Tăng tuần tự khi đã có mã trước đó', () => {
    assert.strictEqual(formatNextSequence('SC', 2026, 'SC-2026-001'), 'SC-2026-002');
    assert.strictEqual(formatNextSequence('SC', 2026, 'SC-2026-009'), 'SC-2026-010');
    assert.strictEqual(formatNextSequence('SC', 2026, 'SC-2026-099'), 'SC-2026-100');
  });

  it('Khởi tạo mã đầu tiên 001 khi chưa có bản ghi (lastCode = null)', () => {
    assert.strictEqual(formatNextSequence('SC', 2026, null), 'SC-2026-001');
    assert.strictEqual(formatNextSequence('SC', 2026, undefined), 'SC-2026-001');
    assert.strictEqual(formatNextSequence('SC', 2026, ''), 'SC-2026-001');
  });

  it('Hỗ trợ các tiền tố khác nhau trong quy trình QT.QLD.09.01', () => {
    assert.strictEqual(formatNextSequence('BBNT', 2026, 'BBNT-2026-015'), 'BBNT-2026-016');
    assert.strictEqual(formatNextSequence('PA', 2026, null), 'PA-2026-001');
    assert.strictEqual(formatNextSequence('TT', 2026, 'TT-2026-150'), 'TT-2026-151');
  });

  it('Xử lý an toàn khi lastCode bị lỗi cú pháp chuỗi, không sinh ra NaN', () => {
    assert.strictEqual(formatNextSequence('SC', 2026, 'CORRUPTED_CODE'), 'SC-2026-001');
    assert.strictEqual(formatNextSequence('SC', 2026, 'SC-2026-abc'), 'SC-2026-001');
    assert.strictEqual(formatNextSequence('SC', 2026, 'SC-2026--5'), 'SC-2026-001'); // số âm
  });
});

// -------------------------------------------------------------
// 6. UNIT TEST: canRestoreEquipmentStatus
// -------------------------------------------------------------
describe('6. Hàm canRestoreEquipmentStatus(currentStatus, openIncidentCount) - Quy tắc phục hồi máy', () => {
  it('Cho phép phục hồi về HOAT_DONG khi số sự cố mở = 0 và máy không thanh lý', () => {
    assert.strictEqual(canRestoreEquipmentStatus('SU_CO', 0), true);
    assert.strictEqual(canRestoreEquipmentStatus('DANG_SUA', 0), true);
    assert.strictEqual(canRestoreEquipmentStatus('CHO_NGHIEM_THU', 0), true);
  });

  it('Không phục hồi khi vẫn còn ít nhất 1 sự cố đang mở', () => {
    assert.strictEqual(canRestoreEquipmentStatus('SU_CO', 1), false);
    assert.strictEqual(canRestoreEquipmentStatus('DANG_SUA', 3), false);
  });

  it('BẢO VỆ NGHIÊM NGẶT: Không bao giờ phục hồi máy đã NGUNG_SU_DUNG hoặc THANH_LY', () => {
    assert.strictEqual(canRestoreEquipmentStatus('NGUNG_SU_DUNG', 0), false);
    assert.strictEqual(canRestoreEquipmentStatus('THANH_LY', 0), false);
  });

  it('Xử lý an toàn khi số lượng là chuỗi, null, undefined hoặc số âm', () => {
    assert.strictEqual(canRestoreEquipmentStatus('SU_CO', '0'), true);
    assert.strictEqual(canRestoreEquipmentStatus('SU_CO', null), false);
    assert.strictEqual(canRestoreEquipmentStatus('SU_CO', -1), false);
    assert.strictEqual(canRestoreEquipmentStatus('SU_CO', 'invalid'), false);
  });
});

// -------------------------------------------------------------
// 7. UNIT TEST: authenticate & requireRole Middleware (Kiểm soát phân quyền RBAC)
// -------------------------------------------------------------
describe('7. Middleware Auth & requireRole - Kiểm định phân quyền truy cập quản trị', () => {
  it('Chặn 401 Unauthorized khi thiếu header Authorization', () => {
    const req = { headers: {} };
    let status = null;
    let body = null;
    const res = {
      status(code) { status = code; return this; },
      json(data) { body = data; return this; },
    };
    let nextCalled = false;
    authenticate(req, res, () => { nextCalled = true; });

    assert.strictEqual(status, 401);
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(body.error, 'Chưa đăng nhập (thiếu token)');
  });

  it('Chặn 403 Forbidden khi người dùng sai vai trò (Ví dụ DON_VI vào trang duyệt)', () => {
    const mw = requireRole('VAN_PHONG_CUC', 'LANH_DAO_CUC');
    const req = { user: { id: 10, role: 'DON_VI', name: 'Nhân viên đơn vị' } };
    let status = null;
    let body = null;
    const res = {
      status(code) { status = code; return this; },
      json(data) { body = data; return this; },
    };
    let nextCalled = false;
    mw(req, res, () => { nextCalled = true; });

    assert.strictEqual(status, 403);
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(body.error.includes('Không có quyền'), true);
  });

  it('Cho phép đi tiếp (next()) khi vai trò hợp lệ', () => {
    const mw = requireRole('VAN_PHONG_CUC', 'LANH_DAO_CUC');
    const req = { user: { id: 1, role: 'VAN_PHONG_CUC', name: 'Cán bộ quản lý' } };
    let nextCalled = false;
    const res = {};
    mw(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true);
  });
});

console.log('\n================================================================');
console.log(`🎉 TỔNG KẾT: ${passedTests}/${totalTests} UNIT TESTS THÀNH CÔNG 100%!`);
console.log('================================================================\n');
