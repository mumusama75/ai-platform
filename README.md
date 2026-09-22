<div align="center">

<img src="assets/icons/icon_studio_flat_1768787191809.png" width="76" alt="AI Hub">

# AI Hub

**AI 对话 · 图像创作 · 创作者社区**

一个使用原生 JavaScript、Express 和 SQLite 搭建的 AI 应用原型。<br>
将第三方模型接口、用户账户、生成记录与社区交互连接到同一套 Web 界面。

![Status](https://img.shields.io/badge/status-prototype-7C6FF0?style=flat-square)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=222222)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)
[![License: MIT](https://img.shields.io/badge/license-MIT-64748B?style=flat-square)](LICENSE)

[功能概览](#功能概览) · [本地启动](#本地启动) · [代码导览](#代码导览) · [当前边界](#当前边界)

</div>

## 项目介绍

AI Hub 围绕「输入需求 → 调用模型 → 展示结果 → 保存与分享」组织功能，主要展示 AI 应用集成、前后端交互和数据持久化的实现。模型能力来自 Gemini、Replicate 等外部服务；本仓库不包含模型训练代码或自研模型权重。

目前适合本地学习、代码交流与项目演示，尚未提供经过验证的公开在线体验。

## 功能概览

| 模块 | 仓库中的实现 | 入口 |
| --- | --- | --- |
| AI 对话 | Gemini 接口代理、会话内多轮上下文、模型与生成参数选择、回复展示 | [`gemini-chat.html`](gemini-chat.html) |
| 图像创作 | Gemini 图像生成、多参考图输入、Replicate 任务提交与轮询、自定义图像服务代理 | [`banana-draw.html`](banana-draw.html) |
| 生成记录 | 登录后的 Gemini 生成结果保存、历史记录查询、图片文件与参数存储 | [`src/routes/image.js`](src/routes/image.js) |
| 用户账户 | 注册登录、JWT 验证、密码哈希、个人资料、头像和按服务商管理 API Key | [`src/routes/auth.js`](src/routes/auth.js) · [`src/routes/user.js`](src/routes/user.js) |
| 创作者社区 | 发帖、评论、点赞、分类筛选与搜索；帖子使用 JSON 文件存储 | [`forum.html`](forum.html) · [`src/routes/forum.js`](src/routes/forum.js) |
| 工具导航 | 图像、音乐和视频工具入口；这些导航页本身不提供音乐或视频生成服务 | [`image.html`](image.html) · [`music.html`](music.html) · [`video.html`](video.html) |

另有 [`browser-agent/`](browser-agent/) 浏览器扩展实验目录，与主站启动流程独立，不作为已验证的完整 Agent 产品。

## 技术与数据流

```text
浏览器页面（HTML / CSS / JavaScript）
          │ HTTP / JSON
          ▼
Express API
  ├─ 认证与用户 ── SQLite：账户、登录记录、API Key、图片历史
  ├─ AI 对话/绘图 ── Gemini / Replicate / 自定义端点
  ├─ 生成图片 ── data/generated_images/
  └─ 社区 ── data/forum.json
```

前端使用原生 JavaScript；后端使用 Express、JWT、bcryptjs、Helmet 和请求限流中间件。数据库通过 `sqlite` / `sqlite3` 访问，用户 API Key 的服务端存储使用加密函数处理。相关实现可直接从下方代码入口阅读。

## 本地启动

需要支持原生 `fetch` 的 Node.js（18+）和 npm，建议选择仍受维护的 Node.js LTS 版本。生成内容还需要有效的服务商 API Key、相应模型权限和可访问的网络环境；调用可能产生服务商费用。

```bash
git clone https://github.com/mumusama75/ai-platform.git
cd ai-platform
npm ci
```

复制环境配置模板：

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

```bash
# macOS / Linux
cp .env.example .env
```

编辑 `.env`，将 `JWT_SECRET` 改为随机生成、至少 32 字符的 ASCII 字符串。其余选项见 [`.env.example`](.env.example)：

| 配置 | 用途 |
| --- | --- |
| `PORT` | Web 服务端口，默认 `3000` |
| `JWT_SECRET` | JWT 签名，也参与现有 API Key 加密；更改后旧令牌及已保存密钥可能失效 |
| `JWT_EXPIRES_IN` | JWT 有效期，默认 `7d` |
| `CORS_ORIGIN` | 允许的请求来源；模板默认 `*` |
| `NODE_ENV` | 本地使用 `development` |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX_REQUESTS` | 通用 API 限流窗口及请求数 |
| `LOGIN_RATE_LIMIT_MAX` / `REGISTER_RATE_LIMIT_MAX` | 登录、注册的限流阈值 |

```bash
npm run dev
# 或不使用自动重启：npm start
```

在本机浏览器打开 <http://localhost:3000>。使用自定义端口时相应调整地址。

1. 打开登录页注册测试账号，进入个人中心。
2. 在个人中心配置 Gemini 或 Replicate API Key，也可使用功能页面提供的输入框。
3. 进入对话或绘图页，执行一次小规模请求，检查结果和错误反馈。
4. 登录后使用 Gemini 绘图，查看生成历史；进入社区体验发帖、评论与搜索。

**API Key 配置说明：** 当前后端从请求或登录账户读取服务商密钥，不读取 `GEMINI_API_KEY`、`REPLICATE_API_TOKEN` 环境变量。不要把真实密钥写入代码、README 或提交记录。

## 代码导览

| 路径 | 阅读重点 |
| --- | --- |
| [`server.js`](server.js) | 中间件、静态文件服务、API 路由注册 |
| [`scripts/chat.js`](scripts/chat.js) | 多轮消息组织、请求状态与响应展示 |
| [`src/routes/chat.js`](src/routes/chat.js) | Gemini 请求转换与提示词优化接口 |
| [`src/routes/image.js`](src/routes/image.js) | 图片生成、任务轮询、文件保存与历史查询 |
| [`src/routes/auth.js`](src/routes/auth.js) | 注册、登录、令牌与密码重置流程 |
| [`src/routes/user.js`](src/routes/user.js) | 用户资料及服务商密钥管理 |
| [`src/db/database.js`](src/db/database.js) | SQLite 表结构与 API Key 加解密 |
| [`src/routes/forum.js`](src/routes/forum.js) | JSON 文件持久化与社区交互 |
| [`styles/`](styles/) · [`assets/`](assets/) | 页面样式与静态资源 |

<details>
<summary>展开查看主要 API</summary>

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `POST` | `/api/register` · `/api/login` | 注册与登录 |
| `GET` | `/api/verify` | 验证登录状态 |
| `GET` / `PUT` | `/api/user` | 读取或更新个人资料 |
| `GET` / `POST` | `/api/user/apikeys` | 查询密钥配置状态或保存密钥 |
| `POST` | `/api/chat/gemini` | Gemini 对话 |
| `POST` | `/api/chat/optimize-prompt` | 绘图提示词优化 |
| `POST` | `/api/image/gemini` | Gemini 图像生成 |
| `POST` / `GET` | `/api/image/replicate` · `/api/image/replicate/:id` | 创建任务与查询结果 |
| `GET` | `/api/image/history` | 查询登录用户的生成历史 |
| `GET` / `POST` | `/api/forum/posts` | 浏览或发布帖子 |
| `POST` | `/api/forum/posts/:id/comments` | 发表评论 |

接口的认证要求、请求字段和错误返回以对应路由文件为准。

</details>

## 当前边界

- **第三方兼容性：** 部分模型名称写在页面或路由中，实际可用性取决于服务商接口和账号权限。当前文档不代表已完成真实 API 联调或运行验证。
- **本地原型：** 当前静态服务覆盖仓库根目录；公开部署前需要隔离静态资源与数据目录、收紧自定义代理端点，并检查密钥和日志处理。不要直接把包含真实账户数据的实例暴露到公网。
- **数据与密钥：** 部分页面把密钥或会话令牌存于浏览器 `localStorage`。演示请使用测试账户，并在共享设备上清理相关数据。
- **功能范围：** 对话上下文保存在当前页面会话中，不等同于长期记忆；音乐和视频页以工具导航为主；密码重置已包含令牌流程，但尚未接入邮件发送服务。
- **验证工作：** `package.json` 尚未配置自动化测试命令。接口回归测试、端到端流程验证和部署加固是后续完善方向。

## 依赖与许可

本仓库使用 [MIT 许可证](LICENSE)。Gemini、Replicate 及其他第三方服务、模型和素材仍受各自的使用条款与许可约束。

相关技术文档：[Google Gemini API](https://ai.google.dev/) · [Replicate](https://replicate.com/docs) · [Express](https://expressjs.com/) · [SQLite](https://www.sqlite.org/docs.html)

欢迎通过 [Issues](https://github.com/mumusama75/ai-platform/issues) 反馈可复现的问题或改进建议；提交代码前可阅读 [贡献指南](CONTRIBUTING.md)。
