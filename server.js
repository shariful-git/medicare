/**
 * MediCare - Native Node.js & SQLite Backend Server
 * Provides genuine SQLite file storage (medicare.sqlite) & multi-device synchronization.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'medicare.sqlite');
const SERVER_SECRET = process.env.MEDICARE_SECRET || 'medicare_clinical_suite_secret_2026';

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

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
                created_at TEXT NOT NULL
            );
        `);

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

        // Check and seed default demo user
        db.get('SELECT id FROM users WHERE username = ?', ['demo'], (err, row) => {
            if (!row) {
                const { hash, salt } = hashPassword('123456');
                const userId = 'user_demo_01';
                db.run(
                    'INSERT INTO users (id, username, full_name, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                    [userId, 'demo', 'ডা. শরিফুল ইসলাম (Dr. Shariful)', hash, salt, new Date().toISOString()]
                );
                console.log('Default Demo user created: username: demo | password: 123456');
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
            created_at TEXT NOT NULL
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

    ['start_date', 'duration_days', 'end_date', 'frequency', 'times_json', 'taken_history'].forEach(col => {
        try {
            db.exec(`ALTER TABLE routines ADD COLUMN ${col} TEXT DEFAULT '';`);
        } catch (e) {}
    });

    const check = db.prepare('SELECT id FROM users WHERE username = ?').get('demo');
    if (!check) {
        const { hash, salt } = hashPassword('123456');
        const userId = 'user_demo_01';
        db.prepare('INSERT INTO users (id, username, full_name, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
            userId, 'demo', 'ডা. শরিফুল ইসলাম (Dr. Shariful)', hash, salt, new Date().toISOString()
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
    if (!fallbackMemoryDb.users.some(u => u.username === 'demo')) {
        const { hash, salt } = hashPassword('123456');
        const userId = 'user_demo_01';
        fallbackMemoryDb.users.push({
            id: userId,
            username: 'demo',
            full_name: 'ডা. শরিফুল ইসলাম (Dr. Shariful)',
            password_hash: hash,
            salt: salt,
            created_at: new Date().toISOString()
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

    if (dbDriver === 'sqlite3') {
        db.get('SELECT id FROM users WHERE username = ?', [cleanUsername], (err, row) => {
            if (row) {
                return res.status(409).json({ success: false, error: 'এই ইউজারনেম দিয়ে ইতিমধ্যে একাউন্ট আছে।' });
            }
            const userId = 'user_' + Date.now();
            const { hash, salt } = hashPassword(password);
            db.run(
                'INSERT INTO users (id, username, full_name, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, cleanUsername, cleanName, hash, salt, new Date().toISOString()],
                function (insErr) {
                    if (insErr) return res.status(500).json({ success: false, error: insErr.message });
                    const token = generateToken(userId);
                    res.json({
                        success: true,
                        token,
                        user: { id: userId, username: cleanUsername, full_name: cleanName }
                    });
                }
            );
        });
    } else if (dbDriver === 'node:sqlite') {
        const row = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
        if (row) return res.status(409).json({ success: false, error: 'এই ইউজারনেম দিয়ে ইতিমধ্যে একাউন্ট আছে।' });
        const userId = 'user_' + Date.now();
        const { hash, salt } = hashPassword(password);
        db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)').run(userId, cleanUsername, cleanName, hash, salt, new Date().toISOString());
        const token = generateToken(userId);
        res.json({ success: true, token, user: { id: userId, username: cleanUsername, full_name: cleanName } });
    } else {
        if (fallbackMemoryDb.users.some(u => u.username === cleanUsername)) {
            return res.status(409).json({ success: false, error: 'এই ইউজারনেম দিয়ে ইতিমধ্যে একাউন্ট আছে।' });
        }
        const userId = 'user_' + Date.now();
        const { hash, salt } = hashPassword(password);
        const newUser = { id: userId, username: cleanUsername, full_name: cleanName, password_hash: hash, salt, created_at: new Date().toISOString() };
        fallbackMemoryDb.users.push(newUser);
        saveFallbackDb();
        const token = generateToken(userId);
        res.json({ success: true, token, user: { id: userId, username: cleanUsername, full_name: cleanName } });
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
            const token = generateToken(user.id);
            res.json({
                success: true,
                token,
                user: { id: user.id, username: user.username, full_name: user.full_name }
            });
        });
    } else if (dbDriver === 'node:sqlite') {
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(cleanUsername);
        if (!user || !verifyPassword(password, user.password_hash, user.salt)) {
            return res.status(401).json({ success: false, error: 'ইউজারনেম বা পাসওয়ার্ড সঠিক নয়।' });
        }
        const token = generateToken(user.id);
        res.json({ success: true, token, user: { id: user.id, username: user.username, full_name: user.full_name } });
    } else {
        const user = fallbackMemoryDb.users.find(u => u.username === cleanUsername);
        if (!user || !verifyPassword(password, user.password_hash, user.salt)) {
            return res.status(401).json({ success: false, error: 'ইউজারনেম বা পাসওয়ার্ড সঠিক নয়।' });
        }
        const token = generateToken(user.id);
        res.json({ success: true, token, user: { id: user.id, username: user.username, full_name: user.full_name } });
    }
});

// Me (Verify session)
app.get('/api/auth/me', authMiddleware, (req, res) => {
    if (dbDriver === 'sqlite3') {
        db.get('SELECT id, username, full_name FROM users WHERE id = ?', [req.userId], (err, user) => {
            if (!user) return res.status(404).json({ success: false, error: 'User not found' });
            res.json({ success: true, user });
        });
    } else if (dbDriver === 'node:sqlite') {
        const user = db.prepare('SELECT id, username, full_name FROM users WHERE id = ?').get(req.userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        res.json({ success: true, user });
    } else {
        const user = fallbackMemoryDb.users.find(u => u.id === req.userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        res.json({ success: true, user: { id: user.id, username: user.username, full_name: user.full_name } });
    }
});

// ==========================================
// 4. ROUTINES API (PER-USER DATA SYNC)
// ==========================================

// Get all routines of active user
app.get('/api/routines', authMiddleware, (req, res) => {
    if (dbDriver === 'sqlite3') {
        db.all('SELECT * FROM routines WHERE user_id = ? ORDER BY time ASC', [req.userId], (err, rows) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            const list = (rows || []).map(r => {
                let times = [];
                try { times = r.times_json ? JSON.parse(r.times_json) : [r.time]; } catch (e) { times = [r.time]; }
                let takenHistory = {};
                try { takenHistory = r.taken_history ? JSON.parse(r.taken_history) : {}; } catch (e) { takenHistory = {}; }
                return {
                    id: r.id,
                    name: r.name,
                    type: r.type,
                    dosage: r.dosage,
                    meal: r.meal,
                    time: r.time,
                    stock: r.stock,
                    notes: r.notes,
                    takenToday: Boolean(r.taken_today),
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
            return {
                id: r.id,
                name: r.name,
                type: r.type,
                dosage: r.dosage,
                meal: r.meal,
                time: r.time,
                stock: r.stock,
                notes: r.notes,
                takenToday: Boolean(r.taken_today),
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
        const list = fallbackMemoryDb.routines.filter(r => r.user_id === req.userId);
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
// 7. SERVER BOOTSTRAP
// ==========================================
app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🩺 MediCare Clinical Suite is running on: http://localhost:${PORT}`);
    console.log(`💾 Native SQLite database file: ${DB_FILE}`);
    console.log(`👤 Multi-Device Sync Ready. Default Demo -> demo / 123456`);
    console.log(`======================================================\n`);
});
