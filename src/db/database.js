const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const crypto = require('crypto');

let db;

// API Key 加密相关
const ENCRYPTION_KEY = (process.env.JWT_SECRET || 'dev-secret-key-change-in-production').slice(0, 32).padEnd(32, '0');
const IV_LENGTH = 16;

function encryptApiKey(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptApiKey(text) {
    try {
        const parts = text.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = Buffer.from(parts[1], 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        return null;
    }
}

async function getDb() {
    if (db) {
        return db;
    }

    const dbPath = path.join(__dirname, '../../data', 'database.sqlite');

    db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    // 创建表
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            avatar TEXT,
            avatar_file TEXT,
            settings TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login DATETIME,
            password_changed_at DATETIME
        );

        CREATE TABLE IF NOT EXISTS login_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            ip TEXT,
            user_agent TEXT,
            login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS login_attempts (
            identifier TEXT PRIMARY KEY,
            attempts INTEGER DEFAULT 0,
            last_attempt INTEGER,
            locked_until INTEGER
        );

        CREATE TABLE IF NOT EXISTS api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            provider TEXT NOT NULL,
            encrypted_key TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, provider),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            email TEXT NOT NULL,
            expires_at INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS image_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            prompt TEXT,
            negative_prompt TEXT,
            image_path TEXT,
            params TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    `);

    // 添加可能缺失的列（兼容已有数据库）
    const columns = await db.all("PRAGMA table_info(users)");
    const columnNames = columns.map(c => c.name);

    if (!columnNames.includes('avatar_file')) {
        await db.exec('ALTER TABLE users ADD COLUMN avatar_file TEXT');
    }
    if (!columnNames.includes('password_changed_at')) {
        await db.exec('ALTER TABLE users ADD COLUMN password_changed_at DATETIME');
    }

    return db;
}

module.exports = { getDb, encryptApiKey, decryptApiKey };
