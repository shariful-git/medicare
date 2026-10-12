/**
 * MediCare - Unified Storage & State Manager
 * Coordinates LocalStorage and SQLite WebAssembly Database with Strict Multi-User Isolation.
 */

window.MediCareStore = (function () {
    const BASE_STORAGE_KEY = window.MediCareConfig ? window.MediCareConfig.STORAGE_KEY : 'medicare_routines_v2';
    const BASE_HYDRATION_KEY = window.MediCareConfig ? window.MediCareConfig.HYDRATION_KEY : 'medicare_hydration_v1';
    
    let routines = [];
    let activeFilter = 'all';
    let searchQuery = '';
    let currentTab = 'schedule'; // 'schedule' | 'tools' | 'history' | 'emergency'

    /**
     * Resolves the active user ID (defaults to 'guest')
     */
    function getActiveUserId() {
        if (window.MediCareAuth && typeof window.MediCareAuth.getCurrentUser === 'function') {
            const user = window.MediCareAuth.getCurrentUser();
            if (user && user.id) return user.id;
        }
        return 'guest';
    }

    /**
     * Returns user-isolated storage key
     */
    function getUserKey(baseKey, userId) {
        const uid = userId || getActiveUserId();
        return `${baseKey}_${uid}`;
    }

    /**
     * Filters out old legacy sample mock IDs so user always gets clean data
     */
    function filterOutMockData(list) {
        if (!Array.isArray(list)) return [];
        return list.filter(r => !['demo-1', 'demo-2', 'demo-3', 'med-demo-1', 'med-demo-2', 'med-demo-3'].includes(r.id));
    }

    /**
     * Initializes Storage and loads active user's data
     */
    async function init() {
        // 1. Initialize SQLite WebAssembly
        if (window.MediCareSQLite) {
            await window.MediCareSQLite.init();
        }

        // 2. Load routines strictly for the active user
        await loadUserRoutines();
    }

    /**
     * Loads routines specifically for current active user
     */
    async function loadUserRoutines() {
        const uid = getActiveUserId();
        let loaded = null;

        // Try SQLite first
        if (window.MediCareSQLite && window.MediCareSQLite.isReady()) {
            loaded = window.MediCareSQLite.loadRoutines(uid);
        }

        // Fallback to user-scoped LocalStorage
        if (!loaded || loaded.length === 0) {
            const userStoreKey = getUserKey(BASE_STORAGE_KEY, uid);
            const stored = localStorage.getItem(userStoreKey);
            if (stored) {
                try {
                    loaded = JSON.parse(stored);
                } catch (e) {
                    loaded = [];
                }
            } else {
                // If brand new user, check if this is guest and old global key exists
                if (uid === 'guest') {
                    const legacyGlobal = localStorage.getItem(BASE_STORAGE_KEY);
                    if (legacyGlobal) {
                        try {
                            loaded = JSON.parse(legacyGlobal);
                        } catch (e) {
                            loaded = [];
                        }
                    }
                }
            }
        }

        routines = filterOutMockData(loaded || []);
        refreshRoutineStatuses();
        save();
    }

    /**
     * Called when user logs in, registers, switches accounts, or logs out
     */
    async function onUserChanged() {
        activeFilter = 'all';
        searchQuery = '';
        await loadUserRoutines();

        if (window.MediCareUI) {
            window.MediCareUI.renderRoutines();
            window.MediCareUI.renderHistoryView();
        }
        if (window.MediCareTools) {
            window.MediCareTools.renderHydrationUI();
        }
    }

    /**
     * Saves active user's routines to both SQLite and localStorage
     */
    function save() {
        const uid = getActiveUserId();
        // Save to user-scoped localStorage
        localStorage.setItem(getUserKey(BASE_STORAGE_KEY, uid), JSON.stringify(routines));

        // Save to SQLite
        if (window.MediCareSQLite && window.MediCareSQLite.isReady()) {
            window.MediCareSQLite.syncRoutines(routines, uid);
        }
    }

    /**
     * Refreshes daily taken statuses based on current date
     */
    function refreshRoutineStatuses() {
        const todayStr = new Date().toDateString();
        routines.forEach(r => {
            if (r.lastTakenDate !== todayStr) {
                r.takenToday = false;
            }
        });
    }

    function getRoutines() {
        return routines;
    }

    function getFilteredRoutines() {
        return routines.filter(r => {
            // Filter pill match
            let matchesFilter = true;
            if (activeFilter === 'pending') {
                matchesFilter = !r.takenToday;
            } else if (activeFilter === 'taken') {
                matchesFilter = r.takenToday;
            }

            // Search query match
            let matchesSearch = true;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const nameMatch = (r.name || '').toLowerCase().includes(q);
                const dosageMatch = (r.dosage || '').toLowerCase().includes(q);
                const notesMatch = (r.notes || '').toLowerCase().includes(q);
                const typeMatch = (r.type || '').toLowerCase().includes(q);
                matchesSearch = nameMatch || dosageMatch || notesMatch || typeMatch;
            }

            return matchesFilter && matchesSearch;
        });
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

    function addRoutine(routine, isCloned = false) {
        const uid = getActiveUserId();
        routine.user_id = uid;
        routines.unshift(routine);
        save();
        if (window.MediCareSQLite) {
            window.MediCareSQLite.logAction(routine.id, routine.name, isCloned ? 'action_cloned' : 'action_added', null, null, uid);
        }
    }

    function getRoutineById(id) {
        return routines.find(r => r.id === id) || null;
    }

    function updateRoutine(id, updatedData) {
        const index = routines.findIndex(r => r.id === id);
        if (index !== -1) {
            routines[index] = { ...routines[index], ...updatedData };
            save();
            if (window.MediCareSQLite) {
                window.MediCareSQLite.logAction(id, routines[index].name, 'action_updated', null, null, getActiveUserId());
            }
            return routines[index];
        }
        return null;
    }

    function markTaken(id) {
        const item = routines.find(r => r.id === id);
        if (item) {
            item.takenToday = true;
            item.lastTakenDate = new Date().toDateString();
            if (item.stock !== undefined && item.stock !== '' && Number(item.stock) > 0) {
                item.stock = Number(item.stock) - 1;
            }
            save();
            if (window.MediCareSQLite) {
                window.MediCareSQLite.logAction(item.id, item.name, 'action_taken', null, null, getActiveUserId());
            }
        }
        return item;
    }

    function markUndo(id) {
        const item = routines.find(r => r.id === id);
        if (item) {
            item.takenToday = false;
            item.lastTakenDate = '';
            save();
            if (window.MediCareSQLite) {
                window.MediCareSQLite.logAction(item.id, item.name, 'action_undo', null, null, getActiveUserId());
            }
        }
        return item;
    }

    function deleteRoutine(id) {
        const item = routines.find(r => r.id === id);
        const name = item ? item.name : 'ঔষধ';
        routines = routines.filter(r => r.id !== id);
        save();
        if (window.MediCareSQLite) {
            window.MediCareSQLite.logAction(id, name, 'action_deleted', null, null, getActiveUserId());
        }
    }

    function getStats() {
        const total = routines.length;
        const taken = routines.filter(r => r.takenToday).length;
        const pending = total - taken;
        const percentage = total > 0 ? Math.round((taken / total) * 100) : 0;
        return { total, taken, pending, percentage };
    }

    // Hydration Tracker state isolated per user
    function getHydration() {
        const uid = getActiveUserId();
        const todayKey = new Date().toISOString().slice(0, 10);
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
    }

    /**
     * Resets database completely to a fresh, clean slate
     */
    function resetToFreshDatabase(skipConfirm = false) {
        const t = (k, def) => window.MediCareI18n ? window.MediCareI18n.t(k, def) : def;
        if (!skipConfirm) {
            const confirmed = window.confirm(t('confirm_fresh_db', 'আপনি কি নিশ্চিত যে ডাটাবেজ সম্পূর্ণ ফ্রেশ ও রিসেট করতে চান? আপনার বর্তমান সমস্ত ঔষধ শিডিউল এবং হিস্ট্রি লগ মুছে যাবে।'));
            if (!confirmed) return false;
        }

        // 1. Reset SQLite
        if (window.MediCareSQLite) {
            window.MediCareSQLite.resetDatabase();
        }

        // 2. Wipe LocalStorage entries related to routines and history
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (
                key.startsWith('medicare_routines') ||
                key.startsWith('medicare_history_logs') ||
                key.startsWith('medicare_hydration') ||
                key === 'medicare_sqlite_bin_v1'
            )) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));

        // 3. Clear in-memory routines
        routines = [];
        activeFilter = 'all';
        searchQuery = '';

        // 4. Update UI
        if (window.MediCareUI) {
            window.MediCareUI.renderRoutines();
            window.MediCareUI.renderHistoryView();
            window.MediCareUI.showToast(t('toast_fresh_db_success', 'ডাটাবেজ সফলভাবে ফ্রেশ ও পরিষ্কার করা হয়েছে!'), 'success');
        }
        if (window.MediCareTools) {
            window.MediCareTools.renderHydrationUI();
        }

        return true;
    }

    return {
        init,
        onUserChanged,
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
        deleteRoutine,
        getStats,
        getHydration,
        updateHydration,
        getHistoryLogsPaged,
        clearHistoryLogs,
        refreshRoutineStatuses,
        save,
        resetToFreshDatabase
    };
})();
