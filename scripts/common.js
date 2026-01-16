/* ==================== AI Hub 公共脚本 ==================== */

// API 基础路径（使用相对路径以便部署）
const API_BASE = '/api';

/* ===== 主题管理 ===== */
const ThemeManager = {
    init() {
        const savedTheme = localStorage.getItem('ai-hub-theme') || 'dark';
        this.setTheme(savedTheme);
        this.bindEvents();
    },

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('ai-hub-theme', theme);
        this.updateButtons(theme);
    },

    updateButtons(theme) {
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-theme') === theme);
        });
    },

    bindEvents() {
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.getAttribute('data-theme');
                this.setTheme(theme);
            });
        });
    }
};

/* ===== 用户认证管理 ===== */
const AuthManager = {
    getToken() {
        return localStorage.getItem('ai-hub-token');
    },

    getUser() {
        const userStr = localStorage.getItem('ai-hub-user');
        if (!userStr) return null;
        try {
            return JSON.parse(userStr);
        } catch (e) {
            return null;
        }
    },

    setAuth(token, user) {
        localStorage.setItem('ai-hub-token', token);
        localStorage.setItem('ai-hub-user', JSON.stringify(user));
    },

    clearAuth() {
        localStorage.removeItem('ai-hub-token');
        localStorage.removeItem('ai-hub-user');
    },

    isLoggedIn() {
        return !!this.getToken();
    },

    async verifyToken() {
        const token = this.getToken();
        if (!token) return false;

        try {
            const res = await fetch(`${API_BASE}/verify`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) {
                this.clearAuth();
                return false;
            }
            return true;
        } catch (error) {
            console.error('Token verification failed:', error);
            return false;
        }
    },

    logout() {
        this.clearAuth();
        this.updateUI();
        // 如果在需要登录的页面，跳转到首页
        if (window.location.pathname.includes('profile')) {
            window.location.href = 'index.html';
        }
    },

    updateUI() {
        const loginBtn = document.getElementById('loginBtn');
        const userProfile = document.getElementById('userProfile');
        const userAvatar = document.getElementById('userAvatar');
        const userName = document.getElementById('userName');

        if (!loginBtn || !userProfile) return;

        const user = this.getUser();
        const isLoggedIn = this.isLoggedIn() && user;

        if (isLoggedIn) {
            loginBtn.style.display = 'none';
            userProfile.classList.add('show');
            if (userAvatar) userAvatar.src = user.avatar || '';
            if (userName) userName.textContent = user.username || '';
        } else {
            loginBtn.style.display = 'block';
            userProfile.classList.remove('show');
        }
    },

    init() {
        this.updateUI();
        // 绑定退出登录事件
        document.querySelectorAll('.logout-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        });
    }
};

/* ===== 移动端菜单 ===== */
const MobileMenu = {
    init() {
        const menuToggle = document.querySelector('.menu-toggle');
        const navLinks = document.querySelector('.nav-links');

        if (menuToggle && navLinks) {
            menuToggle.addEventListener('click', () => {
                navLinks.classList.toggle('show');
                menuToggle.textContent = navLinks.classList.contains('show') ? '✕' : '☰';
            });

            // 点击链接后关闭菜单
            navLinks.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', () => {
                    navLinks.classList.remove('show');
                    menuToggle.textContent = '☰';
                });
            });
        }
    }
};

/* ===== 导航高亮 ===== */
const NavHighlight = {
    init() {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        document.querySelectorAll('.nav-links a').forEach(link => {
            const href = link.getAttribute('href');
            if (href === currentPage || (currentPage === '' && href === 'index.html')) {
                link.classList.add('active');
            }
        });
    }
};

/* ===== 工具函数 ===== */
const Utils = {
    // HTML 转义（防止 XSS）
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // 显示状态消息
    showStatus(elementId, message, type = 'info') {
        const el = document.getElementById(elementId);
        if (!el) return;
        el.textContent = message;
        el.className = `status-message show ${type}`;
    },

    // 隐藏状态消息
    hideStatus(elementId) {
        const el = document.getElementById(elementId);
        if (el) el.classList.remove('show');
    },

    // 格式化日期
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;

        // 小于1分钟
        if (diff < 60000) return '刚刚';
        // 小于1小时
        if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
        // 小于24小时
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
        // 小于7天
        if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
        // 其他
        return date.toLocaleDateString('zh-CN');
    },

    // 防抖
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // 带认证的 fetch
    async authFetch(url, options = {}) {
        const token = AuthManager.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return fetch(url, { ...options, headers });
    }
};

/* ===== 初始化 ===== */
document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();
    AuthManager.init();
    MobileMenu.init();
    NavHighlight.init();
});

// 导出供其他脚本使用
window.AIHub = {
    API_BASE,
    ThemeManager,
    AuthManager,
    MobileMenu,
    NavHighlight,
    Utils
};
