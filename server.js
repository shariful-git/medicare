/**
 * MediCare - Native Node.js & SQLite Backend Server
 * Provides genuine SQLite file storage (medicare.sqlite) & multi-device synchronization.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'medicare.sqlite');
const SERVER_SECRET = process.env.MEDICARE_SECRET || 'medicare_clinical_suite_secret_2026';

let app;
let isNativeHttpServer = false;

try {
    const express = require('express');
    const cors = require('cors');
    app = express();
    app.use(cors());
    app.use(express.json());
    app.use(express.static(__dirname));
    console.log('✓ Express framework loaded successfully.');
} catch (e) {
    // Zero-dependency native Node.js HTTP framework (no npm install required!)
    isNativeHttpServer = true;
    console.log('⚡ Running in Zero-Dependency Native Node.js mode (no npm install required!).');
    app = createNativeHttpApp();
}

function createNativeHttpApp() {
    const routes = [];
    const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.sqlite': 'application/x-sqlite3'
    };

    function pathToRegex(routePath) {
        if (Array.isArray(routePath)) {
            const regexes = routePath.map(p => pathToRegex(p));
            return {
                test: (pathname) => regexes.some(r => r.test(pathname)),
                match: (pathname) => {
                    for (const r of regexes) {
                        const m = r.match(pathname);
                        if (m) return m;
                    }
                    return null;
                }
            };
        }
        const paramNames = [];
        const pattern = routePath.replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
            paramNames.push(name);
            return '([^/]+)';
        });
        const regex = new RegExp(`^${pattern}$`);
        return {
            test: (pathname) => regex.test(pathname),
            match: (pathname) => {
                const match = pathname.match(regex);
                if (!match) return null;
                const params = {};
                paramNames.forEach((name, i) => {
                    params[name] = decodeURIComponent(match[i + 1]);
                });
                return params;
            }
        };
    }

    function addRoute(method, pathPattern, handlers) {
        routes.push({
            method: method.toUpperCase(),
            matcher: pathToRegex(pathPattern),
            handlers: handlers
        });
    }

    function serveFile(filePath, res, customContentType = null) {
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.end('File not found');
                return;
            }
            const ext = path.extname(filePath).toLowerCase();
            const ct = customContentType || mimeTypes[ext] || 'application/octet-stream';
            res.setHeader('Content-Type', ct);
            res.end(data);
        });
    }

    const appObj = {
        use: () => {},
        get: (p, ...h) => addRoute('GET', p, h),
        post: (p, ...h) => addRoute('POST', p, h),
        put: (p, ...h) => addRoute('PUT', p, h),
        delete: (p, ...h) => addRoute('DELETE', p, h),
        listen: (port, cb) => {
            const server = http.createServer((req, res) => {
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

                if (req.method === 'OPTIONS') {
                    res.statusCode = 204;
                    res.end();
                    return;
                }

                const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
                let pathname = parsedUrl.pathname;
                req.query = Object.fromEntries(parsedUrl.searchParams.entries());

                res.status = function (code) {
                    this.statusCode = code;
                    return this;
                };
                res.json = function (data) {
                    this.setHeader('Content-Type', 'application/json; charset=utf-8');
                    this.end(JSON.stringify(data));
                };
                res.sendFile = function (fPath) {
                    serveFile(fPath, this);
                };
                res.download = function (fPath, filename) {
                    this.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                    serveFile(fPath, this);
                };

                const chunks = [];
                req.on('data', chunk => chunks.push(chunk));
                req.on('end', () => {
                    const rawBody = Buffer.concat(chunks).toString('utf8');
                    req.body = {};
                    if (rawBody && (req.headers['content-type'] || '').includes('application/json')) {
                        try {
                            req.body = JSON.parse(rawBody);
                        } catch (e) {
                            req.body = {};
                        }
                    }

                    for (const r of routes) {
                        if (r.method === req.method && r.matcher.test(pathname)) {
                            req.params = r.matcher.match(pathname) || {};
                            let idx = 0;
                            const next = (err) => {
                                if (err) {
                                    res.status(500).json({ success: false, error: err.message || String(err) });
                                    return;
                                }
                                if (idx < r.handlers.length) {
                                    const fn = r.handlers[idx++];
                                    try {
                                        fn(req, res, next);
                                    } catch (ex) {
                                        next(ex);
                                    }
                                }
                            };
                            next();
                            return;
                        }
                    }

                    if (pathname === '/' || pathname === '') {
                        serveFile(path.join(__dirname, 'index.html'), res);
                        return;
                    }
                    if (pathname === '/admin' || pathname === '/admin/') {
                        serveFile(path.join(__dirname, 'admin.html'), res);
                        return;
                    }

                    const safePath = path.normalize(path.join(__dirname, pathname));
                    if (safePath.startsWith(__dirname) && fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
                        serveFile(safePath, res);
                        return;
                    }

                    res.status(404).json({ success: false, error: 'Route not found' });
                });
            });

            server.listen(port, cb);
            return server;
        }
    };

    return appObj;
}

// ==========================================
// 1. SQLITE ENGINE ADAPTER
// Supports node:sqlite (Node 22+), sqlite3, or resilient file-backed store
// ==========================================
let dbDriver = null;
let db = null;

// Password hashing helpers using native Node crypto
function hashPassword(password, salt = null) {
    if (!salt) {
        salt = crypto.randomBytes(16).toString('hex');
    }
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return { hash, salt };
}

function verifyPassword(password, hash, salt) {
    try {
        const calculated = crypto.scryptSync(password, salt, 64).toString('hex');
        return calculated === hash;
    } catch (e) {
        return false;
    }
}

// Token helper with HMAC signature for robust multi-device persistence across server restarts
const activeSessions = new Map();

function generateToken(userId) {
    const timestamp = Date.now();
    const payload = `${userId}:${timestamp}`;
    const sig = crypto.createHmac('sha256', SERVER_SECRET).update(payload).digest('hex');
    const token = `mctk_${Buffer.from(payload).toString('base64url')}.${sig}`;
    activeSessions.set(token, { userId, createdAt: timestamp });
    return token;
}

function verifyToken(token) {
    if (!token || typeof token !== 'string') return null;
    const sess = activeSessions.get(token);
    if (sess) return sess.userId;

    if (token.startsWith('mctk_')) {
        const parts = token.slice(5).split('.');
        if (parts.length === 2) {
            try {
                const payload = Buffer.from(parts[0], 'base64url').toString('utf8');
                const expectedSig = crypto.createHmac('sha256', SERVER_SECRET).update(payload).digest('hex');
                if (crypto.timingSafeEqual(Buffer.from(parts[1]), Buffer.from(expectedSig))) {
                    const [userId, ts] = payload.split(':');
                    // Valid for 60 days
                    if (Date.now() - Number(ts) < 60 * 24 * 3600 * 1000) {
                        activeSessions.set(token, { userId, createdAt: Number(ts) });
                        return userId;
                    }
                }
            } catch (e) {}
        }
    }
    return null;
}

function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ success: false, error: 'অনুগ্রহ করে লগইন করুন (Unauthorized)' });
    }
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const userId = verifyToken(token);
    if (!userId) {
        return res.status(401).json({ success: false, error: 'সেশনের মেয়াদ শেষ বা সঠিক নয় (Invalid Session)' });
    }
    req.userId = userId;
    next();
}

// ==========================================
// 2. DATABASE INITIALIZATION
// ==========================================
try {
    const sqlite3 = require('sqlite3').verbose();
    db = new sqlite3.Database(DB_FILE, (err) => {
        if (err) {
            console.error('Error connecting to SQLite file:', err.message);
        } else {
            console.log(`Connected to genuine SQLite database file: ${DB_FILE}`);
            initTablesSqlite3();
        }
    });
    dbDriver = 'sqlite3';
} catch (e) {
    console.log('sqlite3 package not installed locally yet. Trying alternative driver...');
    try {
        const { DatabaseSync } = require('node:sqlite');
        db = new DatabaseSync(DB_FILE);
        dbDriver = 'node:sqlite';
        console.log(`Using built-in node:sqlite with file: ${DB_FILE}`);
        initTablesNodeSqlite();
    } catch (err) {
        console.warn('Operating with lightweight SQLite JSON replica at:', DB_FILE);
        initFallbackFileDb();
    }
}

function initTablesSqlite3() {
    db.serialize(() => {
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                full_name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                created_at TEXT NOT NULL,
                role TEXT DEFAULT 'user'
            );
        `);

        // Migration for role column
        db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';`, () => {});

        db.run(`
            CREATE TABLE IF NOT EXISTS routines (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                dosage TEXT NOT NULL,
                meal TEXT NOT NULL,
                time TEXT NOT NULL,
                stock INTEGER DEFAULT 0,
                notes TEXT,
                taken_today INTEGER DEFAULT 0,
                last_taken_date TEXT,
                created_at TEXT NOT NULL,
                start_date TEXT DEFAULT '',
                duration_days INTEGER DEFAULT 1,
                end_date TEXT DEFAULT '',
                frequency INTEGER DEFAULT 1,
                times_json TEXT DEFAULT '[]',
                taken_history TEXT DEFAULT '{}',
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
        `);

        // Graceful column migrations for existing databases
        ['start_date', 'duration_days', 'end_date', 'frequency', 'times_json', 'taken_history'].forEach(col => {
            db.run(`ALTER TABLE routines ADD COLUMN ${col} TEXT DEFAULT '';`, () => {});
        });

        db.run(`
            CREATE TABLE IF NOT EXISTS history_logs (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                routine_id TEXT,
                routine_name TEXT,
                action TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                date_str TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS hydration (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                date_str TEXT NOT NULL,
                glasses INTEGER DEFAULT 0,
                target INTEGER DEFAULT 8,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
        `);

        // Check and seed default demo user (assigned admin privileges)
        db.get('SELECT id, role FROM users WHERE username = ?', ['demo'], (err, row) => {
            if (!row) {
                const { hash, salt } = hashPassword('123456');
                const userId = 'user_demo_01';
                db.run(
                    'INSERT INTO users (id, username, full_name, password_hash, salt, created_at, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [userId, 'demo', 'ডা. শরিফুল ইসলাম (Dr. Shariful)', hash, salt, new Date().toISOString(), 'admin']
                );
                console.log('Default Demo user created: username: demo | password: 123456 (Role: admin)');
            } else if (row.role !== 'admin') {
                db.run('UPDATE users SET role = "admin" WHERE username = "demo"');
            }
        });

        // Check and seed dedicated admin user
        db.get('SELECT id FROM users WHERE username = ?', ['admin'], (err, row) => {
            if (!row) {
                const { hash, salt } = hashPassword('admin123');
                const userId = 'user_admin_01';
                db.run(
                    'INSERT INTO users (id, username, full_name, password_hash, salt, created_at, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [userId, 'admin', 'সিস্টেম অ্যাডমিনিস্ট্রেটর (MediCare Admin)', hash, salt, new Date().toISOString(), 'admin']
                );
                console.log('Dedicated Admin user created: username: admin | password: admin123 (Role: admin)');
            }
        });
    });
}

function initTablesNodeSqlite() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            full_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            created_at TEXT NOT NULL,
            role TEXT DEFAULT 'user'
        );
        CREATE TABLE IF NOT EXISTS routines (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            dosage TEXT NOT NULL,
            meal TEXT NOT NULL,
            time TEXT NOT NULL,
            stock INTEGER DEFAULT 0,
            notes TEXT,
            taken_today INTEGER DEFAULT 0,
            last_taken_date TEXT,
            created_at TEXT NOT NULL,
            start_date TEXT DEFAULT '',
            duration_days INTEGER DEFAULT 1,
            end_date TEXT DEFAULT '',
            frequency INTEGER DEFAULT 1,
            times_json TEXT DEFAULT '[]',
            taken_history TEXT DEFAULT '{}'
        );
        CREATE TABLE IF NOT EXISTS history_logs (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            routine_id TEXT,
            routine_name TEXT,
            action TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            date_str TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS hydration (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            date_str TEXT NOT NULL,
            glasses INTEGER DEFAULT 0,
            target INTEGER DEFAULT 8
        );
    `);

    try { db.exec(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';`); } catch (e) {}

    ['start_date', 'duration_days', 'end_date', 'frequency', 'times_json', 'taken_history'].forEach(col => {
        try {
            db.exec(`ALTER TABLE routines ADD COLUMN ${col} TEXT DEFAULT '';`);
        } catch (e) {}
    });

    const checkDemo = db.prepare('SELECT id, role FROM users WHERE username = ?').get('demo');
    if (!checkDemo) {
        const { hash, salt } = hashPassword('123456');
        const userId = 'user_demo_01';
        db.prepare('INSERT INTO users (id, username, full_name, password_hash, salt, created_at, role) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            userId, 'demo', 'ডা. শরিফুল ইসলাম (Dr. Shariful)', hash, salt, new Date().toISOString(), 'admin'
        );
    } else if (checkDemo.role !== 'admin') {
        db.prepare('UPDATE users SET role = "admin" WHERE username = "demo"').run();
    }

    const checkAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    if (!checkAdmin) {
        const { hash, salt } = hashPassword('admin123');
        const userId = 'user_admin_01';
        db.prepare('INSERT INTO users (id, username, full_name, password_hash, salt, created_at, role) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            userId, 'admin', 'সিস্টেম অ্যাডমিনিস্ট্রেটর (MediCare Admin)', hash, salt, new Date().toISOString(), 'admin'
        );
    }
}

// Fallback JSON-backed SQLite file structure if native modules are unavailable
let fallbackMemoryDb = { users: [], routines: [], history_logs: [], hydration: [] };
function initFallbackFileDb() {
    dbDriver = 'fallback';
    const jsonFile = DB_FILE + '.json';
    if (fs.existsSync(jsonFile)) {
        try {
            fallbackMemoryDb = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
            if (!fallbackMemoryDb.routines) fallbackMemoryDb.routines = [];
            if (!fallbackMemoryDb.users) fallbackMemoryDb.users = [];
            if (!fallbackMemoryDb.history_logs) fallbackMemoryDb.history_logs = [];
            if (!fallbackMemoryDb.hydration) fallbackMemoryDb.hydration = [];
        } catch (e) {}
    }
    const demo = fallbackMemoryDb.users.find(u => u.username === 'demo');
    if (!demo) {
        const { hash, salt } = hashPassword('123456');
        const userId = 'user_demo_01';
        fallbackMemoryDb.users.push({
            id: userId,
            username: 'demo',
            full_name: 'ডা. শরিফুল ইসলাম (Dr. Shariful)',
            password_hash: hash,
            salt: salt,
            created_at: new Date().toISOString(),
            role: 'admin'
        });
        saveFallbackDb();
    } else {
        demo.role = 'admin';
        saveFallbackDb();
    }

    const admin = fallbackMemoryDb.users.find(u => u.username === 'admin');
    if (!admin) {
        const { hash, salt } = hashPassword('admin123');
        const userId = 'user_admin_01';
        fallbackMemoryDb.users.push({
            id: userId,
            username: 'admin',
            full_name: 'সিস্টেম অ্যাডমিনিস্ট্রেটর (MediCare Admin)',
            password_hash: hash,
            salt: salt,
            created_at: new Date().toISOString(),
            role: 'admin'
        });
        saveFallbackDb();
    }
}

function saveFallbackDb() {
    if (dbDriver === 'fallback') {
        fs.writeFileSync(DB_FILE + '.json', JSON.stringify(fallbackMemoryDb, null, 2), 'utf8');
    }
}

// Helpers
function getTodayDateStr() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// ==========================================
// 3. AUTHENTICATION API ROUTES
// ==========================================

// Register
app.post('/api/auth/register', (req, res) => {
    const { username, full_name, password } = req.body;
    if (!username || !password || !full_name) {
        return res.status(400).json({ success: false, error: 'ইউজারনেম, নাম এবং পাসওয়ার্ড আবশ্যক।' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanName = full_name.trim();
    const defaultRole = (cleanUsername === 'admin' || cleanUsername === 'demo') ? 'admin' : 'user';

    if (dbDriver === 'sqlite3') {
        db.get('SELECT id FROM users WHERE username = ?', [cleanUsername], (err, row) => {
            if (row) {
                return res.status(409).json({ success: false, error: 'এই ইউজারনেম দিয়ে ইতিমধ্যে একাউন্ট আছে।' });
            }
            const userId = 'user_' + Date.now();
            const { hash, salt } = hashPassword(password);
            db.run(
                'INSERT INTO users (id, username, full_name, password_hash, salt, created_at, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [userId, cleanUsername, cleanName, hash, salt, new Date().toISOString(), defaultRole],
                function (insErr) {
                    if (insErr) return res.status(500).json({ success: false, error: insErr.message });
                    const token = generateToken(userId);
                    res.json({
                        success: true,
                        token,
                        user: { id: userId, username: cleanUsername, full_name: cleanName, role: defaultRole }
                    });
                }
            );
        });
    } else if (dbDriver === 'node:sqlite') {
        const row = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
        if (row) return res.status(409).json({ success: false, error: 'এই ইউজারনেম দিয়ে ইতিমধ্যে একাউন্ট আছে।' });
        const userId = 'user_' + Date.now();
        const { hash, salt } = hashPassword(password);
        db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)').run(userId, cleanUsername, cleanName, hash, salt, new Date().toISOString(), defaultRole);
        const token = generateToken(userId);
        res.json({ success: true, token, user: { id: userId, username: cleanUsername, full_name: cleanName, role: defaultRole } });
    } else {
        if (fallbackMemoryDb.users.some(u => u.username === cleanUsername)) {
            return res.status(409).json({ success: false, error: 'এই ইউজারনেম দিয়ে ইতিমধ্যে একাউন্ট আছে।' });
        }
        const userId = 'user_' + Date.now();
        const { hash, salt } = hashPassword(password);
        const newUser = { id: userId, username: cleanUsername, full_name: cleanName, password_hash: hash, salt, created_at: new Date().toISOString(), role: defaultRole };
        fallbackMemoryDb.users.push(newUser);
        saveFallbackDb();
        const token = generateToken(userId);
        res.json({ success: true, token, user: { id: userId, username: cleanUsername, full_name: cleanName, role: defaultRole } });
    }
});

// Login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'ইউজারনেম এবং পাসওয়ার্ড দিন।' });
    }

    const cleanUsername = username.trim().toLowerCase();

    if (dbDriver === 'sqlite3') {
        db.get('SELECT * FROM users WHERE username = ?', [cleanUsername], (err, user) => {
            if (!user) {
                return res.status(401).json({ success: false, error: 'ইউজারনেম বা পাসওয়ার্ড সঠিক নয়।' });
            }
            if (!verifyPassword(password, user.password_hash, user.salt)) {
                return res.status(401).json({ success: false, error: 'ভুল পাসওয়ার্ড। আবার চেষ্টা করুন।' });
            }
            const userRole = user.role || (user.username === 'admin' || user.username === 'demo' ? 'admin' : 'user');
            const token = generateToken(user.id);
            res.json({
                success: true,
                token,
                user: { id: user.id, username: user.username, full_name: user.full_name, role: userRole }
            });
        });
    } else if (dbDriver === 'node:sqlite') {
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(cleanUsername);
        if (!user || !verifyPassword(password, user.password_hash, user.salt)) {
            return res.status(401).json({ success: false, error: 'ইউজারনেম বা পাসওয়ার্ড সঠিক নয়।' });
        }
        const userRole = user.role || (user.username === 'admin' || user.username === 'demo' ? 'admin' : 'user');
        const token = generateToken(user.id);
        res.json({ success: true, token, user: { id: user.id, username: user.username, full_name: user.full_name, role: userRole } });
    } else {
        const user = fallbackMemoryDb.users.find(u => u.username === cleanUsername);
        if (!user || !verifyPassword(password, user.password_hash, user.salt)) {
            return res.status(401).json({ success: false, error: 'ইউজারনেম বা পাসওয়ার্ড সঠিক নয়।' });
        }
        const userRole = user.role || (user.username === 'admin' || user.username === 'demo' ? 'admin' : 'user');
        const token = generateToken(user.id);
        res.json({ success: true, token, user: { id: user.id, username: user.username, full_name: user.full_name, role: userRole } });
    }
});

// Me (Verify session)
app.get('/api/auth/me', authMiddleware, (req, res) => {
    if (dbDriver === 'sqlite3') {
        db.get('SELECT id, username, full_name, role FROM users WHERE id = ?', [req.userId], (err, user) => {
            if (!user) return res.status(404).json({ success: false, error: 'User not found' });
            const userRole = user.role || (user.username === 'admin' || user.username === 'demo' ? 'admin' : 'user');
            res.json({ success: true, user: { ...user, role: userRole } });
        });
    } else if (dbDriver === 'node:sqlite') {
        const user = db.prepare('SELECT id, username, full_name, role FROM users WHERE id = ?').get(req.userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        const userRole = user.role || (user.username === 'admin' || user.username === 'demo' ? 'admin' : 'user');
        res.json({ success: true, user: { ...user, role: userRole } });
    } else {
        const user = fallbackMemoryDb.users.find(u => u.id === req.userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        const userRole = user.role || (user.username === 'admin' || user.username === 'demo' ? 'admin' : 'user');
        res.json({ success: true, user: { id: user.id, username: user.username, full_name: user.full_name, role: userRole } });
    }
});

// ==========================================
// 4. ROUTINES API (PER-USER DATA SYNC)
// ==========================================

// Get all routines of active user
app.get('/api/routines', authMiddleware, (req, res) => {
    const today = getTodayDateStr();
    if (dbDriver === 'sqlite3') {
        db.all('SELECT * FROM routines WHERE user_id = ? ORDER BY time ASC', [req.userId], (err, rows) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            const list = (rows || []).map(r => {
                let times = [];
                try { times = r.times_json ? JSON.parse(r.times_json) : [r.time]; } catch (e) { times = [r.time]; }
                let takenHistory = {};
                try { takenHistory = r.taken_history ? JSON.parse(r.taken_history) : {}; } catch (e) { takenHistory = {}; }
                const isTakenToday = Array.isArray(takenHistory[today]) && takenHistory[today].length >= (times.length || 1);
                return {
                    id: r.id,
                    name: r.name,
                    type: r.type,
                    dosage: r.dosage,
                    meal: r.meal,
                    time: r.time,
                    stock: r.stock,
                    notes: r.notes,
                    takenToday: isTakenToday,
                    lastTakenDate: r.last_taken_date,
                    createdAt: r.created_at,
                    startDate: r.start_date || '',
                    durationDays: parseInt(r.duration_days, 10) || 1,
                    endDate: r.end_date || '',
                    frequency: parseInt(r.frequency, 10) || times.length,
                    times: times,
                    takenHistory: takenHistory
                };
            });
            res.json({ success: true, routines: list });
        });
    } else if (dbDriver === 'node:sqlite') {
        const rows = db.prepare('SELECT * FROM routines WHERE user_id = ? ORDER BY time ASC').all(req.userId);
        const list = (rows || []).map(r => {
            let times = [];
            try { times = r.times_json ? JSON.parse(r.times_json) : [r.time]; } catch (e) { times = [r.time]; }
            let takenHistory = {};
            try { takenHistory = r.taken_history ? JSON.parse(r.taken_history) : {}; } catch (e) { takenHistory = {}; }
            const isTakenToday = Array.isArray(takenHistory[today]) && takenHistory[today].length >= (times.length || 1);
            return {
                id: r.id,
                name: r.name,
                type: r.type,
                dosage: r.dosage,
                meal: r.meal,
                time: r.time,
                stock: r.stock,
                notes: r.notes,
                takenToday: isTakenToday,
                lastTakenDate: r.last_taken_date,
                createdAt: r.created_at,
                startDate: r.start_date || '',
                durationDays: parseInt(r.duration_days, 10) || 1,
                endDate: r.end_date || '',
                frequency: parseInt(r.frequency, 10) || times.length,
                times: times,
                takenHistory: takenHistory
            };
        });
        res.json({ success: true, routines: list });
    } else {
        const list = fallbackMemoryDb.routines.filter(r => r.user_id === req.userId).map(r => {
            const times = Array.isArray(r.times) ? r.times : (r.time ? [r.time] : ['08:00']);
            const history = r.takenHistory && typeof r.takenHistory === 'object' ? r.takenHistory : {};
            const isTakenToday = Array.isArray(history[today]) && history[today].length >= (times.length || 1);
            return { ...r, takenToday: isTakenToday };
        });
        res.json({ success: true, routines: list });
    }
});

// Create Routine
app.post('/api/routines', authMiddleware, (req, res) => {
    const { id, name, type, dosage, meal, time, stock, notes, startDate, durationDays, endDate, frequency, times, takenHistory } = req.body;
    const routineId = id || 'med-' + Date.now();
    const createdAt = new Date().toISOString();
    const timesArr = Array.isArray(times) && times.length > 0 ? times : (time ? [time] : ['08:00']);
    const timesJson = JSON.stringify(timesArr);
    const historyJson = JSON.stringify(takenHistory || {});
    const primaryTime = time || timesArr[0] || '08:00';
    const numStock = stock !== undefined && stock !== '' ? Number(stock) : 0;
    const durDays = durationDays ? Number(durationDays) : 3;
    const freq = frequency ? Number(frequency) : timesArr.length;

    if (dbDriver === 'sqlite3') {
        db.run(
            `INSERT INTO routines (id, user_id, name, type, dosage, meal, time, stock, notes, taken_today, last_taken_date, created_at, start_date, duration_days, end_date, frequency, times_json, taken_history)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '', ?, ?, ?, ?, ?, ?, ?)`,
            [routineId, req.userId, name, type || 'tablet', dosage, meal, primaryTime, numStock, notes || '', createdAt, startDate || '', durDays, endDate || '', freq, timesJson, historyJson],
            function (err) {
                if (err) return res.status(500).json({ success: false, error: err.message });
                const logId = 'log-' + Date.now();
                db.run('INSERT INTO history_logs VALUES (?, ?, ?, ?, ?, ?, ?)', [
                    logId, req.userId, routineId, name, req.body.isCloned ? 'action_cloned' : 'action_added',
                    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                    getTodayDateStr()
                ]);
                res.json({ success: true, id: routineId });
            }
        );
    } else if (dbDriver === 'node:sqlite') {
        db.prepare(
            `INSERT INTO routines (id, user_id, name, type, dosage, meal, time, stock, notes, taken_today, last_taken_date, created_at, start_date, duration_days, end_date, frequency, times_json, taken_history)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '', ?, ?, ?, ?, ?, ?, ?)`
        ).run(routineId, req.userId, name, type || 'tablet', dosage, meal, primaryTime, numStock, notes || '', createdAt, startDate || '', durDays, endDate || '', freq, timesJson, historyJson);
        const logId = 'log-' + Date.now();
        db.prepare('INSERT INTO history_logs VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            logId, req.userId, routineId, name, req.body.isCloned ? 'action_cloned' : 'action_added',
            new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            getTodayDateStr()
        );
        res.json({ success: true, id: routineId });
    } else {
        const newRoutine = {
            id: routineId,
            user_id: req.userId,
            name,
            type: type || 'tablet',
            dosage,
            meal,
            time: primaryTime,
            stock: numStock,
            notes: notes || '',
            takenToday: false,
            lastTakenDate: '',
            createdAt,
            startDate: startDate || '',
            durationDays: durDays,
            endDate: endDate || '',
            frequency: freq,
            times: timesArr,
            takenHistory: takenHistory || {}
        };
        fallbackMemoryDb.routines.unshift(newRoutine);
        fallbackMemoryDb.history_logs.unshift({
            id: 'log-' + Date.now(),
            user_id: req.userId,
            routine_id: routineId,
            routine_name: name,
            action: req.body.isCloned ? 'action_cloned' : 'action_added',
            timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            date_str: getTodayDateStr()
        });
        saveFallbackDb();
        res.json({ success: true, id: routineId });
    }
});

// Update Routine
app.put('/api/routines/:id', authMiddleware, (req, res) => {
    const { id } = req.params;
    const { name, type, dosage, meal, time, stock, notes, startDate, durationDays, endDate, frequency, times, takenHistory } = req.body;
    const timesArr = Array.isArray(times) && times.length > 0 ? times : (time ? [time] : ['08:00']);
    const timesJson = JSON.stringify(timesArr);
    const historyJson = JSON.stringify(takenHistory || {});
    const primaryTime = time || timesArr[0] || '08:00';
    const numStock = stock !== undefined && stock !== '' ? Number(stock) : 0;
    const durDays = durationDays ? Number(durationDays) : 3;
    const freq = frequency ? Number(frequency) : timesArr.length;

    if (dbDriver === 'sqlite3') {
        db.run(
            `UPDATE routines SET name = ?, type = ?, dosage = ?, meal = ?, time = ?, stock = ?, notes = ?, start_date = ?, duration_days = ?, end_date = ?, frequency = ?, times_json = ?, taken_history = ?
             WHERE id = ? AND user_id = ?`,
            [name, type, dosage, meal, primaryTime, numStock, notes || '', startDate || '', durDays, endDate || '', freq, timesJson, historyJson, id, req.userId],
            function (err) {
                if (err) return res.status(500).json({ success: false, error: err.message });
                res.json({ success: true });
            }
        );
    } else if (dbDriver === 'node:sqlite') {
        db.prepare(
            `UPDATE routines SET name = ?, type = ?, dosage = ?, meal = ?, time = ?, stock = ?, notes = ?, start_date = ?, duration_days = ?, end_date = ?, frequency = ?, times_json = ?, taken_history = ?
             WHERE id = ? AND user_id = ?`
        ).run(name, type, dosage, meal, primaryTime, numStock, notes || '', startDate || '', durDays, endDate || '', freq, timesJson, historyJson, id, req.userId);
        res.json({ success: true });
    } else {
        const item = fallbackMemoryDb.routines.find(r => r.id === id && r.user_id === req.userId);
        if (item) {
            Object.assign(item, {
                name,
                type,
                dosage,
                meal,
                time: primaryTime,
                stock: numStock,
                notes,
                startDate: startDate || item.startDate,
                durationDays: durDays,
                endDate: endDate || item.endDate,
                frequency: freq,
                times: timesArr,
                takenHistory: takenHistory || item.takenHistory
            });
            saveFallbackDb();
        }
        res.json({ success: true });
    }
});

// Mark Dose Taken on a specific date and time
app.post('/api/routines/:id/dose-taken', authMiddleware, (req, res) => {
    const { id } = req.params;
    const { dateStr, timeStr } = req.body;
    const today = getTodayDateStr();
    const targetDate = dateStr || today;

    function applyTaken(routine) {
        let history = routine.takenHistory || {};
        if (typeof history === 'string') {
            try { history = JSON.parse(history); } catch (e) { history = {}; }
        }
        if (!Array.isArray(history[targetDate])) {
            history[targetDate] = [];
        }
        if (!history[targetDate].includes(timeStr)) {
            history[targetDate].push(timeStr);
            if (routine.stock !== undefined && routine.stock !== '' && Number(routine.stock) > 0) {
                routine.stock = Number(routine.stock) - 1;
            }
        }
        const timesCount = routine.times ? routine.times.length : 1;
        if (targetDate === today) {
            routine.takenToday = history[today].length >= timesCount;
            routine.lastTakenDate = new Date().toDateString();
        }
        routine.takenHistory = history;
        return routine;
    }

    if (dbDriver === 'sqlite3') {
        db.get('SELECT * FROM routines WHERE id = ? AND user_id = ?', [id, req.userId], (err, row) => {
            if (err || !row) return res.status(404).json({ success: false, error: 'Routine not found' });
            let times = [];
            try { times = row.times_json ? JSON.parse(row.times_json) : [row.time]; } catch (e) { times = [row.time]; }
            let takenHistory = {};
            try { takenHistory = row.taken_history ? JSON.parse(row.taken_history) : {}; } catch (e) { takenHistory = {}; }

            const updated = applyTaken({ ...row, times, takenHistory });
            db.run(
                'UPDATE routines SET stock = ?, taken_today = ?, last_taken_date = ?, taken_history = ? WHERE id = ? AND user_id = ?',
                [updated.stock, updated.takenToday ? 1 : 0, updated.lastTakenDate, JSON.stringify(updated.takenHistory), id, req.userId],
                function (upErr) {
                    if (upErr) return res.status(500).json({ success: false, error: upErr.message });
                    const logId = 'log-' + Date.now();
                    db.run('INSERT INTO history_logs VALUES (?, ?, ?, ?, ?, ?, ?)', [
                        logId, req.userId, id, `${row.name} (${timeStr})`, 'action_taken',
                        new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                        targetDate
                    ]);
                    res.json({ success: true, routine: updated });
                }
            );
        });
    } else if (dbDriver === 'node:sqlite') {
        const row = db.prepare('SELECT * FROM routines WHERE id = ? AND user_id = ?').get(id, req.userId);
        if (!row) return res.status(404).json({ success: false, error: 'Routine not found' });
        let times = [];
        try { times = row.times_json ? JSON.parse(row.times_json) : [row.time]; } catch (e) { times = [row.time]; }
        let takenHistory = {};
        try { takenHistory = row.taken_history ? JSON.parse(row.taken_history) : {}; } catch (e) { takenHistory = {}; }

        const updated = applyTaken({ ...row, times, takenHistory });
        db.prepare(
            'UPDATE routines SET stock = ?, taken_today = ?, last_taken_date = ?, taken_history = ? WHERE id = ? AND user_id = ?'
        ).run(updated.stock, updated.takenToday ? 1 : 0, updated.lastTakenDate, JSON.stringify(updated.takenHistory), id, req.userId);

        const logId = 'log-' + Date.now();
        db.prepare('INSERT INTO history_logs VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            logId, req.userId, id, `${row.name} (${timeStr})`, 'action_taken',
            new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            targetDate
        );
        res.json({ success: true, routine: updated });
    } else {
        const item = fallbackMemoryDb.routines.find(r => r.id === id && r.user_id === req.userId);
        if (!item) return res.status(404).json({ success: false, error: 'Routine not found' });
        applyTaken(item);
        fallbackMemoryDb.history_logs.unshift({
            id: 'log-' + Date.now(),
            user_id: req.userId,
            routine_id: id,
            routine_name: `${item.name} (${timeStr})`,
            action: 'action_taken',
            timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            date_str: targetDate
        });
        saveFallbackDb();
        res.json({ success: true, routine: item });
    }
});

// Undo Dose Taken
app.post('/api/routines/:id/dose-undo', authMiddleware, (req, res) => {
    const { id } = req.params;
    const { dateStr, timeStr } = req.body;
    const today = getTodayDateStr();
    const targetDate = dateStr || today;

    function applyUndo(routine) {
        let history = routine.takenHistory || {};
        if (typeof history === 'string') {
            try { history = JSON.parse(history); } catch (e) { history = {}; }
        }
        if (Array.isArray(history[targetDate])) {
            const idx = history[targetDate].indexOf(timeStr);
            if (idx !== -1) {
                history[targetDate].splice(idx, 1);
                if (routine.stock !== undefined && routine.stock !== '') {
                    routine.stock = Number(routine.stock) + 1;
                }
            }
        }
        const timesCount = routine.times ? routine.times.length : 1;
        if (targetDate === today) {
            routine.takenToday = (history[today] || []).length >= timesCount;
        }
        routine.takenHistory = history;
        return routine;
    }

    if (dbDriver === 'sqlite3') {
        db.get('SELECT * FROM routines WHERE id = ? AND user_id = ?', [id, req.userId], (err, row) => {
            if (err || !row) return res.status(404).json({ success: false, error: 'Routine not found' });
            let times = [];
            try { times = row.times_json ? JSON.parse(row.times_json) : [row.time]; } catch (e) { times = [row.time]; }
            let takenHistory = {};
            try { takenHistory = row.taken_history ? JSON.parse(row.taken_history) : {}; } catch (e) { takenHistory = {}; }

            const updated = applyUndo({ ...row, times, takenHistory });
            db.run(
                'UPDATE routines SET stock = ?, taken_today = ?, taken_history = ? WHERE id = ? AND user_id = ?',
                [updated.stock, updated.takenToday ? 1 : 0, JSON.stringify(updated.takenHistory), id, req.userId],
                function (upErr) {
                    if (upErr) return res.status(500).json({ success: false, error: upErr.message });
                    const logId = 'log-' + Date.now();
                    db.run('INSERT INTO history_logs VALUES (?, ?, ?, ?, ?, ?, ?)', [
                        logId, req.userId, id, `${row.name} (${timeStr})`, 'action_undo',
                        new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                        targetDate
                    ]);
                    res.json({ success: true, routine: updated });
                }
            );
        });
    } else if (dbDriver === 'node:sqlite') {
        const row = db.prepare('SELECT * FROM routines WHERE id = ? AND user_id = ?').get(id, req.userId);
        if (!row) return res.status(404).json({ success: false, error: 'Routine not found' });
        let times = [];
        try { times = row.times_json ? JSON.parse(row.times_json) : [row.time]; } catch (e) { times = [row.time]; }
        let takenHistory = {};
        try { takenHistory = row.taken_history ? JSON.parse(row.taken_history) : {}; } catch (e) { takenHistory = {}; }

        const updated = applyUndo({ ...row, times, takenHistory });
        db.prepare(
            'UPDATE routines SET stock = ?, taken_today = ?, taken_history = ? WHERE id = ? AND user_id = ?'
        ).run(updated.stock, updated.takenToday ? 1 : 0, JSON.stringify(updated.takenHistory), id, req.userId);

        const logId = 'log-' + Date.now();
        db.prepare('INSERT INTO history_logs VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            logId, req.userId, id, `${row.name} (${timeStr})`, 'action_undo',
            new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            targetDate
        );
        res.json({ success: true, routine: updated });
    } else {
        const item = fallbackMemoryDb.routines.find(r => r.id === id && r.user_id === req.userId);
        if (!item) return res.status(404).json({ success: false, error: 'Routine not found' });
        applyUndo(item);
        fallbackMemoryDb.history_logs.unshift({
            id: 'log-' + Date.now(),
            user_id: req.userId,
            routine_id: id,
            routine_name: `${item.name} (${timeStr})`,
            action: 'action_undo',
            timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            date_str: targetDate
        });
        saveFallbackDb();
        res.json({ success: true, routine: item });
    }
});

// Delete Routine
app.delete('/api/routines/:id', authMiddleware, (req, res) => {
    const { id } = req.params;
    if (dbDriver === 'sqlite3') {
        db.run('DELETE FROM routines WHERE id = ? AND user_id = ?', [id, req.userId], function (err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true });
        });
    } else if (dbDriver === 'node:sqlite') {
        db.prepare('DELETE FROM routines WHERE id = ? AND user_id = ?').run(id, req.userId);
        res.json({ success: true });
    } else {
        fallbackMemoryDb.routines = fallbackMemoryDb.routines.filter(r => !(r.id === id && r.user_id === req.userId));
        saveFallbackDb();
        res.json({ success: true });
    }
});

// Batch Sync Routines (Merge or Replace when moving between devices)
app.post('/api/routines/batch-sync', authMiddleware, (req, res) => {
    const { routines } = req.body;
    if (!Array.isArray(routines)) {
        return res.status(400).json({ success: false, error: 'routines array required' });
    }

    if (dbDriver === 'sqlite3') {
        db.serialize(() => {
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO routines (id, user_id, name, type, dosage, meal, time, stock, notes, taken_today, last_taken_date, created_at, start_date, duration_days, end_date, frequency, times_json, taken_history)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            routines.forEach(r => {
                const times = Array.isArray(r.times) ? r.times : (r.time ? [r.time] : ['08:00']);
                stmt.run([
                    r.id,
                    req.userId,
                    r.name || '',
                    r.type || 'tablet',
                    r.dosage || '',
                    r.meal || '',
                    r.time || times[0] || '08:00',
                    r.stock !== undefined ? Number(r.stock) : 0,
                    r.notes || '',
                    r.takenToday ? 1 : 0,
                    r.lastTakenDate || '',
                    r.createdAt || new Date().toISOString(),
                    r.startDate || '',
                    Number(r.durationDays) || 1,
                    r.endDate || '',
                    Number(r.frequency) || times.length,
                    JSON.stringify(times),
                    JSON.stringify(r.takenHistory || {})
                ]);
            });
            stmt.finalize(() => {
                res.json({ success: true, count: routines.length });
            });
        });
    } else if (dbDriver === 'node:sqlite') {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO routines (id, user_id, name, type, dosage, meal, time, stock, notes, taken_today, last_taken_date, created_at, start_date, duration_days, end_date, frequency, times_json, taken_history)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        routines.forEach(r => {
            const times = Array.isArray(r.times) ? r.times : (r.time ? [r.time] : ['08:00']);
            stmt.run(
                r.id,
                req.userId,
                r.name || '',
                r.type || 'tablet',
                r.dosage || '',
                r.meal || '',
                r.time || times[0] || '08:00',
                r.stock !== undefined ? Number(r.stock) : 0,
                r.notes || '',
                r.takenToday ? 1 : 0,
                r.lastTakenDate || '',
                r.createdAt || new Date().toISOString(),
                r.startDate || '',
                Number(r.durationDays) || 1,
                r.endDate || '',
                Number(r.frequency) || times.length,
                JSON.stringify(times),
                JSON.stringify(r.takenHistory || {})
            );
        });
        res.json({ success: true, count: routines.length });
    } else {
        routines.forEach(r => {
            const existingIdx = fallbackMemoryDb.routines.findIndex(item => item.id === r.id && item.user_id === req.userId);
            const item = { ...r, user_id: req.userId };
            if (existingIdx !== -1) {
                fallbackMemoryDb.routines[existingIdx] = item;
            } else {
                fallbackMemoryDb.routines.push(item);
            }
        });
        saveFallbackDb();
        res.json({ success: true, count: routines.length });
    }
});

// ==========================================
// 5. HYDRATION API (CROSS-DEVICE SYNC)
// ==========================================
app.get('/api/hydration', authMiddleware, (req, res) => {
    if (dbDriver === 'sqlite3') {
        db.all('SELECT date_str, glasses, target FROM hydration WHERE user_id = ?', [req.userId], (err, rows) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            const data = {};
            (rows || []).forEach(r => {
                data[r.date_str] = { glasses: r.glasses, target: r.target };
            });
            res.json({ success: true, hydration: data });
        });
    } else if (dbDriver === 'node:sqlite') {
        const rows = db.prepare('SELECT date_str, glasses, target FROM hydration WHERE user_id = ?').all(req.userId);
        const data = {};
        (rows || []).forEach(r => {
            data[r.date_str] = { glasses: r.glasses, target: r.target };
        });
        res.json({ success: true, hydration: data });
    } else {
        const rows = fallbackMemoryDb.hydration.filter(h => h.user_id === req.userId);
        const data = {};
        rows.forEach(r => {
            data[r.date_str] = { glasses: r.glasses, target: r.target };
        });
        res.json({ success: true, hydration: data });
    }
});

app.post('/api/hydration', authMiddleware, (req, res) => {
    const { dateStr, glasses, target } = req.body;
    const targetDate = dateStr || getTodayDateStr();
    const g = Number(glasses) || 0;
    const t = Number(target) || 8;
    const id = `hyd_${req.userId}_${targetDate}`;

    if (dbDriver === 'sqlite3') {
        db.run(
            `INSERT INTO hydration (id, user_id, date_str, glasses, target)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET glasses = excluded.glasses, target = excluded.target`,
            [id, req.userId, targetDate, g, t],
            (err) => {
                if (err) return res.status(500).json({ success: false, error: err.message });
                res.json({ success: true, dateStr: targetDate, glasses: g, target: t });
            }
        );
    } else if (dbDriver === 'node:sqlite') {
        db.prepare(
            `INSERT INTO hydration (id, user_id, date_str, glasses, target)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET glasses = excluded.glasses, target = excluded.target`
        ).run(id, req.userId, targetDate, g, t);
        res.json({ success: true, dateStr: targetDate, glasses: g, target: t });
    } else {
        const idx = fallbackMemoryDb.hydration.findIndex(h => h.id === id);
        if (idx !== -1) {
            fallbackMemoryDb.hydration[idx].glasses = g;
            fallbackMemoryDb.hydration[idx].target = t;
        } else {
            fallbackMemoryDb.hydration.push({ id, user_id: req.userId, date_str: targetDate, glasses: g, target: t });
        }
        saveFallbackDb();
        res.json({ success: true, dateStr: targetDate, glasses: g, target: t });
    }
});

// ==========================================
// 6. HISTORY LOGS API
// ==========================================
app.get('/api/history', authMiddleware, (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.max(1, parseInt(req.query.pageSize, 10) || 20);
    const offset = (page - 1) * pageSize;

    if (dbDriver === 'sqlite3') {
        db.get('SELECT COUNT(*) as count FROM history_logs WHERE user_id = ?', [req.userId], (err, countRow) => {
            const total = countRow ? countRow.count : 0;
            db.all(
                'SELECT * FROM history_logs WHERE user_id = ? ORDER BY date_str DESC, timestamp DESC LIMIT ? OFFSET ?',
                [req.userId, pageSize, offset],
                (lErr, rows) => {
                    if (lErr) return res.status(500).json({ success: false, error: lErr.message });
                    res.json({
                        success: true,
                        logs: (rows || []).map(r => ({
                            id: r.id,
                            routineId: r.routine_id,
                            routineName: r.routine_name,
                            action: r.action,
                            timestamp: r.timestamp,
                            dateStr: r.date_str
                        })),
                        total,
                        page,
                        pageSize,
                        totalPages: Math.max(1, Math.ceil(total / pageSize))
                    });
                }
            );
        });
    } else if (dbDriver === 'node:sqlite') {
        const countRow = db.prepare('SELECT COUNT(*) as count FROM history_logs WHERE user_id = ?').get(req.userId);
        const total = countRow ? countRow.count : 0;
        const rows = db.prepare(
            'SELECT * FROM history_logs WHERE user_id = ? ORDER BY date_str DESC, timestamp DESC LIMIT ? OFFSET ?'
        ).all(req.userId, pageSize, offset);
        res.json({
            success: true,
            logs: (rows || []).map(r => ({
                id: r.id,
                routineId: r.routine_id,
                routineName: r.routine_name,
                action: r.action,
                timestamp: r.timestamp,
                dateStr: r.date_str
            })),
            total,
            page,
            pageSize,
            totalPages: Math.max(1, Math.ceil(total / pageSize))
        });
    } else {
        const all = fallbackMemoryDb.history_logs.filter(h => h.user_id === req.userId);
        const total = all.length;
        const paged = all.slice(offset, offset + pageSize);
        res.json({
            success: true,
            logs: paged.map(r => ({
                id: r.id,
                routineId: r.routine_id,
                routineName: r.routine_name,
                action: r.action,
                timestamp: r.timestamp,
                dateStr: r.date_str
            })),
            total,
            page,
            pageSize,
            totalPages: Math.max(1, Math.ceil(total / pageSize))
        });
    }
});

app.delete('/api/history', authMiddleware, (req, res) => {
    if (dbDriver === 'sqlite3') {
        db.run('DELETE FROM history_logs WHERE user_id = ?', [req.userId], (err) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true });
        });
    } else if (dbDriver === 'node:sqlite') {
        db.prepare('DELETE FROM history_logs WHERE user_id = ?').run(req.userId);
        res.json({ success: true });
    } else {
        fallbackMemoryDb.history_logs = fallbackMemoryDb.history_logs.filter(h => h.user_id !== req.userId);
        saveFallbackDb();
        res.json({ success: true });
    }
});

// ==========================================
// 7. ADMIN PANEL & MANAGEMENT APIS (/admin)
// ==========================================

// Serve Admin Panel UI
app.get(['/admin', '/admin/'], (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Admin Authorization Middleware
function adminAuthMiddleware(req, res, next) {
    authMiddleware(req, res, () => {
        const verifyRole = (user) => {
            if (!user) return res.status(403).json({ success: false, error: 'ইউজার পাওয়া যায়নি (User not found)' });
            const isAdmin = user.role === 'admin' || user.username === 'admin' || user.username === 'demo';
            if (!isAdmin) {
                return res.status(403).json({ success: false, error: 'অ্যাডমিন অনুমতি আবশ্যক (Admin privileges required)' });
            }
            req.adminUser = user;
            next();
        };

        if (dbDriver === 'sqlite3') {
            db.get('SELECT id, username, full_name, role FROM users WHERE id = ?', [req.userId], (err, user) => {
                if (err) return res.status(500).json({ success: false, error: err.message });
                verifyRole(user);
            });
        } else if (dbDriver === 'node:sqlite') {
            const user = db.prepare('SELECT id, username, full_name, role FROM users WHERE id = ?').get(req.userId);
            verifyRole(user);
        } else {
            const user = fallbackMemoryDb.users.find(u => u.id === req.userId);
            verifyRole(user);
        }
    });
}

// 7.1 Admin Overview & System Diagnostics
app.get('/api/admin/overview', adminAuthMiddleware, (req, res) => {
    const today = getTodayDateStr();
    const uptimeSec = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSec / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);
    const secs = uptimeSec % 60;
    const formattedUptime = `${hours}h ${mins}m ${secs}s`;

    const mem = process.memoryUsage();
    let dbSize = 0;
    try {
        if (fs.existsSync(DB_FILE)) {
            dbSize = fs.statSync(DB_FILE).size;
        } else if (fs.existsSync(DB_FILE + '.json')) {
            dbSize = fs.statSync(DB_FILE + '.json').size;
        }
    } catch (e) {}

    const serverInfo = {
        uptimeSeconds: uptimeSec,
        uptimeFormatted: formattedUptime,
        nodeVersion: process.version,
        platform: process.platform,
        port: PORT,
        dbDriver: dbDriver,
        dbFile: DB_FILE,
        dbSizeBytes: dbSize,
        dbSizeFormatted: (dbSize / 1024).toFixed(1) + ' KB',
        memory: {
            rss: (mem.rss / 1024 / 1024).toFixed(1) + ' MB',
            heapTotal: (mem.heapTotal / 1024 / 1024).toFixed(1) + ' MB',
            heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(1) + ' MB'
        }
    };

    if (dbDriver === 'sqlite3') {
        const statsQuery = `
            SELECT 
                (SELECT COUNT(*) FROM users) as totalUsers,
                (SELECT COUNT(*) FROM users WHERE role = 'admin' OR username = 'admin' OR username = 'demo') as totalAdmins,
                (SELECT COUNT(*) FROM routines) as totalRoutines,
                (SELECT COUNT(*) FROM routines WHERE stock <= 3) as lowStockCount,
                (SELECT COUNT(*) FROM history_logs) as totalLogs,
                (SELECT COUNT(*) FROM history_logs WHERE date_str = ?) as todayLogs,
                (SELECT COUNT(*) FROM hydration) as totalHydration
        `;
        db.get(statsQuery, [today], (err, counts) => {
            if (err) return res.status(500).json({ success: false, error: err.message });

            // Recent 10 audit logs with user info
            const recentLogsQuery = `
                SELECT h.id, h.routine_id, h.routine_name, h.action, h.timestamp, h.date_str, u.username, u.full_name
                FROM history_logs h
                LEFT JOIN users u ON h.user_id = u.id
                ORDER BY h.timestamp DESC
                LIMIT 10
            `;
            db.all(recentLogsQuery, [], (rErr, recentLogs) => {
                const totalRoutines = counts ? counts.totalRoutines : 0;
                const todayLogs = counts ? counts.todayLogs : 0;
                const adherence = totalRoutines > 0 ? Math.min(100, Math.round((todayLogs / totalRoutines) * 100)) : 100;

                res.json({
                    success: true,
                    server: serverInfo,
                    counts: {
                        totalUsers: counts?.totalUsers || 0,
                        totalAdmins: counts?.totalAdmins || 0,
                        totalRoutines: totalRoutines,
                        lowStockCount: counts?.lowStockCount || 0,
                        totalLogs: counts?.totalLogs || 0,
                        todayLogs: todayLogs,
                        totalHydration: counts?.totalHydration || 0,
                        adherenceRate: adherence
                    },
                    recentLogs: recentLogs || []
                });
            });
        });
    } else if (dbDriver === 'node:sqlite') {
        try {
            const counts = db.prepare(`
                SELECT 
                    (SELECT COUNT(*) FROM users) as totalUsers,
                    (SELECT COUNT(*) FROM users WHERE role = 'admin' OR username = 'admin' OR username = 'demo') as totalAdmins,
                    (SELECT COUNT(*) FROM routines) as totalRoutines,
                    (SELECT COUNT(*) FROM routines WHERE stock <= 3) as lowStockCount,
                    (SELECT COUNT(*) FROM history_logs) as totalLogs,
                    (SELECT COUNT(*) FROM history_logs WHERE date_str = ?) as todayLogs,
                    (SELECT COUNT(*) FROM hydration) as totalHydration
            `).get(today);

            const recentLogs = db.prepare(`
                SELECT h.id, h.routine_id, h.routine_name, h.action, h.timestamp, h.date_str, u.username, u.full_name
                FROM history_logs h
                LEFT JOIN users u ON h.user_id = u.id
                ORDER BY h.timestamp DESC
                LIMIT 10
            `).all();

            const totalRoutines = counts ? counts.totalRoutines : 0;
            const todayLogs = counts ? counts.todayLogs : 0;
            const adherence = totalRoutines > 0 ? Math.min(100, Math.round((todayLogs / totalRoutines) * 100)) : 100;

            res.json({
                success: true,
                server: serverInfo,
                counts: {
                    totalUsers: counts?.totalUsers || 0,
                    totalAdmins: counts?.totalAdmins || 0,
                    totalRoutines: totalRoutines,
                    lowStockCount: counts?.lowStockCount || 0,
                    totalLogs: counts?.totalLogs || 0,
                    todayLogs: todayLogs,
                    totalHydration: counts?.totalHydration || 0,
                    adherenceRate: adherence
                },
                recentLogs: recentLogs || []
            });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    } else {
        const totalUsers = fallbackMemoryDb.users.length;
        const totalAdmins = fallbackMemoryDb.users.filter(u => u.role === 'admin' || u.username === 'admin' || u.username === 'demo').length;
        const totalRoutines = fallbackMemoryDb.routines.length;
        const lowStockCount = fallbackMemoryDb.routines.filter(r => (Number(r.stock) || 0) <= 3).length;
        const totalLogs = fallbackMemoryDb.history_logs.length;
        const todayLogs = fallbackMemoryDb.history_logs.filter(h => h.date_str === today).length;
        const totalHydration = fallbackMemoryDb.hydration.length;
        const adherence = totalRoutines > 0 ? Math.min(100, Math.round((todayLogs / totalRoutines) * 100)) : 100;

        const userMap = new Map(fallbackMemoryDb.users.map(u => [u.id, u]));
        const recentLogs = [...fallbackMemoryDb.history_logs]
            .reverse()
            .slice(0, 10)
            .map(h => {
                const u = userMap.get(h.user_id);
                return {
                    id: h.id,
                    routine_id: h.routine_id,
                    routine_name: h.routine_name,
                    action: h.action,
                    timestamp: h.timestamp,
                    date_str: h.date_str,
                    username: u ? u.username : 'Unknown',
                    full_name: u ? u.full_name : 'Unknown User'
                };
            });

        res.json({
            success: true,
            server: serverInfo,
            counts: {
                totalUsers,
                totalAdmins,
                totalRoutines,
                lowStockCount,
                totalLogs,
                todayLogs,
                totalHydration,
                adherenceRate: adherence
            },
            recentLogs
        });
    }
});

// 7.2 List All Registered Users with Activity Metrics
app.get('/api/admin/users', adminAuthMiddleware, (req, res) => {
    if (dbDriver === 'sqlite3') {
        const query = `
            SELECT 
                u.id, u.username, u.full_name, u.role, u.created_at,
                (SELECT COUNT(*) FROM routines WHERE user_id = u.id) as routines_count,
                (SELECT COUNT(*) FROM history_logs WHERE user_id = u.id) as logs_count,
                (SELECT MAX(timestamp) FROM history_logs WHERE user_id = u.id) as last_activity
            FROM users u
            ORDER BY u.created_at DESC
        `;
        db.all(query, [], (err, rows) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({
                success: true,
                users: (rows || []).map(u => ({
                    ...u,
                    role: u.role || (u.username === 'admin' || u.username === 'demo' ? 'admin' : 'user')
                }))
            });
        });
    } else if (dbDriver === 'node:sqlite') {
        try {
            const query = `
                SELECT 
                    u.id, u.username, u.full_name, u.role, u.created_at,
                    (SELECT COUNT(*) FROM routines WHERE user_id = u.id) as routines_count,
                    (SELECT COUNT(*) FROM history_logs WHERE user_id = u.id) as logs_count,
                    (SELECT MAX(timestamp) FROM history_logs WHERE user_id = u.id) as last_activity
                FROM users u
                ORDER BY u.created_at DESC
            `;
            const rows = db.prepare(query).all();
            res.json({
                success: true,
                users: (rows || []).map(u => ({
                    ...u,
                    role: u.role || (u.username === 'admin' || u.username === 'demo' ? 'admin' : 'user')
                }))
            });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    } else {
        const list = fallbackMemoryDb.users.map(u => {
            const userRoutines = fallbackMemoryDb.routines.filter(r => r.user_id === u.id);
            const userLogs = fallbackMemoryDb.history_logs.filter(h => h.user_id === u.id);
            const lastLog = userLogs.length > 0 ? userLogs[userLogs.length - 1].timestamp : null;
            return {
                id: u.id,
                username: u.username,
                full_name: u.full_name,
                role: u.role || (u.username === 'admin' || u.username === 'demo' ? 'admin' : 'user'),
                created_at: u.created_at,
                routines_count: userRoutines.length,
                logs_count: userLogs.length,
                last_activity: lastLog
            };
        }).reverse();
        res.json({ success: true, users: list });
    }
});

// 7.3 Admin Create New User
app.post('/api/admin/users', adminAuthMiddleware, (req, res) => {
    const { username, full_name, password, role } = req.body;
    if (!username || !password || !full_name) {
        return res.status(400).json({ success: false, error: 'ইউজারনেম, নাম এবং পাসওয়ার্ড আবশ্যক।' });
    }
    const cleanUsername = username.trim().toLowerCase();
    const cleanName = full_name.trim();
    const assignedRole = role === 'admin' ? 'admin' : 'user';
    const userId = 'user_' + Date.now();
    const { hash, salt } = hashPassword(password);

    if (dbDriver === 'sqlite3') {
        db.get('SELECT id FROM users WHERE username = ?', [cleanUsername], (err, row) => {
            if (row) return res.status(409).json({ success: false, error: 'এই ইউজারনেম দিয়ে ইতিমধ্যে একাউন্ট আছে।' });
            db.run(
                'INSERT INTO users (id, username, full_name, password_hash, salt, created_at, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [userId, cleanUsername, cleanName, hash, salt, new Date().toISOString(), assignedRole],
                (insErr) => {
                    if (insErr) return res.status(500).json({ success: false, error: insErr.message });
                    res.json({ success: true, user: { id: userId, username: cleanUsername, full_name: cleanName, role: assignedRole } });
                }
            );
        });
    } else if (dbDriver === 'node:sqlite') {
        const row = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
        if (row) return res.status(409).json({ success: false, error: 'এই ইউজারনেম দিয়ে ইতিমধ্যে একাউন্ট আছে।' });
        db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?, ?)').run(userId, cleanUsername, cleanName, hash, salt, new Date().toISOString(), assignedRole);
        res.json({ success: true, user: { id: userId, username: cleanUsername, full_name: cleanName, role: assignedRole } });
    } else {
        if (fallbackMemoryDb.users.some(u => u.username === cleanUsername)) {
            return res.status(409).json({ success: false, error: 'এই ইউজারনেম দিয়ে ইতিমধ্যে একাউন্ট আছে।' });
        }
        fallbackMemoryDb.users.push({ id: userId, username: cleanUsername, full_name: cleanName, password_hash: hash, salt, created_at: new Date().toISOString(), role: assignedRole });
        saveFallbackDb();
        res.json({ success: true, user: { id: userId, username: cleanUsername, full_name: cleanName, role: assignedRole } });
    }
});

// 7.4 Admin Toggle User Role
app.put('/api/admin/users/:id/role', adminAuthMiddleware, (req, res) => {
    const targetUserId = req.params.id;
    const { role } = req.body;
    if (!['admin', 'user'].includes(role)) {
        return res.status(400).json({ success: false, error: 'অবৈধ রোল' });
    }
    if (targetUserId === req.userId && role !== 'admin') {
        return res.status(400).json({ success: false, error: 'আপনি নিজের অ্যাকাউন্ট থেকে অ্যাডমিন ক্ষমতা প্রত্যাহার করতে পারবেন না।' });
    }

    if (dbDriver === 'sqlite3') {
        db.run('UPDATE users SET role = ? WHERE id = ?', [role, targetUserId], function (err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            if (this.changes === 0) return res.status(404).json({ success: false, error: 'ইউজার পাওয়া যায়নি।' });
            res.json({ success: true, role });
        });
    } else if (dbDriver === 'node:sqlite') {
        const info = db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, targetUserId);
        if (info.changes === 0) return res.status(404).json({ success: false, error: 'ইউজার পাওয়া যায়নি।' });
        res.json({ success: true, role });
    } else {
        const u = fallbackMemoryDb.users.find(item => item.id === targetUserId);
        if (!u) return res.status(404).json({ success: false, error: 'ইউজার পাওয়া যায়নি।' });
        u.role = role;
        saveFallbackDb();
        res.json({ success: true, role });
    }
});

// 7.5 Admin Reset User Password
app.put('/api/admin/users/:id/password', adminAuthMiddleware, (req, res) => {
    const targetUserId = req.params.id;
    const { password } = req.body;
    if (!password || password.length < 4) {
        return res.status(400).json({ success: false, error: 'পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।' });
    }
    const { hash, salt } = hashPassword(password);

    if (dbDriver === 'sqlite3') {
        db.run('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?', [hash, salt, targetUserId], function (err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            if (this.changes === 0) return res.status(404).json({ success: false, error: 'ইউজার পাওয়া যায়নি।' });
            res.json({ success: true });
        });
    } else if (dbDriver === 'node:sqlite') {
        const info = db.prepare('UPDATE users SET password_hash = ?, salt = ? WHERE id = ?').run(hash, salt, targetUserId);
        if (info.changes === 0) return res.status(404).json({ success: false, error: 'ইউজার পাওয়া যায়নি।' });
        res.json({ success: true });
    } else {
        const u = fallbackMemoryDb.users.find(item => item.id === targetUserId);
        if (!u) return res.status(404).json({ success: false, error: 'ইউজার পাওয়া যায়নি।' });
        u.password_hash = hash;
        u.salt = salt;
        saveFallbackDb();
        res.json({ success: true });
    }
});

// 7.6 Admin Delete User & Cascade Data
app.delete('/api/admin/users/:id', adminAuthMiddleware, (req, res) => {
    const targetUserId = req.params.id;
    if (targetUserId === req.userId) {
        return res.status(400).json({ success: false, error: 'লগইন থাকা অবস্থায় নিজের একাউন্ট মুছে ফেলা যাবে না।' });
    }

    if (dbDriver === 'sqlite3') {
        db.serialize(() => {
            db.run('DELETE FROM routines WHERE user_id = ?', [targetUserId]);
            db.run('DELETE FROM history_logs WHERE user_id = ?', [targetUserId]);
            db.run('DELETE FROM hydration WHERE user_id = ?', [targetUserId]);
            db.run('DELETE FROM users WHERE id = ?', [targetUserId], function (err) {
                if (err) return res.status(500).json({ success: false, error: err.message });
                res.json({ success: true });
            });
        });
    } else if (dbDriver === 'node:sqlite') {
        db.prepare('DELETE FROM routines WHERE user_id = ?').run(targetUserId);
        db.prepare('DELETE FROM history_logs WHERE user_id = ?').run(targetUserId);
        db.prepare('DELETE FROM hydration WHERE user_id = ?').run(targetUserId);
        db.prepare('DELETE FROM users WHERE id = ?').run(targetUserId);
        res.json({ success: true });
    } else {
        fallbackMemoryDb.routines = fallbackMemoryDb.routines.filter(r => r.user_id !== targetUserId);
        fallbackMemoryDb.history_logs = fallbackMemoryDb.history_logs.filter(h => h.user_id !== targetUserId);
        fallbackMemoryDb.hydration = fallbackMemoryDb.hydration.filter(hyd => hyd.user_id !== targetUserId);
        fallbackMemoryDb.users = fallbackMemoryDb.users.filter(u => u.id !== targetUserId);
        saveFallbackDb();
        res.json({ success: true });
    }
});

// 7.7 Admin Master Medication & Injection Schedules Monitor
app.get('/api/admin/routines', adminAuthMiddleware, (req, res) => {
    const { type, lowStock, userId } = req.query;

    if (dbDriver === 'sqlite3') {
        let query = `
            SELECT r.*, u.username, u.full_name
            FROM routines r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE 1=1
        `;
        const params = [];
        if (type) {
            query += ' AND r.type = ?';
            params.push(type);
        }
        if (lowStock === 'true') {
            query += ' AND r.stock <= 3';
        }
        if (userId) {
            query += ' AND r.user_id = ?';
            params.push(userId);
        }
        query += ' ORDER BY r.time ASC';

        db.all(query, params, (err, rows) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({
                success: true,
                routines: (rows || []).map(r => ({
                    id: r.id,
                    userId: r.user_id,
                    username: r.username,
                    userFullName: r.full_name,
                    name: r.name,
                    type: r.type,
                    dosage: r.dosage,
                    meal: r.meal,
                    time: r.time,
                    stock: r.stock,
                    notes: r.notes,
                    startDate: r.start_date,
                    durationDays: r.duration_days,
                    endDate: r.end_date,
                    frequency: r.frequency,
                    times: r.times_json ? JSON.parse(r.times_json) : [r.time]
                }))
            });
        });
    } else if (dbDriver === 'node:sqlite') {
        try {
            let query = `
                SELECT r.*, u.username, u.full_name
                FROM routines r
                LEFT JOIN users u ON r.user_id = u.id
                WHERE 1=1
            `;
            const params = [];
            if (type) {
                query += ' AND r.type = ?';
                params.push(type);
            }
            if (lowStock === 'true') {
                query += ' AND r.stock <= 3';
            }
            if (userId) {
                query += ' AND r.user_id = ?';
                params.push(userId);
            }
            query += ' ORDER BY r.time ASC';

            const rows = db.prepare(query).all(...params);
            res.json({
                success: true,
                routines: (rows || []).map(r => ({
                    id: r.id,
                    userId: r.user_id,
                    username: r.username,
                    userFullName: r.full_name,
                    name: r.name,
                    type: r.type,
                    dosage: r.dosage,
                    meal: r.meal,
                    time: r.time,
                    stock: r.stock,
                    notes: r.notes,
                    startDate: r.start_date,
                    durationDays: r.duration_days,
                    endDate: r.end_date,
                    frequency: r.frequency,
                    times: r.times_json ? JSON.parse(r.times_json) : [r.time]
                }))
            });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    } else {
        const userMap = new Map(fallbackMemoryDb.users.map(u => [u.id, u]));
        let list = fallbackMemoryDb.routines;
        if (type) list = list.filter(r => r.type === type);
        if (lowStock === 'true') list = list.filter(r => (Number(r.stock) || 0) <= 3);
        if (userId) list = list.filter(r => r.user_id === userId);

        res.json({
            success: true,
            routines: list.map(r => {
                const u = userMap.get(r.user_id);
                return {
                    id: r.id,
                    userId: r.user_id,
                    username: u ? u.username : 'Unknown',
                    userFullName: u ? u.full_name : 'Unknown User',
                    name: r.name,
                    type: r.type,
                    dosage: r.dosage,
                    meal: r.meal,
                    time: r.time,
                    stock: r.stock,
                    notes: r.notes,
                    startDate: r.startDate || r.start_date,
                    durationDays: r.durationDays || r.duration_days,
                    endDate: r.endDate || r.end_date,
                    frequency: r.frequency,
                    times: r.times || [r.time]
                };
            })
        });
    }
});

// 7.8 Admin Global Audit & Patient Adherence Logs
app.get('/api/admin/logs', adminAuthMiddleware, (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.max(1, parseInt(req.query.pageSize, 10) || 20);
    const offset = (page - 1) * pageSize;
    const actionFilter = req.query.action || '';
    const search = req.query.search || '';

    if (dbDriver === 'sqlite3') {
        let where = 'WHERE 1=1';
        const params = [];
        if (actionFilter) {
            where += ' AND h.action LIKE ?';
            params.push(`%${actionFilter}%`);
        }
        if (search) {
            where += ' AND (h.routine_name LIKE ? OR u.full_name LIKE ? OR u.username LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const countQuery = `SELECT COUNT(*) as count FROM history_logs h LEFT JOIN users u ON h.user_id = u.id ${where}`;
        db.get(countQuery, params, (err, countRow) => {
            const total = countRow ? countRow.count : 0;
            const dataQuery = `
                SELECT h.*, u.username, u.full_name
                FROM history_logs h
                LEFT JOIN users u ON h.user_id = u.id
                ${where}
                ORDER BY h.timestamp DESC
                LIMIT ? OFFSET ?
            `;
            db.all(dataQuery, [...params, pageSize, offset], (lErr, rows) => {
                if (lErr) return res.status(500).json({ success: false, error: lErr.message });
                res.json({
                    success: true,
                    logs: (rows || []).map(r => ({
                        id: r.id,
                        userId: r.user_id,
                        username: r.username,
                        userFullName: r.full_name,
                        routineId: r.routine_id,
                        routineName: r.routine_name,
                        action: r.action,
                        timestamp: r.timestamp,
                        dateStr: r.date_str
                    })),
                    total,
                    page,
                    pageSize,
                    totalPages: Math.max(1, Math.ceil(total / pageSize))
                });
            });
        });
    } else if (dbDriver === 'node:sqlite') {
        try {
            let where = 'WHERE 1=1';
            const params = [];
            if (actionFilter) {
                where += ' AND h.action LIKE ?';
                params.push(`%${actionFilter}%`);
            }
            if (search) {
                where += ' AND (h.routine_name LIKE ? OR u.full_name LIKE ? OR u.username LIKE ?)';
                params.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }

            const countQuery = `SELECT COUNT(*) as count FROM history_logs h LEFT JOIN users u ON h.user_id = u.id ${where}`;
            const countRow = db.prepare(countQuery).get(...params);
            const total = countRow ? countRow.count : 0;

            const dataQuery = `
                SELECT h.*, u.username, u.full_name
                FROM history_logs h
                LEFT JOIN users u ON h.user_id = u.id
                ${where}
                ORDER BY h.timestamp DESC
                LIMIT ? OFFSET ?
            `;
            const rows = db.prepare(dataQuery).all(...params, pageSize, offset);
            res.json({
                success: true,
                logs: (rows || []).map(r => ({
                    id: r.id,
                    userId: r.user_id,
                    username: r.username,
                    userFullName: r.full_name,
                    routineId: r.routine_id,
                    routineName: r.routine_name,
                    action: r.action,
                    timestamp: r.timestamp,
                    dateStr: r.date_str
                })),
                total,
                page,
                pageSize,
                totalPages: Math.max(1, Math.ceil(total / pageSize))
            });
        } catch (e) {
            res.status(500).json({ success: false, error: e.message });
        }
    } else {
        const userMap = new Map(fallbackMemoryDb.users.map(u => [u.id, u]));
        let all = fallbackMemoryDb.history_logs.map(h => {
            const u = userMap.get(h.user_id);
            return {
                id: h.id,
                userId: h.user_id,
                username: u ? u.username : 'Unknown',
                userFullName: u ? u.full_name : 'Unknown User',
                routineId: h.routine_id,
                routineName: h.routine_name,
                action: h.action,
                timestamp: h.timestamp,
                dateStr: h.date_str
            };
        }).reverse();

        if (actionFilter) {
            all = all.filter(item => item.action.toLowerCase().includes(actionFilter.toLowerCase()));
        }
        if (search) {
            const q = search.toLowerCase();
            all = all.filter(item => 
                (item.routineName && item.routineName.toLowerCase().includes(q)) ||
                (item.userFullName && item.userFullName.toLowerCase().includes(q)) ||
                (item.username && item.username.toLowerCase().includes(q))
            );
        }

        const total = all.length;
        const paged = all.slice(offset, offset + pageSize);
        res.json({
            success: true,
            logs: paged,
            total,
            page,
            pageSize,
            totalPages: Math.max(1, Math.ceil(total / pageSize))
        });
    }
});

// 7.9 Admin Database Backup Download
app.get('/api/admin/backup-db', adminAuthMiddleware, (req, res) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    if (fs.existsSync(DB_FILE)) {
        res.download(DB_FILE, `medicare-backup-${timestamp}.sqlite`);
    } else if (fs.existsSync(DB_FILE + '.json')) {
        res.download(DB_FILE + '.json', `medicare-backup-${timestamp}.sqlite.json`);
    } else {
        res.status(404).json({ success: false, error: 'Database file not found on server.' });
    }
});

// 7.10 Admin Database VACUUM / Maintenance
app.post('/api/admin/vacuum-db', adminAuthMiddleware, (req, res) => {
    try {
        if (dbDriver === 'sqlite3') {
            db.run('VACUUM;', (err) => {
                if (err) return res.status(500).json({ success: false, error: err.message });
                res.json({ success: true, message: 'SQLite database vacuumed and optimized successfully.' });
            });
        } else if (dbDriver === 'node:sqlite') {
            db.exec('VACUUM;');
            res.json({ success: true, message: 'SQLite database vacuumed and optimized successfully.' });
        } else {
            saveFallbackDb();
            res.json({ success: true, message: 'Database state verified and compacted.' });
        }
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ==========================================
// 8. SERVER BOOTSTRAP
// ==========================================
app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🩺 MediCare Clinical Suite is running on: http://localhost:${PORT}`);
    console.log(`💾 Native SQLite database file: ${DB_FILE}`);
    console.log(`👤 Multi-Device Sync Ready. Default Demo -> demo / 123456`);
    console.log(`======================================================\n`);
});
