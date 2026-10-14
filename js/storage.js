/**
 * MediCare - Unified Storage & State Manager
 * Coordinates Central Server Synchronization, LocalStorage, and SQLite WebAssembly Database.
 * Enables seamless cross-device login and data retrieval for any user account.
 */

window.MediCareStore = (function () {
    const BASE_STORAGE_KEY = window.MediCareConfig ? window.MediCareConfig.STORAGE_KEY : 'medicare_routines_v2';
    const BASE_HYDRATION_KEY = window.MediCareConfig ? window.MediCareConfig.HYDRATION_KEY : 'medicare_hydration_v1';
    
    let routines = [];
    let activeFilter = 'all';
    let searchQuery = '';
    let currentTab = 'schedule'; // 'schedule' | 'tools' | 'history' | 'emergency'

    function getTodayDateStr() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    let selectedDate = getTodayDateStr();

    function calculateEndDate(startDateStr, durationDays) {
        if (!startDateStr) return getTodayDateStr();
        const days = Math.max(1, parseInt(durationDays, 10) || 1);
        const parts = startDateStr.split('-').map(Number);
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        d.setDate(d.getDate() + (days - 1));
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function isRoutineActiveOnDate(routine, dateStr) {
        if (!routine) return false;
        const start = routine.startDate || (routine.createdAt ? routine.createdAt.slice(0, 10) : getTodayDateStr());
        if (dateStr < start) return false;
        
        const duration = parseInt(routine.durationDays, 10);
        if (duration > 0) {
            const end = routine.endDate || calculateEndDate(start, duration);
            if (dateStr > end) return false;
        }
        return true;
    }

    function getCourseDayIndex(routine, dateStr) {
        const start = routine.startDate || (routine.createdAt ? routine.createdAt.slice(0, 10) : getTodayDateStr());
        const startParts = start.split('-').map(Number);
        const targetParts = dateStr.split('-').map(Number);
        const d1 = new Date(startParts[0], startParts[1] - 1, startParts[2]);
        const d2 = new Date(targetParts[0], targetParts[1] - 1, targetParts[2]);
        const diffTime = d2.getTime() - d1.getTime();
        const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
        return Math.max(1, diffDays + 1);
    }

    /**
     * Resolves active user ID (defaults to 'guest')
     */
    function getActiveUserId() {
        if (window.MediCareAuth && typeof window.MediCareAuth.getCurrentUser === 'function') {
            const user = window.MediCareAuth.getCurrentUser();
            if (user && user.id) return user.id;
        }
        return 'guest';
    }

    /**
     * User-isolated storage key
     */
    function getUserKey(baseKey, userId) {
        const uid = userId || getActiveUserId();
        return `${baseKey}_${uid}`;
    }

    function filterOutMockData(list) {
        if (!Array.isArray(list)) return [];
        return list.filter(r => !['demo-1', 'demo-2', 'demo-3', 'med-demo-1', 'med-demo-2', 'med-demo-3'].includes(r.id));
    }

    /**
     * Normalizes a raw routine object
     */
    function normalizeRoutine(r) {
        const startDate = r.startDate || (r.createdAt ? r.createdAt.slice(0, 10) : getTodayDateStr());
        const durationDays = parseInt(r.durationDays, 10) || 3;
        const endDate = r.endDate || calculateEndDate(startDate, durationDays);
        
        let times = Array.isArray(r.times) && r.times.length > 0 ? r.times : (r.time ? [r.time] : ['08:00']);
        const frequency = parseInt(r.frequency, 10) || times.length;
        
        let takenHistory = r.takenHistory && typeof r.takenHistory === 'object' ? r.takenHistory : {};
        if (typeof takenHistory === 'string') {
            try { takenHistory = JSON.parse(takenHistory); } catch (e) { takenHistory = {}; }
        }

        if (r.takenToday && r.lastTakenDate) {
            const todayKey = getTodayDateStr();
            if (!takenHistory[todayKey]) {
                takenHistory[todayKey] = [...times];
            }
        }

        return {
            ...r,
            startDate,
            durationDays,
            endDate,
            frequency,
            times,
            time: r.time || times[0],
            takenHistory
        };
    }

    /**
     * Initializes Storage and loads active user's data
     */
    async function init() {
        // Initialize SQLite WebAssembly if available locally
        if (window.MediCareSQLite) {
            await window.MediCareSQLite.init();
        }

        // Load routines strictly for active user
        await loadUserRoutines();

        // Also fetch hydration from server if logged in
        syncHydrationFromServer();
    }

    /**
     * Loads routines specifically for current active user
     * Priority: Central Node.js SQLite Server API -> LocalStorage Cache -> SQLite WebAssembly
     */
    async function loadUserRoutines() {
        const uid = getActiveUserId();
        let loaded = null;
        let fromServer = false;

        // 1. If user is logged in, fetch from central server first
        if (window.MediCareAuth && window.MediCareAuth.isLoggedIn()) {
            try {
                const apiBase = window.MediCareAuth.getApiBase();
                const res = await fetch(`${apiBase}/api/routines`, {
                    headers: window.MediCareAuth.getAuthHeaders()
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && Array.isArray(data.routines)) {
                        loaded = data.routines;
                        fromServer = true;
                    }
                }
            } catch (err) {
                console.warn('Could not sync routines with server, falling back to local cache:', err);
            }
        }

        // 2. Fallback to LocalStorage cache if server returned nothing or offline
        if (!loaded) {
            const userStoreKey = getUserKey(BASE_STORAGE_KEY, uid);
            const stored = localStorage.getItem(userStoreKey);
            if (stored) {
                try {
                    loaded = JSON.parse(stored);
                } catch (e) {
                    loaded = [];
                }
            }
        }

        // 3. Fallback to SQLite WebAssembly
        if (!loaded || loaded.length === 0) {
            if (window.MediCareSQLite && window.MediCareSQLite.isReady()) {
                loaded = window.MediCareSQLite.loadRoutines(uid);
            }
        }

        const rawList = filterOutMockData(loaded || []);
        routines = rawList.map(normalizeRoutine);

        refreshRoutineStatuses();
        
        // Cache to local storage
        localStorage.setItem(getUserKey(BASE_STORAGE_KEY, uid), JSON.stringify(routines));
        if (window.MediCareSQLite && window.MediCareSQLite.isReady()) {
            window.MediCareSQLite.syncRoutines(routines, uid);
        }
    }

    /**
     * Called when user logs in, registers, switches accounts, or logs out
     */
    async function onUserChanged() {
        activeFilter = 'all';
        searchQuery = '';
        selectedDate = getTodayDateStr();
        await loadUserRoutines();
        await syncHydrationFromServer();

        if (window.MediCareUI) {
            window.MediCareUI.renderDateStrip();
            window.MediCareUI.renderRoutines();
            window.MediCareUI.renderHistoryView();
        }
        if (window.MediCareTools) {
            window.MediCareTools.renderHydrationUI();
        }
    }

    /**
     * Saves active user's routines to LocalStorage and local SQLite
     */
    function save() {
        const uid = getActiveUserId();
        localStorage.setItem(getUserKey(BASE_STORAGE_KEY, uid), JSON.stringify(routines));

        if (window.MediCareSQLite && window.MediCareSQLite.isReady()) {
            window.MediCareSQLite.syncRoutines(routines, uid);
        }
    }

    /**
     * Refreshes daily taken statuses based on current date
     */
    function refreshRoutineStatuses() {
        const todayKey = getTodayDateStr();
        routines.forEach(r => {
            if (r.takenHistory && Array.isArray(r.takenHistory[todayKey])) {
                r.takenToday = r.takenHistory[todayKey].length >= (r.times ? r.times.length : 1);
            } else {
                r.takenToday = false;
            }
        });
    }

    function getSelectedDate() {
        return selectedDate;
    }

    function setSelectedDate(dateStr) {
        if (!dateStr) return;
        selectedDate = dateStr;
    }

    function getRoutines() {
        return routines;
    }

    /**
     * Returns scheduled doses for a specific date
     */
    function getDosesForDate(targetDate = selectedDate) {
        const doses = [];
        routines.forEach(r => {
            if (isRoutineActiveOnDate(r, targetDate)) {
                const times = Array.isArray(r.times) && r.times.length > 0 ? r.times : [r.time || '08:00'];
                const dayIndex = getCourseDayIndex(r, targetDate);
                const takenTimesOnDate = (r.takenHistory && Array.isArray(r.takenHistory[targetDate])) ? r.takenHistory[targetDate] : [];

                times.forEach(t => {
                    const isTaken = takenTimesOnDate.includes(t);
                    doses.push({
                        doseId: `${r.id}__${targetDate}__${t}`,
                        routineId: r.id,
                        name: r.name,
                        type: r.type,
                        dosage: r.dosage,
                        meal: r.meal,
                        time: t,
                        stock: r.stock,
                        notes: r.notes,
                        startDate: r.startDate,
                        endDate: r.endDate,
                        durationDays: r.durationDays,
                        frequency: r.frequency,
                        dayIndex: dayIndex,
                        isTaken: isTaken,
                        dateStr: targetDate
                    });
                });
            }
        });

        // Sort doses chronologically
        doses.sort((a, b) => a.time.localeCompare(b.time));
        return doses;
    }

    function getFilteredDosesForDate(targetDate = selectedDate) {
        const doses = getDosesForDate(targetDate);
        return doses.filter(d => {
            let matchesFilter = true;
            if (activeFilter === 'pending') {
                matchesFilter = !d.isTaken;
            } else if (activeFilter === 'taken') {
                matchesFilter = d.isTaken;
            }

            let matchesSearch = true;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const nameMatch = (d.name || '').toLowerCase().includes(q);
                const dosageMatch = (d.dosage || '').toLowerCase().includes(q);
                const notesMatch = (d.notes || '').toLowerCase().includes(q);
                const typeMatch = (d.type || '').toLowerCase().includes(q);
                matchesSearch = nameMatch || dosageMatch || notesMatch || typeMatch;
            }

            return matchesFilter && matchesSearch;
        });
    }

    function getStatsForDate(targetDate = selectedDate) {
        const doses = getDosesForDate(targetDate);
        const total = doses.length;
        const taken = doses.filter(d => d.isTaken).length;
        const pending = total - taken;
        const percentage = total > 0 ? Math.round((taken / total) * 100) : 0;
        return { total, taken, pending, percentage };
    }

    function getDateBadgeStatus(dateStr) {
        const doses = getDosesForDate(dateStr);
        const total = doses.length;
        if (total === 0) return { hasMeds: false, total: 0, taken: 0, allTaken: false };
        const taken = doses.filter(d => d.isTaken).length;
        return {
            hasMeds: true,
            total,
            taken,
            allTaken: taken === total
        };
    }

    function getFilteredRoutines() {
        return getFilteredDosesForDate(selectedDate);
    }

    function getActiveFilter() {
        return activeFilter;
    }

    function setActiveFilter(filter) {
        activeFilter = filter;
    }

    function setSearchQuery(query) {
        searchQuery = query;
    }

    function getCurrentTab() {
        return currentTab;
    }

    function setCurrentTab(tab) {
        currentTab = tab;
    }

    /**
     * Add Routine & Sync with Central Server
     */
    function addRoutine(routine, isCloned = false) {
        const uid = getActiveUserId();
        routine.user_id = uid;
        if (!routine.startDate) routine.startDate = getTodayDateStr();
        if (!routine.durationDays) routine.durationDays = 3;
        routine.endDate = calculateEndDate(routine.startDate, routine.durationDays);
        if (!Array.isArray(routine.times) || routine.times.length === 0) {
            routine.times = routine.time ? [routine.time] : ['08:00'];
        }
        routine.frequency = routine.times.length;
        if (!routine.takenHistory) routine.takenHistory = {};

        routines.unshift(routine);
        save();

        if (window.MediCareSQLite) {
            window.MediCareSQLite.logAction(routine.id, routine.name, isCloned ? 'action_cloned' : 'action_added', null, routine.startDate, uid);
        }

        // Sync with Central Server
        if (window.MediCareAuth && window.MediCareAuth.isLoggedIn()) {
            const apiBase = window.MediCareAuth.getApiBase();
            fetch(`${apiBase}/api/routines`, {
                method: 'POST',
                headers: window.MediCareAuth.getAuthHeaders(),
                body: JSON.stringify({ ...routine, isCloned })
            }).catch(err => console.warn('Server sync failed on addRoutine:', err));
        }
    }

    function getRoutineById(id) {
        return routines.find(r => r.id === id) || null;
    }

    /**
     * Update Routine & Sync with Central Server
     */
    function updateRoutine(id, updatedData) {
        const index = routines.findIndex(r => r.id === id);
        if (index !== -1) {
            const start = updatedData.startDate || routines[index].startDate || getTodayDateStr();
            const duration = parseInt(updatedData.durationDays, 10) || routines[index].durationDays || 3;
            const endDate = calculateEndDate(start, duration);
            const times = Array.isArray(updatedData.times) ? updatedData.times : (routines[index].times || ['08:00']);

            routines[index] = {
                ...routines[index],
                ...updatedData,
                startDate: start,
                durationDays: duration,
                endDate: endDate,
                times: times,
                time: times[0] || '08:00',
                frequency: times.length
            };
            save();

            if (window.MediCareSQLite) {
                window.MediCareSQLite.logAction(id, routines[index].name, 'action_updated', null, null, getActiveUserId());
            }

            // Sync with Central Server
            if (window.MediCareAuth && window.MediCareAuth.isLoggedIn()) {
                const apiBase = window.MediCareAuth.getApiBase();
                fetch(`${apiBase}/api/routines/${id}`, {
                    method: 'PUT',
                    headers: window.MediCareAuth.getAuthHeaders(),
                    body: JSON.stringify(routines[index])
                }).catch(err => console.warn('Server sync failed on updateRoutine:', err));
            }

            return routines[index];
        }
        return null;
    }

    /**
     * Mark a specific dose on a specific date as taken & Sync with Server
     */
    function markDoseTaken(routineId, dateStr, timeStr) {
        const item = routines.find(r => r.id === routineId);
        if (item) {
            if (!item.takenHistory) item.takenHistory = {};
            if (!Array.isArray(item.takenHistory[dateStr])) {
                item.takenHistory[dateStr] = [];
            }
            if (!item.takenHistory[dateStr].includes(timeStr)) {
                item.takenHistory[dateStr].push(timeStr);
                if (item.stock !== undefined && item.stock !== '' && Number(item.stock) > 0) {
                    item.stock = Number(item.stock) - 1;
                }
            }
            if (dateStr === getTodayDateStr()) {
                item.takenToday = item.takenHistory[dateStr].length >= (item.times ? item.times.length : 1);
                item.lastTakenDate = new Date().toDateString();
            }
            save();

            if (window.MediCareSQLite) {
                window.MediCareSQLite.logAction(item.id, `${item.name} (${timeStr})`, 'action_taken', null, dateStr, getActiveUserId());
            }

            // Sync with Central Server
            if (window.MediCareAuth && window.MediCareAuth.isLoggedIn()) {
                const apiBase = window.MediCareAuth.getApiBase();
                fetch(`${apiBase}/api/routines/${routineId}/dose-taken`, {
                    method: 'POST',
                    headers: window.MediCareAuth.getAuthHeaders(),
                    body: JSON.stringify({ dateStr, timeStr })
                }).catch(err => console.warn('Server sync failed on markDoseTaken:', err));
            }

            return item;
        }
        return null;
    }

    /**
     * Undo a taken dose on a specific date & Sync with Server
     */
    function markDoseUndo(routineId, dateStr, timeStr) {
        const item = routines.find(r => r.id === routineId);
        if (item) {
            if (item.takenHistory && Array.isArray(item.takenHistory[dateStr])) {
                const idx = item.takenHistory[dateStr].indexOf(timeStr);
                if (idx !== -1) {
                    item.takenHistory[dateStr].splice(idx, 1);
                    if (item.stock !== undefined && item.stock !== '') {
                        item.stock = Number(item.stock) + 1;
                    }
                }
            }
            if (dateStr === getTodayDateStr()) {
                const count = (item.takenHistory && item.takenHistory[dateStr]) ? item.takenHistory[dateStr].length : 0;
                item.takenToday = count >= (item.times ? item.times.length : 1);
            }
            save();

            if (window.MediCareSQLite) {
                window.MediCareSQLite.logAction(item.id, `${item.name} (${timeStr})`, 'action_undo', null, dateStr, getActiveUserId());
            }

            // Sync with Central Server
            if (window.MediCareAuth && window.MediCareAuth.isLoggedIn()) {
                const apiBase = window.MediCareAuth.getApiBase();
                fetch(`${apiBase}/api/routines/${routineId}/dose-undo`, {
                    method: 'POST',
                    headers: window.MediCareAuth.getAuthHeaders(),
                    body: JSON.stringify({ dateStr, timeStr })
                }).catch(err => console.warn('Server sync failed on markDoseUndo:', err));
            }

            return item;
        }
        return null;
    }

    function markTaken(id) {
        const item = routines.find(r => r.id === id);
        if (item) {
            const firstTime = item.times && item.times[0] ? item.times[0] : (item.time || '08:00');
            return markDoseTaken(id, selectedDate, firstTime);
        }
        return null;
    }

    function markUndo(id) {
        const item = routines.find(r => r.id === id);
        if (item) {
            const firstTime = item.times && item.times[0] ? item.times[0] : (item.time || '08:00');
            return markDoseUndo(id, selectedDate, firstTime);
        }
        return null;
    }

    /**
     * Delete Routine & Sync with Central Server
     */
    function deleteRoutine(id) {
        const item = routines.find(r => r.id === id);
        const name = item ? item.name : 'ঔষধ';
        routines = routines.filter(r => r.id !== id);
        save();

        if (window.MediCareSQLite) {
            window.MediCareSQLite.logAction(id, name, 'action_deleted', null, null, getActiveUserId());
        }

        // Sync with Central Server
        if (window.MediCareAuth && window.MediCareAuth.isLoggedIn()) {
            const apiBase = window.MediCareAuth.getApiBase();
            fetch(`${apiBase}/api/routines/${id}`, {
                method: 'DELETE',
                headers: window.MediCareAuth.getAuthHeaders()
            }).catch(err => console.warn('Server sync failed on deleteRoutine:', err));
        }
    }

    function getStats() {
        return getStatsForDate(selectedDate);
    }

    // Hydration Tracker state with cross-device sync
    async function syncHydrationFromServer() {
        if (!window.MediCareAuth || !window.MediCareAuth.isLoggedIn()) return;
        try {
            const apiBase = window.MediCareAuth.getApiBase();
            const res = await fetch(`${apiBase}/api/hydration`, {
                headers: window.MediCareAuth.getAuthHeaders()
            });
            if (res.ok) {
                const json = await res.json();
                if (json.success && json.hydration) {
                    const uid = getActiveUserId();
                    localStorage.setItem(getUserKey(BASE_HYDRATION_KEY, uid), JSON.stringify(json.hydration));
                    if (window.MediCareTools) window.MediCareTools.renderHydrationUI();
                }
            }
        } catch (e) {}
    }

    function getHydration() {
        const uid = getActiveUserId();
        const todayKey = getTodayDateStr();
        const raw = localStorage.getItem(getUserKey(BASE_HYDRATION_KEY, uid));
        let data = {};
        if (raw) {
            try { data = JSON.parse(raw); } catch (e) { data = {}; }
        }
        if (!data[todayKey]) {
            data[todayKey] = { glasses: 0, target: 8 };
        }
        return { todayKey, data: data[todayKey], fullData: data };
    }

    function updateHydration(change) {
        const uid = getActiveUserId();
        const { todayKey, fullData } = getHydration();
        if (!fullData[todayKey]) fullData[todayKey] = { glasses: 0, target: 8 };
        let newGlasses = (fullData[todayKey].glasses || 0) + change;
        if (newGlasses < 0) newGlasses = 0;
        if (newGlasses > 20) newGlasses = 20;
        fullData[todayKey].glasses = newGlasses;
        localStorage.setItem(getUserKey(BASE_HYDRATION_KEY, uid), JSON.stringify(fullData));

        // Push to server
        if (window.MediCareAuth && window.MediCareAuth.isLoggedIn()) {
            const apiBase = window.MediCareAuth.getApiBase();
            fetch(`${apiBase}/api/hydration`, {
                method: 'POST',
                headers: window.MediCareAuth.getAuthHeaders(),
                body: JSON.stringify({
                    dateStr: todayKey,
                    glasses: newGlasses,
                    target: fullData[todayKey].target || 8
                })
            }).catch(e => console.warn('Hydration server sync error:', e));
        }

        return fullData[todayKey];
    }

    function getHistoryLogsPaged(page = 1, pageSize = 20) {
        if (window.MediCareSQLite) {
            return window.MediCareSQLite.getHistoryLogsPaged(page, pageSize, getActiveUserId());
        }
        return { logs: [], total: 0, page: 1, pageSize, totalPages: 1 };
    }

    function clearHistoryLogs() {
        if (window.MediCareSQLite) {
            window.MediCareSQLite.clearHistoryLogs(getActiveUserId());
        }
        if (window.MediCareAuth && window.MediCareAuth.isLoggedIn()) {
            const apiBase = window.MediCareAuth.getApiBase();
            fetch(`${apiBase}/api/history`, {
                method: 'DELETE',
                headers: window.MediCareAuth.getAuthHeaders()
            }).catch(e => {});
        }
    }

    return {
        init,
        onUserChanged,
        getTodayDateStr,
        getSelectedDate,
        setSelectedDate,
        calculateEndDate,
        isRoutineActiveOnDate,
        getCourseDayIndex,
        getDosesForDate,
        getFilteredDosesForDate,
        getStatsForDate,
        getDateBadgeStatus,
        getRoutines,
        getFilteredRoutines,
        getActiveFilter,
        setActiveFilter,
        setSearchQuery,
        getCurrentTab,
        setCurrentTab,
        addRoutine,
        getRoutineById,
        updateRoutine,
        markTaken,
        markUndo,
        markDoseTaken,
        markDoseUndo,
        deleteRoutine,
        getStats,
        getHydration,
        updateHydration,
        syncHydrationFromServer,
        getHistoryLogsPaged,
        clearHistoryLogs,
        refreshRoutineStatuses,
        save
    };
})();
