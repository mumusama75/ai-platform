/**
 * layout.js - Global Logic for AI Hub
 * Handles Theme Toggling, Auth State, and Navigation
 */

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initAuth();
});

/* =========================================
   Theme Logic (SVG Icons)
   ========================================= */
function initTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const html = document.documentElement;

    // SVG Icons
    const getSunIcon = () => `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;

    const getMoonIcon = () => `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

    function updateIcon(theme) {
        if (!themeToggle) return;
        // Light mode shows Moon (switch to dark), Dark mode shows Sun (switch to light)
        themeToggle.innerHTML = theme === 'light' ? getMoonIcon() : getSunIcon();
    }

    // Init Logic
    const savedTheme = localStorage.getItem('ai-hub-theme');
    if (savedTheme) {
        html.setAttribute('data-theme', savedTheme);
        updateIcon(savedTheme);
    } else {
        // Default to dark or system preference if needed. 
        // For this design, we default to whatever is set in HTML or dark.
        const currentParams = html.getAttribute('data-theme') || 'dark';
        updateIcon(currentParams);
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = html.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';

            html.setAttribute('data-theme', newTheme);
            localStorage.setItem('ai-hub-theme', newTheme);
            updateIcon(newTheme);
        });
    }
}

/* =========================================
   Auth Logic
   ========================================= */
function initAuth() {
    const token = localStorage.getItem('ai-hub-token');
    const userStr = localStorage.getItem('ai-hub-user');

    const loginBtn = document.getElementById('loginBtn');
    const userArea = document.getElementById('userArea');
    const userName = document.getElementById('userName');

    if (token && userStr) {
        try {
            const user = JSON.parse(userStr);

            // UI Update
            if (loginBtn) loginBtn.style.display = 'none';
            if (userArea) {
                userArea.style.display = 'flex';
                if (userName) {
                    userName.textContent = user.username;

                    // Add Logout capability
                    userName.title = "点击退出登录";
                    userName.style.cursor = "pointer";
                    userName.onclick = handleLogout;
                }
            }
        } catch (e) {
            console.error('Auth check invalid:', e);
            // Optionally clear bad data
            // localStorage.removeItem('ai-hub-token');
        }
    }
}

function handleLogout() {
    if (confirm('确定要退出登录吗？')) {
        localStorage.removeItem('ai-hub-token');
        localStorage.removeItem('ai-hub-user');
        window.location.reload();
    }
}
