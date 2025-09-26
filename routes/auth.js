// Authentication Management - Fixed Version with dynamic URLs
let currentUser = null;

// Get server base URL dynamically
function getServerBaseUrl() {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return 'https://maman-algerienne.onrender.com';
    }
    return 'http://localhost:5000';
}

const SERVER_BASE_URL = getServerBaseUrl();
const API_BASE_URL = SERVER_BASE_URL + '/api';

// Check authentication status on page load
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    setupMobileAuthMenu();
});

// Setup mobile auth menu
function setupMobileAuthMenu() {
    const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
    const mobileProfileLink = document.getElementById('mobile-profile-link');
    const mobileAdminLink = document.getElementById('mobile-admin-link');

    if (mobileLogoutBtn) {
        mobileLogoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }

    if (mobileProfileLink) {
        mobileProfileLink.addEventListener('click', (e) => {
            e.preventDefault();
            navigateToProfile();
        });
    }

    if (mobileAdminLink) {
        mobileAdminLink.addEventListener('click', (e) => {
            e.preventDefault();
            navigateToAdmin();
        });
    }
}

// Check if user is logged in
async function checkAuthStatus() {
    const token = localStorage.getItem('token');
    const rememberMe = localStorage.getItem('rememberMe') === 'true';
    
    if (!token) {
        showGuestMenu();
        return;
    }
    
    // If remember me is false and session expired, logout
    if (!rememberMe) {
        const loginTime = localStorage.getItem('loginTime');
        const currentTime = new Date().getTime();
        const sessionDuration = 24 * 60 * 60 * 1000; // 24 hours
        
        if (currentTime - loginTime > sessionDuration) {
            logout();
            return;
        }
    }
    
    // For test token, use stored user data
    if (token === 'test-admin-token') {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                currentUser = JSON.parse(storedUser);
                showUserMenu(currentUser);
                return;
            } catch (error) {
                console.error('Error parsing stored user:', error);
                logout();
                return;
            }
        }
    }
    
    // Try to validate with backend
    try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            showUserMenu(data.user);
        } else {
            console.warn('Auth validation failed:', response.status);
            
            // If backend is down but we have stored user data, use it
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                try {
                    currentUser = JSON.parse(storedUser);
                    showUserMenu(currentUser);
                } catch (parseError) {
                    logout();
                }
            } else {
                logout();
            }
        }
    } catch (error) {
        console.error('Auth check error:', error);
        
        // If backend is down but we have stored user data, use it
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                currentUser = JSON.parse(storedUser);
                showUserMenu(currentUser);
            } catch (parseError) {
                logout();
            }
        } else {
            logout();
        }
    }
}

// Show guest menu
function showGuestMenu() {
    const guestMenu = document.getElementById('user-menu-guest');
    const loggedMenu = document.getElementById('user-menu-logged');
    const mobileGuestMenu = document.getElementById('mobile-auth-guest');
    const mobileLoggedMenu = document.getElementById('mobile-auth-logged');
    
    if (guestMenu) guestMenu.style.display = 'flex';
    if (loggedMenu) loggedMenu.style.display = 'none';
    if (mobileGuestMenu) mobileGuestMenu.style.display = 'flex';
    if (mobileLoggedMenu) mobileLoggedMenu.classList.remove('show');
}

// Show user menu
function showUserMenu(user) {
    const guestMenu = document.getElementById('user-menu-guest');
    const loggedMenu = document.getElementById('user-menu-logged');
    const userName = document.getElementById('user-name');
    const userAvatarImg = document.getElementById('user-avatar-img');
    
    // Mobile elements
    const mobileGuestMenu = document.getElementById('mobile-auth-guest');
    const mobileLoggedMenu = document.getElementById('mobile-auth-logged');
    const mobileUserName = document.getElementById('mobile-user-name');
    const mobileUserAvatar = document.getElementById('mobile-user-avatar');
    const mobileAdminLink = document.getElementById('mobile-admin-link');
    
    // Desktop menu
    if (guestMenu) guestMenu.style.display = 'none';
    if (loggedMenu) loggedMenu.style.display = 'block';
    
    if (userName) userName.textContent = user.name;
    
    if (userAvatarImg) {
        const avatarUrl = user.avatar 
            ? `${SERVER_BASE_URL}/uploads/avatars/${user.avatar}`
            : `https://via.placeholder.com/35x35/d4a574/ffffff?text=${encodeURIComponent(user.name.charAt(0))}`;
        userAvatarImg.src = avatarUrl;
        userAvatarImg.onerror = function() {
            this.src = `https://via.placeholder.com/35x35/d4a574/ffffff?text=${encodeURIComponent(user.name.charAt(0))}`;
        };
    }
    
    // Mobile menu
    if (mobileGuestMenu) mobileGuestMenu.style.display = 'none';
    if (mobileLoggedMenu) mobileLoggedMenu.classList.add('show');
    
    if (mobileUserName) mobileUserName.textContent = user.name;
    
    if (mobileUserAvatar) {
        const avatarUrl = user.avatar 
            ? `${SERVER_BASE_URL}/uploads/avatars/${user.avatar}`
            : `https://via.placeholder.com/40x40/d4a574/ffffff?text=${encodeURIComponent(user.name.charAt(0))}`;
        mobileUserAvatar.src = avatarUrl;
        mobileUserAvatar.onerror = function() {
            this.src = `https://via.placeholder.com/40x40/d4a574/ffffff?text=${encodeURIComponent(user.name.charAt(0))}`;
        };
    }
    
    // Show admin links if user is admin
    const adminLink = document.getElementById('admin-link');
    if (adminLink && user.isAdmin) {
        adminLink.style.display = 'block';
    }
    
    if (mobileAdminLink && user.isAdmin) {
        mobileAdminLink.style.display = 'block';
    }

    // Setup navigation links
    setTimeout(() => {
        setupNavigationLinks();
    }, 100);
}

// Setup navigation links
function setupNavigationLinks() {
    const profileLink = document.getElementById('profile-link');
    const myPostsLink = document.getElementById('my-posts-link');
    const mobileProfileLink = document.getElementById('mobile-profile-link');
    
    [profileLink, mobileProfileLink].forEach(link => {
        if (link && !link.dataset.listenerAdded) {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                navigateToProfile();
            });
            link.dataset.listenerAdded = 'true';
        }
    });
    
    if (myPostsLink && !myPostsLink.dataset.listenerAdded) {
        myPostsLink.addEventListener('click', function(e) {
            e.preventDefault();
            if (!isLoggedIn()) {
                showToast('يجب تسجيل الدخول أولاً', 'warning');
                return;
            }
            const currentPath = window.location.pathname;
            if (currentPath.includes('/pages/')) {
                window.location.href = 'my-posts.html';
            } else {
                window.location.href = 'pages/my-posts.html';
            }
        });
        myPostsLink.dataset.listenerAdded = 'true';
    }
}

// Navigation helpers
function navigateToProfile() {
    if (!isLoggedIn()) {
        showToast('يجب تسجيل الدخول أولاً', 'warning');
        return;
    }
    const currentPath = window.location.pathname;
    if (currentPath.includes('/pages/')) {
        window.location.href = 'profile.html';
    } else {
        window.location.href = 'pages/profile.html';
    }
}

function navigateToAdmin() {
    if (!isAdmin()) {
        showToast('هذه الصفحة مخصصة للمديرين فقط', 'error');
        return;
    }
    const currentPath = window.location.pathname;
    if (currentPath.includes('/pages/')) {
        window.location.href = 'admin.html';
    } else {
        window.location.href = 'pages/admin.html';
    }
}

// Login function - FIXED VERSION
async function login(email, password, rememberMe = false) {
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store token and user info
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('rememberMe', rememberMe.toString());
            localStorage.setItem('loginTime', new Date().getTime().toString());
            
            currentUser = data.user;
            showToast('تم تسجيل الدخول بنجاح', 'success');
            
            console.log('User logged in:', data.user);
            console.log('Is Admin:', data.user.isAdmin);
            
            // Update UI immediately
            showUserMenu(data.user);
            
            // Redirect based on user type with a small delay
            setTimeout(() => {
                if (data.user.isAdmin) {
                    console.log('Redirecting to admin page');
                    navigateToAdmin();
                } else {
                    console.log('Redirecting to home page');
                    const currentPath = window.location.pathname;
                    if (currentPath.includes('/pages/')) {
                        window.location.href = '../index.html';
                    } else {
                        window.location.href = 'index.html';
                    }
                }
            }, 1000);
        } else {
            showToast(data.message || 'خطأ في تسجيل الدخول', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('خطأ في الاتصال بالخادم', 'error');
    } finally {
        hideLoading();
    }
}

// Register function
async function register(userData) {
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('rememberMe', 'true');
            localStorage.setItem('loginTime', new Date().getTime().toString());
            
            currentUser = data.user;
            showToast('تم إنشاء الحساب بنجاح', 'success');
            
            setTimeout(() => {
                const currentPath = window.location.pathname;
                if (currentPath.includes('/pages/')) {
                    window.location.href = '../index.html';
                } else {
                    window.location.href = 'index.html';
                }
            }, 1500);
        } else {
            showToast(data.message || 'خطأ في إنشاء الحساب', 'error');
        }
    } catch (error) {
        console.error('Register error:', error);
        showToast('خطأ في الاتصال بالخادم', 'error');
    } finally {
        hideLoading();
    }
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('rememberMe');
    localStorage.removeItem('loginTime');
    
    currentUser = null;
    showGuestMenu();
    showToast('تم تسجيل الخروج بنجاح', 'info');
    
    // Redirect to home if on protected page
    const protectedPages = ['admin.html', 'profile.html', 'my-posts.html'];
    const currentPage = window.location.pathname.split('/').pop();
    
    if (protectedPages.includes(currentPage)) {
        const currentPath = window.location.pathname;
        if (currentPath.includes('/pages/')) {
            window.location.href = '../index.html';
        } else {
            window.location.href = 'index.html';
        }
    }
}

// Get current user
function getCurrentUser() {
    return currentUser;
}

// Check if user is admin
function isAdmin() {
    return currentUser && currentUser.isAdmin;
}

// Check if user is logged in
function isLoggedIn() {
    return currentUser !== null && localStorage.getItem('token') !== null;
}

// Require authentication
function requireAuth() {
    if (!isLoggedIn()) {
        showToast('يجب تسجيل الدخول أولاً', 'warning');
        const currentPath = window.location.pathname;
        if (currentPath.includes('/pages/')) {
            window.location.href = 'login.html';
        } else {
            window.location.href = 'pages/login.html';
        }
        return false;
    }
    return true;
}

// Require admin access
function requireAdmin() {
    if (!requireAuth()) return false;
    
    if (!isAdmin()) {
        showToast('هذه الصفحة مخصصة للمديرين فقط', 'error');
        const currentPath = window.location.pathname;
        if (currentPath.includes('/pages/')) {
            window.location.href = '../index.html';
        } else {
            window.location.href = 'index.html';
        }
        return false;
    }
    return true;
}

// Form validation helpers
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePhone(phone) {
    const phoneRegex = /^[0-9]{10}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
}

function validatePassword(password) {
    return password.length >= 6;
}

// Utility functions
function showLoading() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
        spinner.classList.add('show');
    }
}

function hideLoading() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
        spinner.classList.remove('show');
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) {
        // If no toast container, show alert as fallback
        console.log(`Toast: ${message}`);
        return;
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = getToastIcon(type);
    toast.innerHTML = `
        <i class="${icon}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 5000);
}

function getToastIcon(type) {
    switch (type) {
        case 'success': return 'fas fa-check-circle';
        case 'error': return 'fas fa-exclamation-circle';
        case 'warning': return 'fas fa-exclamation-triangle';
        default: return 'fas fa-info-circle';
    }
}

// Theme management for all pages
function loadSavedTheme() {
    const savedTheme = localStorage.getItem('siteTheme');
    if (savedTheme) {
        try {
            const theme = JSON.parse(savedTheme);
            applyTheme(theme);
        } catch (error) {
            console.error('Error loading saved theme:', error);
        }
    }
}

function applyTheme(theme) {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', theme.primaryColor);
    root.style.setProperty('--secondary-color', theme.secondaryColor);
    root.style.setProperty('--text-color', theme.textColor);
    root.style.setProperty('--gradient', `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`);
}

// Load theme on all pages
document.addEventListener('DOMContentLoaded', function() {
    loadSavedTheme();
});

// Also load theme immediately for faster loading
loadSavedTheme();

// Export functions for global use
window.login = login;
window.register = register;
window.logout = logout;
window.getCurrentUser = getCurrentUser;
window.isAdmin = isAdmin;
window.isLoggedIn = isLoggedIn;
window.requireAuth = requireAuth;
window.requireAdmin = requireAdmin;
window.checkAuthStatus = checkAuthStatus;
window.validateEmail = validateEmail;
window.validatePhone = validatePhone;
window.validatePassword = validatePassword;
window.SERVER_BASE_URL = SERVER_BASE_URL;
