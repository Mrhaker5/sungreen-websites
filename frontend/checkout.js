// API_URL is loaded from config.js (included in HTML before this file)

function getToken() { return localStorage.getItem('authToken'); }
function getUser() { try { return JSON.parse(localStorage.getItem('user')); } catch(e) { return null; } }

function showAlert(msg, isError = true) {
    const el = document.getElementById('alertMsg');
    if (!el) return;
    el.textContent = msg;
    el.className = 'alert show ' + (isError ? 'error' : 'success');
    setTimeout(() => el.className = 'alert', 5000);
}

function initNav() {
    const user = getUser();
    const userMenu = document.getElementById('userMenu');
    const loginLink = document.getElementById('loginLink');
    if (user && getToken()) {
        if (userMenu) { userMenu.style.display = 'flex'; document.getElementById('userName').textContent = user.username; }
        if (loginLink) loginLink.style.display = 'none';
    }
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        localStorage.removeItem('authToken'); localStorage.removeItem('user');
        window.location.href = 'login.html';
    });
}

let cartItems = [];
let totalAmount = 0;

async function loadCheckoutSummary() {
    if (!getToken()) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const res = await fetch(`${API_URL}/cart`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
        cartItems = await res.json();
        if (!Array.isArray(cartItems) || cartItems.length === 0) {
            window.location.href = 'cart.html';
            return;
        }

        const itemsEl = document.getElementById('checkoutItems');
        itemsEl.innerHTML = cartItems.map(item => `
            <div class="summary-row" style="font-size:0.85rem;">
                <span>${item.name} × ${item.quantity}</span>
                <span>₹${(Number(item.price) * item.quantity).toLocaleString('en-IN')}</span>
            </div>
        `).join('');

        totalAmount = cartItems.reduce((sum, i) => sum + (Number(i.price) * i.quantity), 0);
        document.getElementById('subtotal').textContent = `₹${totalAmount.toLocaleString('en-IN')}`;
        document.getElementById('totalPrice').textContent = `₹${totalAmount.toLocaleString('en-IN')}`;
    } catch(e) {
        showAlert('Failed to load cart');
    }
}

document.getElementById('checkoutForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const shipping_address = document.getElementById('shippingAddress').value;
    const shipping_city = document.getElementById('shippingCity').value;
    const shipping_pincode = document.getElementById('shippingPincode').value;
    const shipping_phone = document.getElementById('shippingPhone').value;

    if (!shipping_address || !shipping_city || !shipping_pincode || !shipping_phone) {
        showAlert('Please fill all shipping fields');
        return;
    }

    const payBtn = document.getElementById('payBtn');
    payBtn.disabled = true;
    payBtn.textContent = 'Processing...';

    try {
        // 1. Create order in database
        const orderRes = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ shipping_address, shipping_city, shipping_pincode, shipping_phone })
        });
        const orderData = await orderRes.json();

        if (!orderRes.ok) {
            showAlert(orderData.error || 'Failed to create order');
            payBtn.disabled = false;
            payBtn.textContent = '💳 Pay with Razorpay';
            return;
        }

        // 2. Create Razorpay payment order
        const payRes = await fetch(`${API_URL}/payments/create-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
            body: JSON.stringify({ amount: orderData.total, orderId: orderData.orderId })
        });
        const payData = await payRes.json();

        if (!payRes.ok) {
            showAlert(payData.error || 'Payment initialization failed');
            payBtn.disabled = false;
            payBtn.textContent = '💳 Pay with Razorpay';
            return;
        }

        // 3. Open Razorpay modal
        const user = getUser();
        const options = {
            key: payData.key,
            amount: payData.amount,
            currency: payData.currency,
            name: 'SunGreen Energy',
            description: `Order #${orderData.orderId}`,
            order_id: payData.id,
            handler: async function (response) {
                // 4. Verify payment
                try {
                    const verifyRes = await fetch(`${API_URL}/payments/verify`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                        body: JSON.stringify({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            orderId: orderData.orderId
                        })
                    });
                    const verifyData = await verifyRes.json();

                    if (verifyRes.ok) {
                        showAlert('Payment successful! Redirecting to orders...', false);
                        setTimeout(() => window.location.href = 'orders.html', 2000);
                    } else {
                        showAlert(verifyData.error || 'Payment verification failed');
                    }
                } catch(e) {
                    showAlert('Payment verification error');
                }
            },
            prefill: {
                name: user?.username || '',
                email: user?.email || ''
            },
            theme: { color: '#0f766e' },
            modal: {
                ondismiss: function() {
                    showAlert('Payment cancelled');
                    payBtn.disabled = false;
                    payBtn.textContent = '💳 Pay with Razorpay';
                }
            }
        };

        const rzp = new Razorpay(options);
        rzp.on('payment.failed', function(response) {
            showAlert('Payment failed: ' + response.error.description);
            payBtn.disabled = false;
            payBtn.textContent = '💳 Pay with Razorpay';
        });
        rzp.open();

    } catch(e) {
        showAlert('Something went wrong. Please try again.');
        payBtn.disabled = false;
        payBtn.textContent = '💳 Pay with Razorpay';
    }
});

document.addEventListener('DOMContentLoaded', () => { initNav(); loadCheckoutSummary(); });
