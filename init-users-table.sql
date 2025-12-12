-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_code TEXT UNIQUE NOT NULL,
    nickname TEXT,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    avatar_url TEXT,
    status TEXT DEFAULT 'active',
    settings TEXT DEFAULT '{}'
);

-- 为用户表添加索引
CREATE INDEX IF NOT EXISTS idx_users_user_code ON users(user_code);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 创建更新触发器
CREATE TRIGGER IF NOT EXISTS update_users_updated_at
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;