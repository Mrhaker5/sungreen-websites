// API_URL is loaded from config.js (included in HTML before this file)

function getToken() { return localStorage.getItem('authToken'); }
function getUser() { try { return JSON.parse(localStorage.getItem('user')); } catch(e) { return null; } }

function showAlert(msg, isError = true) {
    const el = document.getElementById('alertMsg');
    if (!el) return;
    el.textContent = msg;
    el.className = 'alert show ' + (isError ? 'error' : 'success');
    setTimeout(() => el.className = 'alert', 4000);
}

function initNav() {
    const user = getUser();
    const userMenu = document.getElementById('userMenu');
    const loginLink = document.getElementById('loginLink');
    if (user && getToken()) {
        if (userMenu) { userMenu.style.display = 'flex'; document.getElementById('userName').textContent = user.username; }
        if (loginLink) loginLink.style.display = 'none';
    } else {
        if (userMenu) userMenu.style.display = 'none';
        if (loginLink) loginLink.style.display = '';
    }

    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    });

    updateCartBadge();
    loadNotifications();

    document.getElementById('notifIcon')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('notifDropdown')?.classList.toggle('open');
    });
}

async function updateCartBadge() {
    const badge = document.getElementById('cartBadge');
    if (!badge) return;

    if (getToken()) {
        try {
            const res = await fetch(`${API_URL}/cart`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
            const items = await res.json();
            if (Array.isArray(items) && items.length > 0) {
                badge.textContent = items.reduce((s, i) => s + i.quantity, 0);
                badge.style.display = 'flex';
            } else { badge.style.display = 'none'; }
        } catch(e) { badge.style.display = 'none'; }
    } else {
        const cart = JSON.parse(localStorage.getItem('guestCart') || '[]');
        if (cart.length > 0) {
            badge.textContent = cart.reduce((s, i) => s + i.quantity, 0);
            badge.style.display = 'flex';
        } else { badge.style.display = 'none'; }
    }
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

            list.querySelectorAll('.notif-item.unread').forEach(el => {
                el.addEventListener('click', async () => {
                    await fetch(`${API_URL}/notifications/${el.dataset.id}/read`, {
                        method: 'PUT', headers: { 'Authorization': `Bearer ${getToken()}` }
                    });
                    el.classList.remove('unread');
                    const remaining = list.querySelectorAll('.unread').length;
                    if (remaining === 0 && badge) badge.style.display = 'none';
                    else if (badge) badge.textContent = remaining;
                });
            });
        }
    } catch(e) { console.error('Notification error:', e); }
}

async function loadProducts() {
    const grid = document.getElementById('productGrid');
    try {
        const res = await fetch(`${API_URL}/products`);
        const products = await res.json();

        if (!Array.isArray(products) || products.length === 0) {
            grid.innerHTML = '<div class="empty-state"><h3>No products yet</h3><p>Check back soon for our solar product listings!</p></div>';
            return;
        }

        grid.innerHTML = products.map(p => `
            <div class="product-card">
                <img src="${p.image_url || 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=600'}" alt="${p.name}" loading="lazy">
                <div class="product-info">
                    <div class="product-category">${p.category || 'Solar'}</div>
                    <div class="product-name">${p.name}</div>
                    <div class="product-desc">${p.description || ''}</div>
                    <div class="product-bottom">
                        <div>
                            <div class="product-price">₹${Number(p.price).toLocaleString('en-IN')}</div>
                            <div class="product-stock ${p.stock > 0 ? '' : 'out'}">${p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}</div>
                        </div>
                        <button class="btn-add-cart" data-id="${p.id}" data-name="${p.name}" data-price="${p.price}" data-img="${p.image_url || ''}" ${p.stock <= 0 ? 'disabled' : ''}>
                            ${p.stock > 0 ? 'Add to Cart' : 'Sold Out'}
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        grid.querySelectorAll('.btn-add-cart').forEach(btn => {
            btn.addEventListener('click', () => addToCart(btn.dataset));
        });
    } catch(err) {
        grid.innerHTML = '<div class="empty-state"><h3>Error loading products</h3><p>Please try again later.</p></div>';
    }
}

async function addToCart(data) {
    if (getToken()) {
        try {
            const res = await fetch(`${API_URL}/cart`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                body: JSON.stringify({ product_id: data.id, quantity: 1 })
            });
            const result = await res.json();
            if (res.ok) { showAlert('Added to cart!', false); updateCartBadge(); }
            else showAlert(result.error || 'Failed to add');
        } catch(e) { showAlert('Network error'); }
    } else {
        let cart = JSON.parse(localStorage.getItem('guestCart') || '[]');
        const existing = cart.find(i => i.product_id == data.id);
        if (existing) { existing.quantity++; }
        else { cart.push({ product_id: data.id, name: data.name, price: data.price, image_url: data.img, quantity: 1 }); }
        localStorage.setItem('guestCart', JSON.stringify(cart));
        showAlert('Added to cart!', false);
        updateCartBadge();
    }
}

document.addEventListener('DOMContentLoaded', () => { initNav(); loadProducts(); });
