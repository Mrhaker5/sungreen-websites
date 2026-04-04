// API_URL is loaded from config.js (included in HTML before this file)

function getToken() { return localStorage.getItem('authToken'); }
function getUser() { try { return JSON.parse(localStorage.getItem('user')); } catch(e) { return null; } }

function checkAdmin() {
    const user = getUser();
    if (!user || !getToken() || user.role !== 'admin') {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

function showAdminAlert(msg, isError = true) {
    const el = document.getElementById('adminAlert');
    if (!el) return;
    el.textContent = msg;
    el.className = 'admin-alert show ' + (isError ? 'error' : 'success');
    setTimeout(() => el.className = 'admin-alert', 4000);
}

async function adminFetch(url, options = {}) {
    const defaults = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
        }
    };
    const merged = { ...defaults, ...options, headers: { ...defaults.headers, ...(options.headers || {}) } };
    return fetch(`${API_URL}${url}`, merged);
}

function adminLogout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

function initSidebar() {
    document.getElementById('adminLogoutBtn')?.addEventListener('click', adminLogout);
}
