// background.js - Service Worker，核心 Agent 逻辑

let isRunning = false;
let currentTabId = null;
let maxSteps = 20; // 最大执行步骤

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'startTask') {
        startTask(message.task, message.tabId, message.apiKey);
    } else if (message.type === 'stopTask') {
        stopTask();
    }
});

// 开始执行任务
async function startTask(task, tabId, apiKey) {
    if (isRunning) {
        sendToPopup('status', '已有任务在执行中', 'error');
        return;
    }

    isRunning = true;
    currentTabId = tabId;

    sendToPopup('log', '🚀 开始执行任务...', 'action');

    let step = 0;

    while (isRunning && step < maxSteps) {
        step++;
        sendToPopup('log', `📍 步骤 ${step}/${maxSteps}`, 'thinking');

        try {
            // 1. 获取页面信息
            const pageInfo = await getPageInfo(tabId);
            if (!pageInfo) {
                sendToPopup('log', '❌ 无法获取页面信息', 'error');
                break;
            }

            sendToPopup('log', `📄 当前页面: ${pageInfo.title}`, 'info');

            // 2. 调用 AI 决定下一步
            sendToPopup('log', '🤔 AI 正在思考...', 'thinking');

            const action = await callGeminiAPI(apiKey, task, pageInfo);

            if (!action) {
                sendToPopup('log', '❌ AI 返回无效', 'error');
                break;
            }

            sendToPopup('log', `💡 AI 决定: ${action.action} - ${action.reason}`, 'thinking');

            // 3. 检查是否完成
            if (action.action === 'done') {
                sendToPopup('log', `✅ 任务完成: ${action.reason}`, 'done');
                sendToPopup('status', '任务已完成', 'success');
                break;
            }

            // 4. 执行操作
            if (action.action === 'navigate') {
                // 导航需要特殊处理
                await chrome.tabs.update(tabId, { url: action.url });
                sendToPopup('log', `🌐 导航到: ${action.url}`, 'action');
                // 等待页面加载
                await waitForNavigation(tabId);
            } else if (action.action === 'wait') {
                sendToPopup('log', `⏳ 等待 ${action.duration || 2} 秒...`, 'action');
                await sleep((action.duration || 2) * 1000);
            } else {
                const result = await executeAction(tabId, action);
                if (result.success) {
                    sendToPopup('log', `✓ ${result.message}`, 'action');
                } else {
                    sendToPopup('log', `⚠️ ${result.error}`, 'error');
                }
            }

            // 等待一下让页面响应
            await sleep(1000);

        } catch (error) {
            sendToPopup('log', `❌ 错误: ${error.message}`, 'error');
            break;
        }
    }

    if (step >= maxSteps) {
        sendToPopup('log', '⚠️ 达到最大步骤限制', 'error');
    }

    stopTask();
}

// 停止任务
function stopTask() {
    isRunning = false;
    currentTabId = null;
    sendToPopup('done');
    sendToPopup('status', '任务已停止', 'info');
}

// 获取页面信息
async function getPageInfo(tabId) {
    try {
        const response = await chrome.tabs.sendMessage(tabId, { type: 'getPageInfo' });
        return response;
    } catch (error) {
        console.error('getPageInfo error:', error);
        return null;
    }
}

// 执行操作
async function executeAction(tabId, action) {
    try {
        const response = await chrome.tabs.sendMessage(tabId, {
            type: 'executeAction',
            action: action
        });
        return response;
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 调用 Gemini API
async function callGeminiAPI(apiKey, task, pageInfo) {
    const prompt = buildPrompt(task, pageInfo);

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 1024
                    }
                })
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API 调用失败');
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            throw new Error('AI 返回为空');
        }

        // 解析 JSON
        return parseAIResponse(text);

    } catch (error) {
        console.error('Gemini API error:', error);
        throw error;
    }
}

// 构建 Prompt
function buildPrompt(task, pageInfo) {
    const elementsDescription = pageInfo.elements
        .map((el, i) => `[${i}] ${el.type}: "${el.text}" (${el.selector})`)
        .join('\n');

    return `你是一个浏览器操作助手。根据用户任务和当前页面状态，决定下一步操作。

用户任务: ${task}

当前页面:
- URL: ${pageInfo.url}
- 标题: ${pageInfo.title}

可交互元素列表:
${elementsDescription || '(无可见交互元素)'}

请返回 JSON 格式的下一步操作（只返回 JSON，不要其他内容）:

可用操作:
1. click - 点击元素: {"action": "click", "target": "选择器", "reason": "原因"}
2. type - 输入文本: {"action": "type", "target": "选择器", "value": "输入内容", "reason": "原因"}
3. scroll - 滚动页面: {"action": "scroll", "direction": "down/up", "reason": "原因"}
4. navigate - 跳转页面: {"action": "navigate", "url": "完整URL", "reason": "原因"}
5. wait - 等待: {"action": "wait", "duration": 秒数, "reason": "原因"}
6. done - 任务完成: {"action": "done", "reason": "完成原因"}

注意:
- 选择器使用元素列表中的 selector
- 如果任务需要打开新网站，使用 navigate
- 如果页面没有所需元素，考虑 scroll 或 wait
- 如果任务已完成，返回 done`;
}

// 解析 AI 响应
function parseAIResponse(text) {
    // 尝试提取 JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('无法解析 AI 响应');
    }

    try {
        return JSON.parse(jsonMatch[0]);
    } catch (e) {
        throw new Error('JSON 解析失败');
    }
}

// 等待导航完成
function waitForNavigation(tabId) {
    return new Promise((resolve) => {
        const listener = (id, changeInfo) => {
            if (id === tabId && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                setTimeout(resolve, 500); // 额外等待确保页面稳定
            }
        };
        chrome.tabs.onUpdated.addListener(listener);

        // 超时 30 秒
        setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
        }, 30000);
    });
}

// 发送消息到 popup
function sendToPopup(type, text = '', level = 'info') {
    chrome.runtime.sendMessage({ type, text, level }).catch(() => { });
}

// 睡眠
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('🤖 AI Browser Agent: Background service worker loaded');
