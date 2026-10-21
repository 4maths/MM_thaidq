-- Định danh QR ổn định cho từng thiết bị; không thay đổi mã thiết bị hiện có.
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS qr_code_uuid UUID;

UPDATE equipment
   SET qr_code_uuid = gen_random_uuid()
 WHERE qr_code_uuid IS NULL;

ALTER TABLE equipment
  ALTER COLUMN qr_code_uuid SET DEFAULT gen_random_uuid(),
  ALTER COLUMN qr_code_uuid SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_equipment_qr_code_uuid
  ON equipment(qr_code_uuid);
