// content.js - 注入到网页的脚本，负责 DOM 操作

// 监听来自 background 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'getPageInfo') {
        sendResponse(getPageInfo());
    } else if (message.type === 'executeAction') {
        const result = executeAction(message.action);
        sendResponse(result);
    } else if (message.type === 'highlightElement') {
        highlightElement(message.selector);
        sendResponse({ success: true });
    }
    return true; // 保持消息通道开放
});

// 获取页面信息
function getPageInfo() {
    const elements = getInteractiveElements();
    return {
        url: window.location.href,
        title: document.title,
        elements: elements
    };
}

// 获取可交互元素
function getInteractiveElements() {
    const interactiveSelectors = [
        'a[href]',
        'button',
        'input',
        'textarea',
        'select',
        '[role="button"]',
        '[onclick]',
        '[tabindex]'
    ];

    const elements = [];
    const seen = new Set();

    document.querySelectorAll(interactiveSelectors.join(',')).forEach((el, index) => {
        // 跳过隐藏元素
        if (!isVisible(el)) return;

        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        // 生成唯一选择器
        const selector = generateSelector(el);
        if (seen.has(selector)) return;
        seen.add(selector);

        // 获取元素描述
        const text = getElementText(el);
        const type = getElementType(el);

        elements.push({
            index: elements.length,
            selector: selector,
            type: type,
            text: text.substring(0, 100), // 限制长度
            tag: el.tagName.toLowerCase(),
            rect: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
            }
        });
    });

    // 只返回前 50 个元素，避免过多
    return elements.slice(0, 50);
}

// 检查元素是否可见
function isVisible(el) {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        el.offsetParent !== null;
}

// 生成元素选择器
function generateSelector(el) {
    if (el.id) {
        return `#${el.id}`;
    }

    const path = [];
    while (el && el.nodeType === Node.ELEMENT_NODE) {
        let selector = el.tagName.toLowerCase();

        if (el.className && typeof el.className === 'string') {
            const classes = el.className.trim().split(/\s+/).filter(c => c && !c.includes(':'));
            if (classes.length > 0) {
                selector += '.' + classes.slice(0, 2).join('.');
            }
        }

        const siblings = el.parentNode ? Array.from(el.parentNode.children).filter(s => s.tagName === el.tagName) : [];
        if (siblings.length > 1) {
            const index = siblings.indexOf(el) + 1;
            selector += `:nth-of-type(${index})`;
        }

        path.unshift(selector);

        if (el.id || path.length > 3) break;
        el = el.parentNode;
    }

    return path.join(' > ');
}

// 获取元素文本
function getElementText(el) {
    // 优先使用 aria-label
    if (el.getAttribute('aria-label')) {
        return el.getAttribute('aria-label');
    }

    // 使用 placeholder
    if (el.placeholder) {
        return `[${el.placeholder}]`;
    }

    // 使用 title
    if (el.title) {
        return el.title;
    }

    // 使用 value (针对输入框)
    if (el.value && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        return `[${el.value}]`;
    }

    // 使用内部文本
    return el.innerText?.trim() || el.textContent?.trim() || '';
}

// 获取元素类型
function getElementType(el) {
    const tag = el.tagName.toLowerCase();

    if (tag === 'a') return 'link';
    if (tag === 'button' || el.getAttribute('role') === 'button') return 'button';
    if (tag === 'input') {
        const type = el.getAttribute('type') || 'text';
        return `input[${type}]`;
    }
    if (tag === 'textarea') return 'textarea';
    if (tag === 'select') return 'select';

    return 'interactive';
}

// 执行操作
function executeAction(action) {
    try {
        switch (action.action) {
            case 'click':
                return performClick(action.target);
            case 'type':
                return performType(action.target, action.value);
            case 'scroll':
                return performScroll(action.direction, action.amount);
            case 'navigate':
                return performNavigate(action.url);
            case 'wait':
                // wait 由 background 处理
                return { success: true };
            default:
                return { success: false, error: `未知操作: ${action.action}` };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 点击操作
function performClick(selector) {
    const el = document.querySelector(selector);
    if (!el) {
        return { success: false, error: `找不到元素: ${selector}` };
    }

    // 滚动到元素
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // 高亮
    highlightElement(selector);

    // 模拟点击
    setTimeout(() => {
        el.click();
    }, 300);

    return { success: true, message: `已点击: ${getElementText(el) || selector}` };
}

// 输入操作
function performType(selector, value) {
    const el = document.querySelector(selector);
    if (!el) {
        return { success: false, error: `找不到元素: ${selector}` };
    }

    // 聚焦
    el.focus();

    // 清空并输入
    el.value = '';

    // 模拟逐字输入
    for (let char of value) {
        el.value += char;
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    el.dispatchEvent(new Event('change', { bubbles: true }));

    return { success: true, message: `已输入: ${value}` };
}

// 滚动操作
function performScroll(direction, amount = 300) {
    if (direction === 'down') {
        window.scrollBy({ top: amount, behavior: 'smooth' });
    } else if (direction === 'up') {
        window.scrollBy({ top: -amount, behavior: 'smooth' });
    }
    return { success: true, message: `已滚动: ${direction}` };
}

// 导航操作
function performNavigate(url) {
    window.location.href = url;
    return { success: true, message: `正在导航到: ${url}` };
}

// 高亮元素
function highlightElement(selector) {
    // 移除之前的高亮
    document.querySelectorAll('.ai-agent-highlight').forEach(el => el.remove());

    const el = document.querySelector(selector);
    if (!el) return;

    const rect = el.getBoundingClientRect();

    const highlight = document.createElement('div');
    highlight.className = 'ai-agent-highlight';
    highlight.style.cssText = `
    position: fixed;
    left: ${rect.left - 4}px;
    top: ${rect.top - 4}px;
    width: ${rect.width + 8}px;
    height: ${rect.height + 8}px;
    border: 3px solid #00d4ff;
    border-radius: 8px;
    background: rgba(0, 212, 255, 0.1);
    pointer-events: none;
    z-index: 999999;
    animation: ai-agent-pulse 0.5s ease-out;
  `;

    // 添加动画样式
    if (!document.getElementById('ai-agent-styles')) {
        const style = document.createElement('style');
        style.id = 'ai-agent-styles';
        style.textContent = `
      @keyframes ai-agent-pulse {
        0% { transform: scale(1.2); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
      }
    `;
        document.head.appendChild(style);
    }

    document.body.appendChild(highlight);

    // 3秒后移除
    setTimeout(() => highlight.remove(), 3000);
}

console.log('🤖 AI Browser Agent: Content script loaded');
