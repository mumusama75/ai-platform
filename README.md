# 🚀 AI Hub

<div align="center">

![AI Hub Banner](https://img.shields.io/badge/AI%20Hub-你的创意%20无限可能-667eea?style=for-the-badge&logo=openai&logoColor=white)

**一站式 AI 创作平台** - 集对话、绘图、社区于一体

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)

[🌐 在线体验](#在线体验) • [✨ 功能特性](#功能特性) • [🚀 快速开始](#快速开始) • [📖 文档](#使用指南) • [🤝 贡献](#贡献)

</div>

---

## ✨ 功能特性

### 🤖 AI 对话
- 支持 Google Gemini API
- 多轮对话、上下文记忆
- 代码高亮、Markdown 渲染
- Token 统计与管理

### 🎨 AI 绘图工作室 (Banana Draw)
- Gemini 多模态图片生成
- Replicate 模型支持 (Flux, SD)
- 多参考图混合创作
- 历史记录 & 画廊管理
- 丰富的参数调节

### 👥 创作者社区
- 发帖 & 评论互动
- 点赞 & 收藏
- 分类标签筛选
- Prompt 灵感分享

### 🎵 更多 AI 工具
- AI 音乐工具导航
- AI 视频工具导航
- AI 图片工具聚合

---

## 🛠️ 技术栈

| 前端 | 后端 | 数据库 | 其他 |
|------|------|--------|------|
| HTML5/CSS3 | Node.js | SQLite | JWT 认证 |
| Vanilla JS | Express.js | - | Bcrypt 加密 |
| CSS 动画 | RESTful API | - | Rate Limiting |

---

## 🚀 快速开始

### 环境要求
- Node.js 18+
- npm 或 yarn

### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/your-username/ai-platform.git
cd ai-platform

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入必要的配置

# 4. 启动开发服务器
npm run dev
```

### 环境变量配置

```env
# 服务器配置
PORT=3000
NODE_ENV=development

# JWT 配置 (生产环境请使用强密钥)
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# CORS 配置
CORS_ORIGIN=*

# API Keys (用户也可在个人中心配置)
# GEMINI_API_KEY=your-gemini-api-key
# REPLICATE_API_TOKEN=your-replicate-token
```

---

## 📁 项目结构

```
ai-platform/
├── 📄 index.html          # 首页
├── 📄 login.html          # 登录/注册
├── 📄 gemini-chat.html    # AI 对话
├── 📄 banana-draw.html    # AI 绘图工作室
├── 📄 forum.html          # 社区论坛
├── 📄 profile.html        # 个人中心
├── 📄 music.html          # AI 音乐导航
├── 📄 video.html          # AI 视频导航
├── 📄 image.html          # AI 图片导航
├── 📄 server.js           # Express 服务器入口
│
├── 📂 src/
│   ├── 📂 routes/         # API 路由
│   │   ├── auth.js        # 认证相关
│   │   ├── user.js        # 用户管理
│   │   ├── chat.js        # AI 对话
│   │   ├── image.js       # AI 绘图
│   │   └── forum.js       # 社区论坛
│   ├── 📂 middleware/     # 中间件
│   │   ├── auth.js        # JWT 验证
│   │   └── rateLimit.js   # 请求限流
│   └── 📂 db/             # 数据库
│       └── database.js    # SQLite 配置
│
├── 📂 scripts/            # 前端脚本
├── 📂 styles/             # 样式文件
├── 📂 assets/             # 静态资源
└── 📂 data/               # 数据存储
    ├── avatars/           # 用户头像
    └── generated_images/  # 生成的图片
```

---

## 📖 使用指南

### 用户注册与登录
1. 访问首页，点击「登录」按钮
2. 选择注册新账号或登录已有账号
3. 登录后可在个人中心配置 API Key

### 配置 API Key
1. 进入「个人中心」>「API 密钥管理」
2. 配置 Google Gemini API Key（用于对话和绘图）
3. 可选配置 Replicate API Token（用于更多绘图模型）

### AI 对话
- 支持多轮连续对话
- 可调节模型温度等参数
- 代码自动语法高亮

### AI 绘图
- 输入文字描述生成图片
- 支持上传参考图（多达4张）
- 可调节图片比例、生成数量等
- 自动保存到历史记录

---

## 🔧 API 接口

### 认证
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/register` | 用户注册 |
| POST | `/api/login` | 用户登录 |
| GET | `/api/verify` | 验证 Token |

### 用户
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/user/profile` | 获取个人信息 |
| PUT | `/api/user/profile` | 更新个人信息 |
| POST | `/api/user/apikey` | 保存 API Key |

### AI 功能
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/chat/gemini` | Gemini 对话 |
| POST | `/api/image/gemini` | Gemini 图片生成 |
| GET | `/api/image/history` | 获取绘图历史 |

### 社区
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/forum/posts` | 获取帖子列表 |
| POST | `/api/forum/posts` | 发布新帖子 |
| POST | `/api/forum/posts/:id/like` | 点赞帖子 |

---

## 🌙 主题切换

支持明暗主题切换，基于 CSS 变量实现：

```css
:root[data-theme="dark"] {
    --bg-color: #0a0a0f;
    --text-primary: #ffffff;
}

:root[data-theme="light"] {
    --bg-color: #f8f9fa;
    --text-primary: #1d1d1f;
}
```

---

## 🤝 贡献

欢迎贡献代码！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

---

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

---

## 🙏 致谢

- [Google Gemini API](https://ai.google.dev/)
- [Replicate](https://replicate.com/)
- [Express.js](https://expressjs.com/)
- [DiceBear Avatars](https://www.dicebear.com/)

---

<div align="center">

**[⬆ 回到顶部](#-ai-hub)**

Made with ❤️ by AI Hub Team

</div>
