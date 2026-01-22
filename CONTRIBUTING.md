# 贡献指南

感谢你对 AI Hub 项目的关注！我们欢迎任何形式的贡献。

## 🚀 如何贡献

### 报告 Bug

1. 确保 Bug 尚未被报告，搜索 [Issues](../../issues)
2. 如果找不到相关 Issue，[创建新的 Issue](../../issues/new)
3. 请包含以下信息：
   - 清晰的标题和描述
   - 复现步骤
   - 预期行为 vs 实际行为
   - 截图（如适用）
   - 环境信息（浏览器、Node 版本等）

### 提出新功能

1. 先搜索是否已有类似的建议
2. 创建 Issue 描述你的想法
3. 说明这个功能的使用场景和价值

### 提交代码

1. **Fork** 本仓库
2. **Clone** 你的 Fork
   ```bash
   git clone https://github.com/your-username/ai-platform.git
   ```
3. 创建**特性分支**
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. 进行更改并**提交**
   ```bash
   git add .
   git commit -m "feat: 添加某某功能"
   ```
5. **推送**到你的 Fork
   ```bash
   git push origin feature/your-feature-name
   ```
6. 创建 **Pull Request**

## 📝 代码规范

### 提交信息格式

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type 类型：**
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具相关

**示例：**
```
feat(chat): 添加对话历史导出功能

- 支持导出为 Markdown 格式
- 支持导出为 PDF 格式
- 添加导出按钮到对话界面

Closes #123
```

### 代码风格

- 使用 4 空格缩进
- 使用单引号
- 语句末尾添加分号
- 文件末尾保留一个空行
- 变量命名使用 camelCase
- 常量命名使用 UPPER_SNAKE_CASE

### HTML/CSS 规范

- 使用语义化标签
- CSS 类名使用 kebab-case
- 保持响应式设计
- 支持明暗主题

## 🔍 代码审查

所有 PR 都需要经过代码审查：

- 确保代码符合规范
- 确保没有破坏现有功能
- 确保有适当的注释
- 确保 UI 改动在明暗主题下都正常

## 📋 开发流程

1. 从 `main` 分支创建新分支
2. 开发并测试你的更改
3. 确保没有引入新的警告或错误
4. 创建 PR 并等待审查
5. 根据反馈进行修改
6. 合并后删除你的特性分支

## 🧪 测试

在提交 PR 之前，请确保：

```bash
# 安装依赖
npm install

# 启动开发服务器测试
npm run dev

# 确保服务器正常启动
# 访问 http://localhost:3000 进行测试
```

## 💬 获取帮助

如有问题，可以：

- 查看项目文档
- 搜索已有的 Issues
- 创建新的 Issue 询问

---

再次感谢你的贡献！🎉
