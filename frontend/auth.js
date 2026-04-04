// API_URL is loaded from config.js (included in HTML before this file)

function showAlert(message, isError = true) {
    const alertEl = document.getElementById('alertMsg');
    alertEl.textContent = message;
    alertEl.className = 'msg-alert ' + (isError ? 'error' : 'success');
}

function clearAlert() {
    const alertEl = document.getElementById('alertMsg');
    alertEl.className = 'msg-alert';
    alertEl.textContent = '';
}

function setLoading(isLoading) {
    const submitBtn = document.getElementById('submitBtn');
    if (isLoading) {
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;
    } else {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
}

// Logic for Registration
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAlert();
        setLoading(true);
        
        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            const data = await response.json();

            if (!response.ok) {
                showAlert(data.error || 'Registration failed');
            } else {
                showAlert('Registration successful! Redirecting...', false);
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 1500);
            }
        } catch (error) {
            showAlert('Network error. Is the server running?');
        } finally {
            setLoading(false);
        }
    });
}

// Logic for Login
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAlert();
        setLoading(true);
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();

            if (!response.ok) {
                showAlert(data.error || 'Login failed');
            } else {
                // Save JWT to localStorage (login session)
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                showAlert('Login successful! Redirecting...', false);
                setTimeout(() => {
                    // Redirect admin to admin panel, users to main site
                    if (data.user.role === 'admin') {
                        window.location.href = 'admin/index.html';
                    } else {
                        window.location.href = 'index.html';
                    }
                }, 1000);
            }
        } catch (error) {
            showAlert('Network error. Is the server running?');
        } finally {
            setLoading(false);
        }
    });
}

// Logic for Forgot Password
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAlert();
        setLoading(true);
        
        const email = document.getElementById('email').value;

        try {
            const response = await fetch(`${API_URL}/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await response.json();

            if (!response.ok) {
                showAlert(data.error || 'Request failed');
            } else {
                showAlert(data.message || 'Reset link sent successfully to your email.', false);
                forgotPasswordForm.reset();
            }
        } catch (error) {
            showAlert('Network error. Is the server running?');
        } finally {
            setLoading(false);
        }
    });
}

// Logic for Reset Password
const resetPasswordForm = document.getElementById('resetPasswordForm');
if (resetPasswordForm) {
    resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearAlert();
        setLoading(true);
        
        const token = document.getElementById('token').value;
        const email = document.getElementById('email').value;
        const newPassword = document.getElementById('newPassword').value;

        try {
            const response = await fetch(`${API_URL}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, email, newPassword })
            });
            const data = await response.json();

            if (!response.ok) {
                showAlert(data.error || 'Reset failed');
            } else {
                showAlert('Password reset successful! Redirecting to login...', false);
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            }
        } catch (error) {
            showAlert('Network error. Is the server running?');
        } finally {
            setLoading(false);
        }
    });
}
