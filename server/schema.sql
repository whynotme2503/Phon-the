-- Bảng dữ liệu cho máy chủ tài khoản. Dán cả file này vào ô Console của D1 rồi chạy một lần.

CREATE TABLE IF NOT EXISTS accounts (
  code      TEXT PRIMARY KEY,            -- mã đăng nhập, ví dụ HP-7K2M-9QX4
  name      TEXT NOT NULL DEFAULT '',    -- tên học viên, để giáo viên dễ nhận
  pw_hash   TEXT NOT NULL,               -- mật khẩu đã băm PBKDF2-SHA256
  pw_salt   TEXT NOT NULL,
  created   INTEGER NOT NULL,
  last_seen INTEGER NOT NULL DEFAULT 0,
  visits    INTEGER NOT NULL DEFAULT 0,
  active    INTEGER NOT NULL DEFAULT 1,  -- 0 là tạm dừng
  note      TEXT NOT NULL DEFAULT '',
  fails     INTEGER NOT NULL DEFAULT 0,  -- số lần sai mật khẩu liên tiếp
  fail_at   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS progress (
  code    TEXT PRIMARY KEY,
  json    TEXT NOT NULL,                 -- toàn bộ tiến độ, đúng dạng web đang lưu
  t       INTEGER NOT NULL,              -- mốc thời gian của bản tiến độ
  words   INTEGER NOT NULL DEFAULT 0,    -- số từ đã nắm, để giáo viên xem nhanh
  days    INTEGER NOT NULL DEFAULT 0,    -- số ngày đã hoàn thành
  updated INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS visit_log (
  code TEXT NOT NULL,
  day  TEXT NOT NULL,                    -- dạng YYYY-MM-DD theo UTC
  n    INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (code, day)
);

CREATE INDEX IF NOT EXISTS visit_log_day ON visit_log (day);
CREATE INDEX IF NOT EXISTS accounts_created ON accounts (created);
