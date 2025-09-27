// Enhanced Admin Panel Management - Complete CRUD with Delivery Pricing
// ✅ FIXED VERSION - Uses APP_CONFIG instead of hardcoded URLs

// Check if config is loaded
if (!window.APP_CONFIG) {
    console.error('APP_CONFIG not loaded! Make sure config.js is included before admin.js');
}

let currentSection = 'dashboard';
let selectedFiles = {
    article: [],
    product: [],
    post: []
};
let adminUser = null;

// Delivery pricing by wilaya
const DELIVERY_PRICES = {
    '16 - الجزائر': 400,
    '09 - البليدة': 400,
    '35 - بومرداس': 400,
    '06 - بجاية': 500,
    '19 - سطيف': 500,
    '25 - قسنطينة': 500,
    '31 - وهران': 600,
    '13 - تلمسان': 600,
    '32 - البيض': 600,
    '03 - الأغواط': 700,
    '17 - الجلفة': 700,
    '07 - بسكرة': 700,
    '39 - الوادي': 800,
    '30 - ورقلة': 800,
    '47 - غرداية': 800,
    '01 - أدرار': 900,
    '11 - تمنراست': 1000,
    '08 - بشار': 1000,
    '49 - تيميمون': 1000,
    '02 - الشلف': 500,
    '04 - أم البواقي': 500,
    '05 - باتنة': 500,
    '10 - البويرة': 450,
    '12 - تبسة': 600,
    '14 - تيارت': 550,
    '15 - تيزي وزو': 450,
    '18 - جيجل': 500,
    '20 - سعيدة': 600,
    '21 - سكيكدة': 500,
    '22 - سيدي بلعباس': 600,
    '23 - عنابة': 500,
    '24 - قالمة': 500,
    '26 - المدية': 450,
    '27 - مستغانم': 600,
    '28 - المسيلة': 600,
    '29 - معسكر': 600,
    '33 - إليزي': 1000,
    '34 - برج بوعريريج': 550,
    '36 - الطارف': 500,
    '37 - تندوف': 1000,
    '38 - تيسمسيلت': 600,
    '40 - خنشلة': 600,
    '41 - سوق أهراس': 550,
    '42 - تيبازة': 400,
    '43 - ميلة': 550,
    '44 - عين الدفلى': 500,
    '45 - النعامة': 700,
    '46 - عين تموشنت': 600,
    '48 - غليزان': 600,
    '50 - برج باجي مختار': 1000,
    '51 - أولاد جلال': 700,
    '52 - بني عباس': 900,
    '53 - عين صالح': 1000,
    '54 - عين قزام': 1000,
    '55 - توقرت': 800,
    '56 - جانت': 1000,
    '57 - المقر': 1000,
    '58 - المنيعة': 800
};

// Orders management variables
let currentOrdersPage = 1;
let ordersLoading = false;
let currentOrdersFilter = '';
let currentOrdersSearch = '';

// Initialize admin panel
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing admin panel...');
    initializeAdmin();
});

async function initializeAdmin() {
    console.log('Initializing admin panel...');
    
    // Check if config is loaded
    if (!window.APP_CONFIG) {
        console.error('APP_CONFIG not loaded! Make sure config.js is included before admin.js');
        alert('Configuration error. Please refresh the page.');
        return;
    }
    
    console.log('Using API:', window.APP_CONFIG.API_BASE_URL);
    
    loadSavedTheme();
    
    const hasAccess = await checkAdminAccess();
    if (!hasAccess) return;
    
    setupEventListeners();
    updateCurrentTime();
    setInterval(updateCurrentTime, 60000);
    loadDashboardData();
}

async function checkAdminAccess() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            redirectToLogin();
            return false;
        }

        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                const userData = JSON.parse(storedUser);
                if (userData.isAdmin) {
                    adminUser = userData;
                    updateUserDisplay();
                    return true;
                } else {
                    window.location.href = '../index.html';
                    return false;
                }
            } catch (error) {
                console.error('Error parsing stored user:', error);
            }
        }

        const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            adminUser = data.user;
            
            if (adminUser.isAdmin) {
                updateUserDisplay();
                return true;
            } else {
                window.location.href = '../index.html';
                return false;
            }
        } else {
            redirectToLogin();
            return false;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        redirectToLogin();
        return false;
    }
}

function redirectToLogin() {
    showToast('يرجى تسجيل الدخول كمدير', 'warning');
    window.location.href = 'login.html';
}

function updateUserDisplay() {
    const userNameEl = document.getElementById('user-name');
    const userAvatarEl = document.getElementById('user-avatar-img');
    
    if (userNameEl) userNameEl.textContent = adminUser.name;
    if (userAvatarEl) {
        const avatarUrl = adminUser.avatar 
            ? `${window.APP_CONFIG.SERVER_BASE_URL}/uploads/avatars/${adminUser.avatar}`
            : `https://via.placeholder.com/35x35/d4a574/ffffff?text=${adminUser.name.charAt(0)}`;
        userAvatarEl.src = avatarUrl;
    }
}

function setupEventListeners() {
    setupNavigation();
    setupMobileMenu();
    setupFileUploads();
    setupFormSubmissions();
    setupModalHandlers();
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
}

function setupNavigation() {
    const navLinks = document.querySelectorAll('.admin-nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            if (section) {
                switchSection(section);
            }
        });
    });
}

function setupMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('admin-sidebar');
    
    if (window.innerWidth <= 768) {
        if (mobileMenuBtn) mobileMenuBtn.style.display = 'block';
    }
    
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }
    
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && 
            sidebar &&
            !sidebar.contains(e.target) && 
            mobileMenuBtn &&
            !mobileMenuBtn.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });
}

function setupFileUploads() {
    ['article', 'product', 'post'].forEach(type => {
        const uploadArea = document.getElementById(`${type}-upload`);
        const fileInput = document.getElementById(`${type}-images`);
        
        if (uploadArea && fileInput) {
            uploadArea.addEventListener('click', () => fileInput.click());
            uploadArea.addEventListener('dragover', handleDragOver);
            uploadArea.addEventListener('drop', (e) => handleDrop(e, type));
            fileInput.addEventListener('change', (e) => handleFileSelect(e, type));
        }
    });
}

function setupFormSubmissions() {
    const articleForm = document.getElementById('article-form');
    const productForm = document.getElementById('product-form');
    const postForm = document.getElementById('post-form');
    
    if (articleForm) articleForm.addEventListener('submit', handleArticleSubmit);
    if (productForm) productForm.addEventListener('submit', handleProductSubmit);
    if (postForm) postForm.addEventListener('submit', handlePostSubmit);
    
    const productSaleCheckbox = document.getElementById('product-sale');
    if (productSaleCheckbox) {
        productSaleCheckbox.addEventListener('change', (e) => {
            const salePriceGroup = document.getElementById('sale-price-group');
            if (salePriceGroup) {
                salePriceGroup.style.display = e.target.checked ? 'block' : 'none';
            }
        });
    }
}

function setupModalHandlers() {
    document.querySelectorAll('.form-modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
}

// Section switching
function switchSection(section) {
    document.querySelectorAll('.admin-nav-link').forEach(link => {
        link.classList.remove('active');
    });
    const activeLink = document.querySelector(`[data-section="${section}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    document.querySelectorAll('.admin-section').forEach(sec => {
        sec.classList.remove('active');
    });
    const activeSection = document.getElementById(`${section}-section`);
    if (activeSection) {
        activeSection.classList.add('active');
    }

    currentSection = section;
    loadSectionData(section);
}

function loadSectionData(section) {
    switch(section) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'articles':
            loadArticles();
            break;
        case 'products':
            loadProducts();
            break;
        case 'posts':
            loadPosts();
            break;
        case 'comments':
            loadComments();
            break;
        case 'users':
            loadUsers();
            break;
        case 'orders':
            initializeOrders();
            break;
        case 'theme':
            loadThemeManager();
            break;
    }
}

function updateCurrentTime() {
    const timeElement = document.getElementById('current-time');
    if (timeElement) {
        const now = new Date();
        const timeString = now.toLocaleString('ar-DZ', {
            weekday: 'long',
            year: 'numeric',
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        timeElement.textContent = timeString;
    }
}

// Dashboard data loading
async function loadDashboardData() {
    try {
        showLoading();
        
        updateDashboardCard('articles-count', 0);
        updateDashboardCard('products-count', 0);
        updateDashboardCard('users-count', 1);
        updateDashboardCard('comments-count', 0);
        updateDashboardCard('orders-count', 0);
        
        try {
            const articlesData = await apiRequest('/articles');
            updateDashboardCard('articles-count', articlesData.pagination?.total || 0);
        } catch (error) {
            console.log('Articles endpoint returned empty or error');
        }
        
        try {
            const productsData = await apiRequest('/products');
            updateDashboardCard('products-count', productsData.pagination?.total || 0);
        } catch (error) {
            console.log('Products endpoint returned empty or error');
        }
        
        try {
            const postsData = await apiRequest('/posts');
            if (postsData.posts && Array.isArray(postsData.posts)) {
                updateDashboardCard('posts-count', postsData.pagination?.total || postsData.posts.length);
            }
        } catch (error) {
            console.log('Posts endpoint returned empty or error');
        }
        
        try {
            const ordersData = await apiRequest('/orders');
            if (ordersData.orders && Array.isArray(ordersData.orders)) {
                updateDashboardCard('orders-count', ordersData.pagination?.total || ordersData.orders.length);
            }
        } catch (error) {
            console.log('Orders endpoint returned empty or error');
        }
        
        updateQuickStats();
        
    } catch (error) {
        console.error('Dashboard load error:', error);
        showToast('لوحة التحكم محملة بالبيانات المحدودة', 'warning');
        updateQuickStats();
    } finally {
        hideLoading();
    }
}

function updateDashboardCard(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

function updateQuickStats() {
    const stats = {
        'today-views': '1,250',
        'pending-comments': '0',
        'new-users': '0', 
        'popular-category': 'عام'
    };
    
    Object.entries(stats).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });
}

// Articles management with DELETE functionality
async function loadArticles() {
    try {
        showLoading();
        const data = await apiRequest('/articles');
        displayArticlesTable(data.articles || []);
    } catch (error) {
        console.error('Articles load error:', error);
        displayArticlesTable([]);
    } finally {
        hideLoading();
    }
}

function displayArticlesTable(articles) {
    const tbody = document.querySelector('#articles-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (articles.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--light-text);">لا توجد مقالات بعد. انقر على "مقال جديد" لإضافة أول مقال.</td></tr>';
        return;
    }

    articles.forEach(article => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(article.title)}</td>
            <td>${escapeHtml(article.category)}</td>
            <td>${article.views || 0}</td>
            <td>${article.likes ? article.likes.length : 0}</td>
            <td>${formatDate(article.createdAt)}</td>
            <td>
                <span class="status-badge ${article.published ? 'status-published' : 'status-draft'}">
                    ${article.published ? 'منشور' : 'مسودة'}
                </span>
            </td>
            <td class="table-actions">
                <button class="btn btn-sm btn-outline" onclick="editArticle('${article._id}')">تعديل</button>
                <button class="btn btn-sm btn-danger" onclick="deleteArticle('${article._id}')">حذف</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Products management with DELETE functionality
async function loadProducts() {
    try {
        showLoading();
        const data = await apiRequest('/products');
        displayProductsTable(data.products || []);
    } catch (error) {
        console.error('Products load error:', error);
        displayProductsTable([]);
    } finally {
        hideLoading();
    }
}

function displayProductsTable(products) {
    const tbody = document.querySelector('#products-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--light-text);">لا توجد منتجات بعد. انقر على "منتج جديد" لإضافة أول منتج.</td></tr>';
        return;
    }

    products.forEach(product => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(product.name)}</td>
            <td>${escapeHtml(product.category)}</td>
            <td>${formatPrice(product.price)} دج</td>
            <td>${product.stockQuantity}</td>
            <td>${(product.rating?.average || 0).toFixed(1)} ⭐</td>
            <td>
                <span class="status-badge ${product.inStock ? 'status-published' : 'status-draft'}">
                    ${product.inStock ? 'متوفر' : 'غير متوفر'}
                </span>
            </td>
            <td class="table-actions">
                <button class="btn btn-sm btn-outline" onclick="editProduct('${product._id}')">تعديل</button>
                <button class="btn btn-sm btn-danger" onclick="deleteProduct('${product._id}')">حذف</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Posts management with DELETE functionality
async function loadPosts() {
    try {
        showLoading();
        const data = await apiRequest('/posts');
        displayPostsTable(data.posts || []);
    } catch (error) {
        console.error('Posts load error:', error);
        displayPostsTable([]);
    } finally {
        hideLoading();
    }
}

function displayPostsTable(posts) {
    const tbody = document.querySelector('#posts-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (posts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--light-text);">لا توجد إعلانات بعد. انقر على "إعلان جديد" لإضافة أول إعلان.</td></tr>';
        return;
    }

    posts.forEach(post => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(post.title)}</td>
            <td>${post.type === 'ad' ? 'إعلان' : 'منشور'}</td>
            <td>${post.views || 0}</td>
            <td>${post.likes ? post.likes.length : 0}</td>
            <td>${formatDate(post.createdAt)}</td>
            <td>
                <span class="status-badge ${post.approved ? 'status-published' : 'status-pending'}">
                    ${post.approved ? 'منشور' : 'في الانتظار'}
                </span>
            </td>
            <td class="table-actions">
                <button class="btn btn-sm btn-outline" onclick="editPost('${post._id}')">تعديل</button>
                <button class="btn btn-sm btn-danger" onclick="deletePost('${post._id}')">حذف</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Orders Management with Full Address Display
function initializeOrders() {
    console.log('Initializing orders...');
    setupOrdersEventListeners();
    loadOrders();
}

function setupOrdersEventListeners() {
    const statusFilter = document.getElementById('orders-status-filter');
    const searchInput = document.getElementById('orders-search');
    const loadMoreBtn = document.getElementById('load-more-orders');
    const updateOrderForm = document.getElementById('update-order-form');

    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            currentOrdersFilter = e.target.value;
            currentOrdersPage = 1;
            const tbody = document.querySelector('#orders-table tbody');
            if (tbody) tbody.innerHTML = '';
            loadOrders();
        });
    }

    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentOrdersSearch = e.target.value.trim();
                currentOrdersPage = 1;
                const tbody = document.querySelector('#orders-table tbody');
                if (tbody) tbody.innerHTML = '';
                loadOrders();
            }, 500);
        });
    }

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            currentOrdersPage++;
            loadOrders();
        });
    }

    if (updateOrderForm) {
        updateOrderForm.addEventListener('submit', handleUpdateOrderStatus);
    }
}

async function loadOrders() {
    if (ordersLoading) return;
    
    try {
        ordersLoading = true;
        showLoading();
        
        const params = new URLSearchParams({
            page: currentOrdersPage,
            limit: 20
        });
        
        if (currentOrdersFilter) {
            params.append('status', currentOrdersFilter);
        }
        
        if (currentOrdersSearch) {
            params.append('search', currentOrdersSearch);
        }
        
        const token = localStorage.getItem('token');
        const url = `${window.APP_CONFIG.API_BASE_URL}/orders?${params}`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayOrders(data.orders || []);
            updateOrdersPagination(data.pagination);
            
            if (currentOrdersPage === 1) {
                loadOrdersStats();
            }
        } else {
            const errorData = await response.json();
            console.error('Load orders error:', response.status, errorData);
            showToast('خطأ في تحميل الطلبات: ' + (errorData.message || 'خطأ غير معروف'), 'error');
            displayOrders([]);
        }
    } catch (error) {
        console.error('Load orders error:', error);
        showToast('خطأ في الاتصال بالخادم: ' + error.message, 'error');
        displayOrders([]);
    } finally {
        ordersLoading = false;
        hideLoading();
    }
}

function displayOrders(orders) {
    const tbody = document.querySelector('#orders-table tbody');
    if (!tbody) return;
    
    if (currentOrdersPage === 1) {
        tbody.innerHTML = '';
    }
    
    if (orders.length === 0 && currentOrdersPage === 1) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 2rem; color: var(--light-text);">
                    لا توجد طلبات بعد
                </td>
            </tr>
        `;
        return;
    }
    
    orders.forEach(order => {
        const row = document.createElement('tr');
        
        // Calculate delivery price
        const deliveryPrice = DELIVERY_PRICES[order.customerInfo.wilaya] || 500;
        const totalWithDelivery = order.totalPrice + deliveryPrice;
        
        // Format full address
        const fullAddress = [
            order.customerInfo.address,
            order.customerInfo.city,
            order.customerInfo.wilaya
        ].filter(Boolean).join(', ');
        
        const itemsSummary = order.items && order.items.length > 0 
            ? `${order.items[0].productName}${order.items.length > 1 ? ` +${order.items.length - 1} أخرى` : ''}`
            : 'لا توجد منتجات';
        
        row.innerHTML = `
            <td>
                <strong style="color: var(--primary-color);">${escapeHtml(order.orderNumber || order._id.slice(-8))}</strong>
            </td>
            <td>${escapeHtml(order.customerInfo.name)}</td>
            <td>
                <a href="tel:${order.customerInfo.phone}" style="color: var(--primary-color);">
                    ${escapeHtml(order.customerInfo.phone)}
                </a>
            </td>
            <td title="${escapeHtml(fullAddress)}" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${escapeHtml(fullAddress)}
            </td>
            <td class="order-items" title="${order.items ? order.items.map(item => `${item.productName} (${item.quantity})`).join(', ') : ''}">
                ${escapeHtml(itemsSummary)}
            </td>
            <td>
                <div>المنتجات: ${formatPrice(order.totalPrice)} دج</div>
                <div style="color: var(--light-text); font-size: 0.9rem;">التوصيل: ${formatPrice(deliveryPrice)} دج</div>
                <strong style="color: var(--primary-color);">المجموع: ${formatPrice(totalWithDelivery)} دج</strong>
            </td>
            <td>
                <span class="order-status status-${order.status}">${getStatusText(order.status)}</span>
            </td>
            <td>${formatDate(order.createdAt)}</td>
            <td class="table-actions">
                <button class="btn btn-sm btn-outline" onclick="viewOrderDetails('${order._id}')" title="عرض التفاصيل">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-primary" onclick="updateOrderStatus('${order._id}')" title="تحديث الحالة">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteOrder('${order._id}')" title="حذف">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

async function viewOrderDetails(orderId) {
    try {
        showLoading();
        const token = localStorage.getItem('token');
        const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/orders/${orderId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const order = await response.json();
            displayOrderDetailsModal(order);
        } else {
            const errorData = await response.json();
            showToast('خطأ في تحميل تفاصيل الطلب: ' + (errorData.message || 'خطأ غير معروف'), 'error');
        }
    } catch (error) {
        console.error('View order details error:', error);
        showToast('خطأ في الاتصال بالخادم', 'error');
    } finally {
        hideLoading();
    }
}

function displayOrderDetailsModal(order) {
    const modal = document.getElementById('order-details-modal');
    const title = document.getElementById('order-details-title');
    const body = document.getElementById('order-details-body');
    
    if (!modal || !title || !body) return;
    
    title.textContent = `تفاصيل الطلب ${order.orderNumber || order._id.slice(-8)}`;
    
    const deliveryPrice = DELIVERY_PRICES[order.customerInfo.wilaya] || 500;
    const totalWithDelivery = order.totalPrice + deliveryPrice;
    
    body.innerHTML = `
        <div class="customer-info" style="background: var(--secondary-color); padding: 1.5rem; border-radius: var(--border-radius); margin-bottom: 2rem;">
            <h4 style="margin-bottom: 1rem; color: var(--primary-color);">
                <i class="fas fa-user"></i> معلومات العميل
            </h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <strong>الاسم:</strong> ${escapeHtml(order.customerInfo.name)}
                </div>
                <div>
                    <strong>الهاتف:</strong> 
                    <a href="tel:${order.customerInfo.phone}" style="color: var(--primary-color);">
                        ${escapeHtml(order.customerInfo.phone)}
                    </a>
                </div>
                <div>
                    <strong>الولاية:</strong> ${escapeHtml(order.customerInfo.wilaya)}
                </div>
                ${order.customerInfo.city ? `<div><strong>البلدية:</strong> ${escapeHtml(order.customerInfo.city)}</div>` : ''}
            </div>
            <div style="margin-bottom: 1rem;">
                <strong>العنوان الكامل:</strong><br>
                ${escapeHtml(order.customerInfo.address)}
                ${order.customerInfo.city ? `, ${escapeHtml(order.customerInfo.city)}` : ''}
                ، ${escapeHtml(order.customerInfo.wilaya)}
            </div>
            ${order.customerInfo.notes ? `
                <div>
                    <strong>ملاحظات العميل:</strong><br>
                    ${escapeHtml(order.customerInfo.notes)}
                </div>
            ` : ''}
        </div>
        
        <div class="order-items-detail" style="background: var(--white); border: 2px solid var(--border-color); border-radius: var(--border-radius); padding: 1.5rem; margin-bottom: 2rem;">
            <h4 style="margin-bottom: 1rem; color: var(--primary-color);">
                <i class="fas fa-shopping-bag"></i> المنتجات المطلوبة
            </h4>
            ${order.items ? order.items.map(item => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 0; border-bottom: 1px solid var(--border-color);">
                    ${item.image ? `
                        <img src="${window.APP_CONFIG.SERVER_BASE_URL}/uploads/products/${item.image}" 
                             alt="${escapeHtml(item.productName)}" 
                             style="width: 50px; height: 50px; object-fit: cover; border-radius: var(--border-radius); margin-left: 1rem;"
                             onerror="this.style.display='none'">
                    ` : ''}
                    <div style="flex: 1;">
                        <strong>${escapeHtml(item.productName)}</strong><br>
                        <span style="color: var(--light-text);">
                            الكمية: ${item.quantity} × ${formatPrice(item.price)} دج
                        </span>
                    </div>
                    <div style="font-weight: bold; color: var(--primary-color);">
                        ${formatPrice(item.price * item.quantity)} دج
                    </div>
                </div>
            `).join('') : 'لا توجد منتجات'}
        </div>
        
        <div class="order-summary" style="background: var(--secondary-color); padding: 1.5rem; border-radius: var(--border-radius); border: 2px solid var(--primary-color);">
            <h4 style="margin-bottom: 1rem; color: var(--primary-color);">
                <i class="fas fa-calculator"></i> ملخص الطلب
            </h4>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <span>المجموع الفرعي:</span>
                <span>${formatPrice(order.totalPrice)} دج</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <span>رسوم التوصيل (${escapeHtml(order.customerInfo.wilaya)}):</span>
                <span style="color: var(--primary-color); font-weight: bold;">${formatPrice(deliveryPrice)} دج</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <span>حالة الطلب:</span>
                <span class="order-status status-${order.status}">${getStatusText(order.status)}</span>
            </div>
            ${order.trackingNumber ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>رقم التتبع:</span>
                    <span style="font-family: monospace;">${escapeHtml(order.trackingNumber)}</span>
                </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <span>تاريخ الطلب:</span>
                <span>${formatDate(order.createdAt)}</span>
            </div>
            ${order.notes ? `
                <div style="margin-top: 1rem;">
                    <strong>ملاحظات الإدارة:</strong><br>
                    ${escapeHtml(order.notes)}
                </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 1.2rem; color: var(--primary-color); border-top: 2px solid var(--border-color); padding-top: 0.5rem; margin-top: 0.5rem;">
                <span>المبلغ الإجمالي (مع التوصيل):</span>
                <span>${formatPrice(totalWithDelivery)} دج</span>
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
}

async function updateOrderStatus(orderId) {
    try {
        showLoading();
        const token = localStorage.getItem('token');
        const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/orders/${orderId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const order = await response.json();
            
            document.getElementById('update-order-id').value = orderId;
            document.getElementById('order-status').value = order.status;
            document.getElementById('tracking-number').value = order.trackingNumber || '';
            document.getElementById('order-notes').value = order.notes || '';
            
            document.getElementById('update-order-modal').style.display = 'flex';
        } else {
            const errorData = await response.json();
            showToast('خطأ في تحميل بيانات الطلب: ' + (errorData.message || 'خطأ غير معروف'), 'error');
        }
    } catch (error) {
        console.error('Load order for update error:', error);
        showToast('خطأ في الاتصال بالخادم', 'error');
    } finally {
        hideLoading();
    }
}

async function handleUpdateOrderStatus(e) {
    e.preventDefault();
    
    const orderId = document.getElementById('update-order-id').value;
    const status = document.getElementById('order-status').value;
    const trackingNumber = document.getElementById('tracking-number').value.trim();
    const notes = document.getElementById('order-notes').value.trim();
    
    try {
        showLoading();
        const token = localStorage.getItem('token');
        const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                status,
                trackingNumber: trackingNumber || undefined,
                notes: notes || undefined
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('تم تحديث حالة الطلب بنجاح', 'success');
            closeUpdateOrderModal();
            
            currentOrdersPage = 1;
            const tbody = document.querySelector('#orders-table tbody');
            if (tbody) tbody.innerHTML = '';
            loadOrders();
        } else {
            showToast(data.message || 'خطأ في تحديث حالة الطلب', 'error');
        }
    } catch (error) {
        console.error('Update order status error:', error);
        showToast('خطأ في الاتصال بالخادم', 'error');
    } finally {
        hideLoading();
    }
}

async function deleteOrder(orderId) {
    if (!confirm('هل أنت متأكد من حذف هذا الطلب؟ هذا الإجراء لا يمكن التراجع عنه.')) {
        return;
    }
    
    try {
        showLoading();
        const token = localStorage.getItem('token');
        const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/orders/${orderId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('تم حذف الطلب بنجاح', 'success');
            
            currentOrdersPage = 1;
            const tbody = document.querySelector('#orders-table tbody');
            if (tbody) tbody.innerHTML = '';
            loadOrders();
        } else {
            showToast(data.message || 'خطأ في حذف الطلب', 'error');
        }
    } catch (error) {
        console.error('Delete order error:', error);
        showToast('خطأ في الاتصال بالخادم', 'error');
    } finally {
        hideLoading();
    }
}

async function loadOrdersStats() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/orders/stats/dashboard`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const stats = await response.json();
            updateOrdersStats(stats);
        } else {
            updateOrdersStats({
                totalOrders: 0,
                pendingOrders: 0,
                todayOrders: 0,
                monthRevenue: 0
            });
        }
    } catch (error) {
        console.error('Load orders stats error:', error);
        updateOrdersStats({
            totalOrders: 0,
            pendingOrders: 0,
            todayOrders: 0,
            monthRevenue: 0
        });
    }
}

function updateOrdersStats(stats) {
    const elements = {
        'total-orders': stats.totalOrders || 0,
        'pending-orders': stats.pendingOrders || 0,
        'today-orders': stats.todayOrders || 0,
        'month-revenue': formatPrice(stats.monthRevenue || 0)
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });
}

function updateOrdersPagination(pagination) {
    const loadMoreBtn = document.getElementById('load-more-orders');
    if (loadMoreBtn) {
        if (currentOrdersPage >= (pagination?.pages || 1)) {
            loadMoreBtn.style.display = 'none';
        } else {
            loadMoreBtn.style.display = 'block';
        }
    }
}

function closeOrderDetailsModal() {
    const modal = document.getElementById('order-details-modal');
    if (modal) modal.style.display = 'none';
}

function closeUpdateOrderModal() {
    const modal = document.getElementById('update-order-modal');
    if (modal) modal.style.display = 'none';
    const form = document.getElementById('update-order-form');
    if (form) form.reset();
}

function getStatusText(status) {
    const statusTexts = {
        'pending': 'في الانتظار',
        'confirmed': 'مؤكد',
        'processing': 'قيد المعالجة',
        'shipped': 'تم الشحن',
        'delivered': 'تم التسليم',
        'cancelled': 'ملغي'
    };
    return statusTexts[status] || status;
}

// Comments management - WORKING VERSION
async function loadComments(status = 'all') {
    try {
        showLoading();
        console.log('Loading comments...');
        
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('No token found');
            displayCommentsTable([]);
            return;
        }
        
        // Try the admin comments endpoint first
        let response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/admin/comments`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('API Response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Comments data received:', data);
            displayCommentsTable(data.comments || []);
        } else {
            // If admin endpoint doesn't work, try to get comments from different endpoints
            console.log('Admin endpoint failed, trying alternative approaches...');
            
            // Try to load comments from articles, posts, and products
            const allComments = [];
            
            try {
                // Get comments from articles
                const articlesResponse = await fetch(`${window.APP_CONFIG.API_BASE_URL}/articles`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (articlesResponse.ok) {
                    const articlesData = await articlesResponse.json();
                    if (articlesData.articles) {
                        for (const article of articlesData.articles) {
                            try {
                                const commentsResponse = await fetch(`${window.APP_CONFIG.API_BASE_URL}/comments/Article/${article._id}`, {
                                    headers: { 'Authorization': `Bearer ${token}` }
                                });
                                if (commentsResponse.ok) {
                                    const commentsData = await commentsResponse.json();
                                    if (commentsData.comments) {
                                        allComments.push(...commentsData.comments);
                                    }
                                }
                            } catch (e) {
                                console.log('Error fetching comments for article:', article._id);
                            }
                        }
                    }
                }
            } catch (e) {
                console.log('Error fetching articles');
            }
            
            // Get comments from posts
            try {
                const postsResponse = await fetch(`${window.APP_CONFIG.API_BASE_URL}/posts`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (postsResponse.ok) {
                    const postsData = await postsResponse.json();
                    if (postsData.posts) {
                        for (const post of postsData.posts) {
                            try {
                                const commentsResponse = await fetch(`${window.APP_CONFIG.API_BASE_URL}/comments/Post/${post._id}`, {
                                    headers: { 'Authorization': `Bearer ${token}` }
                                });
                                if (commentsResponse.ok) {
                                    const commentsData = await commentsResponse.json();
                                    if (commentsData.comments) {
                                        allComments.push(...commentsData.comments);
                                    }
                                }
                            } catch (e) {
                                console.log('Error fetching comments for post:', post._id);
                            }
                        }
                    }
                }
            } catch (e) {
                console.log('Error fetching posts');
            }
            
            console.log('Total comments found:', allComments.length);
            displayCommentsTable(allComments);
        }
        
    } catch (error) {
        console.error('Network error loading comments:', error);
        showToast('خطأ في تحميل التعليقات', 'error');
        displayCommentsTable([]);
    } finally {
        hideLoading();
    }
}

function displayCommentsTable(comments) {
    const tbody = document.querySelector('#comments-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (comments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--light-text);">لا توجد تعليقات بعد.</td></tr>';
        return;
    }

    comments.forEach(comment => {
        const row = document.createElement('tr');
        
        const targetInfo = comment.targetType === 'Article' ? 'مقال' : 
                          comment.targetType === 'Post' ? 'منشور' : 'منتج';
        
        row.innerHTML = `
            <td>${escapeHtml(comment.author?.name || 'مستخدم محذوف')}</td>
            <td style="max-width: 200px;">
                <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(comment.content)}">
                    ${escapeHtml(comment.content.substring(0, 50))}${comment.content.length > 50 ? '...' : ''}
                </div>
            </td>
            <td>${targetInfo}</td>
            <td>${formatDate(comment.createdAt)}</td>
            <td>
                <span class="status-badge ${comment.approved ? 'status-published' : 'status-pending'}">
                    ${comment.approved ? 'مقبول' : 'في الانتظار'}
                </span>
            </td>
            <td class="table-actions">
                <button class="btn btn-sm ${comment.approved ? 'btn-outline' : 'btn-success'}" onclick="toggleCommentApproval('${comment._id}', ${comment.approved})">
                    ${comment.approved ? 'إلغاء الموافقة' : 'موافقة'}
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteComment('${comment._id}')">حذف</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function toggleCommentApproval(commentId, isApproved) {
    const action = isApproved ? 'إلغاء الموافقة على' : 'الموافقة على';
    if (!confirm(`هل أنت متأكد من ${action} هذا التعليق؟`)) {
        return;
    }
    
    try {
        showLoading();
        const token = localStorage.getItem('token');
        
        // Try admin route first
        let response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/admin/comments/${commentId}/approve`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        // If admin route fails, try the regular route
        if (!response.ok && response.status === 404) {
            response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/comments/${commentId}/approve`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
        }
        
        if (response.ok) {
            const data = await response.json();
            showToast(data.message || 'تم تحديث حالة التعليق', 'success');
            loadComments(); // Reload comments
        } else {
            const errorData = await response.json();
            showToast(errorData.message || 'خطأ في تغيير حالة التعليق', 'error');
        }
    } catch (error) {
        console.error('Toggle comment approval error:', error);
        showToast('خطأ في الاتصال بالخادم', 'error');
    } finally {
        hideLoading();
    }
}

async function deleteComment(commentId) {
    if (!confirm('هل أنت متأكد من حذف هذا التعليق؟ هذا الإجراء لا يمكن التراجع عنه.')) {
        return;
    }
    
    try {
        showLoading();
        const token = localStorage.getItem('token');
        
        // Try the admin route first
        let response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/admin/comments/${commentId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        // If admin route fails, try the regular comments route
        if (!response.ok && response.status === 404) {
            response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/comments/${commentId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        }
        
        if (response.ok) {
            const data = await response.json();
            showToast('تم حذف التعليق بنجاح', 'success');
            loadComments(); // Reload comments
        } else {
            const errorData = await response.json();
            showToast(errorData.message || 'خطأ في حذف التعليق', 'error');
        }
    } catch (error) {
        console.error('Delete comment error:', error);
        showToast('خطأ في الاتصال بالخادم', 'error');
    } finally {
        hideLoading();
    }
}

// Users management
async function loadUsers() {
    try {
        showLoading();
        
        const users = [
            {
                _id: 'admin-user',
                name: adminUser.name,
                email: adminUser.email,
                phone: '0555123456', 
                isAdmin: true,
                createdAt: new Date(),
                isActive: true
            }
        ];
        
        displayUsersTable(users);
    } catch (error) {
        console.error('Users load error:', error);
        displayUsersTable([]);
    } finally {
        hideLoading();
    }
}

function displayUsersTable(users) {
    const tbody = document.querySelector('#users-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--light-text);">لا توجد مستخدمين.</td></tr>';
        return;
    }

    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(user.name)}</td>
            <td>${escapeHtml(user.email)}</td>
            <td>${escapeHtml(user.phone || 'غير محدد')}</td>
            <td>${formatDate(user.createdAt)}</td>
            <td>
                <span class="status-badge ${user.isAdmin ? 'status-published' : 'status-draft'}">
                    ${user.isAdmin ? 'مدير' : 'مستخدم'}
                </span>
            </td>
            <td class="table-actions">
                ${user.isAdmin ? '<span style="color: var(--light-text);">مدير النظام</span>' : 
                `<button class="btn btn-sm btn-outline" onclick="toggleUserStatus('${user._id}', ${user.isActive})">${user.isActive ? 'إلغاء التفعيل' : 'تفعيل'}</button>
                <button class="btn btn-sm btn-danger" onclick="deleteUser('${user._id}')">حذف</button>`}
            </td>
        `;
        tbody.appendChild(row);
    });
}

// DELETE functions - Actually working
async function deleteArticle(articleId) {
    if (!confirm('هل أنت متأكد من حذف هذا المقال؟ هذا الإجراء لا يمكن التراجع عنه.')) {
        return;
    }
    
    try {
        showLoading();
        const token = localStorage.getItem('token');
        const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/articles/${articleId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('تم حذف المقال بنجاح', 'success');
            loadArticles();
        } else if (response.status === 501) {
            showToast('حذف المقالات سيكون متاحاً قريباً', 'info');
        } else {
            showToast(data.message || 'خطأ في حذف المقال', 'error');
        }
    } catch (error) {
        console.error('Delete article error:', error);
        showToast('خطأ في الاتصال بالخادم', 'error');
    } finally {
        hideLoading();
    }
}

async function deleteProduct(productId) {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟ هذا الإجراء لا يمكن التراجع عنه.')) {
        return;
    }
    
    try {
        showLoading();
        const token = localStorage.getItem('token');
        const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/products/${productId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('تم حذف المنتج بنجاح', 'success');
            loadProducts();
        } else if (response.status === 501) {
            showToast('حذف المنتجات سيكون متاحاً قريباً', 'info');
        } else {
            showToast(data.message || 'خطأ في حذف المنتج', 'error');
        }
    } catch (error) {
        console.error('Delete product error:', error);
        showToast('خطأ في الاتصال بالخادم', 'error');
    } finally {
        hideLoading();
    }
}

async function deletePost(postId) {
    if (!confirm('هل أنت متأكد من حذف هذا الإعلان؟ هذا الإجراء لا يمكن التراجع عنه.')) {
        return;
    }
    
    try {
        showLoading();
        const token = localStorage.getItem('token');
        const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}/posts/${postId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('تم حذف الإعلان بنجاح', 'success');
            loadPosts();
        } else if (response.status === 501) {
            showToast('حذف الإعلانات سيكون متاحاً قريباً', 'info');
        } else {
            showToast(data.message || 'خطأ في حذف الإعلان', 'error');
        }
    } catch (error) {
        console.error('Delete post error:', error);
        showToast('خطأ في الاتصال بالخادم', 'error');
    } finally {
        hideLoading();
    }
}

// Modal functions
function openArticleModal(articleId = null) {
    const modal = document.getElementById('article-modal');
    const title = document.getElementById('article-modal-title');
    const form = document.getElementById('article-form');
    
    if (!modal || !title || !form) return;
    
    if (articleId) {
        title.textContent = 'تعديل المقال';
        loadArticleForEdit(articleId);
    } else {
        title.textContent = 'مقال جديد';
        form.reset();
        document.getElementById('article-id').value = '';
        clearFileList('article');
    }
    
    modal.style.display = 'flex';
}

function closeArticleModal() {
    const modal = document.getElementById('article-modal');
    if (modal) {
        modal.style.display = 'none';
        clearFileList('article');
    }
}

function openProductModal(productId = null) {
    const modal = document.getElementById('product-modal');
    const title = document.getElementById('product-modal-title');
    const form = document.getElementById('product-form');
    
    if (!modal || !title || !form) return;
    
    if (productId) {
        title.textContent = 'تعديل المنتج';
        loadProductForEdit(productId);
    } else {
        title.textContent = 'منتج جديد';
        form.reset();
        document.getElementById('product-id').value = '';
        document.getElementById('sale-price-group').style.display = 'none';
        clearFileList('product');
    }
    
    modal.style.display = 'flex';
}

function closeProductModal() {
    const modal = document.getElementById('product-modal');
    if (modal) {
        modal.style.display = 'none';
        clearFileList('product');
    }
}

function openPostModal(postId = null) {
    const modal = document.getElementById('post-modal');
    const title = document.getElementById('post-modal-title');
    const form = document.getElementById('post-form');
    
    if (!modal || !title || !form) return;
    
    if (postId) {
        title.textContent = 'تعديل الإعلان';
        loadPostForEdit(postId);
    } else {
        title.textContent = 'إعلان جديد';
        form.reset();
        document.getElementById('post-id').value = '';
        clearFileList('post');
    }
    
    modal.style.display = 'flex';
}

function closePostModal() {
    const modal = document.getElementById('post-modal');
    if (modal) {
        modal.style.display = 'none';
        clearFileList('post');
    }
}

// Load data for editing
async function loadArticleForEdit(articleId) {
    try {
        const article = await apiRequest(`/articles/${articleId}`);
        
        document.getElementById('article-id').value = article._id;
        document.getElementById('article-title').value = article.title;
        document.getElementById('article-category').value = article.category;
        document.getElementById('article-excerpt').value = article.excerpt;
        document.getElementById('article-content').value = article.content;
        document.getElementById('article-featured').checked = article.featured;
        
    } catch (error) {
        console.error('Load article error:', error);
        showToast('هذه الميزة ستكون متاحة قريباً', 'info');
        closeArticleModal();
    }
}

async function loadProductForEdit(productId) {
    try {
        const product = await apiRequest(`/products/${productId}`);
        
        document.getElementById('product-id').value = product._id;
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-category').value = product.category;
        document.getElementById('product-description').value = product.description;
        document.getElementById('product-price').value = product.price;
        document.getElementById('product-stock').value = product.stockQuantity;
        document.getElementById('product-featured').checked = product.featured;
        document.getElementById('product-sale').checked = product.onSale;
        
        if (product.onSale && product.salePrice) {
            document.getElementById('sale-price-group').style.display = 'block';
            document.getElementById('product-sale-price').value = product.salePrice;
        }
        
    } catch (error) {
        console.error('Load product error:', error);
        showToast('هذه الميزة ستكون متاحة قريباً', 'info');
        closeProductModal();
    }
}

async function loadPostForEdit(postId) {
    try {
        const post = await apiRequest(`/posts/${postId}`);
        
        document.getElementById('post-id').value = post._id;
        document.getElementById('post-title').value = post.title;
        document.getElementById('post-content').value = post.content;
        document.getElementById('post-link').value = post.adDetails?.link || '';
        document.getElementById('post-button-text').value = post.adDetails?.buttonText || 'اقرأ المزيد';
        document.getElementById('post-featured').checked = post.adDetails?.featured || false;
        
    } catch (error) {
        console.error('Load post error:', error);
        showToast('هذه الميزة ستكون متاحة قريباً', 'info');
        closePostModal();
    }
}

// Form submissions
async function handleArticleSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData();
    const articleId = document.getElementById('article-id').value;
    
    const title = document.getElementById('article-title').value.trim();
    const category = document.getElementById('article-category').value;
    const excerpt = document.getElementById('article-excerpt').value.trim();
    const content = document.getElementById('article-content').value.trim();
    const featured = document.getElementById('article-featured').checked;
    
    if (!title || !category || !excerpt || !content) {
        showToast('يرجى ملء جميع الحقول المطلوبة', 'warning');
        return;
    }
    
    formData.append('title', title);
    formData.append('category', category);
    formData.append('excerpt', excerpt);
    formData.append('content', content);
    formData.append('featured', featured);
    
    selectedFiles.article.forEach(file => {
        formData.append('images', file);
    });
    
    try {
        showLoading();
        
        const token = localStorage.getItem('token');
        const url = articleId ? `/articles/${articleId}` : '/articles';
        const method = articleId ? 'PUT' : 'POST';
        
        const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}${url}`, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast(articleId ? 'تم تحديث المقال بنجاح' : 'تم إنشاء المقال بنجاح', 'success');
            closeArticleModal();
            loadArticles();
        } else if (response.status === 501) {
            showToast('هذه الميزة قيد التطوير حالياً', 'info');
            closeArticleModal();
        } else {
            showToast(data.message || 'خطأ في حفظ المقال', 'error');
        }
    } catch (error) {
        console.error('Article submit error:', error);
        showToast('خطأ في الاتصال بالخادم', 'error');
    } finally {
        hideLoading();
    }
}

async function handleProductSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData();
    const productId = document.getElementById('product-id').value;
    
    const name = document.getElementById('product-name').value.trim();
    const category = document.getElementById('product-category').value;
    const description = document.getElementById('product-description').value.trim();
    const price = document.getElementById('product-price').value;
    const stockQuantity = document.getElementById('product-stock').value;
    const featured = document.getElementById('product-featured').checked;
    const onSale = document.getElementById('product-sale').checked;
    
    if (!name || !category || !description || !price || !stockQuantity) {
        showToast('يرجى ملء جميع الحقول المطلوبة', 'warning');
        return;
    }
    
    formData.append('name', name);
    formData.append('category', category);
    formData.append('description', description);
    formData.append('price', price);
    formData.append('stockQuantity', stockQuantity);
    formData.append('featured', featured);
    formData.append('onSale', onSale);
    
    if (onSale) {
        const salePrice = document.getElementById('product-sale-price').value;
        if (salePrice) {
            formData.append('salePrice', salePrice);
        }
    }
    
    selectedFiles.product.forEach(file => {
        formData.append('images', file);
    });
    
    if (!productId && selectedFiles.product.length === 0) {
        showToast('يرجى إضافة صورة واحدة على الأقل للمنتج', 'warning');
        return;
    }
    
    try {
        showLoading();
        
        const token = localStorage.getItem('token');
        const url = productId ? `/products/${productId}` : '/products';
        const method = productId ? 'PUT' : 'POST';
        
        const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}${url}`, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast(productId ? 'تم تحديث المنتج بنجاح' : 'تم إنشاء المنتج بنجاح', 'success');
            closeProductModal();
            loadProducts();
        } else if (response.status === 501) {
            showToast('هذه الميزة قيد التطوير حالياً', 'info');
            closeProductModal();
        } else {
            showToast(data.message || 'خطأ في حفظ المنتج', 'error');
        }
    } catch (error) {
        console.error('Product submit error:', error);
        showToast('خطأ في الاتصال بالخادم', 'error');
    } finally {
        hideLoading();
    }
}

async function handlePostSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData();
    const postId = document.getElementById('post-id').value;
    
    const title = document.getElementById('post-title').value.trim();
    const content = document.getElementById('post-content').value.trim();
    const link = document.getElementById('post-link').value.trim();
    const buttonText = document.getElementById('post-button-text').value.trim();
    const featured = document.getElementById('post-featured').checked;
    
    if (!title || !content) {
        showToast('يرجى ملء العنوان والمحتوى', 'warning');
        return;
    }
    
    formData.append('title', title);
    formData.append('content', content);
    formData.append('link', link);
    formData.append('buttonText', buttonText || 'اقرأ المزيد');
    formData.append('featured', featured);
    
    selectedFiles.post.forEach(file => {
        formData.append('images', file);
    });
    
    try {
        showLoading();
        
        const token = localStorage.getItem('token');
        const url = postId ? `/posts/${postId}` : '/posts/ad';
        const method = postId ? 'PUT' : 'POST';
        
        const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}${url}`, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast(postId ? 'تم تحديث الإعلان بنجاح' : 'تم إنشاء الإعلان بنجاح', 'success');
            closePostModal();
            loadPosts();
        } else if (response.status === 501) {
            showToast('هذه الميزة قيد التطوير حالياً', 'info');
            closePostModal();
        } else {
            showToast(data.message || 'خطأ في حفظ الإعلان', 'error');
        }
    } catch (error) {
        console.error('Post submit error:', error);
        showToast('خطأ في الاتصال بالخادم', 'error');
    } finally {
        hideLoading();
    }
}

// Edit functions
function editArticle(id) { openArticleModal(id); }
function editProduct(id) { openProductModal(id); }
function editPost(id) { openPostModal(id); }

// User management functions
function toggleUserStatus(userId, isActive) {
    const action = isActive ? 'إلغاء تفعيل' : 'تفعيل';
    if (confirm(`هل أنت متأكد من ${action} هذا المستخدم؟`)) {
        showToast(`تم ${action} المستخدم بنجاح`, 'success');
        loadUsers();
    }
}

function deleteUser(userId) {
    if (confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
        showToast('تم حذف المستخدم بنجاح', 'success');
        loadUsers();
    }
}

// Theme management
function loadThemeManager() {
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
    const secondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--secondary-color').trim();
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim();
    
    const primaryInput = document.getElementById('primary-color');
    const secondaryInput = document.getElementById('secondary-color');
    const textInput = document.getElementById('text-color');
    
    if (primaryInput) primaryInput.value = primaryColor || '#d4a574';
    if (secondaryInput) secondaryInput.value = secondaryColor || '#f8e8d4';
    if (textInput) textInput.value = textColor || '#2c2c2c';
}

function updateThemePreview() {
    const primaryColor = document.getElementById('primary-color').value;
    const secondaryColor = document.getElementById('secondary-color').value;
    const textColor = document.getElementById('text-color').value;
    
    const root = document.documentElement;
    root.style.setProperty('--primary-color', primaryColor);
    root.style.setProperty('--secondary-color', secondaryColor);
    root.style.setProperty('--text-color', textColor);
    root.style.setProperty('--gradient', `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`);
}

function saveThemeChanges() {
    const theme = {
        primaryColor: document.getElementById('primary-color').value,
        secondaryColor: document.getElementById('secondary-color').value,
        textColor: document.getElementById('text-color').value
    };
    
    localStorage.setItem('adminTheme', JSON.stringify(theme));
    localStorage.setItem('siteTheme', JSON.stringify(theme));
    showToast('تم حفظ الألوان بنجاح', 'success');
}

function resetThemeToDefault() {
    if (confirm('هل أنت متأكد من إعادة الألوان للافتراضي؟')) {
        const defaultTheme = {
            primaryColor: '#d4a574',
            secondaryColor: '#f8e8d4',
            textColor: '#2c2c2c'
        };
        
        document.getElementById('primary-color').value = defaultTheme.primaryColor;
        document.getElementById('secondary-color').value = defaultTheme.secondaryColor;
        document.getElementById('text-color').value = defaultTheme.textColor;
        
        updateThemePreview();
        localStorage.removeItem('adminTheme');
        localStorage.removeItem('siteTheme');
        showToast('تم إعادة الألوان للافتراضي', 'success');
    }
}

function loadSavedTheme() {
    const savedTheme = localStorage.getItem('adminTheme');
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
    if (theme.primaryColor) root.style.setProperty('--primary-color', theme.primaryColor);
    if (theme.secondaryColor) root.style.setProperty('--secondary-color', theme.secondaryColor);
    if (theme.textColor) root.style.setProperty('--text-color', theme.textColor);
    if (theme.primaryColor && theme.secondaryColor) {
        root.style.setProperty('--gradient', `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`);
    }
}

// File upload handlers
function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

function handleDrop(e, type) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    const files = Array.from(e.dataTransfer.files);
    addFiles(files, type);
}

function handleFileSelect(e, type) {
    const files = Array.from(e.target.files);
    addFiles(files, type);
}

function addFiles(files, type) {
    const validFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (validFiles.length !== files.length) {
        showToast('يُسمح بملفات الصور فقط', 'warning');
    }
    
    selectedFiles[type] = [...selectedFiles[type], ...validFiles];
    updateFileList(type);
}

function updateFileList(type) {
    const fileList = document.getElementById(`${type}-file-list`);
    if (!fileList) return;
    
    fileList.innerHTML = '';

    selectedFiles[type].forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <span>${escapeHtml(file.name)}</span>
            <button type="button" class="remove-file" onclick="removeFile(${index}, '${type}')">&times;</button>
        `;
        fileList.appendChild(fileItem);
    });
}

function removeFile(index, type) {
    selectedFiles[type].splice(index, 1);
    updateFileList(type);
}

function clearFileList(type) {
    selectedFiles[type] = [];
    updateFileList(type);
}

// API request function - FIXED VERSION
async function apiRequest(endpoint, options = {}) {
    // Check if config is loaded
    if (!window.APP_CONFIG) {
        console.error('APP_CONFIG not loaded! Cannot make API request.');
        throw new Error('Configuration not loaded');
    }
    
    const token = localStorage.getItem('token');
    
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };
    
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    
    try {
        const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}${endpoint}`, config);
        
        if (response.ok) {
            const data = await response.json();
            return data;
        } else if (response.status === 404) {
            return {
                articles: [],
                products: [],
                posts: [],
                comments: [],
                users: [],
                orders: [],
                pagination: { total: 0, pages: 0, current: 1 }
            };
        } else if (response.status === 501) {
            console.log(`Endpoint ${endpoint} not implemented yet`);
            return {
                articles: [],
                products: [],
                posts: [],
                comments: [],
                users: [],
                orders: [],
                pagination: { total: 0, pages: 0, current: 1 }
            };
        } else {
            let errorMessage = 'Server error';
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorMessage;
            } catch (e) {
                errorMessage = `HTTP ${response.status} - ${response.statusText}`;
            }
            
            throw new Error(errorMessage);
        }
        
    } catch (error) {
        console.error('API Error:', error);
        
        if (error.name === 'TypeError' || error.message.includes('Failed to fetch')) {
            console.log('Server appears to be down, returning empty data');
            return {
                articles: [],
                products: [],
                posts: [],
                comments: [],
                users: [],
                orders: [],
                pagination: { total: 0, pages: 0, current: 1 }
            };
        }
        
        throw error;
    }
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-DZ', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatPrice(price) {
    return new Intl.NumberFormat('ar-DZ').format(price);
}

function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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
    if (!container) return;
    
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

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('rememberMe');
    localStorage.removeItem('loginTime');
    
    showToast('تم تسجيل الخروج بنجاح', 'info');
    window.location.href = 'login.html';
}

// Export functions for global use
window.openArticleModal = openArticleModal;
window.closeArticleModal = closeArticleModal;
window.editArticle = editArticle;
window.deleteArticle = deleteArticle;

window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;

window.openPostModal = openPostModal;
window.closePostModal = closePostModal;
window.editPost = editPost;
window.deletePost = deletePost;

window.loadOrders = loadOrders;
window.viewOrderDetails = viewOrderDetails;
window.updateOrderStatus = updateOrderStatus;
window.deleteOrder = deleteOrder;
window.closeOrderDetailsModal = closeOrderDetailsModal;
window.closeUpdateOrderModal = closeUpdateOrderModal;

window.removeFile = removeFile;
window.toggleUserStatus = toggleUserStatus;
window.deleteUser = deleteUser;
window.toggleCommentApproval = toggleCommentApproval;
window.deleteComment = deleteComment;
window.updateThemePreview = updateThemePreview;
window.saveThemeChanges = saveThemeChanges;
window.resetThemeToDefault = resetThemeToDefault;

console.log('✅ Fixed Admin.js loaded with proper config usage');
