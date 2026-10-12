/**
 * MediCare - Unified Storage & State Manager
 * Coordinates LocalStorage and SQLite WebAssembly Database.
 */

window.MediCareStore = (function () {
    const STORAGE_KEY = window.MediCareConfig ? window.MediCareConfig.STORAGE_KEY : 'medicare_routines_v2';
    const HYDRATION_KEY = window.MediCareConfig ? window.MediCareConfig.HYDRATION_KEY : 'medicare_hydration_v1';
    
    let routines = [];
    let activeFilter = 'all';
    let searchQuery = '';
    let currentTab = 'schedule'; // 'schedule' | 'tools' | 'history' | 'emergency'

    async function init() {
        // Try initializing SQLite
        if (window.MediCareSQLite) {
            await window.MediCareSQLite.init();
        }

        // Check SQLite routines first, else fallback to LocalStorage
        let loadedFromSqlite = null;
        if (window.MediCareSQLite && window.MediCareSQLite.isReady()) {
            loadedFromSqlite = window.MediCareSQLite.loadRoutines();
        }

        if (loadedFromSqlite && loadedFromSqlite.length > 0) {
            routines = loadedFromSqlite;
        } else {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                try {
                    routines = JSON.parse(stored);
                } catch (e) {
                    routines = [];
                }
            } else {
                const defaults = window.MediCareConfig ? window.MediCareConfig.DEFAULT_ROUTINES : [];
                routines = JSON.parse(JSON.stringify(defaults));
            }
        }

        refreshRoutineStatuses();
        save();
    }

    function save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(routines));
        if (window.MediCareSQLite && window.MediCareSQLite.isReady()) {
            window.MediCareSQLite.syncRoutines(routines);
        }
    }

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
        routines.unshift(routine);
        save();
        if (window.MediCareSQLite) {
            window.MediCareSQLite.logAction(routine.id, routine.name, isCloned ? 'action_cloned' : 'action_added');
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
                window.MediCareSQLite.logAction(id, routines[index].name, 'action_updated');
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
                window.MediCareSQLite.logAction(item.id, item.name, 'action_taken');
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
                window.MediCareSQLite.logAction(item.id, item.name, 'action_undo');
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
            window.MediCareSQLite.logAction(id, name, 'action_deleted');
        }
    }

    function getStats() {
        const total = routines.length;
        const taken = routines.filter(r => r.takenToday).length;
        const pending = total - taken;
        const percentage = total > 0 ? Math.round((taken / total) * 100) : 0;
        return { total, taken, pending, percentage };
    }

    // Hydration Tracker state
    function getHydration() {
        const todayKey = new Date().toISOString().slice(0, 10);
        const raw = localStorage.getItem(HYDRATION_KEY);
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
        const { todayKey, fullData } = getHydration();
        if (!fullData[todayKey]) fullData[todayKey] = { glasses: 0, target: 8 };
        let newGlasses = (fullData[todayKey].glasses || 0) + change;
        if (newGlasses < 0) newGlasses = 0;
        if (newGlasses > 20) newGlasses = 20;
        fullData[todayKey].glasses = newGlasses;
        localStorage.setItem(HYDRATION_KEY, JSON.stringify(fullData));
        return fullData[todayKey];
    }

    function getHistoryLogsPaged(page = 1, pageSize = 20) {
        if (window.MediCareSQLite) {
            return window.MediCareSQLite.getHistoryLogsPaged(page, pageSize);
        }
        return { logs: [], total: 0, page: 1, pageSize, totalPages: 1 };
    }

    function clearHistoryLogs() {
        if (window.MediCareSQLite) {
            window.MediCareSQLite.clearHistoryLogs();
        }
    }

    return {
        init,
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
        save
    };
})();
