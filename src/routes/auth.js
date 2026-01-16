const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getDb } = require('../db/database');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimit');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const RESET_TOKEN_EXPIRY = 30 * 60 * 1000; // 30 分钟

// 账户锁定相关
const loginAttempts = new Map();
const LOCK_TIME = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function getLoginAttempts(identifier) {
    const record = loginAttempts.get(identifier);
    if (!record) return { attempts: 0, lockedUntil: null };
    if (record.lockedUntil && Date.now() > record.lockedUntil) {
        loginAttempts.delete(identifier);
        return { attempts: 0, lockedUntil: null };
    }
    return record;
}

function recordFailedLogin(identifier) {
    const record = getLoginAttempts(identifier);
    record.attempts++;
    record.lastAttempt = Date.now();
    if (record.attempts >= MAX_ATTEMPTS) {
        record.lockedUntil = Date.now() + LOCK_TIME;
    }
    loginAttempts.set(identifier, record);
    return record;
}

function clearLoginAttempts(identifier) {
    loginAttempts.delete(identifier);
}

function isAccountLocked(identifier) {
    const record = getLoginAttempts(identifier);
    if (record.lockedUntil && Date.now() < record.lockedUntil) {
        return { locked: true, remainingMinutes: Math.ceil((record.lockedUntil - Date.now()) / 60000) };
    }
    return { locked: false };
}

// 用户名保留词
const RESERVED_USERNAMES = [
    'admin', 'administrator', 'root', 'system', 'support', 'help',
    'moderator', 'mod', 'staff', 'official', 'aihub', 'ai-hub',
    'api', 'www', 'mail', 'email', 'test', 'demo', 'null', 'undefined',
    'anonymous', 'guest', 'user', 'login', 'logout', 'register', 'signup',
    'signin', 'account', 'profile', 'settings', 'config', 'admin123'
];

// 验证函数
function validateUsername(username) {
    const errors = [];
    if (username.length < 2 || username.length > 20) errors.push('用户名长度应为 2-20 个字符');
    if (!/^[\u4e00-\u9fa5a-zA-Z0-9_]+$/.test(username)) errors.push('用户名只能包含字母、数字、下划线和中文');
    if (/^[0-9_]/.test(username)) errors.push('用户名不能以数字或下划线开头');
    if (RESERVED_USERNAMES.includes(username.toLowerCase())) errors.push('该用户名为系统保留，请选择其他用户名');
    return errors;
}

function validatePassword(password) {
    const errors = [];
    if (password.length < 8) errors.push('密码至少 8 个字符');
    if (password.length > 128) errors.push('密码不能超过 128 个字符');
    if (!/[A-Z]/.test(password)) errors.push('密码需包含大写字母');
    if (!/[a-z]/.test(password)) errors.push('密码需包含小写字母');
    if (!/[0-9]/.test(password)) errors.push('密码需包含数字');
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('密码需包含特殊字符');
    // 检测常见弱密码
    const commonPasswords = ['password', '12345678', 'qwerty123', 'admin123'];
    if (commonPasswords.includes(password.toLowerCase())) errors.push('密码过于简单');
    return errors;
}

// 注册
router.post('/register', registerLimiter, async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) return res.status(400).json({ error: '请填写所有字段' });

        const usernameErrors = validateUsername(username);
        if (usernameErrors.length > 0) return res.status(400).json({ error: usernameErrors.join('；') });

        const passwordErrors = validatePassword(password);
        if (passwordErrors.length > 0) return res.status(400).json({ error: passwordErrors.join('；') });

        const db = await getDb();

        // 检查是否存在
        const existingUser = await db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
        if (existingUser) return res.status(400).json({ error: '用户名或邮箱已被注册' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const id = Date.now().toString(); // 或者使用 UUID
        const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;

        await db.run(
            'INSERT INTO users (id, username, email, password, avatar, settings) VALUES (?, ?, ?, ?, ?, ?)',
            [id, username, email, hashedPassword, avatar, JSON.stringify({ theme: 'dark' })]
        );

        const token = jwt.sign({ id, username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        res.json({
            message: '注册成功',
            token,
            user: { id, username, email, avatar }
        });
    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 登录
router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { username, password, rememberMe } = req.body;
        if (!username || !password) return res.status(400).json({ error: '请填写用户名和密码' });

        const lockStatus = isAccountLocked(username.toLowerCase());
        if (lockStatus.locked) {
            return res.status(423).json({
                error: `账户已锁定，请 ${lockStatus.remainingMinutes} 分钟后再试`,
                locked: true,
                remainingMinutes: lockStatus.remainingMinutes
            });
        }

        const db = await getDb();
        const user = await db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, username]);

        if (!user || !(await bcrypt.compare(password, user.password))) {
            recordFailedLogin(username.toLowerCase());
            return res.status(400).json({ error: '用户名或密码错误' });
        }

        clearLoginAttempts(username.toLowerCase());
        const tokenExpiry = rememberMe ? '30d' : JWT_EXPIRES_IN;
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: tokenExpiry });

        // 记录登录历史
        await db.run(
            'INSERT INTO login_history (user_id, ip, user_agent) VALUES (?, ?, ?)',
            [user.id, req.ip || req.connection.remoteAddress, req.get('User-Agent')]
        );

        // 更新最后登录时间
        await db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

        res.json({
            message: '登录成功',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                lastLogin: user.last_login
            }
        });
    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 验证 Token
router.get('/verify', authenticateToken, (req, res) => {
    res.json({ valid: true, user: req.user });
});

// 刷新 Token
router.post('/refresh-token', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const user = await db.get('SELECT id, username FROM users WHERE id = ?', [req.user.id]);

        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        const newToken = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.json({ message: 'Token 已刷新', token: newToken });
    } catch (error) {
        console.error('刷新 Token 错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 忘记密码 - 请求重置
router.post('/forgot-password', registerLimiter, async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: '请提供邮箱地址' });
        }

        const db = await getDb();
        const user = await db.get('SELECT id, username, email FROM users WHERE email = ?', [email]);

        // 无论用户是否存在，都返回成功（防止邮箱枚举）
        if (!user) {
            return res.json({ message: '如果该邮箱已注册，您将收到密码重置链接' });
        }

        // 生成重置令牌
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = Date.now() + RESET_TOKEN_EXPIRY;

        // 删除旧的重置令牌
        await db.run('DELETE FROM password_reset_tokens WHERE user_id = ?', [user.id]);

        // 保存新令牌
        await db.run(
            'INSERT INTO password_reset_tokens (token, user_id, email, expires_at) VALUES (?, ?, ?, ?)',
            [resetToken, user.id, user.email, expiresAt]
        );

        console.log(`密码重置令牌（用户 ${user.username}）: ${resetToken}`);

        res.json({
            message: '如果该邮箱已注册，您将收到密码重置链接',
            // 仅开发环境返回令牌
            ...(process.env.NODE_ENV === 'development' && { resetToken })
        });

    } catch (error) {
        console.error('密码重置请求错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 验证重置令牌
router.get('/reset-password/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const db = await getDb();

        const resetData = await db.get(
            'SELECT * FROM password_reset_tokens WHERE token = ?',
            [token]
        );

        if (!resetData) {
            return res.status(400).json({ error: '无效的重置链接' });
        }

        if (Date.now() > resetData.expires_at) {
            await db.run('DELETE FROM password_reset_tokens WHERE token = ?', [token]);
            return res.status(400).json({ error: '重置链接已过期' });
        }

        res.json({ valid: true, email: resetData.email });
    } catch (error) {
        console.error('验证重置令牌错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 执行密码重置
router.post('/reset-password/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { newPassword } = req.body;

        const db = await getDb();
        const resetData = await db.get(
            'SELECT * FROM password_reset_tokens WHERE token = ?',
            [token]
        );

        if (!resetData) {
            return res.status(400).json({ error: '无效的重置链接' });
        }

        if (Date.now() > resetData.expires_at) {
            await db.run('DELETE FROM password_reset_tokens WHERE token = ?', [token]);
            return res.status(400).json({ error: '重置链接已过期' });
        }

        // 验证新密码强度
        const passwordErrors = validatePassword(newPassword);
        if (passwordErrors.length > 0) {
            return res.status(400).json({ error: passwordErrors.join('；') });
        }

        // 更新密码
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.run(
            'UPDATE users SET password = ?, password_changed_at = CURRENT_TIMESTAMP WHERE id = ?',
            [hashedPassword, resetData.user_id]
        );

        // 删除使用过的令牌
        await db.run('DELETE FROM password_reset_tokens WHERE token = ?', [token]);

        res.json({ message: '密码重置成功，请使用新密码登录' });

    } catch (error) {
        console.error('密码重置错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

module.exports = router;
