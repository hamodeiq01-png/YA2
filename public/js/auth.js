// Common Auth Helpers

const API_BASE = '/api';

// Save JWT token and user info
function setSession(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

// Get JWT token
function getToken() {
  return localStorage.getItem('token');
}

// Get logged in user info
function getUser() {
  const userStr = localStorage.getItem('user');
  try {
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    return null;
  }
}

// Check if user is logged in
function isLoggedIn() {
  return !!getToken();
}

// Logout user
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/index.html';
}

// Setup headers for API requests
function getAuthHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
}

// Show alert message
function showAlert(alertId, message, type = 'danger') {
  const alertEl = document.getElementById(alertId);
  if (!alertEl) return;
  
  alertEl.textContent = message;
  alertEl.className = `alert alert-${type}`;
  alertEl.style.display = 'block';
  
  // Auto hide after 5 seconds
  setTimeout(() => {
    alertEl.style.display = 'none';
  }, 5000);
}
