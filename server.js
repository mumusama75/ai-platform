const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'ai-hub-secret-key-2025'; // 生产环境应使用环境变量
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// 中间件
app.use(cors());
app.use(express.json());
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

// 用户注册
app.post('/api/register', async (req, res) => {
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
            { expiresIn: '7d' }
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

// 用户登录
app.post('/api/login', async (req, res) => {
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
            { expiresIn: '7d' }
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
