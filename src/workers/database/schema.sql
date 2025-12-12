-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,                 -- 使用UUID
    user_code TEXT UNIQUE NOT NULL,      -- 用户唯一编码
    nickname TEXT NOT NULL,              -- 个性化昵称
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,        -- 密码哈希值
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    last_login INTEGER,
    avatar_url TEXT,
    is_email_verified INTEGER DEFAULT 0, -- 0: 未验证, 1: 已验证
    deleted_at INTEGER,                  -- 软删除时间
    recovery_expire_at INTEGER,          -- 注销恢复期限
    status TEXT DEFAULT 'active',        -- active, banned, deleted
    settings TEXT DEFAULT '{}'          -- JSON格式存储用户设置
);

-- 为用户表添加索引
CREATE INDEX IF NOT EXISTS idx_users_user_code ON users(user_code);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 聊天群组表
CREATE TABLE IF NOT EXISTS chat_groups (
    id TEXT PRIMARY KEY,                 -- 使用UUID
    name TEXT NOT NULL,
    description TEXT,
    creator_id TEXT NOT NULL,            -- 创建者用户ID
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    status TEXT DEFAULT 'active',        -- active, archived, deleted
    is_private INTEGER DEFAULT 0,        -- 0: 公开, 1: 私有
    avatar_url TEXT,
    FOREIGN KEY (creator_id) REFERENCES users(id)
);

-- 为群组表添加索引
CREATE INDEX IF NOT EXISTS idx_chat_groups_creator_id ON chat_groups(creator_id);
CREATE INDEX IF NOT EXISTS idx_chat_groups_status ON chat_groups(status);

-- 用户-群组关系表
CREATE TABLE IF NOT EXISTS user_groups (
    id TEXT PRIMARY KEY,                 -- 使用UUID
    user_id TEXT NOT NULL,
    group_id TEXT NOT NULL,
    joined_at INTEGER DEFAULT (unixepoch()),
    role TEXT DEFAULT 'member',          -- admin, moderator, member
    status TEXT DEFAULT 'active',        -- active, muted, banned
    last_read_message_id TEXT,
    UNIQUE (user_id, group_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (group_id) REFERENCES chat_groups(id),
    FOREIGN KEY (last_read_message_id) REFERENCES messages(id)
);

-- 为用户-群组关系表添加索引
CREATE INDEX IF NOT EXISTS idx_user_groups_user_id ON user_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_group_id ON user_groups(group_id);

-- 消息表
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,                 -- 使用UUID
    group_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',    -- text, image, link, etc.
    assets TEXT DEFAULT '[]',            -- JSON数组，存储附件信息
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    status TEXT DEFAULT 'sent',          -- sent, delivered, read
    is_deleted INTEGER DEFAULT 0,        -- 0: 未删除, 1: 已删除
    FOREIGN KEY (group_id) REFERENCES chat_groups(id),
    FOREIGN KEY (sender_id) REFERENCES users(id)
);

-- 为消息表添加索引
CREATE INDEX IF NOT EXISTS idx_messages_group_id ON messages(group_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- 会话表（用于存储用户会话信息和Token管理）
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,                 -- 使用UUID
    user_id TEXT NOT NULL,
    token TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()),
    last_used INTEGER DEFAULT (unixepoch()),
    ip_address TEXT,
    user_agent TEXT,
    status TEXT DEFAULT 'active',        -- active, revoked, expired
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 为会话表添加索引
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- 好友关系表（可选，用于一对一聊天）
CREATE TABLE IF NOT EXISTS friendships (
    id TEXT PRIMARY KEY,                 -- 使用UUID
    user_id TEXT NOT NULL,
    friend_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',       -- pending, accepted, blocked
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    UNIQUE (user_id, friend_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (friend_id) REFERENCES users(id)
);

-- 为好友关系表添加索引
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);

-- 邮箱验证码表
CREATE TABLE IF NOT EXISTS email_verification_codes (
    id TEXT PRIMARY KEY,                 -- 使用UUID
    user_id TEXT,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    purpose TEXT NOT NULL,          -- bind, reset_password, change_email
    created_at INTEGER DEFAULT (unixepoch()),
    expires_at INTEGER NOT NULL,
    is_used INTEGER DEFAULT 0,      -- 0: 未使用, 1: 已使用
    attempt_count INTEGER DEFAULT 0,
    ip_address TEXT,
    user_agent TEXT,
    last_failed_at INTEGER,
    used_at INTEGER,
    failure_reason TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 为邮箱验证码表添加索引
CREATE INDEX IF NOT EXISTS idx_email_verification_codes_email ON email_verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_email_verification_codes_user_id ON email_verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_codes_expires_at ON email_verification_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_email_verification_codes_is_used ON email_verification_codes(is_used);
CREATE INDEX IF NOT EXISTS idx_email_verification_codes_last_failed_at ON email_verification_codes(last_failed_at);
CREATE INDEX IF NOT EXISTS idx_email_verification_codes_email_purpose ON email_verification_codes(email, purpose);

-- 安全事件日志表
CREATE TABLE IF NOT EXISTS security_events (
    id TEXT PRIMARY KEY,                 -- 使用UUID
    event_type TEXT NOT NULL,
    email TEXT,
    ip_address TEXT NOT NULL,
    user_id TEXT,
    details TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 为安全事件日志表添加索引
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_email ON security_events(email);
CREATE INDEX IF NOT EXISTS idx_security_events_ip_address ON security_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);

-- 请求频率限制表
CREATE TABLE IF NOT EXISTS rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expiry_time INTEGER NOT NULL
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_action ON rate_limits(identifier, action);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expiry_time ON rate_limits(expiry_time);
CREATE INDEX IF NOT EXISTS idx_rate_limits_created_at ON rate_limits(created_at);

-- 创建触发器以自动更新updated_at字段
CREATE TRIGGER IF NOT EXISTS update_users_updated_at
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = unixepoch() WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS update_chat_groups_updated_at
AFTER UPDATE ON chat_groups
FOR EACH ROW
BEGIN
    UPDATE chat_groups SET updated_at = unixepoch() WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS update_messages_updated_at
AFTER UPDATE ON messages
FOR EACH ROW
BEGIN
    UPDATE messages SET updated_at = unixepoch() WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS update_friendships_updated_at
AFTER UPDATE ON friendships
FOR EACH ROW
BEGIN
    UPDATE friendships SET updated_at = unixepoch() WHERE id = OLD.id;
END;
