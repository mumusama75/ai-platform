// 加载环境变量（必须在最开头）
require('dotenv').config();

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

const app = express();

// 从环境变量读取配置
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// 生产环境检查 JWT_SECRET
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    console.error('错误: 生产环境必须设置 JWT_SECRET 环境变量！');
    process.exit(1);
}

// 安全中间件
app.use(helmet({
    contentSecurityPolicy: false, // 允许内联脚本（开发用）
    crossOriginEmbedderPolicy: false
}));

// CORS 配置
const corsOptions = {
    origin: process.env.CORS_ORIGIN === '*' ? true : process.env.CORS_ORIGIN,
    credentials: true
};
app.use(cors(corsOptions));

// 基础速率限制（所有请求）
const generalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15分钟
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: { error: '请求过于频繁，请稍后再试' },
    standardHeaders: true,
    legacyHeaders: false
});

// 登录接口速率限制（更严格）
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX) || 5,
    message: { error: '登录尝试次数过多，请15分钟后再试' },
    standardHeaders: true,
    legacyHeaders: false
});

// 注册接口速率限制
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1小时
    max: parseInt(process.env.REGISTER_RATE_LIMIT_MAX) || 3,
    message: { error: '注册次数过多，请1小时后再试' },
    standardHeaders: true,
    legacyHeaders: false
});

// 应用基础速率限制
app.use('/api/', generalLimiter);

app.use(express.json({ limit: '10mb' })); // 限制请求体大小
app.use(express.static(__dirname)); // 提供静态文件

// 确保数据目录存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// 初始化用户文件
if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
}

// 读取用户数据
function getUsers() {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

// 保存用户数据
function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// 验证 Token 中间件
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: '未登录' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token 无效或已过期' });
        }
        req.user = user;
        next();
    });
}

// ==================== API 路由 ====================

// 用户注册（带速率限制）
app.post('/api/register', registerLimiter, async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // 验证输入
        if (!username || !email || !password) {
            return res.status(400).json({ error: '请填写所有字段' });
        }

        if (username.length < 2 || username.length > 20) {
            return res.status(400).json({ error: '用户名长度应为 2-20 个字符' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: '密码至少 6 个字符' });
        }

        // 验证邮箱格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: '邮箱格式不正确' });
        }

        const users = getUsers();

        // 检查用户名是否已存在
        if (users.find(u => u.username === username)) {
            return res.status(400).json({ error: '用户名已被使用' });
        }

        // 检查邮箱是否已存在
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ error: '邮箱已被注册' });
        }

        // 加密密码
        const hashedPassword = await bcrypt.hash(password, 10);

        // 创建新用户
        const newUser = {
            id: Date.now().toString(),
            username,
            email,
            password: hashedPassword,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
            createdAt: new Date().toISOString(),
            settings: {
                theme: 'dark'
            }
        };

        users.push(newUser);
        saveUsers(users);

        // 生成 Token
        const token = jwt.sign(
            { id: newUser.id, username: newUser.username },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.json({
            message: '注册成功',
            token,
            user: {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email,
                avatar: newUser.avatar
            }
        });

    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 用户登录（带速率限制）
app.post('/api/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: '请填写用户名和密码' });
        }

        const users = getUsers();

        // 查找用户（支持用户名或邮箱登录）
        const user = users.find(u => u.username === username || u.email === username);

        if (!user) {
            return res.status(400).json({ error: '用户不存在' });
        }

        // 验证密码
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: '密码错误' });
        }

        // 生成 Token
        const token = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.json({
            message: '登录成功',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                avatar: user.avatar
            }
        });

    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 获取当前用户信息
app.get('/api/user', authenticateToken, (req, res) => {
    const users = getUsers();
    const user = users.find(u => u.id === req.user.id);

    if (!user) {
        return res.status(404).json({ error: '用户不存在' });
    }

    res.json({
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            createdAt: user.createdAt,
            settings: user.settings
        }
    });
});

// 更新用户信息
app.put('/api/user', authenticateToken, async (req, res) => {
    try {
        const { username, email, avatar, settings } = req.body;
        const users = getUsers();
        const userIndex = users.findIndex(u => u.id === req.user.id);

        if (userIndex === -1) {
            return res.status(404).json({ error: '用户不存在' });
        }

        // 检查用户名是否被其他人使用
        if (username && username !== users[userIndex].username) {
            if (users.find(u => u.username === username && u.id !== req.user.id)) {
                return res.status(400).json({ error: '用户名已被使用' });
            }
            users[userIndex].username = username;
        }

        // 检查邮箱是否被其他人使用
        if (email && email !== users[userIndex].email) {
            if (users.find(u => u.email === email && u.id !== req.user.id)) {
                return res.status(400).json({ error: '邮箱已被使用' });
            }
            users[userIndex].email = email;
        }

        if (avatar) users[userIndex].avatar = avatar;
        if (settings) users[userIndex].settings = { ...users[userIndex].settings, ...settings };

        saveUsers(users);

        res.json({
            message: '更新成功',
            user: {
                id: users[userIndex].id,
                username: users[userIndex].username,
                email: users[userIndex].email,
                avatar: users[userIndex].avatar,
                settings: users[userIndex].settings
            }
        });

    } catch (error) {
        console.error('更新错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 修改密码
app.put('/api/user/password', authenticateToken, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({ error: '请填写原密码和新密码' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: '新密码至少 6 个字符' });
        }

        const users = getUsers();
        const userIndex = users.findIndex(u => u.id === req.user.id);

        if (userIndex === -1) {
            return res.status(404).json({ error: '用户不存在' });
        }

        // 验证原密码
        const validPassword = await bcrypt.compare(oldPassword, users[userIndex].password);
        if (!validPassword) {
            return res.status(400).json({ error: '原密码错误' });
        }

        // 加密新密码
        users[userIndex].password = await bcrypt.hash(newPassword, 10);
        saveUsers(users);

        res.json({ message: '密码修改成功' });

    } catch (error) {
        console.error('修改密码错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 验证 Token
app.get('/api/verify', authenticateToken, (req, res) => {
    res.json({ valid: true, user: req.user });
});

// ==================== API Key 安全管理 ====================

// 加密/解密 API Key 的简单混淆（生产环境应使用更强的加密）
const crypto = require('crypto');
const ENCRYPTION_KEY = process.env.JWT_SECRET.slice(0, 32).padEnd(32, '0'); // 使用 JWT_SECRET 派生
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

// 保存用户的 API Keys（加密存储）
app.post('/api/user/apikeys', authenticateToken, (req, res) => {
    try {
        const { provider, apiKey } = req.body;

        if (!provider || !apiKey) {
            return res.status(400).json({ error: '请提供 provider 和 apiKey' });
        }

        const validProviders = ['gemini', 'replicate'];
        if (!validProviders.includes(provider)) {
            return res.status(400).json({ error: '不支持的 API 提供商' });
        }

        const users = getUsers();
        const userIndex = users.findIndex(u => u.id === req.user.id);

        if (userIndex === -1) {
            return res.status(404).json({ error: '用户不存在' });
        }

        // 初始化 apiKeys 对象
        if (!users[userIndex].apiKeys) {
            users[userIndex].apiKeys = {};
        }

        // 加密存储 API Key
        users[userIndex].apiKeys[provider] = encryptApiKey(apiKey);
        saveUsers(users);

        res.json({ message: `${provider} API Key 已安全保存` });

    } catch (error) {
        console.error('保存 API Key 错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 获取用户已配置的 API Key 状态（不返回实际密钥）
app.get('/api/user/apikeys', authenticateToken, (req, res) => {
    try {
        const users = getUsers();
        const user = users.find(u => u.id === req.user.id);

        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }

        const apiKeys = user.apiKeys || {};

        // 只返回哪些 provider 已配置，不返回实际密钥
        res.json({
            configured: {
                gemini: !!apiKeys.gemini,
                replicate: !!apiKeys.replicate
            }
        });

    } catch (error) {
        console.error('获取 API Key 状态错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 删除用户的 API Key
app.delete('/api/user/apikeys/:provider', authenticateToken, (req, res) => {
    try {
        const { provider } = req.params;

        const users = getUsers();
        const userIndex = users.findIndex(u => u.id === req.user.id);

        if (userIndex === -1) {
            return res.status(404).json({ error: '用户不存在' });
        }

        if (users[userIndex].apiKeys && users[userIndex].apiKeys[provider]) {
            delete users[userIndex].apiKeys[provider];
            saveUsers(users);
        }

        res.json({ message: `${provider} API Key 已删除` });

    } catch (error) {
        console.error('删除 API Key 错误:', error);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 获取用户的解密 API Key（内部使用）
function getUserApiKey(userId, provider) {
    const users = getUsers();
    const user = users.find(u => u.id === userId);
    if (!user || !user.apiKeys || !user.apiKeys[provider]) {
        return null;
    }
    return decryptApiKey(user.apiKeys[provider]);
}

// ==================== AI 绘图代理 API ====================

// 可选认证中间件（支持已登录和未登录用户）
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (!err) {
                req.user = user;
            }
            next();
        });
    } else {
        next();
    }
}

// Replicate API 代理 - 创建预测
app.post('/api/image/replicate', optionalAuth, async (req, res) => {
    try {
        const { apiKey: requestApiKey, model, input } = req.body;

        // 优先使用服务器端存储的 API Key（如果用户已登录）
        let apiKey = requestApiKey;
        if (req.user && !requestApiKey) {
            apiKey = getUserApiKey(req.user.id, 'replicate');
        }

        if (!apiKey) {
            return res.status(400).json({ error: '请提供 API Key 或登录后配置 API Key' });
        }

        // 默认使用 Stable Diffusion XL
        const modelVersion = model || 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b';

        const response = await fetch('https://api.replicate.com/v1/predictions', {
            method: 'POST',
            headers: {
                'Authorization': `Token ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                version: modelVersion.includes(':') ? modelVersion.split(':')[1] : modelVersion,
                input: input
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                error: data.detail || data.error || '请求失败'
            });
        }

        res.json(data);

    } catch (error) {
        console.error('Replicate API 错误:', error);
        res.status(500).json({ error: '服务器错误: ' + error.message });
    }
});

// Replicate API 代理 - 获取预测结果
app.get('/api/image/replicate/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const apiKey = req.headers['x-api-key'];

        if (!apiKey) {
            return res.status(400).json({ error: '请提供 API Key' });
        }

        const response = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
            headers: {
                'Authorization': `Token ${apiKey}`,
            }
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                error: data.detail || data.error || '请求失败'
            });
        }

        res.json(data);

    } catch (error) {
        console.error('Replicate API 错误:', error);
        res.status(500).json({ error: '服务器错误: ' + error.message });
    }
});

// Gemini 图片生成代理 (支持文生图和图生图)
app.post('/api/image/gemini', optionalAuth, async (req, res) => {
    try {
        const { apiKey: requestApiKey, prompt, negativePrompt, aspectRatio, numberOfImages, referenceImage } = req.body;

        // 优先使用服务器端存储的 API Key（如果用户已登录）
        let apiKey = requestApiKey;
        if (req.user && !requestApiKey) {
            apiKey = getUserApiKey(req.user.id, 'gemini');
        }

        if (!apiKey) {
            return res.status(400).json({ error: '请提供 Gemini API Key 或登录后配置 API Key' });
        }

        if (!prompt) {
            return res.status(400).json({ error: '请提供提示词' });
        }

        // 使用 Gemini 2.0 Flash 生成图片
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;

        // 构建提示词
        let fullPrompt = prompt;
        if (negativePrompt) {
            fullPrompt += `\n\nAvoid: ${negativePrompt}`;
        }
        if (aspectRatio && aspectRatio !== '1:1') {
            fullPrompt += `\n\nAspect ratio: ${aspectRatio}`;
        }

        // 构建请求内容
        const parts = [];

        // 如果有参考图片，添加图生图指令
        if (referenceImage && referenceImage.base64) {
            parts.push({
                inlineData: {
                    mimeType: referenceImage.mimeType || 'image/jpeg',
                    data: referenceImage.base64
                }
            });
            parts.push({
                text: `Based on this reference image, generate a new image with the following modifications: ${fullPrompt}`
            });
        } else {
            parts.push({
                text: `Generate an image: ${fullPrompt}`
            });
        }

        const requestBody = {
            contents: [{
                parts: parts
            }],
            generationConfig: {
                responseModalities: ["image", "text"],
                responseMimeType: "text/plain"
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (!response.ok) {
            const errorMsg = data.error?.message || data.error?.status || JSON.stringify(data);
            return res.status(response.status).json({ error: errorMsg });
        }

        // 解析返回的图片数据
        if (data.candidates && data.candidates[0]?.content?.parts) {
            const parts = data.candidates[0].content.parts;
            const images = [];
            for (const part of parts) {
                if (part.inlineData?.data) {
                    const mimeType = part.inlineData.mimeType || 'image/png';
                    images.push(`data:${mimeType};base64,${part.inlineData.data}`);
                }
            }
            if (images.length > 0) {
                return res.json({ images });
            }
        }

        res.status(500).json({ error: '未能获取到图片数据，请确保使用支持图片生成的 API Key' });

    } catch (error) {
        console.error('Gemini API 错误:', error);
        res.status(500).json({ error: '服务器错误: ' + error.message });
    }
});

// 通用代理 - 支持自定义端点 (如本地 Stable Diffusion WebUI)
app.post('/api/image/proxy', async (req, res) => {
    try {
        const { endpoint, apiKey, body, headers: customHeaders } = req.body;

        if (!endpoint) {
            return res.status(400).json({ error: '请提供 API 端点' });
        }

        // 构建请求头
        const headers = {
            'Content-Type': 'application/json',
            ...customHeaders
        };

        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.json(data);

    } catch (error) {
        console.error('代理请求错误:', error);
        res.status(500).json({ error: '服务器错误: ' + error.message });
    }
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║                                        ║
║     🚀 AI Hub 服务器已启动!            ║
║                                        ║
║     访问地址: http://localhost:${PORT}    ║
║                                        ║
╚════════════════════════════════════════╝
    `);
});
