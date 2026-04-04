// API_URL is loaded from config.js (included in HTML before this file)

function getToken() { return localStorage.getItem('authToken'); }
function getUser() { try { return JSON.parse(localStorage.getItem('user')); } catch(e) { return null; } }

function initNav() {
    const user = getUser();
    const userMenu = document.getElementById('userMenu');
    const loginLink = document.getElementById('loginLink');
    if (user && getToken()) {
        if (userMenu) { userMenu.style.display = 'flex'; document.getElementById('userName').textContent = user.username; }
        if (loginLink) loginLink.style.display = 'none';
    } else {
        window.location.href = 'login.html';
        return;
    }
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        localStorage.removeItem('authToken'); localStorage.removeItem('user');
        window.location.href = 'login.html';
    });
    document.getElementById('notifIcon')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('notifDropdown')?.classList.toggle('open');
    });
    loadNotifications();
}

async function loadNotifications() {
    if (!getToken()) return;
    try {
        const res = await fetch(`${API_URL}/notifications`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
        const notifs = await res.json();
        const list = document.getElementById('notifList');
        const badge = document.getElementById('notifBadge');
        if (!Array.isArray(notifs) || notifs.length === 0) return;
        const unread = notifs.filter(n => !n.is_read).length;
        if (unread > 0 && badge) { badge.textContent = unread; badge.style.display = 'flex'; }
        if (list) {
            list.innerHTML = notifs.slice(0, 10).map(n => `
                <div class="notif-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}">
                    <div class="notif-title">${n.title}</div>
                    <div class="notif-message">${n.message}</div>
                    <div class="notif-time">${new Date(n.created_at).toLocaleDateString()}</div>
                </div>
            `).join('');
        }
    } catch(e) {}
}

async function loadOrders() {
    const container = document.getElementById('ordersList');

    try {
        const res = await fetch(`${API_URL}/orders`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
        const orders = await res.json();

        if (!Array.isArray(orders) || orders.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No orders yet</h3>
                    <p>Start shopping to see your orders here.</p>
                    <a href="shop.html" class="btn-primary">Browse Products</a>
                </div>
            `;
            return;
        }

        container.innerHTML = orders.map(order => `
            <div class="order-card">
                <div class="order-header">
                    <div>
                        <span class="order-id">Order #${order.id}</span>
                        <span class="order-date"> · ${new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <span class="order-status status-${order.status}">${order.status}</span>
                </div>
                <div class="order-items-list">
                    ${(order.items || []).map(item => `
                        <div class="order-item-row">
                            <img src="${item.image_url || 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=100'}" alt="${item.name}">
                            <span>${item.name} × ${item.quantity}</span>
                            <span style="margin-left:auto; font-weight:600;">₹${(Number(item.price_at_purchase) * item.quantity).toLocaleString('en-IN')}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="order-total">Total: ₹${Number(order.total).toLocaleString('en-IN')}</div>
            </div>
        `).join('');
    } catch(e) {
        container.innerHTML = '<div class="empty-state"><h3>Error loading orders</h3><p>Please try again.</p></div>';
    }
}

document.addEventListener('DOMContentLoaded', () => { initNav(); loadOrders(); });
