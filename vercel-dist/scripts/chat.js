const CHAT_API_BASE = window.AIHub ? window.AIHub.API_BASE : '/api';
let useServerKey = false;
let chatHistory = [];

// 初始化函数
function init() {
    const sendBtn = document.getElementById('sendBtn');
    const userInput = document.getElementById('userInput');
    const toggleApiBtn = document.querySelector('.toggle-api');
    const clearBtn = document.querySelector('.btn-clear');
    const modelSelect = document.getElementById('model');
    const tempInput = document.getElementById('temperature');

    if (sendBtn) {
        // Remove existing listeners if any (though unlikely here)
        const newBtn = sendBtn.cloneNode(true);
        sendBtn.parentNode.replaceChild(newBtn, sendBtn);
        newBtn.addEventListener('click', sendMessage);
        newBtn.disabled = false; // Ensure enabled
    }

    if (userInput) {
        userInput.addEventListener('keydown', handleKeyDown);
        // 自动调整高度
        userInput.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 150) + 'px';
        });
    }

    if (toggleApiBtn) {
        toggleApiBtn.addEventListener('click', toggleApiKey);
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', clearChat);
    }

    if (modelSelect) {
        modelSelect.addEventListener('change', function () {
            document.getElementById('modelBadge').textContent = this.value;
        });
    }

    if (tempInput) {
        tempInput.addEventListener('input', function () {
            document.getElementById('tempValue').textContent = this.value;
        });
    }

    checkSavedApiKey();
    loadSavedSettings();
}

// 确保在DOM加载完成后执行初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    // 如果脚本执行时 DOM 已经加载完成
    init();
}

// 加载本地保存的设置
function loadSavedSettings() {
    const savedApiKey = localStorage.getItem('gemini-api-key');
    if (savedApiKey) {
        document.getElementById('apiKey').value = savedApiKey;
    }
}

// 检查用户是否登录并有保存的 API Key
async function checkSavedApiKey() {
    const token = localStorage.getItem('ai-hub-token');
    if (!token) {
        document.getElementById('apiKeyHint').innerHTML =
            '<a href="login.html" style="color: var(--accent);">登录</a> 后可在个人中心保存 API Key';
        return;
    }

    try {
        const res = await fetch(`${CHAT_API_BASE}/user/apikeys`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) return;

        const data = await res.json();
        if (data.configured.gemini) {
            useServerKey = true;
            document.getElementById('savedKeyInfo').style.display = 'block';
            document.getElementById('apiKeyGroup').style.display = 'none';
        } else {
            document.getElementById('apiKeyHint').innerHTML =
                '也可在 <a href="profile.html" style="color: var(--accent);">个人中心</a> 保存 API Key';
        }
    } catch (error) {
        console.error('检查 API Key 状态失败:', error);
    }
}

// API Key 显示切换
function toggleApiKey() {
    const input = document.getElementById('apiKey');
    const btn = document.querySelector('.toggle-api');
    if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
    } else {
        input.type = 'password';
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    }
}

// 显示状态
function showStatus(message, type = 'error') {
    const bar = document.getElementById('statusBar');
    bar.textContent = message;
    bar.className = 'status-bar show ' + type;
    if (type === 'success') {
        setTimeout(() => bar.classList.remove('show'), 3000);
    }
}

function hideStatus() {
    const bar = document.getElementById('statusBar');
    if (bar) bar.classList.remove('show');
}

// 键盘事件
function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

// 添加消息到界面
function addMessage(content, isUser = false) {
    const welcomeMsg = document.getElementById('welcomeMessage');
    if (welcomeMsg) welcomeMsg.remove();

    const messagesDiv = document.getElementById('chatMessages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isUser ? 'user' : 'ai'}`;

    msgDiv.innerHTML = `
        <div class="message-avatar">${isUser ? '👤' : '✨'}</div>
        <div class="message-content">${formatContent(content)}</div>
    `;

    messagesDiv.appendChild(msgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    return msgDiv;
}

// HTML 转义函数（防止 XSS）
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 格式化内容（简单的Markdown支持，带 XSS 防护）
function formatContent(text) {
    // 先转义 HTML，再进行 Markdown 处理
    let escaped = escapeHtml(text);
    return escaped
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
}

// 打字机效果
async function typeWriter(element, text, speed = 20) {
    const contentDiv = element.querySelector('.message-content');
    let index = 0;
    let currentText = '';

    // 添加光标
    contentDiv.innerHTML = '<span class="typing-cursor"></span>';

    return new Promise(resolve => {
        function type() {
            if (index < text.length) {
                currentText += text[index];
                contentDiv.innerHTML = formatContent(currentText) + '<span class="typing-cursor"></span>';
                index++;

                // 滚动到底部
                const messagesDiv = document.getElementById('chatMessages');
                messagesDiv.scrollTop = messagesDiv.scrollHeight;

                setTimeout(type, speed);
            } else {
                // 移除光标
                contentDiv.innerHTML = formatContent(currentText);
                resolve();
            }
        }
        type();
    });
}

// 发送消息
async function sendMessage() {
    const apiKeyInput = document.getElementById('apiKey');
    const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
    const userInputEl = document.getElementById('userInput');
    const message = userInputEl ? userInputEl.value.trim() : '';
    const model = document.getElementById('model').value;
    const temperature = parseFloat(document.getElementById('temperature').value);
    const maxTokens = parseInt(document.getElementById('maxTokens').value);

    // 检查是否有可用的 API Key
    if (!useServerKey && !apiKey) {
        showStatus('请输入 API Key 或登录使用已保存的密钥');
        return;
    }

    if (!message) return;

    // 保存本地 API Key（如果有输入）
    if (apiKey) {
        localStorage.setItem('gemini-api-key', apiKey);
    }

    // 清空输入框
    userInputEl.value = '';
    userInputEl.style.height = 'auto';
    hideStatus();

    // 添加用户消息
    addMessage(message, true);

    // 添加到历史
    chatHistory.push({
        role: 'user',
        content: message
    });

    // 禁用发送按钮
    const sendBtn = document.getElementById('sendBtn');
    sendBtn.disabled = true;

    // 创建AI消息占位
    const aiMsgDiv = addMessage('', false);
    const contentDiv = aiMsgDiv.querySelector('.message-content');
    contentDiv.innerHTML = '<span class="typing-cursor"></span>';

    try {
        // 构建请求头
        const headers = { 'Content-Type': 'application/json' };
        const token = localStorage.getItem('ai-hub-token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const requestBody = {
            apiKey: useServerKey ? undefined : apiKey,
            model,
            messages: chatHistory,
            generationConfig: {
                temperature,
                maxOutputTokens: maxTokens
            }
        };

        // 通过后端代理发送请求
        const response = await fetch(`${CHAT_API_BASE}/chat/gemini`, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `请求失败: ${response.status}`);
        }

        const aiText = data.content;

        // 添加到历史
        chatHistory.push({
            role: 'assistant',
            content: aiText
        });

        // 打字机效果显示
        await typeWriter(aiMsgDiv, aiText, 15);

    } catch (error) {
        console.error('请求失败:', error);
        contentDiv.innerHTML = `<span style="color: #ff6b6b;">请求失败: ${escapeHtml(error.message)}</span>`;
        showStatus(error.message);

        // 移除失败的历史记录
        chatHistory.pop();
    } finally {
        sendBtn.disabled = false;
    }
}
