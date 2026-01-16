// popup.js - 弹出窗口逻辑

// DOM 元素
const apiKeyInput = document.getElementById('apiKey');
const apiKeyToggle = document.getElementById('apiKeyToggle');
const settingsToggle = document.getElementById('settingsToggle');
const settingsContent = document.getElementById('settingsContent');
const savedIndicator = document.getElementById('savedIndicator');
const taskInput = document.getElementById('taskInput');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const status = document.getElementById('status');
const logContainer = document.getElementById('logContainer');

let isRunning = false;

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    // 加载保存的 API Key
    const result = await chrome.storage.local.get(['geminiApiKey']);
    if (result.geminiApiKey) {
        apiKeyInput.value = result.geminiApiKey;
    }

    // 监听来自 background 的消息
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'log') {
            addLog(message.text, message.level);
        } else if (message.type === 'status') {
            showStatus(message.text, message.level);
        } else if (message.type === 'done') {
            stopExecution();
        }
    });
});

// API Key 显示/隐藏
apiKeyToggle.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        apiKeyToggle.textContent = '🙈';
    } else {
        apiKeyInput.type = 'password';
        apiKeyToggle.textContent = '👁️';
    }
});

// API Key 自动保存
apiKeyInput.addEventListener('input', debounce(async () => {
    await chrome.storage.local.set({ geminiApiKey: apiKeyInput.value });
    savedIndicator.classList.add('show');
    setTimeout(() => savedIndicator.classList.remove('show'), 2000);
}, 500));

// 设置折叠
settingsToggle.addEventListener('click', () => {
    settingsToggle.classList.toggle('open');
    settingsContent.classList.toggle('show');
});

// 开始执行
startBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const task = taskInput.value.trim();

    if (!apiKey) {
        showStatus('请先配置 Gemini API Key', 'error');
        settingsToggle.classList.add('open');
        settingsContent.classList.add('show');
        return;
    }

    if (!task) {
        showStatus('请输入任务指令', 'error');
        return;
    }

    // 获取当前标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
        showStatus('无法获取当前标签页', 'error');
        return;
    }

    // 清空日志
    logContainer.innerHTML = '';

    // 开始执行
    isRunning = true;
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    showStatus('正在执行任务...', 'info');

    addLog('任务开始: ' + task, 'action');

    // 发送消息给 background
    chrome.runtime.sendMessage({
        type: 'startTask',
        task: task,
        tabId: tab.id,
        apiKey: apiKey
    });
});

// 停止执行
stopBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'stopTask' });
    stopExecution();
});

function stopExecution() {
    isRunning = false;
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
}

// 显示状态
function showStatus(text, level = 'info') {
    status.textContent = text;
    status.className = `status show ${level}`;
}

// 添加日志
function addLog(text, level = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${level}`;

    const time = new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    entry.innerHTML = `<span class="time">[${time}]</span>${escapeHtml(text)}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

// 防抖
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// HTML 转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
