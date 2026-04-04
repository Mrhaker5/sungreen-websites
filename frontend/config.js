// Central API configuration
// Update RENDER_URL after deploying backend to Render
const RENDER_URL = 'https://sungreen-backend.onrender.com';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000/api'
    : `${RENDER_URL}/api`;
