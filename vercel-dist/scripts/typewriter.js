/* ==================== AI 打字机效果 ==================== */

class TypeWriter {
    constructor(element, options = {}) {
        this.element = element;
        this.text = '';
        this.index = 0;
        this.isTyping = false;
        this.callback = null;

        this.config = {
            speed: options.speed || 30,           // 打字速度 (ms)
            cursorChar: options.cursorChar || '▊', // 光标字符
            showCursor: options.showCursor !== false,
            sound: options.sound || false,
            ...options
        };

        if (this.config.showCursor) {
            this.createCursor();
        }
    }

    createCursor() {
        this.cursor = document.createElement('span');
        this.cursor.className = 'typewriter-cursor';
        this.cursor.textContent = this.config.cursorChar;
        this.cursor.style.cssText = `
            animation: blink 1s infinite;
            color: var(--accent, #00d4ff);
        `;

        // 添加光标动画样式
        if (!document.getElementById('typewriter-styles')) {
            const style = document.createElement('style');
            style.id = 'typewriter-styles';
            style.textContent = `
                @keyframes blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0; }
                }
                .typewriter-cursor {
                    font-weight: normal;
                    margin-left: 2px;
                }
            `;
            document.head.appendChild(style);
        }
    }

    async type(text, callback) {
        if (this.isTyping) {
            this.stop();
        }

        this.text = text;
        this.index = 0;
        this.isTyping = true;
        this.callback = callback;
        this.element.innerHTML = '';

        if (this.config.showCursor) {
            this.element.appendChild(this.cursor);
        }

        return new Promise((resolve) => {
            this._typeNext(resolve);
        });
    }

    _typeNext(resolve) {
        if (!this.isTyping) {
            resolve();
            return;
        }

        if (this.index < this.text.length) {
            const char = this.text[this.index];

            // 处理 HTML 标签
            if (char === '<') {
                const endIndex = this.text.indexOf('>', this.index);
                if (endIndex !== -1) {
                    const tag = this.text.slice(this.index, endIndex + 1);
                    this._appendText(tag);
                    this.index = endIndex + 1;
                } else {
                    this._appendChar(char);
                    this.index++;
                }
            } else if (char === '\n') {
                this._appendText('<br>');
                this.index++;
            } else {
                this._appendChar(char);
                this.index++;
            }

            // 根据字符调整速度
            let delay = this.config.speed;
            if (char === '。' || char === '！' || char === '？' || char === '.') {
                delay = this.config.speed * 5;
            } else if (char === '，' || char === ',') {
                delay = this.config.speed * 3;
            }

            setTimeout(() => this._typeNext(resolve), delay);
        } else {
            this.isTyping = false;
            if (this.cursor) {
                this.cursor.remove();
            }
            if (this.callback) {
                this.callback();
            }
            resolve();
        }
    }

    _appendChar(char) {
        const textNode = document.createTextNode(char);
        if (this.cursor && this.cursor.parentNode) {
            this.element.insertBefore(textNode, this.cursor);
        } else {
            this.element.appendChild(textNode);
        }
    }

    _appendText(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        while (temp.firstChild) {
            if (this.cursor && this.cursor.parentNode) {
                this.element.insertBefore(temp.firstChild, this.cursor);
            } else {
                this.element.appendChild(temp.firstChild);
            }
        }
    }

    stop() {
        this.isTyping = false;
        if (this.cursor) {
            this.cursor.remove();
        }
    }

    // 立即显示全部文本
    complete() {
        this.stop();
        this.element.innerHTML = this.text.replace(/\n/g, '<br>');
    }
}

// 工具函数：为元素添加打字效果
function typewriterEffect(element, text, options = {}) {
    const tw = new TypeWriter(element, options);
    return tw.type(text);
}

// 导出到全局
window.TypeWriter = TypeWriter;
window.typewriterEffect = typewriterEffect;
