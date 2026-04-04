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
        localStorage.removeItem('authToken'); localStorage.removeItem('user');
        window.location.href = 'login.html';
    });
    document.getElementById('notifIcon')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('notifDropdown')?.classList.toggle('open');
    });
}

async function loadCart() {
    const cartLayout = document.getElementById('cartLayout');
    const emptyCart = document.getElementById('emptyCart');
    const cartItemsEl = document.getElementById('cartItems');
    let items = [];

    if (getToken()) {
        try {
            const res = await fetch(`${API_URL}/cart`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
            items = await res.json();
            if (!Array.isArray(items)) items = [];
        } catch(e) { items = []; }
    } else {
        items = JSON.parse(localStorage.getItem('guestCart') || '[]');
    }

    if (items.length === 0) {
        cartLayout.style.display = 'none';
        emptyCart.style.display = '';
        return;
    }

    cartLayout.style.display = 'grid';
    emptyCart.style.display = 'none';

    cartItemsEl.innerHTML = items.map(item => {
        const name = item.name || 'Product';
        const price = Number(item.price);
        const img = item.image_url || 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=200';
        const qty = item.quantity;
        const itemId = item.id || item.product_id;

        return `
            <div class="cart-item" data-id="${itemId}">
                <img src="${img}" alt="${name}">
                <div class="cart-item-info">
                    <div class="cart-item-name">${name}</div>
                    <div class="cart-item-price">₹${price.toLocaleString('en-IN')}</div>
                </div>
                <div class="qty-controls">
                    <button class="qty-btn" data-action="decrease" data-id="${itemId}">−</button>
                    <span class="qty-value">${qty}</span>
                    <button class="qty-btn" data-action="increase" data-id="${itemId}">+</button>
                </div>
                <button class="btn-remove" data-id="${itemId}" title="Remove">✕</button>
            </div>
        `;
    }).join('');

    // Calculate totals
    const subtotal = items.reduce((sum, i) => sum + (Number(i.price) * i.quantity), 0);
    document.getElementById('subtotal').textContent = `₹${subtotal.toLocaleString('en-IN')}`;
    document.getElementById('totalPrice').textContent = `₹${subtotal.toLocaleString('en-IN')}`;

    // Update badge
    const badge = document.getElementById('cartBadge');
    const totalQty = items.reduce((s, i) => s + i.quantity, 0);
    if (badge) { badge.textContent = totalQty; badge.style.display = totalQty > 0 ? 'flex' : 'none'; }

    // Event listeners
    cartItemsEl.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', () => handleQty(btn.dataset.id, btn.dataset.action, items));
    });

    cartItemsEl.querySelectorAll('.btn-remove').forEach(btn => {
        btn.addEventListener('click', () => handleRemove(btn.dataset.id));
    });
}

async function handleQty(itemId, action, items) {
    if (getToken()) {
        const item = items.find(i => i.id == itemId);
        if (!item) return;
        let newQty = action === 'increase' ? item.quantity + 1 : item.quantity - 1;
        if (newQty < 1) { handleRemove(itemId); return; }
        try {
            await fetch(`${API_URL}/cart/${itemId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                body: JSON.stringify({ quantity: newQty })
            });
            loadCart();
        } catch(e) { showAlert('Failed to update quantity'); }
    } else {
        let cart = JSON.parse(localStorage.getItem('guestCart') || '[]');
        const item = cart.find(i => i.product_id == itemId);
        if (!item) return;
        if (action === 'increase') item.quantity++;
        else if (item.quantity > 1) item.quantity--;
        else { cart = cart.filter(i => i.product_id != itemId); }
        localStorage.setItem('guestCart', JSON.stringify(cart));
        loadCart();
    }
}

async function handleRemove(itemId) {
    if (getToken()) {
        try {
            await fetch(`${API_URL}/cart/${itemId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            showAlert('Item removed', false);
            loadCart();
        } catch(e) { showAlert('Failed to remove item'); }
    } else {
        let cart = JSON.parse(localStorage.getItem('guestCart') || '[]');
        cart = cart.filter(i => i.product_id != itemId);
        localStorage.setItem('guestCart', JSON.stringify(cart));
        showAlert('Item removed', false);
        loadCart();
    }
}

document.getElementById('checkoutBtn')?.addEventListener('click', () => {
    if (!getToken()) {
        showAlert('Please login to checkout');
        setTimeout(() => window.location.href = 'login.html', 1500);
        return;
    }
    window.location.href = 'checkout.html';
});

document.addEventListener('DOMContentLoaded', () => { initNav(); loadCart(); });
