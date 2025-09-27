const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enhanced CORS configuration
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'https://parapharmacie-gaher.onrender.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
}));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Database connection
const connectDB = async () => {
    try {
        if (process.env.MONGODB_URI) {
            await mongoose.connect(process.env.MONGODB_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            });
            console.log('✅ MongoDB Connected Successfully');
        } else {
            console.log('⚠️ No MongoDB URI found, running in demo mode');
        }
    } catch (error) {
        console.error('❌ Database connection error:', error.message);
        console.log('🔧 Continuing in demo mode...');
    }
};

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// Demo data for when database is not available
const demoProducts = [
    {
        id: 'demo_1',
        nom: 'Paracétamol 500mg',
        description: 'Antalgique et antipyrétique',
        prix: 250,
        stock: 100,
        categorie: 'Médicaments',
        image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5QYXJhY8OpdGFtb2w8L3RleHQ+PC9zdmc+',
        featured: true
    },
    {
        id: 'demo_2',
        nom: 'Vitamine C 1000mg',
        description: 'Complément alimentaire vitamine C',
        prix: 800,
        stock: 50,
        categorie: 'Vitamines',
        image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmZlNGIzIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5WaXRhbWluZSBDPC90ZXh0Pjwvc3ZnPg==',
        featured: false
    }
];

const demoOrders = [
    {
        id: 'demo_order_1',
        numeroCommande: 'CMD001',
        client: {
            prenom: 'Ahmed',
            nom: 'Benali',
            email: 'ahmed@email.com',
            telephone: '0555123456',
            adresse: '123 Rue de la Paix',
            wilaya: 'Alger'
        },
        articles: [
            { nom: 'Paracétamol 500mg', prix: 250, quantite: 2 }
        ],
        sousTotal: 500,
        fraisLivraison: 300,
        total: 800,
        status: 'pending',
        createdAt: new Date().toISOString()
    }
];

// Import routes with error handling
let authRoutes, productRoutes, orderRoutes, adminRoutes, settingsRoutes;

try {
    authRoutes = require('./routes/auth');
    console.log('✅ Auth routes loaded');
} catch (error) {
    console.warn('⚠️ Auth routes failed to load:', error.message);
    authRoutes = express.Router();
    authRoutes.post('/login', (req, res) => {
        const { email, password } = req.body;
        if (email === 'pharmaciegaher@gmail.com' && password === 'anesaya75') {
            res.json({
                token: 'demo-admin-token',
                user: { id: 'admin', email, nom: 'Admin', role: 'admin' }
            });
        } else {
            res.json({
                token: 'demo-user-token',
                user: { id: 'user', email, nom: 'User', role: 'user' }
            });
        }
    });
    authRoutes.get('/profile', (req, res) => {
        const token = req.headers['x-auth-token'];
        if (token === 'demo-admin-token') {
            res.json({ id: 'admin', email: 'pharmaciegaher@gmail.com', nom: 'Admin', role: 'admin' });
        } else {
            res.json({ id: 'user', email: 'user@email.com', nom: 'User', role: 'user' });
        }
    });
}

try {
    productRoutes = require('./routes/products');
    console.log('✅ Product routes loaded');
} catch (error) {
    console.warn('⚠️ Product routes failed to load:', error.message);
    productRoutes = express.Router();
    productRoutes.get('/', (req, res) => res.json(demoProducts));
}

try {
    orderRoutes = require('./routes/orders');
    console.log('✅ Order routes loaded');
} catch (error) {
    console.warn('⚠️ Order routes failed to load:', error.message);
    orderRoutes = express.Router();
    orderRoutes.post('/', (req, res) => {
        const order = { ...req.body, id: 'demo_order_' + Date.now() };
        demoOrders.push(order);
        res.json(order);
    });
    orderRoutes.get('/', (req, res) => res.json(demoOrders));
}

try {
    adminRoutes = require('./routes/admin');
    console.log('✅ Admin routes loaded');
} catch (error) {
    console.warn('⚠️ Admin routes failed to load:', error.message);
    adminRoutes = express.Router();
    
    // Demo admin routes
    adminRoutes.get('/dashboard', (req, res) => {
        res.json({
            totalProducts: demoProducts.length,
            totalOrders: demoOrders.length,
            totalRevenue: demoOrders.reduce((sum, order) => sum + order.total, 0),
            pendingOrders: demoOrders.filter(order => order.status === 'pending').length
        });
    });
    
    adminRoutes.get('/products', (req, res) => res.json(demoProducts));
    
    adminRoutes.post('/products', (req, res) => {
        const product = { ...req.body, id: 'demo_' + Date.now() };
        demoProducts.push(product);
        res.json(product);
    });
    
    adminRoutes.put('/products/:id', (req, res) => {
        const index = demoProducts.findIndex(p => p.id === req.params.id);
        if (index >= 0) {
            demoProducts[index] = { ...demoProducts[index], ...req.body };
            res.json(demoProducts[index]);
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    });
    
    adminRoutes.delete('/products/:id', (req, res) => {
        const index = demoProducts.findIndex(p => p.id === req.params.id);
        if (index >= 0) {
            demoProducts.splice(index, 1);
            res.json({ message: 'Product deleted successfully' });
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    });
    
    adminRoutes.get('/orders', (req, res) => res.json(demoOrders));
    
    adminRoutes.put('/orders/:id', (req, res) => {
        const index = demoOrders.findIndex(o => o.id === req.params.id);
        if (index >= 0) {
            demoOrders[index] = { ...demoOrders[index], ...req.body };
            res.json(demoOrders[index]);
        } else {
            res.status(404).json({ message: 'Order not found' });
        }
    });
}

try {
    settingsRoutes = require('./routes/settings');
    console.log('✅ Settings routes loaded');
} catch (error) {
    console.warn('⚠️ Settings routes failed to load:', error.message);
    settingsRoutes = express.Router();
    settingsRoutes.get('/public', (req, res) => {
        res.json({
            nomSite: 'Shifa - Parapharmacie',
            fraisLivraison: 300,
            livraisonGratuite: 5000
        });
    });
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);

// Catch-all route for API endpoints
app.use('/api/*', (req, res) => {
    res.status(404).json({
        message: 'API endpoint not found',
        endpoint: req.originalUrl,
        method: req.method
    });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('❌ Server Error:', error);
    res.status(500).json({
        message: 'Erreur serveur interne',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// Start server
const startServer = async () => {
    try {
        // Connect to database
        await connectDB();
        
        // Start server
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log('🚀=================================🚀');
            console.log(`📡 Server running on port ${PORT}`);
            console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
            console.log(`📚 API Base URL: http://localhost:${PORT}/api`);
            console.log('🚀=================================🚀');
            
            if (process.env.NODE_ENV === 'development') {
                console.log('🔧 Development mode - detailed logging enabled');
                console.log('💡 Demo credentials:');
                console.log('   Admin: pharmaciegaher@gmail.com / anesaya75');
                console.log('   User: any email / any password');
            }
        });
        
        // Handle server errors
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`❌ Port ${PORT} is already in use`);
                console.log('💡 Try running: npm run kill-port or use a different port');
                process.exit(1);
            } else {
                console.error('❌ Server error:', error);
                throw error;
            }
        });
        
        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('📡 SIGTERM received. Shutting down gracefully...');
            server.close(() => {
                console.log('✅ Server closed');
                mongoose.connection.close(false, () => {
                    console.log('✅ Database connection closed');
                    process.exit(0);
                });
            });
        });
        
        return server;
        
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
};

// Start the server
startServer();

module.exports = app;
