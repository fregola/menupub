require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const database = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');

const app = express();
const server = http.createServer(app);

// Origini permesse (configurabili via env ALLOWED_ORIGINS)
const DEFAULT_ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5001'
];
const ENV_ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
const ALLOWED_ORIGINS = ENV_ALLOWED_ORIGINS.length ? ENV_ALLOWED_ORIGINS : DEFAULT_ALLOWED_ORIGINS;

const io = new Server(server, {
    cors: {
        origin: ALLOWED_ORIGINS,
        methods: ['GET', 'POST'],
        credentials: true
    }
});
const PORT = process.env.PORT || 5000;

// Middleware di sicurezza
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            imgSrc: ["'self'", "data:", ...ALLOWED_ORIGINS],
            styleSrc: ["'self'", "'unsafe-inline'", "https:"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
        },
    },
}));

// Configurazione CORS
app.use(cors({
    origin: function (origin, callback) {
        // Lista delle origini permesse
        const allowedOrigins = ALLOWED_ORIGINS;
        
        // Permetti richieste senza origin (es. app mobile, Postman) o da origini permesse
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log('🚫 CORS blocked origin:', origin);
            callback(new Error('Non permesso da CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minuti
    max: 1000, // massimo 1000 richieste per IP ogni 15 minuti (aumentato per testing)
    message: {
        success: false,
        message: 'Troppe richieste da questo IP, riprova più tardi'
    }
});
app.use('/api/', limiter);

// Rate limiting più restrittivo per auth
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minuti
    max: 50, // massimo 50 tentativi di login per IP ogni 15 minuti (aumentato per testing)
    message: {
        success: false,
        message: 'Troppi tentativi di login, riprova più tardi'
    }
});
app.use('/api/auth/login', authLimiter);

// Parsing JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servire file statici con CORS
app.use('/uploads', (req, res, next) => {
    const allowedOrigins = ALLOWED_ORIGINS;
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    
    res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Gestisci richieste OPTIONS
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    
    next();
}, express.static('uploads'));

// Middleware per logging delle richieste
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Configurazione Socket.IO
io.on('connection', (socket) => {
    console.log('🔌 Client connesso:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('🔌 Client disconnesso:', socket.id);
    });
});

// Rendi io disponibile globalmente per i controller
app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/allergens', require('./routes/allergens'));
app.use('/api/ingredients', require('./routes/ingredients'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/products', require('./routes/products'));
app.use('/api/business', require('./routes/business'));
app.use('/api/translate', require('./routes/translate'));

// Route per informazioni API
app.get('/api', (req, res) => {
    res.json({
        success: true,
        message: 'API Sistema Gestione Menu Ristorante',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            auth: '/api/auth',
            allergens: '/api/allergens',
            ingredients: '/api/ingredients',
            categories: '/api/categories'
        }
    });
});

// Route di test
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server funzionante',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Route di benvenuto
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});



// Middleware per gestire route non trovate
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint non trovato'
    });
});

// Middleware per gestire errori globali
app.use((error, req, res, next) => {
    console.error('Errore globale:', error);
    
    res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Errore interno del server',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
});

// Inizializzazione server
async function startServer() {
    try {
        // Inizializza il database
        await database.connect();
        console.log('✅ Database connesso');

        // Migrazioni rapide: garantisci colonne necessarie per i controller
        await database.ensureColumn('allergens', 'name_en', 'VARCHAR(100)');
        await database.ensureColumn('ingredients', 'name_en', 'VARCHAR(100)');

        // Avvia il server HTTP con Socket.IO
        server.listen(PORT, () => {
            console.log(`🚀 Server avviato su porta ${PORT}`);
            console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
            console.log(`📡 API disponibili su: http://localhost:${PORT}/api`);
            console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
            console.log(`🔌 Socket.IO attivo per aggiornamenti in tempo reale`);
        });

    } catch (error) {
        console.error('❌ Errore avvio server:', error);
        process.exit(1);
    }
}

// Gestione graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Ricevuto SIGINT, chiusura server...');
    await database.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Ricevuto SIGTERM, chiusura server...');
    await database.close();
    process.exit(0);
});

// Avvia il server
startServer();

module.exports = app;