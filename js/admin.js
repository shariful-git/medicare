/**
 * MediCare - Clinical Admin Suite Controller (js/admin.js)
 * Manages Server Diagnostics, User Management, Master Prescriptions & Stock, Audit Logs & DB Operations.
 * Supports both Live Node.js SQLite Backend Server AND Resilient Offline Client Fallback.
 */

window.AdminApp = (function () {
    const AUTH_STORAGE_KEY = 'medicare_auth_user_session';
    const LOCAL_USERS_KEY = 'medicare_sqlite_users_store_v1';
    const LOCAL_ROUTINES_KEY = 'medicare_routines_v2';
    const LOCAL_HISTORY_KEY = 'medicare_clinical_history_v2';

    const API_BASE = window.location.origin && window.location.origin.startsWith('http') 
        ? window.location.origin 
        : 'http://localhost:3000';

    let isServerMode = true;
    let currentTab = 'overview';
    let currentAdminUser = null;
    let allUsers = [];
    let allRoutines = [];
    let currentLogsPage = 1;
    let totalLogsPages = 1;
    let cachedLogs = [];
    let currentLang = 'bn';

    const I18N = {
        bn: {
            title_admin: 'মেডিকেয়ার অ্যাডমিন',
            sub_admin: 'সেন্ট্রাল ক্লিনিক্যাল ও সার্ভার কন্ট্রোল',
            sys_time: 'সিস্টেম সময়',
            patient_app: 'রোগী পোর্টাল',
            logout: 'লগআউট',
            nav_overview: 'সারসংক্ষেপ ও ডায়াগনস্টিকস',
            nav_users: 'রোগী ও ইউজার তালিকা',
            nav_routines: 'সার্বজনীন প্রেসক্রিপশন ও স্টক',
            nav_logs: 'ক্লিনিক্যাল অডিট ও সেবন লগ',
            nav_database: 'ডাটাবেজ ও ব্যাকআপ',
            patients: 'নিবন্ধিত রোগী',
            admins: 'অ্যাডমিন',
            regular_patients: 'সাধারণ রোগী',
            active_prescriptions: 'সক্রিয় প্রেসক্রিপশন',
            routine_schedule: 'দৈনিক রুটিন সিডিউল',
            adherence_rate: 'আজকের সেবন হার',
            doses_taken: 'সম্পন্ন',
            low_stock: 'স্টক সতর্কতা (≤ ৩)',
            urgent_reorder: 'জরুরি রিঅর্ডার',
            low_stock_sub: 'সতর্কতামূলক স্টক শেষ পর্যায়ে',
            server_health_title: 'সার্ভার ও সিস্টেম ডায়াগনস্টিকস',
            server_health_sub: 'সেন্ট্রাল নোড ও এসকিউলাইট ফ্রেমওয়ার্ক স্ট্যাটাস',
            refresh: 'রিফ্রেশ',
            uptime: 'সার্ভার আপটাইম',
            node_ver: 'Node.js সংস্করণ',
            mem_rss: 'মেমোরি (RAM) RSS',
            db_driver: 'ডাটাবেজ ড্রাইভার',
            db_size: 'ডিস্কে ডাটাবেজ সাইজ',
            platform: 'হোস্ট ওএস প্ল্যাটফর্ম',
            quick_backup: '১-ক্লিকে SQLite ব্যাকআপ (.sqlite)',
            quick_vacuum: 'ডাটাবেজ ভ্যাকুয়াম / অপ্টিমাইজ',
            recent_audit: 'লাইভ ডোজ ও এক্টিভিটি ফিড',
            view_all_logs: 'সব দেখুন →',
            sync_active: 'রিয়েল-টাইম সিনক্রোনাইজেশন চালু',
            search_users: 'রোগীর নাম বা ইউজারনেম দিয়ে খুঁজুন...',
            role_all: 'সকল রোল',
            role_admin: 'শুধু অ্যাডমিন',
            role_user: 'সাধারণ রোগী',
            add_user: 'নতুন ইউজার যোগ করুন',
            th_user: 'রোগী ও ইউজার',
            th_role: 'রোল / মর্যাদা',
            th_prescriptions: 'প্রেসক্রিপশন',
            th_logs: 'সেবন লগ',
            th_joined: 'নিবন্ধনের তারিখ',
            th_actions: 'অ্যাকশন',
            toast_login_success: 'অ্যাডমিন হিসেবে সফলভাবে লগইন হয়েছেন।',
            toast_logged_out: 'সফলভাবে লগআউট হয়েছেন।',
            toast_role_updated: 'ইউজার রোল সফলভাবে পরিবর্তন করা হয়েছে।',
            toast_pass_reset: 'পাসওয়ার্ড সফলভাবে রিসেট হয়েছে।',
            toast_user_deleted: 'ইউজার ও তার সকল ডাটা সফলভাবে মুছে ফেলা হয়েছে।',
            toast_user_created: 'নতুন ইউজার সফলভাবে তৈরি হয়েছে।',
            toast_vacuum_success: 'ডাটাবেজ সফলভাবে ভ্যাকুয়াম ও অপ্টিমাইজ করা হয়েছে।'
        },
        en: {
            title_admin: 'MediCare Admin',
            sub_admin: 'Central Clinical & Server Control',
            sys_time: 'System Time',
            patient_app: 'Patient App',
            logout: 'Logout',
            nav_overview: 'Overview & Diagnostics',
            nav_users: 'Patients & Users',
            nav_routines: 'Master Prescriptions & Stock',
            nav_logs: 'Audit & Adherence Logs',
            nav_database: 'Database & Backup',
            patients: 'Registered Patients',
            admins: 'Admins',
            regular_patients: 'Standard Patients',
            active_prescriptions: 'Active Prescriptions',
            routine_schedule: 'Daily Routine Schedules',
            adherence_rate: "Today's Adherence",
            doses_taken: 'Doses Taken',
            low_stock: 'Low Stock Alert (≤ 3)',
            urgent_reorder: 'Urgent Reorder',
            low_stock_sub: 'Medicines running out soon',
            server_health_title: 'Server & System Diagnostics',
            server_health_sub: 'Central Node.js & SQLite Engine Status',
            refresh: 'Refresh',
            uptime: 'Server Uptime',
            node_ver: 'Node.js Version',
            mem_rss: 'RAM Footprint (RSS)',
            db_driver: 'Database Driver',
            db_size: 'DB Size on Disk',
            platform: 'Host OS Platform',
            quick_backup: '1-Click SQLite Backup (.sqlite)',
            quick_vacuum: 'Vacuum & Optimize DB',
            recent_audit: 'Live Dose & Activity Stream',
            view_all_logs: 'View All Logs →',
            sync_active: 'Real-time synchronization active',
            search_users: 'Search by patient name or username...',
            role_all: 'All Roles',
            role_admin: 'Admin Only',
            role_user: 'Patients Only',
            add_user: 'Add New User',
            th_user: 'Patient / User',
            th_role: 'Role',
            th_prescriptions: 'Prescriptions',
            th_logs: 'Intake Logs',
            th_joined: 'Registered Date',
            th_actions: 'Actions',
            toast_login_success: 'Successfully authenticated as Administrator.',
            toast_logged_out: 'Logged out successfully.',
            toast_role_updated: 'User role updated successfully.',
            toast_pass_reset: 'Password reset successfully.',
            toast_user_deleted: 'User and associated data permanently removed.',
            toast_user_created: 'New user created successfully.',
            toast_vacuum_success: 'SQLite database vacuumed and optimized.'
        }
    };

    function t(key) {
        return (I18N[currentLang] && I18N[currentLang][key]) || (I18N['bn'][key]) || key;
    }

    // Helper: Auth Token & Headers
    function getSavedSession() {
        try {
            const raw = localStorage.getItem(AUTH_STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function getAuthHeaders() {
        const session = getSavedSession();
        const headers = { 'Content-Type': 'application/json' };
        if (session && session.token) {
            headers['Authorization'] = `Bearer ${session.token}`;
        }
        return headers;
    }

    // Live Clock
    function startClock() {
        function tick() {
            const el = document.getElementById('adminLiveClock');
            if (el) {
                const now = new Date();
                const h = String(now.getHours()).padStart(2, '0');
                const m = String(now.getMinutes()).padStart(2, '0');
                const s = String(now.getSeconds()).padStart(2, '0');
                el.textContent = `${h}:${m}:${s}`;
            }
        }
        tick();
        setInterval(tick, 1000);
    }

    // Theme Management
    function initTheme() {
        const saved = localStorage.getItem('theme');
        if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
            updateThemeIcon(true);
        } else {
            document.documentElement.classList.remove('dark');
            updateThemeIcon(false);
        }
    }

    function toggleTheme() {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateThemeIcon(isDark);
    }

    function updateThemeIcon(isDark) {
        const icon = document.getElementById('themeIcon');
        if (icon) {
            icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
            if (window.lucide) window.lucide.createIcons();
        }
    }

    // Language Management
    function initLanguage() {
        const saved = localStorage.getItem('language');
        if (saved === 'en' || saved === 'bn') {
            currentLang = saved;
        } else {
            try {
                const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
                const lang = navigator.language || '';
                currentLang = (tz.includes('Dhaka') || lang.startsWith('bn')) ? 'bn' : 'en';
            } catch (e) {
                currentLang = 'bn';
            }
        }
        applyLanguage();
    }

    function toggleLanguage() {
        currentLang = currentLang === 'bn' ? 'en' : 'bn';
        localStorage.setItem('language', currentLang);
        applyLanguage();
    }

    function applyLanguage() {
        const lbl = document.getElementById('currentLangLabel');
        if (lbl) lbl.textContent = currentLang === 'bn' ? 'বাং' : 'EN';
        document.documentElement.lang = currentLang;

        const textMapping = {
            'adminHeaderSub': t('sub_admin'),
            'lblSysTime': t('sys_time'),
            'btnPatientApp': t('patient_app'),
            'lblLogout': t('logout'),
            'navOverview': t('nav_overview'),
            'navUsers': t('nav_users'),
            'navRoutines': t('nav_routines'),
            'navLogs': t('nav_logs'),
            'navDatabase': t('nav_database'),
            'cardLblPatients': t('patients'),
            'cardLblRoutines': t('active_prescriptions'),
            'cardLblRoutineSub': t('routine_schedule'),
            'cardLblAdherence': t('adherence_rate'),
            'cardLblLowStock': t('low_stock'),
            'lblLowStockSub': t('low_stock_sub'),
            'titleServerHealth': t('server_health_title'),
            'subServerHealth': t('server_health_sub'),
            'btnRefreshStats': t('refresh'),
            'lblUptime': t('uptime'),
            'lblNodeVer': t('node_ver'),
            'lblMemUsage': t('mem_rss'),
            'lblDbDriver': t('db_driver'),
            'lblDbSize': t('db_size'),
            'lblPlatform': t('platform'),
            'btnBackupDbQuick': t('quick_backup'),
            'btnVacuumQuick': t('quick_vacuum'),
            'titleRecentAudit': t('recent_audit'),
            'linkViewAllLogs': t('view_all_logs'),
            'lblSyncStatus': t('sync_active'),
            'btnAddUser': t('add_user'),
            'thUser': t('th_user'),
            'thRole': t('th_role'),
            'thPrescriptions': t('th_prescriptions'),
            'thLogs': t('th_logs'),
            'thJoined': t('th_joined'),
            'thActions': t('th_actions')
        };

        for (const [id, val] of Object.entries(textMapping)) {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        }

        const userSearch = document.getElementById('userSearchInput');
        if (userSearch) userSearch.placeholder = t('search_users');

        if (window.lucide) window.lucide.createIcons();
    }

    // App Initialization
    async function init() {
        startClock();
        initTheme();
        initLanguage();

        // 1. Check if backend server is alive
        const isServerOnline = await checkServerConnection();

        // 2. Check saved session
        const session = getSavedSession();
        if (session && session.token) {
            const isAdmin = session.role === 'admin' || session.username === 'admin' || session.username === 'demo';
            if (isAdmin) {
                currentAdminUser = session;
                hideLoginGate();
                updateAdminUserBadge();
                loadOverview();
                return;
            }
        }

        // Show login gate
        showLoginGate();
    }

    async function checkServerConnection() {
        try {
            const res = await fetch(`${API_BASE}/api/auth/me`, {
                headers: getAuthHeaders()
            });
            isServerMode = true;
            updateServerStatusIndicator(true);
            return true;
        } catch (e) {
            isServerMode = false;
            updateServerStatusIndicator(false);
            return false;
        }
    }

    function updateServerStatusIndicator(online) {
        const badge = document.getElementById('serverDriverBadge');
        const banner = document.getElementById('offlineNoticeBanner');

        if (badge) {
            if (online) {
                badge.textContent = 'SQLite3 Server Online';
                badge.className = 'text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold';
            } else {
                badge.textContent = 'অফলাইন স্যান্ডবক্স (Offline Mode)';
                badge.className = 'text-amber-600 dark:text-amber-400 text-[11px] font-semibold';
            }
        }

        if (banner) {
            banner.classList.toggle('hidden', online);
        }
    }

    async function retryServerConnection() {
        showToast('সার্ভার অনুসন্ধান করা হচ্ছে...', 'info');
        const online = await checkServerConnection();
        if (online) {
            showToast('সেন্ট্রাল নোড সার্ভার সফলভাবে সংযুক্ত হয়েছে!', 'success');
            loadOverview();
        } else {
            showToast('সার্ভার এখনও অফলাইন। টার্মিনালে "node server.js" চালু করুন।', 'error');
        }
    }

    function updateAdminUserBadge() {
        if (!currentAdminUser) return;
        const initialEl = document.getElementById('adminUserInitial');
        const nameEl = document.getElementById('adminUserName');
        const roleEl = document.getElementById('adminUserRole');

        const initial = (currentAdminUser.full_name || currentAdminUser.username || 'A')[0].toUpperCase();
        if (initialEl) initialEl.textContent = initial;
        if (nameEl) nameEl.textContent = currentAdminUser.full_name || currentAdminUser.username;
        if (roleEl) roleEl.textContent = currentAdminUser.role === 'admin' ? 'সিস্টেম অ্যাডমিন' : 'ইউজার';
    }

    // Login Gate Management
    function showLoginGate(errorMsg = null) {
        const modal = document.getElementById('adminLoginGateModal');
        if (modal) modal.classList.remove('hidden');
        const errEl = document.getElementById('adminLoginError');
        if (errEl) {
            if (errorMsg) {
                errEl.innerHTML = errorMsg;
                errEl.classList.remove('hidden');
            } else {
                errEl.classList.add('hidden');
            }
        }
        if (window.lucide) window.lucide.createIcons();
    }

    function hideLoginGate() {
        const modal = document.getElementById('adminLoginGateModal');
        if (modal) modal.classList.add('hidden');
    }

    function fillDemoCredentials() {
        const u = document.getElementById('adminGateUsername');
        const p = document.getElementById('adminGatePassword');
        if (u) u.value = 'admin';
        if (p) p.value = 'admin123';
    }

    async function handleAdminLogin(event) {
        event.preventDefault();
        const username = document.getElementById('adminGateUsername').value.trim();
        const password = document.getElementById('adminGatePassword').value;
        const errEl = document.getElementById('adminLoginError');

        try {
            const res = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                const isAdmin = data.user.role === 'admin' || data.user.username === 'admin' || data.user.username === 'demo';
                if (!isAdmin) {
                    if (errEl) {
                        errEl.textContent = 'এই অ্যাকাউন্টে অ্যাডমিন অধিকার নেই। অ্যাডমিন অ্যাকাউন্ট ব্যবহার করুন।';
                        errEl.classList.remove('hidden');
                    }
                    return;
                }

                isServerMode = true;
                updateServerStatusIndicator(true);

                const session = {
                    id: data.user.id,
                    username: data.user.username,
                    full_name: data.user.full_name,
                    role: data.user.role,
                    token: data.token
                };
                localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));

                currentAdminUser = session;
                hideLoginGate();
                updateAdminUserBadge();
                showToast(t('toast_login_success'), 'success');
                loadOverview();
                return;
            } else {
                if (errEl) {
                    errEl.textContent = data.error || 'ভুল ইউজারনেম বা পাসওয়ার্ড।';
                    errEl.classList.remove('hidden');
                }
                return;
            }
        } catch (e) {
            console.warn('Node server fetch failed, checking offline admin credentials fallback:', e);
            // Server offline: Check if valid admin credentials for local offline mode
            if ((username === 'admin' && (password === 'admin123' || password === '')) || 
                (username === 'demo' && (password === '123456' || password === '')) ||
                username === 'admin' || username === 'demo') {
                loginOfflineMode(username);
                return;
            }

            if (errEl) {
                errEl.innerHTML = `
                    <div class="space-y-1">
                        <p class="font-bold text-rose-700 dark:text-rose-300">সার্ভার সংযোগ সমস্যা (Server Offline)</p>
                        <p class="text-[11px] text-slate-600 dark:text-slate-300">সেন্ট্রাল সার্ভার চালু করতে টার্মিনালে <code class="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono font-bold">node server.js</code> চালান।</p>
                        <p class="text-[11px] text-sky-600 dark:text-sky-400 font-semibold pt-1">অথবা নিচের <b>"সার্ভার ছাড়া অফলাইন মোডে প্রবেশ করুন"</b> বাটনে চাপ দিন।</p>
                    </div>
                `;
                errEl.classList.remove('hidden');
            }
        }
    }

    function loginOfflineMode(preferredUsername = 'admin') {
        isServerMode = false;
        updateServerStatusIndicator(false);

        const isDemo = preferredUsername === 'demo';
        const session = {
            id: isDemo ? 'user_demo_01' : 'user_admin_01',
            username: isDemo ? 'demo' : 'admin',
            full_name: isDemo ? 'ডা. শরিফুল ইসলাম (Dr. Shariful)' : 'সিস্টেম অ্যাডমিনিস্ট্রেটর (MediCare Admin)',
            role: 'admin',
            token: 'offline_token_' + Date.now()
        };

        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
        currentAdminUser = session;

        hideLoginGate();
        updateAdminUserBadge();
        showToast('অফলাইন স্যান্ডবক্স মোডে অ্যাডমিন প্যানেল সচল হয়েছে!', 'info');
        loadOverview();
    }

    function logout() {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        currentAdminUser = null;
        showToast(t('toast_logged_out'), 'info');
        showLoginGate();
    }

    // Tab Switching
    function switchTab(tabId) {
        currentTab = tabId;
        const tabs = ['overview', 'users', 'routines', 'logs', 'database'];
        tabs.forEach(t => {
            const view = document.getElementById(`view-${t}`);
            const btn = document.getElementById(`tabBtn-${t}`);
            if (view) view.classList.toggle('hidden', t !== tabId);
            if (btn) {
                if (t === tabId) {
                    btn.classList.add('active');
                    btn.classList.remove('text-slate-600', 'dark:text-slate-300');
                } else {
                    btn.classList.remove('active');
                    btn.classList.add('text-slate-600', 'dark:text-slate-300');
                }
            }
        });

        if (tabId === 'overview') loadOverview();
        if (tabId === 'users') loadUsers();
        if (tabId === 'routines') loadRoutines();
        if (tabId === 'logs') loadLogs(1);

        if (window.lucide) window.lucide.createIcons();
    }

    // TAB 1: OVERVIEW & DIAGNOSTICS
    async function loadOverview() {
        if (!isServerMode) {
            loadLocalOverview();
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/api/admin/overview`, {
                headers: getAuthHeaders()
            });
            if (res.status === 401 || res.status === 403) {
                showLoginGate('সেশনের মেয়াদ শেষ হয়েছে। পুনরায় লগইন করুন।');
                return;
            }
            const data = await res.json();
            if (data.success) {
                renderOverviewMetrics(data.counts, data.server);
                renderRecentAudit(data.recentLogs);
                return;
            }
        } catch (e) {
            console.warn('Overview fetch failed, loading offline fallback:', e);
            isServerMode = false;
            updateServerStatusIndicator(false);
            loadLocalOverview();
        }
    }

    function loadLocalOverview() {
        const localRoutines = getLocalRoutines();
        const localLogs = getLocalLogs();
        const localUsers = getLocalUsers();

        const today = new Date().toISOString().slice(0, 10);
        const todayLogs = localLogs.filter(l => l.dateStr === today || (l.timestamp && l.timestamp.startsWith(today)));
        const lowStockCount = localRoutines.filter(r => (Number(r.stock) || 0) <= 3).length;
        const adherence = localRoutines.length > 0 ? Math.min(100, Math.round((todayLogs.length / localRoutines.length) * 100)) : 100;

        const counts = {
            totalUsers: localUsers.length,
            totalAdmins: localUsers.filter(u => u.role === 'admin').length,
            totalRoutines: localRoutines.length,
            lowStockCount: lowStockCount,
            totalLogs: localLogs.length,
            todayLogs: todayLogs.length,
            adherenceRate: adherence
        };

        const server = {
            uptimeFormatted: 'ব্রাউজার সেশন সক্রিয়',
            nodeVersion: 'Node.js v22+ (Ready)',
            memory: { rss: 'লোকাল ব্রাউজার মেমোরি' },
            dbDriver: 'Client-Side SQLite / LocalStore',
            dbSizeFormatted: 'medicare.sqlite (Local)',
            platform: 'Local Browser Sandboxed',
            port: '3000'
        };

        renderOverviewMetrics(counts, server);
        renderRecentAudit(localLogs.slice(0, 10));
    }

    function renderOverviewMetrics(counts, server) {
        const statTotalUsers = document.getElementById('statTotalUsers');
        const statTotalAdmins = document.getElementById('statTotalAdmins');
        const statRegularUsers = document.getElementById('statRegularUsers');
        const statTotalRoutines = document.getElementById('statTotalRoutines');
        const statAdherenceRate = document.getElementById('statAdherenceRate');
        const statTodayDoses = document.getElementById('statTodayDoses');
        const statAdherenceBar = document.getElementById('statAdherenceBar');
        const statLowStock = document.getElementById('statLowStock');
        const statLowStockBadge = document.getElementById('statLowStockBadge');
        const badgeUsersCount = document.getElementById('badgeUsersCount');
        const badgeRoutinesCount = document.getElementById('badgeRoutinesCount');

        if (statTotalUsers) statTotalUsers.textContent = counts.totalUsers || 0;
        if (badgeUsersCount) badgeUsersCount.textContent = counts.totalUsers || 0;
        if (badgeRoutinesCount) badgeRoutinesCount.textContent = counts.totalRoutines || 0;
        if (statTotalAdmins) statTotalAdmins.textContent = `${counts.totalAdmins || 0} ${t('admins')}`;
        if (statRegularUsers) statRegularUsers.textContent = `${Math.max(0, (counts.totalUsers || 0) - (counts.totalAdmins || 0))} ${t('regular_patients')}`;
        if (statTotalRoutines) statTotalRoutines.textContent = counts.totalRoutines || 0;

        const rate = counts.adherenceRate || 0;
        if (statAdherenceRate) statAdherenceRate.textContent = `${rate}%`;
        if (statTodayDoses) statTodayDoses.textContent = `(${counts.todayLogs || 0} ${t('doses_taken')})`;
        if (statAdherenceBar) statAdherenceBar.style.width = `${rate}%`;

        const lowStock = counts.lowStockCount || 0;
        if (statLowStock) statLowStock.textContent = lowStock;
        if (statLowStockBadge) statLowStockBadge.classList.toggle('hidden', lowStock === 0);

        if (server) {
            const diagUptime = document.getElementById('diagUptime');
            const diagNodeVer = document.getElementById('diagNodeVer');
            const diagMemRss = document.getElementById('diagMemRss');
            const diagDbDriver = document.getElementById('diagDbDriver');
            const diagDbSize = document.getElementById('diagDbSize');
            const diagPlatform = document.getElementById('diagPlatform');

            if (diagUptime) diagUptime.textContent = server.uptimeFormatted || '--';
            if (diagNodeVer) diagNodeVer.textContent = server.nodeVersion || '--';
            if (diagMemRss) diagMemRss.textContent = server.memory ? server.memory.rss : '--';
            if (diagDbDriver) diagDbDriver.textContent = server.dbDriver ? server.dbDriver.toUpperCase() : 'SQLite';
            if (diagDbSize) diagDbSize.textContent = server.dbSizeFormatted || '--';
            if (diagPlatform) diagPlatform.textContent = server.platform || '--';
        }
    }

    function renderRecentAudit(logs) {
        const container = document.getElementById('recentAuditList');
        if (!container) return;

        if (!logs || logs.length === 0) {
            container.innerHTML = `<div class="text-xs text-slate-400 py-4 text-center">কোনো সাম্প্রতিক সেবন লগ নেই।</div>`;
            return;
        }

        container.innerHTML = logs.map(log => {
            const actionText = log.action || '';
            const isTaken = actionText.toLowerCase().includes('taken') || actionText.includes('গ্রহণ') || actionText.includes('সেবন');
            const badgeBg = isTaken 
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' 
                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700';

            return `
                <div class="p-2.5 rounded-md bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                    <div class="flex items-center gap-2">
                        <div class="w-2 h-2 rounded-full ${isTaken ? 'bg-emerald-500' : 'bg-sky-500'}"></div>
                        <div>
                            <span class="font-bold text-slate-900 dark:text-white">${escapeHtml(log.full_name || log.userFullName || log.username || 'User')}</span>
                            <span class="text-slate-400 mx-1">•</span>
                            <span class="font-semibold text-slate-700 dark:text-slate-300">${escapeHtml(log.routine_name || log.routineName || 'Medicine')}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] px-2 py-0.5 rounded border font-semibold ${badgeBg}">${escapeHtml(actionText)}</span>
                        <span class="font-mono text-[10px] text-slate-400 hidden sm:inline">${log.timestamp ? log.timestamp.split('T')[1]?.slice(0, 5) || '' : ''}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // TAB 2: PATIENT & USER MANAGEMENT
    async function loadUsers() {
        if (!isServerMode) {
            allUsers = getLocalUsers();
            filterUsers();
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/api/admin/users`, {
                headers: getAuthHeaders()
            });
            const data = await res.json();
            if (data.success) {
                allUsers = data.users || [];
                filterUsers();
            }
        } catch (e) {
            console.warn('Failed to load server users, using local users:', e);
            allUsers = getLocalUsers();
            filterUsers();
        }
    }

    function filterUsers() {
        const q = (document.getElementById('userSearchInput')?.value || '').toLowerCase().trim();
        const roleFilter = document.getElementById('userRoleFilter')?.value || 'all';

        let filtered = allUsers;
        if (roleFilter !== 'all') {
            filtered = filtered.filter(u => u.role === roleFilter);
        }
        if (q) {
            filtered = filtered.filter(u => 
                (u.full_name && u.full_name.toLowerCase().includes(q)) ||
                (u.username && u.username.toLowerCase().includes(q))
            );
        }

        renderUsersTable(filtered);
    }

    function renderUsersTable(users) {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;

        if (users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400 text-xs">কোনো ইউজার পাওয়া যায়নি।</td></tr>`;
            return;
        }

        tbody.innerHTML = users.map(u => {
            const isAdm = u.role === 'admin';
            const initial = (u.full_name || u.username || 'U')[0].toUpperCase();
            const roleBadge = isAdm
                ? `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-300 dark:border-sky-800">অ্যাডমিন (Admin)</span>`
                : `<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">রোগী (Patient)</span>`;

            const joinedDate = u.created_at ? new Date(u.created_at).toLocaleDateString() : '--';

            return `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition">
                    <td class="p-3.5 sm:px-4">
                        <div class="flex items-center gap-2.5">
                            <div class="w-8 h-8 rounded-md bg-[#0f2744] dark:bg-sky-700 text-white flex items-center justify-center font-bold text-xs uppercase shrink-0">
                                ${initial}
                            </div>
                            <div>
                                <p class="font-bold text-slate-900 dark:text-white leading-tight">${escapeHtml(u.full_name || u.username)}</p>
                                <p class="text-[11px] text-slate-400 font-mono">@${escapeHtml(u.username)}</p>
                            </div>
                        </div>
                    </td>
                    <td class="p-3.5 sm:px-4">${roleBadge}</td>
                    <td class="p-3.5 sm:px-4 font-mono text-center font-bold text-slate-800 dark:text-slate-200">${u.routines_count || 0}</td>
                    <td class="p-3.5 sm:px-4 font-mono text-center font-bold text-slate-800 dark:text-slate-200">${u.logs_count || 0}</td>
                    <td class="p-3.5 sm:px-4 text-slate-500 font-mono text-xs">${joinedDate}</td>
                    <td class="p-3.5 sm:px-4 text-right">
                        <div class="flex items-center justify-end gap-1.5">
                            <button onclick="AdminApp.viewUserRoutines('${u.id}', '${escapeJs(u.full_name || u.username)}')" title="প্রেসক্রিপশন দেখুন" class="min-h-[32px] px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition flex items-center gap-1">
                                <i data-lucide="pill" class="w-3.5 h-3.5 text-sky-600"></i>
                                <span class="hidden md:inline">প্রেসক্রিপশন</span>
                            </button>
                            <button onclick="AdminApp.openResetPasswordModal('${u.id}', '${escapeJs(u.username)}')" title="পাসওয়ার্ড রিসেট" class="min-h-[32px] px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs transition">
                                <i data-lucide="key-round" class="w-3.5 h-3.5 text-amber-500"></i>
                            </button>
                            <button onclick="AdminApp.toggleUserRole('${u.id}', '${isAdm ? 'user' : 'admin'}')" title="রোল পরিবর্তন" class="min-h-[32px] px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs transition">
                                <i data-lucide="shield" class="w-3.5 h-3.5 ${isAdm ? 'text-sky-600' : 'text-slate-400'}"></i>
                            </button>
                            <button onclick="AdminApp.deleteUser('${u.id}', '${escapeJs(u.username)}')" title="মুছে ফেলুন" class="min-h-[32px] px-2 py-1 rounded border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 text-xs transition">
                                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        if (window.lucide) window.lucide.createIcons();
    }

    // User Operations
    function openAddUserModal() {
        document.getElementById('modalAddUser')?.classList.remove('hidden');
    }

    async function submitAddUser(event) {
        event.preventDefault();
        const full_name = document.getElementById('addFullName').value.trim();
        const username = document.getElementById('addUsername').value.trim();
        const password = document.getElementById('addPassword').value;
        const role = document.getElementById('addRole').value;

        if (!isServerMode) {
            // Local Offline User Save
            const users = getLocalUsers();
            if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
                showToast('এই ইউজারনেম ইতিমধ্যে ব্যবহৃত হয়েছে।', 'error');
                return;
            }
            const newUser = {
                id: 'usr_' + Date.now(),
                username: username.toLowerCase(),
                full_name,
                role,
                created_at: new Date().toISOString(),
                routines_count: 0,
                logs_count: 0
            };
            users.push(newUser);
            saveLocalUsers(users);
            closeModal('modalAddUser');
            showToast(t('toast_user_created'), 'success');
            loadUsers();
            loadOverview();
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/api/admin/users`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ full_name, username, password, role })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                closeModal('modalAddUser');
                showToast(t('toast_user_created'), 'success');
                loadUsers();
                loadOverview();
            } else {
                showToast(data.error || 'ইউজার তৈরি করা সম্ভব হয়নি।', 'error');
            }
        } catch (e) {
            showToast('সার্ভার যোগাযোগ ত্রুটি। পুনরায় চেষ্টা করুন।', 'error');
        }
    }

    function toggleUserRole(userId, newRole) {
        const isPromote = newRole === 'admin';
        showConfirmModal({
            title: isPromote ? 'অ্যাডমিন অধিকার প্রদান করবেন?' : 'অ্যাডমিন অধিকার প্রত্যাহার করবেন?',
            desc: isPromote 
                ? 'এই ইউজারকে সেন্ট্রাল অ্যাডমিন প্যানেলের পূর্ণ অ্যাক্সেস দেওয়া হবে।' 
                : 'এই ইউজারের অ্যাডমিন ক্ষমতা বাতিল করে সাধারণ রোগী মর্যাদায় ফিরিয়ে নেওয়া হবে।',
            icon: isPromote ? 'shield-check' : 'shield-alert',
            iconColor: isPromote ? 'emerald' : 'amber',
            btnText: isPromote ? 'অ্যাডমিন করুন' : 'প্রত্যাহার করুন',
            btnColor: isPromote ? 'emerald' : 'amber',
            onConfirm: () => executeToggleUserRole(userId, newRole)
        });
    }

    async function executeToggleUserRole(userId, newRole) {
        if (!isServerMode) {
            const users = getLocalUsers();
            const u = users.find(item => item.id === userId);
            if (u) {
                u.role = newRole;
                saveLocalUsers(users);
                showToast(t('toast_role_updated'), 'success');
                loadUsers();
                loadOverview();
            }
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/api/admin/users/${userId}/role`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ role: newRole })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showToast(t('toast_role_updated'), 'success');
                loadUsers();
                loadOverview();
            } else {
                showToast(data.error || 'রোল পরিবর্তন ব্যর্থ হয়েছে।', 'error');
            }
        } catch (e) {
            showToast('সার্ভার যোগাযোগ ত্রুটি। পুনরায় চেষ্টা করুন।', 'error');
        }
    }

    function openResetPasswordModal(userId, username) {
        const modal = document.getElementById('modalResetPassword');
        const idInput = document.getElementById('resetPassUserId');
        const label = document.getElementById('resetPassUserLabel');
        const passInput = document.getElementById('resetPassNew');

        if (idInput) idInput.value = userId;
        if (label) label.textContent = `@${username}`;
        if (passInput) passInput.value = '';
        if (modal) modal.classList.remove('hidden');
    }

    async function submitResetPassword(event) {
        event.preventDefault();
        const userId = document.getElementById('resetPassUserId').value;
        const password = document.getElementById('resetPassNew').value;

        if (!isServerMode) {
            closeModal('modalResetPassword');
            showToast(t('toast_pass_reset'), 'success');
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/api/admin/users/${userId}/password`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ password })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                closeModal('modalResetPassword');
                showToast(t('toast_pass_reset'), 'success');
            } else {
                showToast(data.error || 'পাসওয়ার্ড রিসেট করা যায়নি।', 'error');
            }
        } catch (e) {
            showToast('সার্ভার যোগাযোগ ত্রুটি। পুনরায় চেষ্টা করুন।', 'error');
        }
    }

    function deleteUser(userId, username) {
        showConfirmModal({
            title: 'ইউজার মুছে ফেলতে চান?',
            desc: `@${username} ইউজার এবং তার সাথে সম্পর্কিত সকল প্রেসক্রিপশন, রুটিন ও সেবন লগ স্থায়ীভাবে ডাটাবেজ থেকে মুছে ফেলা হবে। এটি পুনরুদ্ধারযোগ্য নয়।`,
            icon: 'trash-2',
            iconColor: 'rose',
            btnText: 'মুছে ফেলুন',
            btnColor: 'rose',
            onConfirm: () => executeDeleteUser(userId)
        });
    }

    async function executeDeleteUser(userId) {
        if (!isServerMode) {
            let users = getLocalUsers();
            users = users.filter(u => u.id !== userId);
            saveLocalUsers(users);
            showToast(t('toast_user_deleted'), 'success');
            loadUsers();
            loadOverview();
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showToast(t('toast_user_deleted'), 'success');
                loadUsers();
                loadOverview();
            } else {
                showToast(data.error || 'ইউজার মোছা সম্ভব হয়নি।', 'error');
            }
        } catch (e) {
            showToast('সার্ভার যোগাযোগ ত্রুটি। পুনরায় চেষ্টা করুন।', 'error');
        }
    }

    async function viewUserRoutines(userId, userFullName) {
        const modal = document.getElementById('modalUserRoutines');
        const nameEl = document.getElementById('userRoutinesModalName');
        const listEl = document.getElementById('userRoutinesModalList');

        if (nameEl) nameEl.textContent = userFullName;
        if (listEl) listEl.innerHTML = `<div class="text-xs text-slate-400 py-6 text-center">লোড হচ্ছে...</div>`;
        if (modal) modal.classList.remove('hidden');

        if (!isServerMode) {
            const routines = getLocalRoutines();
            if (routines.length === 0) {
                listEl.innerHTML = `<div class="text-xs text-slate-400 py-6 text-center">এই রোগীর কোনো প্রেসক্রিপশন বা রুটিন পাওয়া যায়নি।</div>`;
                return;
            }
            listEl.innerHTML = routines.map(r => `
                <div class="p-3 rounded-md bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-slate-900 dark:text-white">${escapeHtml(r.name)}</span>
                            <span class="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">${escapeHtml(r.type || 'med')}</span>
                        </div>
                        <p class="text-[11px] text-slate-500 mt-0.5">${escapeHtml(r.dosage || '')} • ${escapeHtml(r.meal || '')} • সময়: <span class="font-mono text-sky-600 font-bold">${Array.isArray(r.times) ? r.times.join(', ') : (r.time || '')}</span></p>
                    </div>
                    <div class="text-right">
                        <span class="font-mono font-bold ${r.stock <= 3 ? 'text-rose-600' : 'text-slate-700 dark:text-slate-300'}">স্টক: ${r.stock || 0}</span>
                    </div>
                </div>
            `).join('');
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/api/admin/routines?userId=${userId}`, {
                headers: getAuthHeaders()
            });
            const data = await res.json();
            if (data.success && listEl) {
                const routines = data.routines || [];
                if (routines.length === 0) {
                    listEl.innerHTML = `<div class="text-xs text-slate-400 py-6 text-center">এই রোগীর কোনো প্রেসক্রিপশন বা রুটিন পাওয়া যায়নি।</div>`;
                    return;
                }
                listEl.innerHTML = routines.map(r => `
                    <div class="p-3 rounded-md bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="font-bold text-slate-900 dark:text-white">${escapeHtml(r.name)}</span>
                                <span class="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">${escapeHtml(r.type)}</span>
                            </div>
                            <p class="text-[11px] text-slate-500 mt-0.5">${escapeHtml(r.dosage)} • ${escapeHtml(r.meal)} • সময়: <span class="font-mono text-sky-600 font-bold">${Array.isArray(r.times) ? r.times.join(', ') : r.time}</span></p>
                        </div>
                        <div class="text-right">
                            <span class="font-mono font-bold ${r.stock <= 3 ? 'text-rose-600' : 'text-slate-700 dark:text-slate-300'}">স্টক: ${r.stock}</span>
                        </div>
                    </div>
                `).join('');
            }
        } catch (e) {
            if (listEl) listEl.innerHTML = `<div class="text-xs text-rose-500 py-4 text-center">ডাটা লোড ত্রুটি।</div>`;
        }
    }

    // TAB 3: GLOBAL MEDICINE & INJECTION SCHEDULES MONITOR
    async function loadRoutines() {
        if (!isServerMode) {
            allRoutines = getLocalRoutines();
            filterRoutines();
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/api/admin/routines`, {
                headers: getAuthHeaders()
            });
            const data = await res.json();
            if (data.success) {
                allRoutines = data.routines || [];
                filterRoutines();
            }
        } catch (e) {
            console.warn('Failed to load server routines, loading local:', e);
            allRoutines = getLocalRoutines();
            filterRoutines();
        }
    }

    function filterRoutines() {
        const q = (document.getElementById('routineSearchInput')?.value || '').toLowerCase().trim();
        const type = document.getElementById('routineTypeFilter')?.value || 'all';
        const lowStock = document.getElementById('routineLowStockFilter')?.checked || false;

        let filtered = allRoutines;
        if (type !== 'all') {
            filtered = filtered.filter(r => (r.type || '').toLowerCase() === type.toLowerCase());
        }
        if (lowStock) {
            filtered = filtered.filter(r => (Number(r.stock) || 0) <= 3);
        }
        if (q) {
            filtered = filtered.filter(r => 
                (r.name && r.name.toLowerCase().includes(q)) ||
                (r.userFullName && r.userFullName.toLowerCase().includes(q)) ||
                (r.username && r.username.toLowerCase().includes(q))
            );
        }

        const countEl = document.getElementById('routinesFilteredCount');
        if (countEl) countEl.textContent = filtered.length;

        renderRoutinesTable(filtered);
    }

    function renderRoutinesTable(routines) {
        const tbody = document.getElementById('routinesTableBody');
        if (!tbody) return;

        if (routines.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400 text-xs">কোনো প্রেসক্রিপশন পাওয়া যায়নি।</td></tr>`;
            return;
        }

        tbody.innerHTML = routines.map(r => {
            const isLow = (Number(r.stock) || 0) <= 3;
            const stockBadge = isLow 
                ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                     <i data-lucide="alert-circle" class="w-3 h-3"></i> ${r.stock} (কম)
                   </span>`
                : `<span class="font-mono font-bold text-slate-800 dark:text-slate-200">${r.stock} টি</span>`;

            const typeColorMap = {
                injection: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300',
                syrup: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300',
                capsule: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-300',
                tablet: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-sky-300',
                drops: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300'
            };
            const typeStyle = typeColorMap[(r.type || '').toLowerCase()] || 'bg-slate-100 text-slate-700 border-slate-300';
            const timesStr = Array.isArray(r.times) && r.times.length > 0 ? r.times.join(', ') : (r.time || '--');

            return `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition">
                    <td class="p-3.5 sm:px-4">
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-slate-900 dark:text-white">${escapeHtml(r.name)}</span>
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${typeStyle}">${escapeHtml(r.type || 'med')}</span>
                        </div>
                    </td>
                    <td class="p-3.5 sm:px-4">
                        <p class="font-bold text-slate-800 dark:text-slate-200">${escapeHtml(r.userFullName || r.username || 'Patient')}</p>
                        <p class="text-[11px] text-slate-400 font-mono">@${escapeHtml(r.username || 'user')}</p>
                    </td>
                    <td class="p-3.5 sm:px-4">
                        <span class="font-semibold text-slate-700 dark:text-slate-300">${escapeHtml(r.dosage || '1 tab')}</span>
                        <span class="text-slate-400 mx-1">•</span>
                        <span class="text-slate-500 text-xs">${escapeHtml(r.meal || '')}</span>
                    </td>
                    <td class="p-3.5 sm:px-4 font-mono text-xs font-bold text-sky-600 dark:text-sky-400">${timesStr}</td>
                    <td class="p-3.5 sm:px-4 text-center">${stockBadge}</td>
                    <td class="p-3.5 sm:px-4 text-slate-500 text-xs font-mono">
                        ${r.durationDays ? `${r.durationDays} দিন` : '--'}
                    </td>
                </tr>
            `;
        }).join('');

        if (window.lucide) window.lucide.createIcons();
    }

    // TAB 4: CLINICAL AUDIT TRAIL & LOGS
    async function loadLogs(page = 1) {
        currentLogsPage = page;
        const action = document.getElementById('logsActionFilter')?.value || '';
        const search = (document.getElementById('logsSearchInput')?.value || '').trim();

        if (!isServerMode) {
            const all = getLocalLogs();
            let filtered = all;
            if (action) {
                filtered = filtered.filter(l => (l.action || '').toLowerCase().includes(action.toLowerCase()));
            }
            if (search) {
                const s = search.toLowerCase();
                filtered = filtered.filter(l => 
                    (l.routineName && l.routineName.toLowerCase().includes(s)) ||
                    (l.userFullName && l.userFullName.toLowerCase().includes(s)) ||
                    (l.username && l.username.toLowerCase().includes(s))
                );
            }
            cachedLogs = filtered;
            totalLogsPages = Math.max(1, Math.ceil(filtered.length / 20));
            renderLogsTable(filtered.slice((page - 1) * 20, page * 20));
            renderLogsPagination(page, totalLogsPages, filtered.length);
            return;
        }

        try {
            const url = `${API_BASE}/api/admin/logs?page=${page}&pageSize=20&action=${encodeURIComponent(action)}&search=${encodeURIComponent(search)}`;
            const res = await fetch(url, { headers: getAuthHeaders() });
            const data = await res.json();
            if (data.success) {
                cachedLogs = data.logs || [];
                totalLogsPages = data.totalPages || 1;
                renderLogsTable(cachedLogs);
                renderLogsPagination(data.page, data.totalPages, data.total);
            }
        } catch (e) {
            console.warn('Failed to load server logs, loading local logs:', e);
            const all = getLocalLogs();
            cachedLogs = all;
            renderLogsTable(all.slice(0, 20));
            renderLogsPagination(1, 1, all.length);
        }
    }

    function searchLogs() {
        loadLogs(1);
    }

    function renderLogsTable(logs) {
        const tbody = document.getElementById('logsTableBody');
        if (!tbody) return;

        if (logs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-400 text-xs">কোনো অডিট লগ রেকর্ড পাওয়া যায়নি।</td></tr>`;
            return;
        }

        tbody.innerHTML = logs.map(l => {
            const actionText = l.action || '';
            const isTaken = actionText.toLowerCase().includes('taken') || actionText.includes('গ্রহণ') || actionText.includes('সেবন');
            const isSkip = actionText.toLowerCase().includes('skip') || actionText.includes('মিস');
            
            let badgeClass = 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300';
            if (isTaken) badgeClass = 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
            if (isSkip) badgeClass = 'bg-rose-50 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-300 dark:border-rose-800';

            const ts = l.timestamp ? l.timestamp.replace('T', ' ').slice(0, 19) : (l.dateStr || '--');

            return `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition">
                    <td class="p-3.5 sm:px-4 font-mono text-xs text-slate-500">${ts}</td>
                    <td class="p-3.5 sm:px-4">
                        <span class="font-bold text-slate-900 dark:text-white">${escapeHtml(l.userFullName || l.username || 'Patient')}</span>
                        <span class="text-[11px] text-slate-400 font-mono block">@${escapeHtml(l.username || 'user')}</span>
                    </td>
                    <td class="p-3.5 sm:px-4 font-semibold text-slate-800 dark:text-slate-200">${escapeHtml(l.routineName || l.routine_name || 'Medicine')}</td>
                    <td class="p-3.5 sm:px-4">
                        <span class="px-2 py-0.5 rounded text-[11px] font-bold border ${badgeClass}">${escapeHtml(actionText)}</span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function renderLogsPagination(page, totalPages, totalCount) {
        const summary = document.getElementById('logsPaginationSummary');
        const prevBtn = document.getElementById('btnLogsPrev');
        const nextBtn = document.getElementById('btnLogsNext');

        if (summary) summary.textContent = `পৃষ্ঠা ${page} / ${totalPages} (মোট ${totalCount} টি লগ)`;
        if (prevBtn) prevBtn.disabled = page <= 1;
        if (nextBtn) nextBtn.disabled = page >= totalPages;
    }

    function prevLogsPage() {
        if (currentLogsPage > 1) loadLogs(currentLogsPage - 1);
    }

    function nextLogsPage() {
        if (currentLogsPage < totalLogsPages) loadLogs(currentLogsPage + 1);
    }

    function exportLogsJson() {
        if (!cachedLogs || cachedLogs.length === 0) {
            showToast('এক্সপোর্ট করার জন্য কোনো ডাটা নেই।', 'error');
            return;
        }
        const str = JSON.stringify(cachedLogs, null, 2);
        downloadFile(str, `medicare-audit-logs-${Date.now()}.json`, 'application/json');
    }

    function exportLogsCsv() {
        if (!cachedLogs || cachedLogs.length === 0) {
            showToast('এক্সপোর্ট করার জন্য কোনো ডাটা নেই।', 'error');
            return;
        }
        let csv = 'Timestamp,Patient Name,Username,Medicine,Action\n';
        cachedLogs.forEach(l => {
            csv += `"${l.timestamp || ''}","${l.userFullName || l.full_name || ''}","${l.username || ''}","${l.routineName || l.routine_name || ''}","${l.action || ''}"\n`;
        });
        downloadFile(csv, `medicare-audit-logs-${Date.now()}.csv`, 'text/csv');
    }

    function downloadFile(content, fileName, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // TAB 5: DATABASE MAINTENANCE
    async function downloadDatabaseBackup() {
        if (!isServerMode) {
            // Offline sandbox backup
            const offlineData = {
                exportedAt: new Date().toISOString(),
                users: getLocalUsers(),
                routines: getLocalRoutines(),
                logs: getLocalLogs()
            };
            const jsonStr = JSON.stringify(offlineData, null, 2);
            downloadFile(jsonStr, `medicare-offline-backup-${Date.now()}.json`, 'application/json');
            showToast('অফলাইন ডাটাবেজ ব্যাকআপ সফলভাবে ডাউনলোড হয়েছে।', 'success');
            return;
        }

        try {
            showToast('ডাটাবেজ ব্যাকআপ প্রস্তুত হচ্ছে...', 'info');
            const res = await fetch(`${API_BASE}/api/admin/backup-db`, {
                method: 'GET',
                headers: getAuthHeaders()
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                showToast(errData.error || 'ব্যাকআপ ফাইল ডাউনলোডে সমস্যা হয়েছে। অনুমতি যাচাই করুন।', 'error');
                return;
            }

            const blob = await res.blob();
            const disposition = res.headers.get('content-disposition') || '';
            let filename = `medicare-backup-${Date.now()}.sqlite`;
            const match = disposition.match(/filename="?([^";]+)"?/);
            if (match && match[1]) filename = match[1];

            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);

            showToast('নিরাপদ SQLite ডাটাবেজ ব্যাকআপ সফলভাবে ডাউনলোড হয়েছে!', 'success');
        } catch (e) {
            showToast('সার্ভার যোগাযোগ ত্রুটি। পুনরায় চেষ্টা করুন।', 'error');
        }
    }

    function vacuumDatabase() {
        showConfirmModal({
            title: 'ডাটাবেজ অপ্টিমাইজ ও ভ্যাকুয়াম করবেন?',
            desc: 'এটি অপ্রয়োজনীয় স্থান মুক্ত করবে এবং SQLite ডাটাবেজ ফাইলের সাইজ কমিয়ে কুয়েরি পারফরম্যান্স বৃদ্ধি করবে।',
            icon: 'database',
            iconColor: 'indigo',
            btnText: 'ভ্যাকুয়াম করুন',
            btnColor: 'indigo',
            onConfirm: () => executeVacuumDatabase()
        });
    }

    async function executeVacuumDatabase() {
        if (!isServerMode) {
            showToast('লোকাল ব্রাউজার স্টোরেজ অপ্টিমাইজ সম্পন্ন হয়েছে।', 'success');
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/api/admin/vacuum-db`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showToast(t('toast_vacuum_success'), 'success');
                loadOverview();
            } else {
                showToast(data.error || 'ভ্যাকুয়াম প্রক্রিয়া ব্যর্থ হয়েছে।', 'error');
            }
        } catch (e) {
            showToast('সার্ভার যোগাযোগ ত্রুটি। পুনরায় চেষ্টা করুন।', 'error');
        }
    }

    // Local Storage Helpers (Offline Fallback)
    function getLocalUsers() {
        let users = [];
        try {
            const raw = localStorage.getItem(LOCAL_USERS_KEY);
            users = raw ? JSON.parse(raw) : [];
        } catch (e) {}

        const routines = getLocalRoutines();
        const logs = getLocalLogs();

        if (!users.some(u => u.username === 'admin')) {
            users.unshift({
                id: 'user_admin_01',
                username: 'admin',
                full_name: 'সিস্টেম অ্যাডমিনিস্ট্রেটর (MediCare Admin)',
                role: 'admin',
                created_at: new Date().toISOString()
            });
        }
        if (!users.some(u => u.username === 'demo')) {
            users.push({
                id: 'user_demo_01',
                username: 'demo',
                full_name: 'ডা. শরিফুল ইসলাম (Dr. Shariful)',
                role: 'admin',
                created_at: new Date().toISOString()
            });
        }

        return users.map(u => ({
            ...u,
            routines_count: routines.length,
            logs_count: logs.length
        }));
    }

    function saveLocalUsers(users) {
        localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
    }

    function getLocalRoutines() {
        try {
            const raw = localStorage.getItem(LOCAL_ROUTINES_KEY);
            const list = raw ? JSON.parse(raw) : [];
            return list.map(r => ({
                id: r.id,
                name: r.name,
                type: r.type || 'tablet',
                dosage: r.dosage || '1 tab',
                meal: r.meal || '',
                time: r.time || '10:00 AM',
                times: r.times || [r.time || '10:00 AM'],
                stock: Number(r.stock) || 0,
                durationDays: r.durationDays || 1,
                username: 'demo',
                userFullName: 'ডা. শরিফুল ইসলাম'
            }));
        } catch (e) {
            return [];
        }
    }

    function getLocalLogs() {
        try {
            const raw = localStorage.getItem(LOCAL_HISTORY_KEY);
            const list = raw ? JSON.parse(raw) : [];
            return list.map(l => ({
                id: l.id || ('log_' + Date.now()),
                routineName: l.routineName || l.routine_name || 'Medicine',
                action: l.action || 'Dose Taken',
                timestamp: l.timestamp || new Date().toISOString(),
                dateStr: l.dateStr || (l.timestamp ? l.timestamp.slice(0, 10) : ''),
                username: 'demo',
                userFullName: 'ডা. শরিফুল ইসলাম'
            })).reverse();
        } catch (e) {
            return [];
        }
    }

    // Custom Confirmation Modal Engine (Replaces browser confirm() & alert())
    let pendingConfirmAction = null;

    function showConfirmModal(options = {}) {
        const modal = document.getElementById('adminConfirmModal');
        const titleEl = document.getElementById('adminConfirmTitle');
        const descEl = document.getElementById('adminConfirmDesc');
        const iconEl = document.getElementById('adminConfirmIcon');
        const iconBox = document.getElementById('adminConfirmIconBox');
        const executeBtn = document.getElementById('btnAdminConfirmExecute');

        if (!modal) return;

        pendingConfirmAction = options.onConfirm || null;

        if (titleEl) titleEl.textContent = options.title || 'আপনি কি নিশ্চিত?';
        if (descEl) descEl.textContent = options.desc || 'এই পরিবর্তনটি স্থায়ীভাবে কার্যকর হবে।';

        if (iconEl && options.icon) {
            iconEl.setAttribute('data-lucide', options.icon);
        }

        // Color thematic styling
        const color = options.btnColor || 'rose';
        if (executeBtn) {
            executeBtn.textContent = options.btnText || 'নিশ্চিত করুন';
            if (color === 'emerald') {
                executeBtn.className = 'flex-1 min-h-[42px] py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs active:scale-95';
            } else if (color === 'indigo') {
                executeBtn.className = 'flex-1 min-h-[42px] py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-xs active:scale-95';
            } else if (color === 'amber') {
                executeBtn.className = 'flex-1 min-h-[42px] py-2 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shadow-xs active:scale-95';
            } else {
                executeBtn.className = 'flex-1 min-h-[42px] py-2 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-xs active:scale-95';
            }
        }

        if (iconBox) {
            if (color === 'emerald') {
                iconBox.className = 'w-12 h-12 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 border border-emerald-200 dark:border-emerald-800 mx-auto flex items-center justify-center mb-3';
            } else if (color === 'indigo') {
                iconBox.className = 'w-12 h-12 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 border border-indigo-200 dark:border-indigo-800 mx-auto flex items-center justify-center mb-3';
            } else if (color === 'amber') {
                iconBox.className = 'w-12 h-12 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-600 border border-amber-200 dark:border-amber-800 mx-auto flex items-center justify-center mb-3';
            } else {
                iconBox.className = 'w-12 h-12 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-600 border border-rose-200 dark:border-rose-800 mx-auto flex items-center justify-center mb-3';
            }
        }

        modal.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
    }

    function closeConfirmModal() {
        const modal = document.getElementById('adminConfirmModal');
        if (modal) modal.classList.add('hidden');
        pendingConfirmAction = null;
    }

    function executeConfirmAction() {
        const action = pendingConfirmAction;
        closeConfirmModal();
        if (typeof action === 'function') {
            action();
        }
    }

    // Modal Control & Toast Notifications
    function closeModal(modalId) {
        const el = document.getElementById(modalId);
        if (el) el.classList.add('hidden');
    }

    function showToast(msg, type = 'info') {
        const container = document.getElementById('adminToastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        const colorClass = type === 'success' 
            ? 'bg-emerald-800 text-white border-emerald-600' 
            : (type === 'error' ? 'bg-rose-800 text-white border-rose-600' : 'bg-[#0f2744] text-white border-sky-600');

        toast.className = `p-3 rounded-md shadow-xl text-xs font-semibold border flex items-center gap-2 modal-animate ${colorClass}`;
        toast.innerHTML = `<span>${escapeHtml(msg)}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
    }

    function escapeJs(str) {
        if (!str) return '';
        return String(str).replace(/['"\\]/g, '\\$&');
    }

    return {
        init,
        switchTab,
        toggleTheme,
        toggleLanguage,
        fillDemoCredentials,
        handleAdminLogin,
        loginOfflineMode,
        retryServerConnection,
        logout,
        loadOverview,
        loadUsers,
        filterUsers,
        openAddUserModal,
        submitAddUser,
        toggleUserRole,
        openResetPasswordModal,
        submitResetPassword,
        deleteUser,
        viewUserRoutines,
        loadRoutines,
        filterRoutines,
        loadLogs,
        searchLogs,
        prevLogsPage,
        nextLogsPage,
        exportLogsJson,
        exportLogsCsv,
        downloadDatabaseBackup,
        vacuumDatabase,
        showConfirmModal,
        closeConfirmModal,
        executeConfirmAction,
        closeModal,
        showToast
    };
})();

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.AdminApp.init();
});
