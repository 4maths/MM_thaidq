-- ============================================================
-- Hệ thống quản lý trang thiết bị — Cục Quản lý Dược (QT.QLD.09.01)
-- Migration 001: tạo toàn bộ schema
-- Quy ước: các trường có chú thích "[mở rộng]" là bổ sung so với
-- biểu mẫu giấy gốc (nguyên bản BM/01..04 không có) — tách bạch khi
-- viết báo cáo giữa "bám quy trình" và "đề xuất cải tiến".
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Danh mục chung ----------
CREATE TABLE departments (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(30)  UNIQUE NOT NULL,          -- VPC, PDKT, PQLCT...
    name        VARCHAR(200) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE roles (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(30)  UNIQUE NOT NULL,          -- DON_VI | VAN_PHONG_CUC | LANH_DAO_CUC | QMS | NHA_THAU
    name        VARCHAR(100) NOT NULL
);

CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(200) NOT NULL,
    email         VARCHAR(200),
    phone         VARCHAR(30),
    role_id       INT NOT NULL REFERENCES roles(id),
    department_id INT REFERENCES departments(id),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- BM.QLD.09.01/01 — Danh mục trang thiết bị ----------
-- Cột gốc: STT | Tên trang thiết bị | Mã số | Nước sản xuất | Ngày nhận | Đơn vị sử dụng
CREATE TABLE equipment (
    id                SERIAL PRIMARY KEY,
    code              VARCHAR(50)  UNIQUE NOT NULL,           -- Mã số
    name              VARCHAR(200) NOT NULL,                  -- Tên trang thiết bị
    country_of_origin VARCHAR(100),                           -- Nước sản xuất
    received_date     DATE,                                   -- Ngày nhận
    department_id     INT REFERENCES departments(id),         -- Đơn vị sử dụng
    -- [mở rộng] phục vụ theo dõi vòng đời + lọc/tìm kiếm
    status            VARCHAR(30)  NOT NULL DEFAULT 'HOAT_DONG',
                      -- HOAT_DONG | SU_CO | DANG_SUA | DANG_BAO_DUONG | NGUNG_SU_DUNG | THANH_LY
    category          VARCHAR(100),                           -- nhóm thiết bị
    model             VARCHAR(100),
    serial_number     VARCHAR(100),
    notes             TEXT,
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_equipment_dept   ON equipment(department_id);
CREATE INDEX idx_equipment_status ON equipment(status);

-- ---------- BM.QLD.09.01/02 — Hồ sơ trang thiết bị ----------
-- Bảng lịch sử: STT | Ngày thực hiện | Nội dung bảo trì, sửa chữa | Người thực hiện
-- Một dòng = một bản ghi lịch sử; gắn vào thiết bị để dựng timeline.
CREATE TABLE equipment_logs (
    id                   SERIAL PRIMARY KEY,
    equipment_id         INT NOT NULL REFERENCES equipment(id),
    performed_date       DATE NOT NULL,                    -- Ngày thực hiện
    content              TEXT NOT NULL,                    -- Nội dung bảo trì, sửa chữa
    performer            VARCHAR(200) NOT NULL,            -- Người thực hiện
    log_type             VARCHAR(30)  NOT NULL,            -- [mở rộng] BAO_DUONG | SUA_CHUA | THAY_THE | KHAC_PHUC_SU_CO
    related_incident_id  INT,                              -- [mở rộng] truy vết nguồn gốc bản ghi
    related_plan_item_id INT,                              -- [mở rộng] truy vết kế hoạch
    created_by           INT REFERENCES users(id),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_equip_log_equipment ON equipment_logs(equipment_id, performed_date DESC);

-- ---------- BM.QLD.09.01/03 — Kế hoạch bảo dưỡng, thay thế trang thiết bị ----------
-- Header (1 bản/năm): "Năm …" + chữ ký Văn phòng Cục / Lãnh đạo Cục
CREATE TABLE maintenance_plans (
    id           SERIAL PRIMARY KEY,
    year         INT NOT NULL UNIQUE,
    status       VARCHAR(30) NOT NULL DEFAULT 'NHAP',
                 -- NHAP | CHO_DUYET | DA_DUYET | TU_CHOI | DANG_THUC_HIEN | HOAN_THANH
    submitted_at TIMESTAMPTZ,
    approved_by  INT REFERENCES users(id),
    approved_at  TIMESTAMPTZ,
    approval_note TEXT,
    created_by   INT REFERENCES users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dòng kế hoạch: STT | Tên TT | Mã số | Đơn vị sử dụng | Nội dung |
--                Đơn vị thực hiện (nội bộ/bên ngoài) | Thời gian dự kiến (tháng) | Ghi chú
CREATE TABLE maintenance_plan_items (
    id              SERIAL PRIMARY KEY,
    plan_id         INT NOT NULL REFERENCES maintenance_plans(id) ON DELETE CASCADE,
    equipment_id    INT NOT NULL REFERENCES equipment(id),
    department_id   INT REFERENCES departments(id),
    content         TEXT NOT NULL,                        -- Nội dung
    executor_type   VARCHAR(20) NOT NULL,                 -- NOI_BO | BEN_NGOAI
    planned_month   INT CHECK (planned_month BETWEEN 1 AND 12),  -- Thời gian dự kiến (tháng)
    -- [mở rộng] quản trị tiến độ & chi phí (nguyên bản không có)
    estimated_cost  NUMERIC(15,0),
    priority        VARCHAR(20) DEFAULT 'BINH_THUONG',    -- CAO | BINH_THUONG | THAP
    status          VARCHAR(30) NOT NULL DEFAULT 'CHO_THUC_HIEN',
                    -- CHO_THUC_HIEN | DANG_THUC_HIEN | HOAN_THANH | TRE_TIEN_DO
    completion_date DATE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_plan_item_plan ON maintenance_plan_items(plan_id);
CREATE INDEX idx_plan_item_equip ON maintenance_plan_items(equipment_id);

-- ---------- Nhà thầu bên ngoài [mở rộng] ----------
CREATE TABLE vendors (
    id             SERIAL PRIMARY KEY,
    name           VARCHAR(200) NOT NULL,
    tax_code       VARCHAR(30),
    address        VARCHAR(300),
    phone          VARCHAR(30),
    email          VARCHAR(200),
    contact_person VARCHAR(200),
    notes          TEXT,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------- Sự cố (luồng 6.2.3b) ----------
CREATE TABLE incidents (
    id              SERIAL PRIMARY KEY,
    code            VARCHAR(30) UNIQUE NOT NULL,          -- [mở rộng] SC-2026-001
    equipment_id    INT NOT NULL REFERENCES equipment(id),
    reported_by     INT NOT NULL REFERENCES users(id),    -- người báo (đơn vị sử dụng)
    department_id   INT REFERENCES departments(id),
    description     TEXT NOT NULL,                        -- mô tả sự cố / nguy cơ sự cố
    severity        VARCHAR(20) NOT NULL DEFAULT 'NHO',   -- [mở rộng] NHO | LON | NGUY_CO
                    -- RẺ nhánh 6.2.3b: NHO → "Tự khắc phục"; LON/NGUY_CO → "Lập phương án"
    resolution_type VARCHAR(20) NOT NULL DEFAULT 'CHUA_XAC_DINH',
                    -- TU_KHAC_PHUC | THUE_NGOAI | NOI_BO
    status          VARCHAR(30) NOT NULL DEFAULT 'MOI',
                    -- MOI | DANG_XEM_XET | CHO_DUYET | TU_CHOI | DANG_SUA |
                    -- CHO_NGHIEM_THU | DA_XU_LY | DONG
    reported_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by     INT REFERENCES users(id),             -- Văn phòng Cục xem xét
    reviewed_at     TIMESTAMPTZ,
    resolved_at     TIMESTAMPTZ,
    notes           TEXT
);

CREATE INDEX idx_incident_status ON incidents(status);
CREATE INDEX idx_incident_equip  ON incidents(equipment_id);

-- Phương án sửa chữa (lập bởi Văn phòng Cục, trình Lãnh đạo Cục phê duyệt)
CREATE TABLE repair_plans (
    id             SERIAL PRIMARY KEY,
    incident_id    INT NOT NULL REFERENCES incidents(id),
    content        TEXT NOT NULL,                          -- phương án sửa chữa
    vendor_id      INT REFERENCES vendors(id),             -- [mở rộng] nhà thầu đề xuất
    estimated_cost NUMERIC(15,0),                          -- [mở rộng]
    status         VARCHAR(30) NOT NULL DEFAULT 'CHO_DUYET',
                   -- CHO_DUYET | DA_DUYET | TU_CHOI | DANG_THUC_HIEN | HOAN_THANH
    submitted_at   TIMESTAMPTZ,
    approved_by    INT REFERENCES users(id),
    approved_at    TIMESTAMPTZ,
    approval_note  TEXT,
    created_by     INT REFERENCES users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- BM.QLD.09.01/04 — Biên bản nghiệm thu ----------
-- "Bên B đã thực hiện ... các nội dung công việc sau" + "Tình trạng hoạt động ... sau khi Bên B thực hiện"
CREATE TABLE acceptance_records (
    id                        SERIAL PRIMARY KEY,
    code                      VARCHAR(30) UNIQUE NOT NULL, -- [mở rộng] BBNT-2026-001
    incident_id               INT REFERENCES incidents(id),
    repair_plan_id            INT REFERENCES repair_plans(id),
    plan_item_id              INT REFERENCES maintenance_plan_items(id),
    work_done                 TEXT NOT NULL,               -- nội dung đã thực hiện
    equipment_condition_after TEXT NOT NULL,               -- tình trạng sau thực hiện
    accepted_date             DATE NOT NULL,               -- "Hôm nay, ngày… tháng… năm…"
    copies_count              INT NOT NULL DEFAULT 2,      -- "lập thành 02 bản, mỗi bên giữ 01 bản"
    status                    VARCHAR(20) NOT NULL DEFAULT 'MOI',  -- MOI | DA_KY
    equipment_id              INT REFERENCES equipment(id),-- truy vết nhanh
    created_by                INT REFERENCES users(id),
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Đại diện hai bên: Bên A (Cục QLD) 2 người, Bên B (Công ty) 2 người
CREATE TABLE acceptance_representatives (
    id             SERIAL PRIMARY KEY,
    acceptance_id  INT NOT NULL REFERENCES acceptance_records(id) ON DELETE CASCADE,
    side           CHAR(1) NOT NULL CHECK (side IN ('A','B')),
    full_name      VARCHAR(200) NOT NULL,                  -- "Ông (bà): …"
    organization   VARCHAR(200),                           -- "Đơn vị: …"
    signed         BOOLEAN NOT NULL DEFAULT FALSE,         -- [mở rộng] ký điện tử
    signed_at      TIMESTAMPTZ
);

-- ---------- Đính kèm [mở rộng] ----------
CREATE TABLE attachments (
    id          SERIAL PRIMARY KEY,
    entity_type VARCHAR(30) NOT NULL,   -- equipment | incident | acceptance | plan | plan_item
    entity_id   INT NOT NULL,
    file_name   VARCHAR(255) NOT NULL,
    file_path   VARCHAR(500) NOT NULL,
    mime_type   VARCHAR(100),
    file_size   BIGINT,
    uploaded_by INT REFERENCES users(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attach_entity ON attachments(entity_type, entity_id);

-- ---------- Thông báo / nhắc lịch [mở rộng] ----------
CREATE TABLE notifications (
    id         SERIAL PRIMARY KEY,
    user_id    INT NOT NULL REFERENCES users(id),
    title      VARCHAR(255) NOT NULL,
    body       TEXT,
    type       VARCHAR(30),          -- NHAC_BAO_DUONG | PH_DUYET | SU_CO | HE_THONG
    link       VARCHAR(300),
    is_read    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Nhật ký thao tác (audit trail, append-only) ----------
-- Phục vụ kiểm soát tài liệu ISO 9001:2015: không sửa/xóa dữ liệu lịch sử.
CREATE TABLE audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    user_id     INT REFERENCES users(id),
    action      VARCHAR(50) NOT NULL,   -- CREATE | UPDATE | APPROVE | REJECT | SUBMIT | LOGIN | ...
    entity_type VARCHAR(30) NOT NULL,
    entity_id   INT,
    old_values  JSONB,
    new_values  JSONB,
    ip_address  VARCHAR(45),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ràng buộc truy vết hồ sơ thiết bị (sửa tên khóa ngoại sau khi bảng tồn tại)
ALTER TABLE equipment_logs
    ADD CONSTRAINT fk_equip_log_incident FOREIGN KEY (related_incident_id) REFERENCES incidents(id),
    ADD CONSTRAINT fk_equip_log_plan_item FOREIGN KEY (related_plan_item_id) REFERENCES maintenance_plan_items(id);
