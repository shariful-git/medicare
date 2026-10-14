/**
 * MediCare - Native Node.js & SQLite Backend Server
 * Provides genuine SQLite file storage (medicare.sqlite) & multi-user authentication.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'medicare.sqlite');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ==========================================
// 1. SQLITE ENGINE ADAPTER
// Supports node:sqlite (Node 22+), sqlite3, or resilient file-backed store
// ==========================================
let dbDriver = null;
let db = null;

// Password hashing helpers using native Node crypto (Zero external dependency)
function hashPassword(password, salt = null) {
    if (!salt) {
        salt = crypto.randomBytes(16).toString('hex');
    }
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return { hash, salt };
}

function verifyPassword(password, hash, salt) {
    const calculated = crypto.scryptSync(password, salt, 64).toString('hex');
    return calculated === hash;
}

// Token helper
const activeSessions = new Map();

function generateToken(userId) {
    const token = 'mctk_' + crypto.randomBytes(24).toString('hex');
    activeSessions.set(token, { userId, createdAt: Date.now() });
    return token;
}

function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ success: false, error: 'অনুগ্রহ করে লগইন করুন (Unauthorized)' });
    }
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const session = activeSessions.get(token);
    if (!session) {
        return res.status(401).json({ success: false, error: 'সেশনের মেয়াদ শেষ বা সঠিক নয় (Invalid Session)' });
    }
    req.userId = session.userId;
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
                times_json TEXT DEFAULT '',
                taken_history TEXT DEFAULT '{}',
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
        `);

        // Graceful column migration for sqlite3
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
                console.log('Default Demo user created (Fresh zero routines): username: demo | password: 123456');
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
            created_at TEXT NOT NULL
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
        res.json({ success: true, user });
    } else {
        const user = fallbackMemoryDb.users.find(u => u.id === req.userId);
        res.json({ success: true, user: { id: user.id, username: user.username, full_name: user.full_name } });
    }
});

// ==========================================
// 4. ROUTINES API (PER-USER DATA)
// ==========================================

// Get Routines
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
                ...r,
                takenToday: Boolean(r.taken_today),
                times,
                takenHistory
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
    const timesArr = Array.isArray(times) ? times : (time ? [time] : ['08:00']);
    const timesJson = JSON.stringify(timesArr);
    const historyJson = JSON.stringify(takenHistory || {});
    const primaryTime = time || timesArr[0] || '08:00';

    if (dbDriver === 'sqlite3') {
        db.run(
            `INSERT INTO routines (id, user_id, name, type, dosage, meal, time, stock, notes, taken_today, last_taken_date, created_at, start_date, duration_days, end_date, frequency, times_json, taken_history)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '', ?, ?, ?, ?, ?, ?, ?)`,
            [routineId, req.userId, name, type || 'tablet', dosage, meal, primaryTime, stock || 0, notes || '', createdAt, startDate || '', durationDays || 1, endDate || '', frequency || timesArr.length, timesJson, historyJson],
            function (err) {
                if (err) return res.status(500).json({ success: false, error: err.message });
                // Log action in history
                const logId = 'log-' + Date.now();
                db.run('INSERT INTO history_logs VALUES (?, ?, ?, ?, ?, ?, ?)', [
                    logId, req.userId, routineId, name, req.body.isCloned ? 'action_cloned' : 'action_added',
                    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                    new Date().toLocaleDateString('en-CA')
                ]);
                res.json({ success: true, id: routineId });
            }
        );
    } else {
        const newRoutine = {
            id: routineId,
            user_id: req.userId,
            name,
            type: type || 'tablet',
            dosage,
            meal,
            time: primaryTime,
            stock: stock || 0,
            notes: notes || '',
            takenToday: false,
            lastTakenDate: '',
            createdAt,
            startDate: startDate || '',
            durationDays: durationDays || 1,
            endDate: endDate || '',
            frequency: frequency || timesArr.length,
            times: timesArr,
            takenHistory: takenHistory || {}
        };
        fallbackMemoryDb.routines.unshift(newRoutine);
        saveFallbackDb();
        res.json({ success: true, id: routineId });
    }
});

// Update Routine
app.put('/api/routines/:id', authMiddleware, (req, res) => {
    const { id } = req.params;
    const { name, type, dosage, meal, time, stock, notes, startDate, durationDays, endDate, frequency, times, takenHistory } = req.body;
    const timesArr = Array.isArray(times) ? times : (time ? [time] : ['08:00']);
    const timesJson = JSON.stringify(timesArr);
    const historyJson = JSON.stringify(takenHistory || {});
    const primaryTime = time || timesArr[0] || '08:00';

    if (dbDriver === 'sqlite3') {
        db.run(
            `UPDATE routines SET name = ?, type = ?, dosage = ?, meal = ?, time = ?, stock = ?, notes = ?, start_date = ?, duration_days = ?, end_date = ?, frequency = ?, times_json = ?, taken_history = ?
             WHERE id = ? AND user_id = ?`,
            [name, type, dosage, meal, primaryTime, stock || 0, notes || '', startDate || '', durationDays || 1, endDate || '', frequency || timesArr.length, timesJson, historyJson, id, req.userId],
            function (err) {
                if (err) return res.status(500).json({ success: false, error: err.message });
                res.json({ success: true });
            }
        );
    } else {
        const item = fallbackMemoryDb.routines.find(r => r.id === id && r.user_id === req.userId);
        if (item) {
            Object.assign(item, {
                name,
                type,
                dosage,
                meal,
                time: primaryTime,
                stock,
                notes,
                startDate: startDate || item.startDate,
                durationDays: durationDays || item.durationDays,
                endDate: endDate || item.endDate,
                frequency: frequency || item.frequency,
                times: timesArr,
                takenHistory: takenHistory || item.takenHistory
            });
            saveFallbackDb();
        }
        res.json({ success: true });
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
    } else {
        fallbackMemoryDb.routines = fallbackMemoryDb.routines.filter(r => !(r.id === id && r.user_id === req.userId));
        saveFallbackDb();
        res.json({ success: true });
    }
});

// Reset / Fresh Database for active user
app.post('/api/database/reset', authMiddleware, (req, res) => {
    if (dbDriver === 'sqlite3') {
        db.run('DELETE FROM routines WHERE user_id = ?', [req.userId]);
        db.run('DELETE FROM history_logs WHERE user_id = ?', [req.userId]);
        db.run('DELETE FROM hydration WHERE user_id = ?', [req.userId], (err) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true, message: 'User database reset successfully.' });
        });
    } else if (dbDriver === 'node:sqlite') {
        db.prepare('DELETE FROM routines WHERE user_id = ?').run(req.userId);
        db.prepare('DELETE FROM history_logs WHERE user_id = ?').run(req.userId);
        db.prepare('DELETE FROM hydration WHERE user_id = ?').run(req.userId);
        res.json({ success: true, message: 'User database reset successfully.' });
    } else {
        fallbackMemoryDb.routines = fallbackMemoryDb.routines.filter(r => r.user_id !== req.userId);
        fallbackMemoryDb.history_logs = fallbackMemoryDb.history_logs.filter(l => l.user_id !== req.userId);
        fallbackMemoryDb.hydration = fallbackMemoryDb.hydration.filter(h => h.user_id !== req.userId);
        saveFallbackDb();
        res.json({ success: true, message: 'User database reset successfully.' });
    }
});

// Download .sqlite Database directly
app.get('/api/database/download', (req, res) => {
    if (fs.existsSync(DB_FILE)) {
        res.download(DB_FILE, 'medicare.sqlite');
    } else {
        res.status(404).json({ success: false, error: 'Database file not yet created.' });
    }
});

// ==========================================
// 5. SERVER BOOTSTRAP
// ==========================================
app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🩺 MediCare Clinical Suite is running on: http://localhost:${PORT}`);
    console.log(`💾 Native SQLite database file: ${DB_FILE}`);
    console.log(`👤 Demo Account -> Username: demo | Password: 123456`);
    console.log(`======================================================\n`);
});
