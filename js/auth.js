/**
 * MediCare - Authentication & User Profile Manager
 * Supports Central Node.js SQLite Backend Server & Multi-Device Sync.
 */

window.MediCareAuth = (function () {
    const AUTH_STORAGE_KEY = 'medicare_auth_user_session';
    const API_BASE = window.location.origin && window.location.origin.startsWith('http') 
        ? window.location.origin 
        : 'http://localhost:3000';

    let currentUser = null;
    let isServerMode = true; // Assume server is primary

    // Check if Backend API is alive
    async function checkServerHealth() {
        try {
            const res = await fetch(`${API_BASE}/api/auth/me`, {
                headers: getAuthHeaders()
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.user) {
                    const session = getSavedSession() || {};
                    currentUser = { ...data.user, token: session.token };
                    saveSessionLocally(currentUser);
                    isServerMode = true;
                    return true;
                }
            }
            // Even if unauthenticated, if /api/auth/me returned 401, server is alive!
            if (res.status === 401) {
                isServerMode = true;
                return true;
            }
            isServerMode = true;
            return false;
        } catch (e) {
            isServerMode = false;
            return false;
        }
    }

    function getApiBase() {
        return API_BASE;
    }

    function isServerActive() {
        return isServerMode;
    }

    function getAuthHeaders() {
        const session = getSavedSession();
        const headers = { 'Content-Type': 'application/json' };
        if (session && session.token) {
            headers['Authorization'] = `Bearer ${session.token}`;
        }
        return headers;
    }

    function getSavedSession() {
        try {
            const raw = localStorage.getItem(AUTH_STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function saveSessionLocally(userData) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
        currentUser = userData;
    }

    function clearSessionLocally() {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        currentUser = null;
    }

    // Hash helper for client-side SQLite fallback
    function simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return 'clh_' + Math.abs(hash).toString(16);
    }

    async function init() {
        const saved = getSavedSession();
        if (saved) {
            currentUser = saved;
        }

        // Try pinging server
        await checkServerHealth();

        // Update UI
        updateAuthUI();

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const menu = document.getElementById('userProfileDropdown');
            const btn = document.getElementById('userProfileBtn');
            if (menu && !menu.classList.contains('hidden')) {
                if (!menu.contains(e.target) && !btn?.contains(e.target)) {
                    menu.classList.add('hidden');
                }
            }
        });
    }

    function getCurrentUser() {
        return currentUser;
    }

    function isLoggedIn() {
        return currentUser !== null;
    }

    // Modal Control
    function openAuthModal(mode = 'login') {
        const modal = document.getElementById('authModal');
        if (!modal) return;
        
        switchAuthTab(mode);
        modal.classList.remove('hidden');
        
        const usernameInput = document.getElementById('authUsername');
        if (usernameInput) usernameInput.focus();
    }

    function closeAuthModal() {
        const modal = document.getElementById('authModal');
        if (modal) modal.classList.add('hidden');
        const errEl = document.getElementById('authErrorMessage');
        if (errEl) errEl.classList.add('hidden');
    }

    function switchAuthTab(tab) {
        const tabLogin = document.getElementById('authTabLogin');
        const tabRegister = document.getElementById('authTabRegister');
        const nameField = document.getElementById('authFullNameGroup');
        const submitBtnText = document.getElementById('authSubmitBtnText');
        const modalTitle = document.getElementById('authModalTitleText');
        const errEl = document.getElementById('authErrorMessage');
        const modeInput = document.getElementById('authCurrentMode');

        if (errEl) errEl.classList.add('hidden');

        const t = (k, def) => window.MediCareI18n ? window.MediCareI18n.t(k, def) : def;

        if (tab === 'register') {
            if (modeInput) modeInput.value = 'register';
            if (tabLogin) tabLogin.className = 'flex-1 py-2 text-xs font-semibold rounded text-slate-600 dark:text-slate-400 hover:text-slate-900 transition';
            if (tabRegister) tabRegister.className = 'flex-1 py-2 text-xs font-bold rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs transition';
            if (nameField) nameField.classList.remove('hidden');
            if (submitBtnText) submitBtnText.textContent = t('btn_register_submit', 'অ্যাকাউন্ট তৈরি করুন');
            if (modalTitle) modalTitle.textContent = t('auth_modal_register_title', 'নতুন অ্যাকাউন্ট তৈরি');
        } else {
            if (modeInput) modeInput.value = 'login';
            if (tabLogin) tabLogin.className = 'flex-1 py-2 text-xs font-bold rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs transition';
            if (tabRegister) tabRegister.className = 'flex-1 py-2 text-xs font-semibold rounded text-slate-600 dark:text-slate-400 hover:text-slate-900 transition';
            if (nameField) nameField.classList.add('hidden');
            if (submitBtnText) submitBtnText.textContent = t('btn_login_submit', 'লগইন করুন');
            if (modalTitle) modalTitle.textContent = t('auth_modal_login_title', 'মেডিকেয়ারে লগইন');
        }
    }

    function togglePasswordVisibility() {
        const passInput = document.getElementById('authPassword');
        const icon = document.getElementById('authPassEyeIcon');
        if (!passInput) return;
        if (passInput.type === 'password') {
            passInput.type = 'text';
            if (icon) icon.setAttribute('data-lucide', 'eye-off');
        } else {
            passInput.type = 'password';
            if (icon) icon.setAttribute('data-lucide', 'eye');
        }
        if (window.lucide) window.lucide.createIcons();
    }

    // Submit handler
    async function handleAuthSubmit(event) {
        event.preventDefault();
        const t = (k, def) => window.MediCareI18n ? window.MediCareI18n.t(k, def) : def;
        const mode = document.getElementById('authCurrentMode')?.value || 'login';
        const username = document.getElementById('authUsername')?.value.trim();
        const password = document.getElementById('authPassword')?.value;
        const fullName = document.getElementById('authFullName')?.value.trim();

        if (!username || !password) {
            showError(t('auth_err_required', 'অনুগ্রহ করে ইউজারনেম এবং পাসওয়ার্ড পূরণ করুন।'));
            return;
        }

        if (mode === 'register' && !fullName) {
            showError(t('auth_err_fullname', 'অনুগ্রহ করে আপনার পুরো নাম দিন।'));
            return;
        }

        // Try Backend API First for Cross-Device Synchronization
        try {
            const endpoint = mode === 'register' ? `${API_BASE}/api/auth/register` : `${API_BASE}/api/auth/login`;
            const body = mode === 'register' 
                ? { username, full_name: fullName, password }
                : { username, password };

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                showError(data.error || t('auth_err_failed', 'লগইন ব্যর্থ হয়েছে।'));
                return;
            }

            saveSessionLocally({
                id: data.user.id,
                username: data.user.username,
                full_name: data.user.full_name,
                role: data.user.role || (data.user.username === 'admin' || data.user.username === 'demo' ? 'admin' : 'user'),
                token: data.token
            });

            isServerMode = true;
            closeAuthModal();
            updateAuthUI();
            showSuccessToast(mode === 'register' ? t('toast_register_success', 'অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!') : t('toast_login_success', 'স্বাগতম! আপনি সফলভাবে লগইন করেছেন।'));
            reloadUserData();
            return;
        } catch (err) {
            console.warn('Backend call failed, using client-side fallback:', err);
        }

        // Client-Side SQLite Multi-User Fallback
        handleClientSideAuth(mode, username, fullName, password);
    }

    function handleClientSideAuth(mode, username, fullName, password) {
        const t = (k, def) => window.MediCareI18n ? window.MediCareI18n.t(k, def) : def;
        const usersKey = 'medicare_sqlite_users_store_v1';
        let users = [];
        try {
            const raw = localStorage.getItem(usersKey);
            users = raw ? JSON.parse(raw) : [];
        } catch (e) {}

        const cleanUsername = username.toLowerCase();

        if (mode === 'register') {
            if (users.some(u => u.username === cleanUsername)) {
                showError(t('auth_err_username_exists', 'এই ইউজারনেম ইতিমধ্যে ব্যবহৃত হয়েছে।'));
                return;
            }
            const newUser = {
                id: 'usr_' + Date.now(),
                username: cleanUsername,
                full_name: fullName,
                passHash: simpleHash(password),
                createdAt: new Date().toISOString()
            };
            users.push(newUser);
            localStorage.setItem(usersKey, JSON.stringify(users));

            saveSessionLocally({
                id: newUser.id,
                username: newUser.username,
                full_name: newUser.full_name,
                token: 'local_' + Date.now()
            });

            closeAuthModal();
            updateAuthUI();
            showSuccessToast(t('toast_register_success', 'অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!'));
            reloadUserData();
        } else {
            // Login
            if (cleanUsername === 'demo' && password === '123456') {
                const demoUser = {
                    id: 'user_demo_01',
                    username: 'demo',
                    full_name: 'ডা. শরিফুল ইসলাম (Dr. Shariful)',
                    token: 'demo_' + Date.now()
                };
                saveSessionLocally(demoUser);
                closeAuthModal();
                updateAuthUI();
                showSuccessToast(t('toast_login_success', 'স্বাগতম! ডেমো অ্যাকাউন্টে লগইন সম্পন্ন হয়েছে।'));
                reloadUserData();
                return;
            }

            const found = users.find(u => u.username === cleanUsername);
            if (!found || found.passHash !== simpleHash(password)) {
                showError(t('auth_err_invalid_creds', 'ভুল ইউজারনেম বা পাসওয়ার্ড। ডেমো একাউন্ট: demo / 123456'));
                return;
            }

            saveSessionLocally({
                id: found.id,
                username: found.username,
                full_name: found.full_name,
                token: 'local_' + Date.now()
            });

            closeAuthModal();
            updateAuthUI();
            showSuccessToast(t('toast_login_success', 'স্বাগতম! আপনি সফলভাবে লগইন করেছেন।'));
            reloadUserData();
        }
    }

    // Quick 1-Click Demo Login with central server synchronization
    async function quickDemoLogin() {
        const t = (k, def) => window.MediCareI18n ? window.MediCareI18n.t(k, def) : def;
        try {
            const res = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'demo', password: '123456' })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                saveSessionLocally({
                    id: data.user.id,
                    username: data.user.username,
                    full_name: data.user.full_name,
                    role: data.user.role || 'admin',
                    token: data.token
                });
                isServerMode = true;
                closeAuthModal();
                updateAuthUI();
                showSuccessToast(t('toast_demo_login', 'ডেমো অ্যাকাউন্টে সফলভাবে প্রবেশ করেছেন!'));
                reloadUserData();
                return;
            }
        } catch (e) {
            console.warn('Server offline during demo login, using client fallback:', e);
        }

        // Fallback
        const demoUser = {
            id: 'user_demo_01',
            username: 'demo',
            full_name: 'ডা. শরিফুল ইসলাম (Dr. Shariful)',
            role: 'admin',
            token: 'demo_token_' + Date.now()
        };
        saveSessionLocally(demoUser);
        closeAuthModal();
        updateAuthUI();
        showSuccessToast(t('toast_demo_login', 'ডেমো অ্যাকাউন্টে সফলভাবে প্রবেশ করেছেন!'));
        reloadUserData();
    }

    function logout() {
        clearSessionLocally();
        updateAuthUI();
        const t = (k, def) => window.MediCareI18n ? window.MediCareI18n.t(k, def) : def;
        showSuccessToast(t('toast_logged_out', 'আপনি সফলভাবে লগআউট হয়েছেন।'), 'info');
        reloadUserData();
    }

    function toggleUserMenu() {
        const menu = document.getElementById('userProfileDropdown');
        if (menu) {
            menu.classList.toggle('hidden');
        }
    }

    function showError(msg) {
        const errEl = document.getElementById('authErrorMessage');
        if (errEl) {
            errEl.textContent = msg;
            errEl.classList.remove('hidden');
        }
    }

    function showSuccessToast(msg, type = 'success') {
        if (window.MediCareUI && window.MediCareUI.showToast) {
            window.MediCareUI.showToast(msg, type);
        }
    }

    function reloadUserData() {
        if (window.MediCareStore && typeof window.MediCareStore.onUserChanged === 'function') {
            window.MediCareStore.onUserChanged();
        } else if (window.MediCareUI) {
            window.MediCareUI.renderRoutines();
            window.MediCareUI.renderHistoryView();
        }
    }

    // UI Updater
    function updateAuthUI() {
        const authBtn = document.getElementById('userAuthBtn');
        const profileBox = document.getElementById('userProfileBox');
        const userAvatarChar = document.getElementById('userAvatarChar');
        const userDisplayName = document.getElementById('userDisplayName');
        const dropdownUserName = document.getElementById('dropdownUserName');
        const dropdownUserHandle = document.getElementById('dropdownUserHandle');

        if (currentUser) {
            if (authBtn) authBtn.classList.add('hidden');
            if (profileBox) profileBox.classList.remove('hidden');
            
            const firstLetter = (currentUser.full_name || currentUser.username || 'U')[0].toUpperCase();
            if (userAvatarChar) userAvatarChar.textContent = firstLetter;
            if (userDisplayName) userDisplayName.textContent = currentUser.full_name || currentUser.username;
            if (dropdownUserName) dropdownUserName.textContent = currentUser.full_name || currentUser.username;
            if (dropdownUserHandle) dropdownUserHandle.textContent = '@' + currentUser.username;
        } else {
            if (authBtn) authBtn.classList.remove('hidden');
            if (profileBox) profileBox.classList.add('hidden');
        }

        if (window.lucide) window.lucide.createIcons();
    }

    return {
        init,
        isLoggedIn,
        getCurrentUser,
        getApiBase,
        isServerActive,
        getAuthHeaders,
        openAuthModal,
        closeAuthModal,
        switchAuthTab,
        togglePasswordVisibility,
        handleAuthSubmit,
        quickDemoLogin,
        logout,
        toggleUserMenu,
        updateAuthUI
    };
})();

// Global alias
window.openAuthModal = () => window.MediCareAuth.openAuthModal();
window.closeAuthModal = () => window.MediCareAuth.closeAuthModal();
window.logout = () => window.MediCareAuth.logout();
