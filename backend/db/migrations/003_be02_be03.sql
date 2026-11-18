-- ============================================================
-- Migration 003: Nâng cấp BE-02 & BE-03
-- Tương thích 100% với Báo cáo Tuần 3 (Report Week 3)
-- Mục tiêu: hỗ trợ tra cứu QR/mã, báo hỏng không cần đăng nhập,
--           chống trùng lặp (request_id, active incident),
--           mã tra cứu tiến độ (lookup_code), và điều phối kỹ thuật.
-- ============================================================

-- ── equipment: thêm cột thời điểm khởi tạo QR ──────────────
ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS qr_generated_at TIMESTAMPTZ DEFAULT now();

-- Điền mặc định cho thiết bị đã được gán UUID
UPDATE equipment
   SET qr_generated_at = now()
 WHERE qr_code_uuid IS NOT NULL
   AND qr_generated_at IS NULL;

-- ── incidents: cho phép reported_by = NULL ───────────────────
-- (phục vụ chức năng báo hỏng nhanh qua QR không cần tài khoản - UC-03)
ALTER TABLE incidents
  ALTER COLUMN reported_by DROP NOT NULL;

-- ── incidents: bổ sung các cột theo đúng Báo cáo Tuần 3 ───────
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS reporter_name    VARCHAR(200),                          -- Họ tên người báo (UR-03)
  ADD COLUMN IF NOT EXISTS reporter_phone   VARCHAR(30),                           -- SĐT liên hệ người báo
  ADD COLUMN IF NOT EXISTS issue_type       VARCHAR(50),                           -- NGUON_DIEN | MAN_HINH | CO_KHI | PHAN_MEM | KHAC
  ADD COLUMN IF NOT EXISTS technician_id    INT,                                   -- Cán bộ kỹ thuật phụ trách (UC-04)
  ADD COLUMN IF NOT EXISTS resolution_notes TEXT,                                  -- Ghi chú phương án & kết quả xử lý
  ADD COLUMN IF NOT EXISTS source           VARCHAR(20) NOT NULL DEFAULT 'WEB_NOI_BO', -- QR_SCAN | WEB_NOI_BO
  ADD COLUMN IF NOT EXISTS detected_at      TIMESTAMPTZ,                           -- Thời điểm phát hiện sự cố (Mục 2.4.2)
  ADD COLUMN IF NOT EXISTS request_id       UUID,                                  -- Chống gửi lặp lại cùng thao tác (NFR-03, UC-03.A5.1)
  ADD COLUMN IF NOT EXISTS lookup_code      VARCHAR(64),                           -- Mã tra cứu tiến độ tối thiểu khó đoán (UC-03.5)
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ NOT NULL DEFAULT now();    -- Thời điểm cập nhật cuối

-- Đảm bảo request_id là duy nhất (nếu có giá trị)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_incidents_request_id'
  ) THEN
    ALTER TABLE incidents ADD CONSTRAINT uq_incidents_request_id UNIQUE (request_id);
  END IF;
END $$;

-- Khóa ngoại cán bộ kỹ thuật liên kết bảng users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_incidents_technician'
  ) THEN
    ALTER TABLE incidents
      ADD CONSTRAINT fk_incidents_technician FOREIGN KEY (technician_id) REFERENCES users(id);
  END IF;
END $$;

-- Index hỗ trợ tìm kiếm và bảng điều phối
CREATE INDEX IF NOT EXISTS idx_incident_technician  ON incidents(technician_id);
CREATE INDEX IF NOT EXISTS idx_incident_source      ON incidents(source);
CREATE INDEX IF NOT EXISTS idx_incident_lookup_code ON incidents(lookup_code);
CREATE INDEX IF NOT EXISTS idx_incident_updated     ON incidents(updated_at DESC);
