/* ==================== AI Hub 网页助手 (增强版) ==================== */

const AIAssistant = {
    isOpen: false,
    isProcessing: false,
    apiKey: null,
    taskQueue: [],
    maxSteps: 10,

    // 初始化
    init() {
        this.createUI();
        this.loadApiKey();
        this.bindEvents();
        console.log('🤖 AI 助手已加载（增强版）');
    },

    // 创建 UI
    createUI() {
        // 浮动按钮
        const fab = document.createElement('button');
        fab.className = 'ai-assistant-fab';
        fab.id = 'aiAssistantFab';
        fab.innerHTML = '🤖';
        fab.title = 'AI 助手';
        document.body.appendChild(fab);

        // 助手面板
        const panel = document.createElement('div');
        panel.className = 'ai-assistant-panel';
        panel.id = 'aiAssistantPanel';
        panel.innerHTML = `
            <div class="ai-assistant-header">
                <h3>🤖 AI 助手</h3>
                <div>
                    <button class="ai-assistant-close" id="aiSettingsBtn" title="设置">⚙️</button>
                    <button class="ai-assistant-close" id="aiCloseBtn" title="关闭">×</button>
                </div>
            </div>
            <div class="ai-assistant-settings" id="aiSettings">
                <div class="ai-settings-group">
                    <label>Gemini API Key</label>
                    <input type="password" id="aiApiKeyInput" placeholder="输入你的 API Key">
                    <div class="ai-settings-saved" id="aiSettingsSaved">✓ 已保存</div>
                </div>
            </div>
            <div class="ai-assistant-messages" id="aiMessages">
                <div class="ai-message assistant">
                    你好！我是 AI Hub 智能助手，我能：
                    <br>• 🧭 帮你导航到各个页面
                    <br>• ✍️ 代替你发布帖子
                    <br>• 🖱️ 自动点击按钮
                    <br>• ⌨️ 自动填写表单
                    <br><br>试试说"帮我发一篇帖子，标题是测试，内容是你好"
                </div>
            </div>
            <div class="ai-quick-actions">
                <button class="ai-quick-btn" data-action="navigate-chat">去AI对话</button>
                <button class="ai-quick-btn" data-action="navigate-draw">去AI绘图</button>
                <button class="ai-quick-btn" data-action="navigate-forum">去社区</button>
                <button class="ai-quick-btn" data-action="help-post">帮我发帖</button>
            </div>
            <div class="ai-assistant-input">
                <input type="text" id="aiInput" placeholder="输入你的问题或指令...">
                <button id="aiSendBtn">➤</button>
            </div>
        `;
        document.body.appendChild(panel);
    },

    // 绑定事件
    bindEvents() {
        const fab = document.getElementById('aiAssistantFab');
        const closeBtn = document.getElementById('aiCloseBtn');
        const settingsBtn = document.getElementById('aiSettingsBtn');
        const input = document.getElementById('aiInput');
        const sendBtn = document.getElementById('aiSendBtn');
        const apiKeyInput = document.getElementById('aiApiKeyInput');

        fab.addEventListener('click', () => this.toggle());
        closeBtn.addEventListener('click', () => this.close());
        settingsBtn.addEventListener('click', () => this.toggleSettings());

        sendBtn.addEventListener('click', () => this.send());
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.send();
        });

        // API Key 保存
        apiKeyInput.addEventListener('input', this.debounce(() => {
            this.apiKey = apiKeyInput.value;
            localStorage.setItem('ai-hub-assistant-key', this.apiKey);
            document.getElementById('aiSettingsSaved').classList.add('show');
            setTimeout(() => {
                document.getElementById('aiSettingsSaved').classList.remove('show');
            }, 2000);
        }, 500));

        // 快捷操作
        document.querySelectorAll('.ai-quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                this.handleQuickAction(action);
            });
        });
    },

    // 加载 API Key
    loadApiKey() {
        this.apiKey = localStorage.getItem('ai-hub-assistant-key') || '';
        document.getElementById('aiApiKeyInput').value = this.apiKey;
    },

    toggle() {
        this.isOpen ? this.close() : this.open();
    },

    open() {
        document.getElementById('aiAssistantPanel').classList.add('show');
        document.getElementById('aiAssistantFab').classList.add('hidden');
        this.isOpen = true;
        document.getElementById('aiInput').focus();
    },

    close() {
        document.getElementById('aiAssistantPanel').classList.remove('show');
        document.getElementById('aiAssistantFab').classList.remove('hidden');
        this.isOpen = false;
    },

    toggleSettings() {
        document.getElementById('aiSettings').classList.toggle('show');
    },

    // 获取页面可交互元素
    getPageElements() {
        const selectors = 'a[href], button, input, textarea, select, [role="button"], [onclick]';
        const elements = [];

        document.querySelectorAll(selectors).forEach((el, index) => {
            if (!this.isVisible(el)) return;

            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;

            const text = this.getElementText(el);
            const type = this.getElementType(el);
            const selector = this.generateSelector(el);

            elements.push({
                index: elements.length,
                type,
                text: text.substring(0, 80),
                selector,
                tag: el.tagName.toLowerCase()
            });
        });

        return elements.slice(0, 30); // 限制数量
    },

    isVisible(el) {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            el.offsetParent !== null;
    },

    getElementText(el) {
        return el.getAttribute('aria-label') ||
            el.placeholder ||
            el.title ||
            el.innerText?.trim() ||
            el.value || '';
    },

    getElementType(el) {
        const tag = el.tagName.toLowerCase();
        if (tag === 'a') return 'link';
        if (tag === 'button') return 'button';
        if (tag === 'input') return `input[${el.type || 'text'}]`;
        if (tag === 'textarea') return 'textarea';
        if (tag === 'select') return 'select';
        return 'interactive';
    },

    generateSelector(el) {
        if (el.id) return `#${el.id}`;

        let selector = el.tagName.toLowerCase();
        if (el.className && typeof el.className === 'string') {
            const cls = el.className.trim().split(/\s+/).filter(c => c && !c.includes(':')).slice(0, 2);
            if (cls.length) selector += '.' + cls.join('.');
        }
        return selector;
    },

    // 快捷操作
    handleQuickAction(action) {
        switch (action) {
            case 'navigate-chat':
                window.location.href = 'gemini-chat.html';
                break;
            case 'navigate-draw':
                window.location.href = 'banana-draw.html';
                break;
            case 'navigate-forum':
                window.location.href = 'forum.html';
                break;
            case 'help-post':
                this.executeTask('帮我发布一篇帖子');
                break;
        }
    },

    // 发送消息
    async send() {
        const input = document.getElementById('aiInput');
        const message = input.value.trim();
        if (!message || this.isProcessing) return;

        input.value = '';
        this.addMessage(message, 'user');
        await this.executeTask(message);
    },

    // 执行任务（多步骤）
    async executeTask(task) {
        if (!this.apiKey) {
            this.addMessage('请先在设置中配置 Gemini API Key', 'assistant');
            this.toggleSettings();
            return;
        }

        this.isProcessing = true;

        for (let step = 0; step < this.maxSteps; step++) {
            this.addMessage(`🔄 步骤 ${step + 1}: 分析中...`, 'assistant', 'thinking');

            try {
                const pageInfo = {
                    url: window.location.href,
                    title: document.title,
                    elements: this.getPageElements(),
                    isLoggedIn: !!window.AIHub?.AuthManager?.getUser?.()
                };

                const response = await this.callGemini(task, pageInfo, step);
                this.removeLastMessage();

                if (response.message) {
                    this.addMessage(response.message, 'assistant');
                }

                if (response.action) {
                    const result = await this.executeAction(response.action);
                    if (result.message) {
                        this.addMessage(`✓ ${result.message}`, 'assistant', 'action');
                    }

                    // 等待页面响应
                    await this.sleep(800);
                }

                if (response.done) {
                    this.addMessage('✅ 任务完成！', 'assistant');
                    break;
                }

                // 导航操作需要等待页面加载
                if (response.action?.type === 'navigate') {
                    break;
                }

            } catch (error) {
                this.removeLastMessage();
                this.addMessage('❌ 出错: ' + error.message, 'assistant');
                break;
            }
        }

        this.isProcessing = false;
    },

    // 调用 Gemini API
    async callGemini(task, pageInfo, step) {
        const elementsDesc = pageInfo.elements
            .map((el, i) => `[${i}] ${el.type}: "${el.text}" → ${el.selector}`)
            .join('\n');

        const prompt = `你是AI Hub网站的操作助手。根据用户任务和当前页面，决定下一步操作。

用户任务: ${task}
当前步骤: ${step + 1}
当前URL: ${pageInfo.url}
页面标题: ${pageInfo.title}
用户登录: ${pageInfo.isLoggedIn ? '是' : '否'}

页面可交互元素:
${elementsDesc || '(无)'}

请返回JSON格式（只返回JSON，不要其他内容）:
{
  "message": "给用户的说明（可选）",
  "action": {
    "type": "click|type|navigate|scroll|openModal",
    "selector": "元素选择器",
    "value": "输入内容（type时必填）"
  },
  "done": true/false
}

可用操作:
- click: 点击按钮/链接，selector填元素选择器
- type: 输入文本，selector填输入框选择器，value填内容
- navigate: 跳转页面，selector填URL
- openModal: 调用页面函数打开弹窗，selector填函数名如"openNewPostModal"
- scroll: 滚动页面

示例:
- 发帖子: 先navigate到forum.html，再openModal "openNewPostModal"，再type填写标题和内容，最后click提交
- 如果任务完成，设置done为true`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.3, maxOutputTokens: 800 }
                })
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API调用失败');
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // 提取 JSON
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return { message: text, done: true };
        }

        try {
            return JSON.parse(jsonMatch[0]);
        } catch (e) {
            return { message: text, done: true };
        }
    },

    // 执行动作
    async executeAction(action) {
        if (!action || !action.type) {
            return { success: false, message: '无效操作' };
        }

        switch (action.type) {
            case 'navigate':
                window.location.href = action.selector;
                return { success: true, message: `导航到 ${action.selector}` };

            case 'click':
                const clickEl = document.querySelector(action.selector);
                if (clickEl) {
                    this.highlightElement(clickEl);
                    await this.sleep(300);
                    clickEl.click();
                    return { success: true, message: `点击 "${this.getElementText(clickEl) || action.selector}"` };
                }
                return { success: false, message: `找不到元素: ${action.selector}` };

            case 'type':
                const typeEl = document.querySelector(action.selector);
                if (typeEl) {
                    this.highlightElement(typeEl);
                    typeEl.focus();
                    typeEl.value = action.value || '';
                    typeEl.dispatchEvent(new Event('input', { bubbles: true }));
                    typeEl.dispatchEvent(new Event('change', { bubbles: true }));
                    return { success: true, message: `输入 "${action.value}"` };
                }
                return { success: false, message: `找不到输入框: ${action.selector}` };

            case 'openModal':
                // 调用页面上的函数
                if (typeof window[action.selector] === 'function') {
                    window[action.selector]();
                    return { success: true, message: `打开 ${action.selector}` };
                }
                return { success: false, message: `函数不存在: ${action.selector}` };

            case 'scroll':
                const dir = action.value || 'down';
                window.scrollBy({
                    top: dir === 'up' ? -300 : 300,
                    behavior: 'smooth'
                });
                return { success: true, message: `滚动${dir === 'up' ? '上' : '下'}` };

            default:
                return { success: false, message: `未知操作: ${action.type}` };
        }
    },

    // 高亮元素
    highlightElement(el) {
        document.querySelectorAll('.ai-highlight-overlay').forEach(e => e.remove());

        const rect = el.getBoundingClientRect();
        const overlay = document.createElement('div');
        overlay.className = 'ai-highlight-overlay';
        overlay.style.cssText = `
            position: fixed;
            left: ${rect.left - 4}px;
            top: ${rect.top - 4}px;
            width: ${rect.width + 8}px;
            height: ${rect.height + 8}px;
            border: 3px solid #00d4ff;
            border-radius: 8px;
            background: rgba(0, 212, 255, 0.1);
            pointer-events: none;
            z-index: 99999;
            animation: pulse 0.5s ease-out;
        `;
        document.body.appendChild(overlay);

        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => overlay.remove(), 2000);
    },

    // 添加消息
    addMessage(text, type, extraClass = '') {
        const container = document.getElementById('aiMessages');
        const msg = document.createElement('div');
        msg.className = `ai-message ${type} ${extraClass}`;

        // AI 回复使用打字机效果
        if (type === 'assistant' && !extraClass.includes('thinking') && window.TypeWriter) {
            container.appendChild(msg);
            const tw = new TypeWriter(msg, { speed: 20, showCursor: true });
            tw.type(text.replace(/\n/g, '<br>'));
        } else {
            msg.innerHTML = text.replace(/\n/g, '<br>');
            container.appendChild(msg);
        }

        container.scrollTop = container.scrollHeight;
    },

    removeLastMessage() {
        const container = document.getElementById('aiMessages');
        if (container.lastChild) {
            container.removeChild(container.lastChild);
        }
    },

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    AIAssistant.init();
});
