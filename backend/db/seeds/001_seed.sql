-- ============================================================
-- Seed data — dữ liệu mẫu theo quy trình QT.QLD.09.01
-- Mật khẩu chung của toàn bộ tài khoản mẫu: Abc@12345
-- ============================================================

-- Vai trò (map mục 4. TRÁCH NHIỆM của quy trình)
INSERT INTO roles (code, name) VALUES
 ('DON_VI',        'Đơn vị sử dụng'),
 ('VAN_PHONG_CUC', 'Văn phòng Cục'),
 ('LANH_DAO_CUC',  'Lãnh đạo Cục'),
 ('QMS',           'Ban QMS'),
 ('NHA_THAU',      'Nhà thầu bên ngoài');

-- Đơn vị (rút từ trang "NƠI NHẬN" của quy trình)
INSERT INTO departments (code, name) VALUES
 ('VPC',    'Văn phòng Cục'),
 ('KHTC',   'Phòng Kế hoạch - Tài chính'),
 ('PHC',    'Phòng Pháp chế & Hội nhập'),
 ('QHKD',   'Phòng Quản lý kinh doanh dược'),
 ('DKT',    'Phòng Đăng ký thuốc'),
 ('QLCT',   'Phòng Quản lý chất lượng thuốc'),
 ('GLT',    'Phòng Quản lý giá thuốc'),
 ('QCTC',   'Phòng Quản lý thông tin quảng cáo thuốc'),
 ('QMP',    'Phòng Quản lý mỹ phẩm'),
 ('TTDMP',  'Phòng Thanh tra Dược & Mỹ phẩm'),
 ('TTDT',   'Trung tâm đào tạo và hỗ trợ doanh nghiệp dược & mỹ phẩm');

-- Người dùng mẫu (mỗi vai trò ít nhất 1 tài khoản)
INSERT INTO users (username, password_hash, full_name, email, role_id, department_id) VALUES
 ('vanphong',  crypt('Abc@12345', gen_salt('bf', 10)), 'Nguyễn Văn Bình',   'vanphong@cucqld.gov.vn', (SELECT id FROM roles WHERE code='VAN_PHONG_CUC'), (SELECT id FROM departments WHERE code='VPC')),
 ('lanhdao',   crypt('Abc@12345', gen_salt('bf', 10)), 'Vũ Tuấn Cường',     'lanhdao@cucqld.gov.vn',  (SELECT id FROM roles WHERE code='LANH_DAO_CUC'),  (SELECT id FROM departments WHERE code='VPC')),
 ('qms',       crypt('Abc@12345', gen_salt('bf', 10)), 'Nguyễn Tất Đạt',    'qms@cucqld.gov.vn',      (SELECT id FROM roles WHERE code='QMS'),           (SELECT id FROM departments WHERE code='VPC')),
 ('dkt',       crypt('Abc@12345', gen_salt('bf', 10)), 'Trần Thị Mai',      'dkt@cucqld.gov.vn',      (SELECT id FROM roles WHERE code='DON_VI'),        (SELECT id FROM departments WHERE code='DKT')),
 ('qlct',      crypt('Abc@12345', gen_salt('bf', 10)), 'Lê Phương',         'qlct@cucqld.gov.vn',     (SELECT id FROM roles WHERE code='DON_VI'),        (SELECT id FROM departments WHERE code='QLCT')),
 ('nathau',    crypt('Abc@12345', gen_salt('bf', 10)), 'Công ty Điện máy ABC', 'contact@abc.vn',       (SELECT id FROM roles WHERE code='NHA_THAU'),      NULL);

-- BM/01 — Danh mục trang thiết bị (mẫu theo định nghĩa 5.1: máy tính, máy in, photocopy, điện thoại, điều hòa...)
INSERT INTO equipment (code, name, country_of_origin, received_date, department_id, status, category, model) VALUES
 ('TT-2021-001', 'Máy photocopy Ricoh MP 2555',   'Nhật Bản', '2021-03-15', (SELECT id FROM departments WHERE code='VPC'),   'HOAT_DONG', 'Văn phòng', 'MP 2555'),
 ('TT-2022-014', 'Máy tính Dell OptiPlex 7090',   'Việt Nam', '2022-06-01', (SELECT id FROM departments WHERE code='DKT'),   'HOAT_DONG', 'CNTT',      'OptiPlex 7090'),
 ('TT-2022-015', 'Máy in HP LaserJet Pro M404dn','Việt Nam', '2022-06-01', (SELECT id FROM departments WHERE code='DKT'),   'HOAT_DONG', 'CNTT',      'M404dn'),
 ('TT-2023-007', 'Điều hòa Daikin FTKA35',        'Thái Lan', '2023-04-20', (SELECT id FROM departments WHERE code='QLCT'),  'HOAT_DONG', 'Điện lạnh', 'FTKA35'),
 ('TT-2020-003', 'Điện thoại IP Yealink T31P',    'Trung Quốc','2020-01-10',(SELECT id FROM departments WHERE code='KHTC'),  'SU_CO',     'Viễn thông','T31P'),
 ('TT-2019-021', 'Máy chiếu Epson EB-X49',        'Philippines','2019-11-05',(SELECT id FROM departments WHERE code='TTDT'), 'DANG_SUA',  'Hội thảo',  'EB-X49');

-- BM/02 — Hồ sơ trang thiết bị (lịch sử)
INSERT INTO equipment_logs (equipment_id, performed_date, content, performer, log_type, created_by) VALUES
 ((SELECT id FROM equipment WHERE code='TT-2021-001'), '2025-06-10', 'Thay gạt mực, vệ sinh cụm sấy, bảo dưỡng định kỳ 6 tháng.', 'Kỹ thuật viên Công ty ABC', 'BAO_DUONG', (SELECT id FROM users WHERE username='vanphong')),
 ((SELECT id FROM equipment WHERE code='TT-2023-007'), '2025-09-02', 'Vệ sinh dàn nóng, nạp thêm gas R32, kiểm tra áp suất.', 'Tổ vận hành Cục', 'BAO_DUONG', (SELECT id FROM users WHERE username='vanphong')),
 ((SELECT id FROM equipment WHERE code='TT-2020-003'), '2026-08-30', 'Khắc phục sự cố mất nguồn: thay adapter 5V/1.2A.', 'Trần Thị Mai', 'KHAC_PHUC_SU_CO', (SELECT id FROM users WHERE username='dkt'));

-- BM/03 — Kế hoạch bảo dưỡng, thay thế trang thiết bị năm 2026
INSERT INTO maintenance_plans (year, status, submitted_at, approved_by, approved_at, created_by) VALUES
 (2026, 'DA_DUYET', '2026-01-05 09:00+07', (SELECT id FROM users WHERE username='lanhdao'), '2026-01-08 10:30+07', (SELECT id FROM users WHERE username='vanphong'));

INSERT INTO maintenance_plan_items (plan_id, equipment_id, department_id, content, executor_type, planned_month, estimated_cost, priority, status) VALUES
 ((SELECT id FROM maintenance_plans WHERE year=2026), (SELECT id FROM equipment WHERE code='TT-2021-001'), (SELECT id FROM departments WHERE code='VPC'),  'Bảo dưỡng định kỳ: vệ sinh, thay linh kiện tiêu hao (gạt mực, trống in)', 'BEN_NGOAI', 6, 3500000, 'BINH_THUONG', 'HOAN_THANH'),
 ((SELECT id FROM maintenance_plans WHERE year=2026), (SELECT id FROM equipment WHERE code='TT-2023-007'), (SELECT id FROM departments WHERE code='QLCT'), 'Bảo dưỡng điều hòa trước mùa hè: vệ sinh dàn nóng/lạnh, kiểm tra gas',     'NOI_BO',    4, 800000,   'BINH_THUONG', 'HOAN_THANH'),
 ((SELECT id FROM maintenance_plans WHERE year=2026), (SELECT id FROM equipment WHERE code='TT-2019-021'), (SELECT id FROM departments WHERE code='TTDT'), 'Thay bóng đèn chiếu/projector lamp, kiểm tra quạt tản nhiệt',              'BEN_NGOAI', 9, 4200000,  'CAO',         'CHO_THUC_HIEN'),
 ((SELECT id FROM maintenance_plans WHERE year=2026), (SELECT id FROM equipment WHERE code='TT-2022-014'), (SELECT id FROM departments WHERE code='DKT'),  'Nâng cấp RAM 16GB, thay SSD 512GB cho máy tính làm việc',                  'NOI_BO',    11, 6000000, 'THAP',        'CHO_THUC_HIEN');

-- Nhà thầu
INSERT INTO vendors (name, tax_code, address, phone, email, contact_person) VALUES
 ('Công ty TNHH Dịch vụ Điện máy ABC', '0101234567', '138A Giảng Võ, Ba Đình, Hà Nội', '024-3736-1234', 'service@abc.vn', 'Nguyễn Hoàng'),
 ('Công ty CP Bảo trì Văn phòng XYZ',  '0109876543', '25 Tôn Thất Tùng, Đống Đa, Hà Nội', '024-3821-5678', 'contact@xyz.vn', 'Phạm Lan');

-- Sự cố mẫu (luồng 6.2.3b)
INSERT INTO incidents (code, equipment_id, reported_by, department_id, description, severity, resolution_type, status, reported_at, reviewed_by, reviewed_at) VALUES
 ('SC-2026-001', (SELECT id FROM equipment WHERE code='TT-2020-003'), (SELECT id FROM users WHERE username='dkt'),     (SELECT id FROM departments WHERE code='KHTC'), 'Điện thoại IP không lên nguồn, màn hình tối hoàn toàn.', 'NHO', 'TU_KHAC_PHUC', 'DONG',           '2026-08-28 08:30+07', (SELECT id FROM users WHERE username='vanphong'), '2026-08-28 09:10+07'),
 ('SC-2026-002', (SELECT id FROM equipment WHERE code='TT-2019-021'), (SELECT id FROM users WHERE username='qlct'),    (SELECT id FROM departments WHERE code='TTDT'), 'Máy chiếu chớp hình ảnh, quạt phát tiếng ồn lớn khi hoạt động.', 'LON', 'THUE_NGOAI',   'CHO_NGHIEM_THU', '2026-09-05 14:00+07', (SELECT id FROM users WHERE username='vanphong'), '2026-09-06 09:00+07');

-- Phương án sửa chữa thuê ngoài (đã duyệt)
INSERT INTO repair_plans (incident_id, content, vendor_id, estimated_cost, status, submitted_at, approved_by, approved_at, created_by) VALUES
 ((SELECT id FROM incidents WHERE code='SC-2026-002'), 'Gửi máy về trung tâm bảo hành: thay bóng đèn projecto, vệ sinh quạt tản nhiệt, kiểm tra mainboard. Thời gian dự kiến 5 ngày làm việc.', (SELECT id FROM vendors WHERE name LIKE 'Công ty TNHH Dịch vụ Điện máy ABC'), 4200000, 'DANG_THUC_HIEN', '2026-09-06 10:00+07', (SELECT id FROM users WHERE username='lanhdao'), '2026-09-07 08:30+07', (SELECT id FROM users WHERE username='vanphong'));

-- BM/04 — Biên bản nghiệm thu mẫu (2 đại diện mỗi bên)
INSERT INTO acceptance_records (code, incident_id, repair_plan_id, equipment_id, work_done, equipment_condition_after, accepted_date, status, created_by) VALUES
 ('BBNT-2026-001', (SELECT id FROM incidents WHERE code='SC-2026-002'), (SELECT id FROM repair_plans WHERE id=1), (SELECT id FROM equipment WHERE code='TT-2019-021'),
  'Thay bóng đèn projecto Epson ELPLP78, vệ sinh quạt tản nhiệt, kiểm tra mainboard và chạy thử 2 giờ liên tục.',
  'Máy chiếu hoạt động ổn định, hình ảnh rõ, không còn tiếng ồn bất thường.', '2026-09-15', 'DA_KY', (SELECT id FROM users WHERE username='vanphong'));

INSERT INTO acceptance_representatives (acceptance_id, side, full_name, organization, signed, signed_at) VALUES
 ((SELECT id FROM acceptance_records WHERE code='BBNT-2026-001'), 'A', 'Nguyễn Văn Bình', 'Văn phòng Cục - Cục Quản lý Dược', TRUE, '2026-09-15 10:00+07'),
 ((SELECT id FROM acceptance_records WHERE code='BBNT-2026-001'), 'A', 'Lê Phương',       'Trung tâm đào tạo - Cục Quản lý Dược', TRUE, '2026-09-15 10:00+07'),
 ((SELECT id FROM acceptance_records WHERE code='BBNT-2026-001'), 'B', 'Nguyễn Hoàng',    'Công ty TNHH Dịch vụ Điện máy ABC', TRUE, '2026-09-15 10:00+07'),
 ((SELECT id FROM acceptance_records WHERE code='BBNT-2026-001'), 'B', 'Phạm Lan',        'Công ty TNHH Dịch vụ Điện máy ABC', TRUE, '2026-09-15 10:00+07');

-- Nhật ký thao tác mẫu
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values) VALUES
 ((SELECT id FROM users WHERE username='lanhdao'), 'APPROVE', 'maintenance_plan', 1, '{"year": 2026, "status": "DA_DUYET"}'::jsonb),
 ((SELECT id FROM users WHERE username='vanphong'), 'CREATE', 'acceptance_record', 1, '{"code": "BBNT-2026-001"}'::jsonb);
