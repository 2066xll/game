-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_code TEXT UNIQUE NOT NULL,      -- 用户唯一编码
    nickname TEXT,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,        -- 密码哈希值
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    avatar_url TEXT,
    status TEXT DEFAULT 'active',        -- active, banned, deleted
    settings TEXT DEFAULT '{}'          -- JSON格式存储用户设置
);

-- 为用户表添加索引
CREATE INDEX IF NOT EXISTS idx_users_user_code ON users(user_code);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 聊天群组表
CREATE TABLE IF NOT EXISTS chat_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    creator_id INTEGER NOT NULL,         -- 创建者用户ID
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    group_id INTEGER NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    role TEXT DEFAULT 'member',          -- admin, moderator, member
    status TEXT DEFAULT 'active',        -- active, muted, banned
    last_read_message_id INTEGER,
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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',    -- text, image, link, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',       -- pending, accepted, blocked
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, friend_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (friend_id) REFERENCES users(id)
);

-- 为好友关系表添加索引
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);

-- 创建触发器以自动更新updated_at字段
CREATE TRIGGER IF NOT EXISTS update_users_updated_at
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS update_chat_groups_updated_at
AFTER UPDATE ON chat_groups
FOR EACH ROW
BEGIN
    UPDATE chat_groups SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS update_messages_updated_at
AFTER UPDATE ON messages
FOR EACH ROW
BEGIN
    UPDATE messages SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS update_friendships_updated_at
AFTER UPDATE ON friendships
FOR EACH ROW
BEGIN
    UPDATE friendships SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
