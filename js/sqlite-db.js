/**
 * MediCare - SQLite Database Layer (Powered by WebAssembly SQLite / sql.js)
 * Provides genuine relational SQLite database operations in the browser.
 */

window.MediCareSQLite = (function () {
    let db = null;
    let isReady = false;
    const DB_STORAGE_KEY = 'medicare_sqlite_bin_v1';

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

            isReady = true;
            checkAndSeedHistoryLogs();
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
            // Convert to base64 for persistent localStorage
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
     * Synchronizes a list of routines into the SQLite table
     */
    function syncRoutines(routines) {
        if (!db || !isReady) return;
        try {
            db.run('DELETE FROM routines;');
            const stmt = db.prepare(`
                INSERT INTO routines (id, name, type, dosage, meal, time, stock, notes, takenToday, lastTakenDate, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            `);

            routines.forEach(r => {
                stmt.run([
                    r.id,
                    r.name,
                    r.type,
                    r.dosage,
                    r.meal,
                    r.time,
                    r.stock !== undefined && r.stock !== '' ? Number(r.stock) : 0,
                    r.notes || '',
                    r.takenToday ? 1 : 0,
                    r.lastTakenDate || '',
                    r.createdAt || new Date().toISOString()
                ]);
            });
            stmt.free();
            persist();
        } catch (e) {
            console.warn('SQLite syncRoutines failed:', e);
        }
    }

    /**
     * Retrieves all routines from SQLite
     */
    function loadRoutines() {
        if (!db || !isReady) return null;
        try {
            const res = db.exec('SELECT * FROM routines ORDER BY time ASC;');
            if (!res || res.length === 0) return [];
            
            const columns = res[0].columns;
            const values = res[0].values;
            return values.map(row => {
                const item = {};
                columns.forEach((col, idx) => {
                    item[col] = row[idx];
                });
                item.takenToday = Boolean(item.takenToday);
                return item;
            });
        } catch (e) {
            console.warn('SQLite loadRoutines failed:', e);
            return null;
        }
    }

    /**
     * Realistic sample activity history logs for initial demonstration
     */
    function getInitialSampleLogs() {
        const today = new Date();
        const fmtDate = (daysAgo) => {
            const d = new Date(today);
            d.setDate(d.getDate() - daysAgo);
            return d.toLocaleDateString('en-CA');
        };

        return [
            { id: 'log-seed-1', routine_id: 'demo-1', routine_name: 'ইনসুলিন (Lantus)', action: 'action_taken', timestamp: '09:30 PM', date_str: fmtDate(0) },
            { id: 'log-seed-2', routine_id: 'demo-2', routine_name: 'Napa Extend (৬৬৫ মিলিগ্রাম)', action: 'action_taken', timestamp: '08:45 PM', date_str: fmtDate(0) },
            { id: 'log-seed-3', routine_id: 'demo-3', routine_name: 'Seclo ২০ মিগ্রা (Omeprazole)', action: 'action_taken', timestamp: '08:00 AM', date_str: fmtDate(0) },
            { id: 'log-seed-4', routine_id: 'demo-4', routine_name: 'ক্যালসিয়াম + ডি৩ (Calbo-D)', action: 'action_taken', timestamp: '02:15 PM', date_str: fmtDate(0) },
            { id: 'log-seed-5', routine_id: 'demo-5', routine_name: 'মন্টিন ১০ মিগ্রা (Montelukast)', action: 'action_taken', timestamp: '10:00 PM', date_str: fmtDate(1) },
            { id: 'log-seed-6', routine_id: 'demo-1', routine_name: 'ইনসুলিন (Lantus)', action: 'action_taken', timestamp: '09:30 PM', date_str: fmtDate(1) },
            { id: 'log-seed-7', routine_id: 'demo-2', routine_name: 'Napa Extend (৬৬৫ মিলিগ্রাম)', action: 'action_taken', timestamp: '08:30 PM', date_str: fmtDate(1) },
            { id: 'log-seed-8', routine_id: 'demo-3', routine_name: 'Seclo ২০ মিগ্রা (Omeprazole)', action: 'action_taken', timestamp: '08:05 AM', date_str: fmtDate(1) },
            { id: 'log-seed-9', routine_id: 'demo-6', routine_name: 'ইকোস্প্রিন ৭৫ মিগ্রা', action: 'action_added', timestamp: '11:15 AM', date_str: fmtDate(1) },
            { id: 'log-seed-10', routine_id: 'demo-4', routine_name: 'ক্যালসিয়াম + ডি৩ (Calbo-D)', action: 'action_taken', timestamp: '02:00 PM', date_str: fmtDate(1) },
            { id: 'log-seed-11', routine_id: 'demo-2', routine_name: 'Napa Extend (৬৬৫ মিলিগ্রাম)', action: 'action_taken', timestamp: '01:45 PM', date_str: fmtDate(1) },
            { id: 'log-seed-12', routine_id: 'demo-5', routine_name: 'মন্টিন ১০ মিগ্রা (Montelukast)', action: 'action_taken', timestamp: '10:00 PM', date_str: fmtDate(2) },
            { id: 'log-seed-13', routine_id: 'demo-1', routine_name: 'ইনসুলিন (Lantus)', action: 'action_taken', timestamp: '09:30 PM', date_str: fmtDate(2) },
            { id: 'log-seed-14', routine_id: 'demo-2', routine_name: 'Napa Extend (৬৬৫ মিলিগ্রাম)', action: 'action_taken', timestamp: '08:30 PM', date_str: fmtDate(2) },
            { id: 'log-seed-15', routine_id: 'demo-3', routine_name: 'Seclo ২০ মিগ্রা (Omeprazole)', action: 'action_taken', timestamp: '08:00 AM', date_str: fmtDate(2) },
            { id: 'log-seed-16', routine_id: 'demo-4', routine_name: 'ক্যালসিয়াম + ডি৩ (Calbo-D)', action: 'action_taken', timestamp: '02:10 PM', date_str: fmtDate(2) },
            { id: 'log-seed-17', routine_id: 'demo-2', routine_name: 'Napa Extend (৬৬৫ মিলিগ্রাম)', action: 'action_updated', timestamp: '12:20 PM', date_str: fmtDate(2) },
            { id: 'log-seed-18', routine_id: 'demo-5', routine_name: 'মন্টিন ১০ মিগ্রা (Montelukast)', action: 'action_taken', timestamp: '10:00 PM', date_str: fmtDate(3) },
            { id: 'log-seed-19', routine_id: 'demo-1', routine_name: 'ইনসুলিন (Lantus)', action: 'action_taken', timestamp: '09:30 PM', date_str: fmtDate(3) },
            { id: 'log-seed-20', routine_id: 'demo-2', routine_name: 'Napa Extend (৬৬৫ মিলিগ্রাম)', action: 'action_taken', timestamp: '08:30 PM', date_str: fmtDate(3) },
            { id: 'log-seed-21', routine_id: 'demo-3', routine_name: 'Seclo ২০ মিগ্রা (Omeprazole)', action: 'action_taken', timestamp: '08:00 AM', date_str: fmtDate(3) },
            { id: 'log-seed-22', routine_id: 'demo-4', routine_name: 'ক্যালসিয়াম + ডি৩ (Calbo-D)', action: 'action_taken', timestamp: '02:15 PM', date_str: fmtDate(3) },
            { id: 'log-seed-23', routine_id: 'demo-1', routine_name: 'ইনসুলিন (Lantus)', action: 'action_taken', timestamp: '09:30 PM', date_str: fmtDate(4) },
            { id: 'log-seed-24', routine_id: 'demo-2', routine_name: 'Napa Extend (৬৬৫ মিলিগ্রাম)', action: 'action_taken', timestamp: '08:30 PM', date_str: fmtDate(4) },
            { id: 'log-seed-25', routine_id: 'demo-3', routine_name: 'Seclo ২০ মিগ্রা (Omeprazole)', action: 'action_taken', timestamp: '08:00 AM', date_str: fmtDate(4) }
        ];
    }

    /**
     * Seeds initial logs if table is empty
     */
    function checkAndSeedHistoryLogs() {
        if (!db || !isReady) return;
        try {
            const res = db.exec("SELECT COUNT(*) FROM history_logs;");
            const count = (res && res[0] && res[0].values[0]) ? res[0].values[0][0] : 0;
            if (count === 0) {
                const sampleLogs = getInitialSampleLogs();
                const stmt = db.prepare(`
                    INSERT INTO history_logs (id, routine_id, routine_name, action, timestamp, date_str)
                    VALUES (?, ?, ?, ?, ?, ?);
                `);
                sampleLogs.forEach(log => {
                    stmt.run([log.id, log.routine_id, log.routine_name, log.action, log.timestamp, log.date_str]);
                });
                stmt.free();
                persist();
                try {
                    localStorage.setItem('medicare_history_logs_v1', JSON.stringify(sampleLogs));
                } catch (e) {}
            }
        } catch (e) {
            console.warn('Error checking/seeding history logs in SQLite:', e);
        }
    }

    /**
     * Fallback logs helper from localStorage
     */
    function getFallbackLogs() {
        try {
            const raw = localStorage.getItem('medicare_history_logs_v1');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) {}
        const sampleLogs = getInitialSampleLogs();
        try {
            localStorage.setItem('medicare_history_logs_v1', JSON.stringify(sampleLogs));
        } catch (e) {}
        return sampleLogs;
    }

    /**
     * Logs an activity in the history_logs SQLite table and fallback storage
     */
    function logAction(routineId, routineName, action, timestampStr, dateStr) {
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
            routine_id: routineId,
            routine_name: routineName,
            action,
            timestamp: ts,
            date_str: ds
        };

        // 1. Mirror to localStorage fallback
        try {
            const fallback = getFallbackLogs();
            fallback.unshift(logItem);
            if (fallback.length > 300) fallback.length = 300;
            localStorage.setItem('medicare_history_logs_v1', JSON.stringify(fallback));
        } catch (e) {}

        // 2. Insert into SQLite
        if (db && isReady) {
            try {
                db.run(`
                    INSERT INTO history_logs (id, routine_id, routine_name, action, timestamp, date_str)
                    VALUES (?, ?, ?, ?, ?, ?);
                `, [id, routineId, routineName, action, ts, ds]);
                persist();
            } catch (e) {
                console.warn('SQLite logAction failed:', e);
            }
        }
    }

    /**
     * Retrieves recent history logs from SQLite (backward compatibility)
     */
    function getHistoryLogs(limit = 30) {
        if (!db || !isReady) return getFallbackLogs().slice(0, limit);
        try {
            const res = db.exec(`SELECT * FROM history_logs ORDER BY rowid DESC LIMIT ${limit};`);
            if (!res || res.length === 0) return [];
            const columns = res[0].columns;
            return res[0].values.map(row => {
                const item = {};
                columns.forEach((col, idx) => {
                    item[col] = row[idx];
                });
                return item;
            });
        } catch (e) {
            return getFallbackLogs().slice(0, limit);
        }
    }

    /**
     * Retrieves paginated history logs with total counts (Default 20 per page)
     */
    function getHistoryLogsPaged(page = 1, pageSize = 20) {
        const p = Math.max(1, parseInt(page, 10) || 1);
        const limit = Math.max(1, parseInt(pageSize, 10) || 20);

        if (!db || !isReady) {
            const all = getFallbackLogs();
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
            const countRes = db.exec("SELECT COUNT(*) FROM history_logs;");
            if (countRes && countRes[0] && countRes[0].values[0]) {
                total = countRes[0].values[0][0] || 0;
            }

            const totalPages = Math.max(1, Math.ceil(total / limit));
            const safePage = Math.min(p, totalPages);
            const safeOffset = (safePage - 1) * limit;

            const res = db.exec(`SELECT * FROM history_logs ORDER BY rowid DESC LIMIT ${limit} OFFSET ${safeOffset};`);
            let logs = [];
            if (res && res[0]) {
                const columns = res[0].columns;
                logs = res[0].values.map(row => {
                    const item = {};
                    columns.forEach((col, idx) => {
                        item[col] = row[idx];
                    });
                    return item;
                });
            }

            return {
                logs,
                total,
                page: safePage,
                pageSize: limit,
                totalPages
            };
        } catch (e) {
            console.warn('SQLite getHistoryLogsPaged error, fallback used:', e);
            const all = getFallbackLogs();
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
     * Clears all history logs from database and storage
     */
    function clearHistoryLogs() {
        if (db && isReady) {
            try {
                db.run("DELETE FROM history_logs;");
                persist();
            } catch (e) {
                console.warn('SQLite clearHistoryLogs failed:', e);
            }
        }
        try {
            localStorage.setItem('medicare_history_logs_v1', JSON.stringify([]));
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
        exportDatabaseFile,
        importDatabaseFile
    };
})();
