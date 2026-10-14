/**
 * MediCare - SQLite Database Layer (Powered by WebAssembly SQLite / sql.js)
 * Provides genuine relational SQLite database operations in the browser with Multi-User isolation.
 */

window.MediCareSQLite = (function () {
    let db = null;
    let isReady = false;
    const DB_STORAGE_KEY = 'medicare_sqlite_bin_v1';

    /**
     * Resolves the active user ID (defaulting to 'guest')
     */
    function getActiveUserId() {
        if (window.MediCareAuth && typeof window.MediCareAuth.getCurrentUser === 'function') {
            const user = window.MediCareAuth.getCurrentUser();
            if (user && user.id) return user.id;
        }
        return 'guest';
    }

    /**
     * Initializes the SQLite WebAssembly database
     */
    async function init() {
        try {
            if (typeof initSqlJs !== 'function') {
                console.warn('sql.js is not loaded yet, falling back to local storage.');
                return false;
            }

            const SQL = await initSqlJs({
                locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`
            });

            // Check if binary database is saved in localStorage
            const savedDbBase64 = localStorage.getItem(DB_STORAGE_KEY);
            if (savedDbBase64) {
                try {
                    const binaryString = atob(savedDbBase64);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    db = new SQL.Database(bytes);
                } catch (e) {
                    console.warn('Could not restore saved SQLite binary, creating fresh DB:', e);
                    db = new SQL.Database();
                }
            } else {
                db = new SQL.Database();
            }

            // Run table creation schemas
            const schema = window.MediCareConfig ? window.MediCareConfig.SQLITE_SCHEMA : '';
            if (schema) {
                db.run(schema);
            }

            // Non-breaking column migrations for existing databases
            ['startDate', 'durationDays', 'endDate', 'frequency', 'timesJson', 'takenHistoryJson'].forEach(col => {
                try {
                    db.run(`ALTER TABLE routines ADD COLUMN ${col} TEXT DEFAULT '';`);
                } catch (e) {
                    // Column already exists, safe to ignore
                }
            });

            isReady = true;
            persist();
            console.log('SQLite WebAssembly Database initialized successfully.');
            return true;
        } catch (err) {
            console.warn('SQLite init warning (operating in standard mode):', err);
            isReady = false;
            return false;
        }
    }

    /**
     * Saves the binary SQLite database to persistent storage
     */
    function persist() {
        if (!db || !isReady) return;
        try {
            const data = db.export();
            let binary = '';
            const len = data.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(data[i]);
            }
            const base64 = btoa(binary);
            localStorage.setItem(DB_STORAGE_KEY, base64);
        } catch (e) {
            console.warn('Failed to persist SQLite DB binary:', e);
        }
    }

    /**
     * Executes arbitrary SQL query and returns results
     */
    function runQuery(sqlString) {
        if (!db || !isReady) {
            return { success: false, error: 'SQLite ডাটাবেজ এখনো প্রস্তুত হয়নি।' };
        }
        try {
            const res = db.exec(sqlString);
            persist();
            return { success: true, result: res };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Synchronizes a list of routines for a specific user into the SQLite table
     */
    function syncRoutines(routines, userId) {
        if (!db || !isReady) return;
        const targetUser = userId || getActiveUserId();
        try {
            db.run('DELETE FROM routines WHERE user_id = ?;', [targetUser]);
            const stmt = db.prepare(`
                INSERT INTO routines (id, user_id, name, type, dosage, meal, time, stock, notes, takenToday, lastTakenDate, createdAt, startDate, durationDays, endDate, frequency, timesJson, takenHistoryJson)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            `);

            routines.forEach(r => {
                const timesJson = JSON.stringify(Array.isArray(r.times) ? r.times : (r.time ? [r.time] : ['08:00']));
                const historyJson = JSON.stringify(r.takenHistory && typeof r.takenHistory === 'object' ? r.takenHistory : {});
                stmt.run([
                    r.id,
                    targetUser,
                    r.name,
                    r.type,
                    r.dosage,
                    r.meal,
                    r.time || (Array.isArray(r.times) && r.times[0] ? r.times[0] : '08:00'),
                    r.stock !== undefined && r.stock !== '' ? Number(r.stock) : 0,
                    r.notes || '',
                    r.takenToday ? 1 : 0,
                    r.lastTakenDate || '',
                    r.createdAt || new Date().toISOString(),
                    r.startDate || '',
                    parseInt(r.durationDays, 10) || 1,
                    r.endDate || '',
                    parseInt(r.frequency, 10) || (Array.isArray(r.times) ? r.times.length : 1),
                    timesJson,
                    historyJson
                ]);
            });
            stmt.free();
            persist();
        } catch (e) {
            console.warn('SQLite syncRoutines failed:', e);
        }
    }

    /**
     * Retrieves all routines for a specific user from SQLite
     */
    function loadRoutines(userId) {
        if (!db || !isReady) return null;
        const targetUser = userId || getActiveUserId();
        try {
            const stmt = db.prepare('SELECT * FROM routines WHERE user_id = ? ORDER BY time ASC;');
            stmt.bind([targetUser]);
            const list = [];
            while (stmt.step()) {
                const row = stmt.getAsObject();
                row.takenToday = Boolean(row.takenToday);
                if (row.timesJson) {
                    try { row.times = JSON.parse(row.timesJson); } catch (e) { row.times = [row.time]; }
                } else {
                    row.times = row.time ? [row.time] : ['08:00'];
                }
                if (row.takenHistoryJson) {
                    try { row.takenHistory = JSON.parse(row.takenHistoryJson); } catch (e) { row.takenHistory = {}; }
                } else {
                    row.takenHistory = {};
                }
                row.durationDays = parseInt(row.durationDays, 10) || 1;
                row.frequency = parseInt(row.frequency, 10) || (Array.isArray(row.times) ? row.times.length : 1);
                list.push(row);
            }
            stmt.free();
            return list;
        } catch (e) {
            console.warn('SQLite loadRoutines failed:', e);
            return null;
        }
    }

    /**
     * Fallback logs helper from localStorage (Isolated per user, no fake demo seeds)
     */
    function getFallbackLogs(userId) {
        const targetUser = userId || getActiveUserId();
        try {
            const raw = localStorage.getItem(`medicare_history_logs_v1_${targetUser}`);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (e) {}
        return [];
    }

    /**
     * Logs an activity in the history_logs SQLite table and per-user fallback storage
     */
    function logAction(routineId, routineName, action, timestampStr, dateStr, userId) {
        const targetUser = userId || getActiveUserId();
        const now = new Date();
        const id = 'log-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        
        let ts = timestampStr;
        if (!ts) {
            const hours = now.getHours();
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours % 12 || 12;
            ts = `${displayHours}:${minutes} ${ampm}`;
        }
        
        let ds = dateStr;
        if (!ds) {
            ds = now.toLocaleDateString('en-CA');
        }

        const logItem = {
            id,
            user_id: targetUser,
            routine_id: routineId,
            routine_name: routineName,
            action,
            timestamp: ts,
            date_str: ds
        };

        // 1. Mirror to user localStorage fallback
        try {
            const fallback = getFallbackLogs(targetUser);
            fallback.unshift(logItem);
            if (fallback.length > 300) fallback.length = 300;
            localStorage.setItem(`medicare_history_logs_v1_${targetUser}`, JSON.stringify(fallback));
        } catch (e) {}

        // 2. Insert into SQLite
        if (db && isReady) {
            try {
                db.run(`
                    INSERT INTO history_logs (id, user_id, routine_id, routine_name, action, timestamp, date_str)
                    VALUES (?, ?, ?, ?, ?, ?, ?);
                `, [id, targetUser, routineId, routineName, action, ts, ds]);
                persist();
            } catch (e) {
                console.warn('SQLite logAction failed:', e);
            }
        }
    }

    /**
     * Retrieves recent history logs from SQLite
     */
    function getHistoryLogs(limit = 30, userId) {
        const paged = getHistoryLogsPaged(1, limit, userId);
        return paged ? paged.logs : [];
    }

    /**
     * Retrieves paginated history logs isolated for active user (Default 20 per page)
     */
    function getHistoryLogsPaged(page = 1, pageSize = 20, userId) {
        const targetUser = userId || getActiveUserId();
        const p = Math.max(1, parseInt(page, 10) || 1);
        const limit = Math.max(1, parseInt(pageSize, 10) || 20);

        if (!db || !isReady) {
            const all = getFallbackLogs(targetUser);
            const total = all.length;
            const totalPages = Math.max(1, Math.ceil(total / limit));
            const safePage = Math.min(p, totalPages);
            const safeOffset = (safePage - 1) * limit;
            const logs = all.slice(safeOffset, safeOffset + limit);
            return {
                logs,
                total,
                page: safePage,
                pageSize: limit,
                totalPages
            };
        }

        try {
            let total = 0;
            const countStmt = db.prepare("SELECT COUNT(*) FROM history_logs WHERE user_id = ?;");
            countStmt.bind([targetUser]);
            if (countStmt.step()) {
                total = countStmt.get()[0] || 0;
            }
            countStmt.free();

            const totalPages = Math.max(1, Math.ceil(total / limit));
            const safePage = Math.min(p, totalPages);
            const safeOffset = (safePage - 1) * limit;

            const stmt = db.prepare("SELECT * FROM history_logs WHERE user_id = ? ORDER BY rowid DESC LIMIT ? OFFSET ?;");
            stmt.bind([targetUser, limit, safeOffset]);
            const logs = [];
            while (stmt.step()) {
                logs.push(stmt.getAsObject());
            }
            stmt.free();

            return {
                logs,
                total,
                page: safePage,
                pageSize: limit,
                totalPages
            };
        } catch (e) {
            console.warn('SQLite getHistoryLogsPaged error, fallback used:', e);
            const all = getFallbackLogs(targetUser);
            const total = all.length;
            const totalPages = Math.max(1, Math.ceil(total / limit));
            const safePage = Math.min(p, totalPages);
            const safeOffset = (safePage - 1) * limit;
            return {
                logs: all.slice(safeOffset, safeOffset + limit),
                total,
                page: safePage,
                pageSize: limit,
                totalPages
            };
        }
    }

    /**
     * Clears history logs for a specific user
     */
    function clearHistoryLogs(userId) {
        const targetUser = userId || getActiveUserId();
        if (db && isReady) {
            try {
                db.run("DELETE FROM history_logs WHERE user_id = ?;", [targetUser]);
                persist();
            } catch (e) {
                console.warn('SQLite clearHistoryLogs failed:', e);
            }
        }
        try {
            localStorage.removeItem(`medicare_history_logs_v1_${targetUser}`);
        } catch (e) {}
    }

    /**
     * Resets the entire SQLite database to a completely clean, fresh state
     */
    function resetDatabase() {
        if (db && isReady) {
            try {
                db.run("DELETE FROM routines;");
                db.run("DELETE FROM history_logs;");
                db.run("DELETE FROM hydration;");
                persist();
            } catch (e) {
                console.warn('SQLite resetDatabase failed:', e);
            }
        }
        try {
            localStorage.removeItem(DB_STORAGE_KEY);
        } catch (e) {}
    }

    /**
     * Exports the real binary SQLite (.sqlite / .db) file for download
     */
    function exportDatabaseFile() {
        if (!db || !isReady) {
            alert('SQLite ডাটাবেজ সক্রিয় নয়।');
            return;
        }
        try {
            const binary = db.export();
            const blob = new Blob([binary], { type: 'application/x-sqlite3' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `medicare_database_${new Date().toISOString().slice(0, 10)}.sqlite`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            alert('ডাটাবেজ এক্সপোর্ট করতে সমস্যা হয়েছে: ' + e.message);
        }
    }

    /**
     * Imports an external .sqlite file into the application
     */
    async function importDatabaseFile(file) {
        if (!file) return false;
        try {
            const arrayBuffer = await file.arrayBuffer();
            const uInt8Array = new Uint8Array(arrayBuffer);
            if (typeof initSqlJs === 'function') {
                const SQL = await initSqlJs({
                    locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${f}`
                });
                db = new SQL.Database(uInt8Array);
                isReady = true;
                persist();
                return true;
            }
            return false;
        } catch (e) {
            console.error('Import SQLite DB failed:', e);
            return false;
        }
    }

    return {
        init,
        isReady: () => isReady,
        runQuery,
        syncRoutines,
        loadRoutines,
        logAction,
        getHistoryLogs,
        getHistoryLogsPaged,
        clearHistoryLogs,
        resetDatabase,
        exportDatabaseFile,
        importDatabaseFile
    };
})();
