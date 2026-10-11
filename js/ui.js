/**
 * MediCare - Production-Ready UI View & Presentation Controller
 */

window.MediCareUI = (function () {
    let pendingDeleteId = null;

    function escapeHtml(text) {
        if (!text) return '';
        return String(text).replace(/[&<>"']/g, function (m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
        });
    }

    function formatBengaliTime(timeStr) {
        if (window.MediCareI18n) {
            return window.MediCareI18n.formatTime(timeStr);
        }
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':');
        const hour = parseInt(h, 10);
        return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
    }

    function getTimeOfDayBadge(timeStr) {
        if (window.MediCareI18n) {
            return window.MediCareI18n.getTimeOfDayBadge(timeStr);
        }
        return '';
    }

    function getGreetingText() {
        if (window.MediCareI18n) {
            return window.MediCareI18n.getGreetingText();
        }
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return 'শুভ সকাল!';
        if (hour >= 12 && hour < 16) return 'শুভ দুপুর!';
        if (hour >= 16 && hour < 19) return 'শুভ বিকেল!';
        return 'শুভ রাত্রি!';
    }

    function getTypeIcon(type) {
        const mapping = window.MediCareConfig ? window.MediCareConfig.TYPE_MAPPINGS : {};
        const config = mapping[type] || mapping.other || { icon: 'pill', iconColor: 'text-teal-500' };
        return `<i data-lucide="${config.icon}" class="w-5 h-5 ${config.iconColor}"></i>`;
    }

    function getTypeBadge(type) {
        const mapping = window.MediCareConfig ? window.MediCareConfig.TYPE_MAPPINGS : {};
        const config = mapping[type] || mapping.other || { label: 'অন্যান্য', color: 'bg-slate-50 text-slate-700 border-slate-200' };
        const label = window.MediCareI18n ? window.MediCareI18n.t(`type_${type}`, config.label) : config.label;
        return `<span class="text-[11px] font-semibold px-2 py-0.5 rounded border ${config.color}">${label}</span>`;
    }

    // ==========================================
    // TOAST NOTIFICATION SYSTEM
    // ==========================================
    function showToast(message, type = 'success') {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const item = document.createElement('div');
        item.className = `toast-item toast-${type}`;
        
        let iconName = 'check-circle-2';
        if (type === 'danger') iconName = 'alert-triangle';
        if (type === 'info') iconName = 'info';

        item.innerHTML = `
            <i data-lucide="${iconName}" class="w-4 h-4 shrink-0"></i>
            <span>${escapeHtml(message)}</span>
        `;
        container.appendChild(item);
        if (window.lucide) window.lucide.createIcons();

        setTimeout(() => {
            item.style.opacity = '0';
            item.style.transform = 'translateY(12px) scale(0.95)';
            setTimeout(() => item.remove(), 300);
        }, 3200);
    }

    // ==========================================
    // THEME CONTROLLER (DARK / LIGHT)
    // ==========================================
    function initTheme() {
        const savedTheme = localStorage.getItem('medicare_theme_mode');
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        updateThemeToggleIcon();
    }

    function toggleTheme() {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('medicare_theme_mode', isDark ? 'dark' : 'light');
        updateThemeToggleIcon();
        const msg = window.MediCareI18n ? window.MediCareI18n.t(isDark ? 'toast_dark_on' : 'toast_light_on') : (isDark ? 'ডার্ক মোড সক্রিয় হয়েছে' : 'লাইট মোড সক্রিয় হয়েছে');
        showToast(msg, 'info');
    }

    function updateThemeToggleIcon() {
        const icon = document.getElementById('themeIcon');
        if (!icon) return;
        const isDark = document.documentElement.classList.contains('dark');
        icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
        if (window.lucide) window.lucide.createIcons();
    }

    // ==========================================
    // FONT / TYPOGRAPHY (ANEK BANGLA)
    // ==========================================
    function initFont() {
        document.body.style.fontFamily = "'Anek Bangla', 'Plus Jakarta Sans', sans-serif";
    }

    function setFont() {
        initFont();
    }

    function cycleFont() {
        // No-op: user requested sole Anek Bangla font
    }

    // ==========================================
    // TAB NAVIGATION (DESKTOP & MOBILE BOTTOM BAR)
    // ==========================================
    function switchTab(tabId) {
        window.MediCareStore.setCurrentTab(tabId);
        
        // Hide all views
        document.querySelectorAll('.app-view').forEach(view => view.classList.add('hidden'));
        
        // Show target view
        const targetView = document.getElementById(`view-${tabId}`);
        if (targetView) targetView.classList.remove('hidden');

        // Update nav tabs styling (desktop)
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        const activeBtn = document.getElementById(`tab-${tabId}`);
        if (activeBtn) activeBtn.classList.add('active');

        // Update mobile bottom bar styling
        document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
            btn.classList.remove('active', 'text-teal-600', 'dark:text-teal-400');
            btn.classList.add('text-slate-500', 'dark:text-slate-400');
        });
        const mobileActiveBtn = document.getElementById(`mobile-tab-${tabId}`);
        if (mobileActiveBtn) {
            mobileActiveBtn.classList.add('active', 'text-teal-600', 'dark:text-teal-400');
            mobileActiveBtn.classList.remove('text-slate-500', 'dark:text-slate-400');
        }

        // Refresh dynamic content for the specific tab
        if (tabId === 'schedule') {
            renderRoutines();
        } else if (tabId === 'history') {
            initHistorySearch();
            renderHistoryView();
        } else if (tabId === 'tools') {
            window.MediCareTools.renderHydrationUI();
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (window.lucide) window.lucide.createIcons();
    }

    // ==========================================
    // ROUTINES RENDERING
    // ==========================================
    function renderRoutines() {
        const listEl = document.getElementById('medicineList');
        const emptyEl = document.getElementById('emptyState');
        if (!listEl) return;

        listEl.innerHTML = '';
        const filtered = window.MediCareStore.getFilteredRoutines();
        const stats = window.MediCareStore.getStats();

        // Update Counter Stats & Progress Bar
        const statTotal = document.getElementById('statTotal');
        const statPending = document.getElementById('statPending');
        const statTaken = document.getElementById('statTaken');
        const statPercent = document.getElementById('statPercent');
        const progressBar = document.getElementById('dailyProgressBar');
        const greetingEl = document.getElementById('heroGreetingText');

        if (greetingEl) greetingEl.textContent = getGreetingText();
        if (statTotal) statTotal.textContent = stats.total;
        if (statPending) statPending.textContent = stats.pending;
        if (statTaken) statTaken.textContent = stats.taken;
        if (statPercent) statPercent.textContent = `${stats.percentage}%`;
        if (progressBar) progressBar.style.width = `${stats.percentage}%`;

        if (filtered.length === 0) {
            if (emptyEl) emptyEl.classList.remove('hidden');
            return;
        }
        if (emptyEl) emptyEl.classList.add('hidden');

        const t = (k, def) => window.MediCareI18n ? window.MediCareI18n.t(k, def) : def;
        const dosageLabel = t('dosage_label', 'পরিমাণ:');
        const mealLabel = t('meal_label', 'নির্দেশনা:');
        const stockLabel = t('stock_label', 'স্টক:');
        const stockOutLabel = t('stock_out', '❌ স্টক শেষ');
        const notePrefix = t('note_prefix', 'নোট:');
        const btnTaken = t('btn_taken', 'খেয়েছি');
        const btnUndo = t('btn_undo', 'আনডু');
        const btnEdit = t('btn_edit', 'সম্পাদনা করুন');
        const btnDelete = t('btn_delete', 'ডিলিট করুন');

        filtered.forEach(item => {
            const card = document.createElement('div');
            const isLowStock = item.stock !== undefined && item.stock !== '' && Number(item.stock) <= 3;
            const isOutOfStock = item.stock !== undefined && item.stock !== '' && Number(item.stock) === 0;

            card.className = `med-card p-3.5 sm:p-4 rounded-md ${
                item.takenToday 
                    ? 'bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800' 
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs'
            } transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5`;

            card.innerHTML = `
                <div class="flex items-start gap-3 flex-1 min-w-0">
                    <div class="w-11 h-11 rounded-md flex items-center justify-center shrink-0 border ${
                        item.takenToday 
                            ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400' 
                            : 'bg-sky-50 dark:bg-sky-950/60 border-sky-200/70 dark:border-sky-800/60 text-[#0284c7] dark:text-sky-400'
                    }">
                        ${getTypeIcon(item.type)}
                    </div>
                    <div class="space-y-1 min-w-0 flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <h3 class="font-bold text-sm sm:text-base truncate ${item.takenToday ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}">
                                ${escapeHtml(item.name)}
                            </h3>
                            ${getTypeBadge(item.type)}
                            ${getTimeOfDayBadge(item.time)}
                            <span class="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-mono border border-slate-200 dark:border-slate-700">
                                ⏰ ${formatBengaliTime(item.time)}
                            </span>
                        </div>
                        <div class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium flex-wrap pt-0.5">
                            <span><b>${dosageLabel}</b> ${escapeHtml(item.dosage)}</span>
                            <span>•</span>
                            <span><b>${mealLabel}</b> ${escapeHtml(item.meal)}</span>
                            ${item.stock !== undefined && item.stock !== '' ? `
                                <span>•</span>
                                <span class="${isLowStock ? 'text-rose-600 dark:text-rose-400 font-bold low-stock-badge' : ''}">
                                    ${isOutOfStock ? stockOutLabel : `${stockLabel} ${escapeHtml(item.stock)}`}
                                </span>
                            ` : ''}
                        </div>
                        ${item.notes ? `<p class="text-[11px] text-slate-400 dark:text-slate-500 italic font-normal truncate">${notePrefix} ${escapeHtml(item.notes)}</p>` : ''}
                    </div>
                </div>

                <div class="flex items-center gap-2 self-stretch sm:self-center shrink-0 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-0 border-slate-100 dark:border-slate-800">
                    ${!item.takenToday ? `
                        <button onclick="window.MediCareApp.markAsTaken('${item.id}')" class="flex-1 sm:flex-initial min-h-[44px] px-4 py-2.5 rounded-md bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 active:scale-95">
                            <i data-lucide="check" class="w-4 h-4 stroke-[2.5]"></i>
                            ${btnTaken}
                        </button>
                    ` : `
                        <button onclick="window.MediCareApp.markAsUndo('${item.id}')" class="flex-1 sm:flex-initial min-h-[44px] px-3.5 py-2.5 rounded-md border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition flex items-center justify-center gap-1 active:scale-95">
                            <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                            ${btnUndo}
                        </button>
                    `}
                    <button onclick="window.MediCareUI.openModal('${item.id}')" title="${btnEdit}" class="min-h-[44px] min-w-[44px] p-2.5 rounded-md border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-[#0284c7] hover:border-[#0284c7] hover:bg-sky-50 dark:hover:bg-sky-950/40 transition flex items-center justify-center active:scale-95">
                        <i data-lucide="edit-3" class="w-4 h-4"></i>
                    </button>
                    <button onclick="window.MediCareUI.confirmDelete('${item.id}', '${escapeHtml(item.name)}')" title="${btnDelete}" class="min-h-[44px] min-w-[44px] p-2.5 rounded-md border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-rose-600 hover:border-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition flex items-center justify-center active:scale-95">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            `;

            listEl.appendChild(card);
        });

        if (window.lucide) window.lucide.createIcons();
    }

    // ==========================================
    // HISTORY LOGS VIEW & 20-ITEM PAGINATION (MAIN APP CARD ARCHITECTURE)
    // ==========================================
    let currentHistoryPage = 1;
    let currentHistoryFilter = 'all'; // 'all' | 'taken' | 'changes'
    let historySearchQuery = '';
    const HISTORY_PAGE_SIZE = 20;

    function getActionDisplayDetails(action) {
        const t = (k, def) => window.MediCareI18n ? window.MediCareI18n.t(k, def) : def;
        const act = String(action || '');

        if (act === 'action_taken' || act.includes('গ্রহণ') || act.includes('taken')) {
            return {
                label: t('log_action_taken', 'ডোজ গ্রহণ করা হয়েছে'),
                icon: 'check-circle-2',
                badgeClass: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
                textClass: 'text-emerald-700 dark:text-emerald-300'
            };
        }
        if (act === 'action_undo' || act.includes('আনডু') || act.includes('undo')) {
            return {
                label: t('log_action_undo', 'ডোজ আনডু করা হয়েছে'),
                icon: 'rotate-ccw',
                badgeClass: 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300',
                textClass: 'text-amber-700 dark:text-amber-300'
            };
        }
        if (act === 'action_added' || act.includes('যুক্ত') || act.includes('added')) {
            return {
                label: t('log_action_added', 'নতুন রুটিন যুক্ত করা হয়েছে'),
                icon: 'plus-circle',
                badgeClass: 'bg-sky-50 dark:bg-sky-950/60 border-sky-300 dark:border-sky-800 text-[#0284c7] dark:text-sky-300',
                textClass: 'text-[#0284c7] dark:text-sky-300'
            };
        }
        if (act === 'action_updated' || act.includes('আপডেট') || act.includes('updated')) {
            return {
                label: t('log_action_updated', 'রুটিন তথ্য আপডেট করা হয়েছে'),
                icon: 'edit-3',
                badgeClass: 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300',
                textClass: 'text-indigo-700 dark:text-indigo-300'
            };
        }
        if (act === 'action_deleted' || act.includes('মুছে') || act.includes('deleted')) {
            return {
                label: t('log_action_deleted', 'রুটিন মুছে ফেলা হয়েছে'),
                icon: 'trash-2',
                badgeClass: 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300',
                textClass: 'text-rose-700 dark:text-rose-300'
            };
        }
        return {
            label: act,
            icon: 'activity',
            badgeClass: 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300',
            textClass: 'text-slate-700 dark:text-slate-300'
        };
    }

    function setHistoryFilter(filter) {
        currentHistoryFilter = filter;
        currentHistoryPage = 1;
        document.querySelectorAll('.history-filter-tab').forEach(tab => {
            tab.classList.remove('bg-white', 'text-slate-900', 'shadow-xs', 'dark:bg-slate-700', 'dark:text-white');
            tab.classList.add('text-slate-600', 'dark:text-slate-400');
        });
        const selected = document.getElementById(`history-filter-${filter}`);
        if (selected) {
            selected.classList.add('bg-white', 'text-slate-900', 'shadow-xs', 'dark:bg-slate-700', 'dark:text-white');
            selected.classList.remove('text-slate-600', 'dark:text-slate-400');
        }
        renderHistoryView();
    }

    function initHistorySearch() {
        const input = document.getElementById('historySearchInput');
        if (input && !input.dataset.bound) {
            input.dataset.bound = 'true';
            input.addEventListener('input', (e) => {
                historySearchQuery = e.target.value.trim().toLowerCase();
                currentHistoryPage = 1;
                renderHistoryView();
            });
        }
    }

    function changeHistoryPage(page) {
        currentHistoryPage = Math.max(1, parseInt(page, 10) || 1);
        renderHistoryView();
        const historyView = document.getElementById('view-history');
        if (historyView) {
            historyView.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function clearHistoryLogsPrompt() {
        const modal = document.getElementById('clearHistoryConfirmModal');
        if (modal) {
            modal.classList.remove('hidden');
            if (window.lucide) window.lucide.createIcons();
        }
    }

    function closeClearHistoryModal() {
        const modal = document.getElementById('clearHistoryConfirmModal');
        if (modal) modal.classList.add('hidden');
    }

    function executeClearHistoryLogs() {
        if (window.MediCareStore) {
            window.MediCareStore.clearHistoryLogs();
        }
        currentHistoryPage = 1;
        closeClearHistoryModal();
        renderHistoryView();
        const msg = window.MediCareI18n ? window.MediCareI18n.t('toast_history_cleared') : 'সমস্ত সেবনের ইতিহাস সফলভাবে মুছে ফেলা হয়েছে';
        showToast(msg, 'danger');
    }

    function renderHistoryView() {
        const historyContainer = document.getElementById('historyList');
        const paginationContainer = document.getElementById('historyPagination');
        const statsBadge = document.getElementById('historyStatsBadge');
        const clearBtn = document.getElementById('clearHistoryBtn');
        if (!historyContainer) return;

        // Fetch logs
        const pagedData = window.MediCareStore ? window.MediCareStore.getHistoryLogsPaged(1, 1000) : { logs: [] };
        let allLogs = (pagedData && pagedData.logs) ? pagedData.logs : [];

        // Apply Tab Filter
        if (currentHistoryFilter === 'taken') {
            allLogs = allLogs.filter(l => (l.action || '').includes('taken') || (l.action || '').includes('গ্রহণ'));
        } else if (currentHistoryFilter === 'changes') {
            allLogs = allLogs.filter(l => !(l.action || '').includes('taken') && !(l.action || '').includes('গ্রহণ'));
        }

        // Apply Search Filter
        if (historySearchQuery) {
            const q = historySearchQuery.toLowerCase();
            allLogs = allLogs.filter(l => 
                (l.routine_name || '').toLowerCase().includes(q) ||
                (l.action || '').toLowerCase().includes(q) ||
                (l.date_str || '').toLowerCase().includes(q) ||
                (l.timestamp || '').toLowerCase().includes(q)
            );
        }

        const total = allLogs.length;
        const totalPages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
        currentHistoryPage = Math.min(Math.max(1, currentHistoryPage), totalPages);
        const startIndex = (currentHistoryPage - 1) * HISTORY_PAGE_SIZE;
        const logs = allLogs.slice(startIndex, startIndex + HISTORY_PAGE_SIZE);

        const fmtNum = (n) => window.MediCareI18n ? window.MediCareI18n.formatNumber(n) : String(n);
        const t = (k, def) => window.MediCareI18n ? window.MediCareI18n.t(k, def) : def;
        const dosageLabel = t('dosage_label', 'পরিমাণ:');
        const mealLabel = t('meal_label', 'নির্দেশনা:');

        // Update stats badge
        if (statsBadge) {
            if (total > 0) {
                statsBadge.textContent = t('history_total_badge', `মোট ${total}টি লগ (২০টি/পৃষ্ঠা)`).replace('{total}', fmtNum(total));
                statsBadge.classList.remove('hidden');
            } else {
                statsBadge.classList.add('hidden');
            }
        }

        // Update clear button
        if (clearBtn) {
            if (total > 0) {
                clearBtn.classList.remove('hidden');
            } else {
                clearBtn.classList.add('hidden');
            }
        }

        historyContainer.innerHTML = '';

        if (total === 0 || logs.length === 0) {
            const emptyTitle = t('history_empty_title', 'এখনো কোনো সেবনের ইতিহাস রেকর্ড হয়নি।');
            const emptySub = t('history_empty_subtitle', 'ঔষধ গ্রহণ বা আনডু করলে তা স্বয়ংক্রিয়ভাবে এখানে তালিকাভুক্ত হবে।');
            historyContainer.innerHTML = `
                <div class="med-card text-center py-12 px-4 rounded-md border border-dashed border-slate-300 dark:border-slate-800 text-slate-400">
                    <i data-lucide="history" class="w-10 h-10 mx-auto mb-2 text-slate-400 dark:text-slate-600"></i>
                    <p class="text-sm font-bold text-slate-700 dark:text-slate-300">${emptyTitle}</p>
                    <p class="text-xs text-slate-500 mt-1">${emptySub}</p>
                </div>
            `;
            if (paginationContainer) paginationContainer.innerHTML = '';
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        // Render Cards identical to Main App med-card layout
        logs.forEach((log, idx) => {
            const globalIndex = total - (startIndex + idx);
            const actionInfo = getActionDisplayDetails(log.action);
            const routine = window.MediCareStore ? window.MediCareStore.getRoutineById(log.routine_id) : null;

            const card = document.createElement('div');
            card.className = 'med-card p-3.5 sm:p-4 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5';
            
            card.innerHTML = `
                <div class="flex items-start gap-3 flex-1 min-w-0">
                    <div class="w-11 h-11 rounded-md flex items-center justify-center shrink-0 border ${actionInfo.badgeClass}">
                        <i data-lucide="${actionInfo.icon}" class="w-5 h-5 stroke-[2.2]"></i>
                    </div>
                    <div class="space-y-1 min-w-0 flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <h3 class="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                                ${escapeHtml(log.routine_name || 'ঔষধ')}
                            </h3>
                            ${routine ? getTypeBadge(routine.type) : ''}
                            <span class="text-xs font-semibold px-2 py-0.5 rounded border ${actionInfo.badgeClass}">
                                ${escapeHtml(actionInfo.label)}
                            </span>
                            <span class="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                #${fmtNum(globalIndex)}
                            </span>
                        </div>
                        <div class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium flex-wrap pt-0.5">
                            ${routine ? `
                                <span><b>${dosageLabel}</b> ${escapeHtml(routine.dosage)}</span>
                                <span>•</span>
                                <span><b>${mealLabel}</b> ${escapeHtml(routine.meal)}</span>
                            ` : `
                                <span>${escapeHtml(actionInfo.label)}</span>
                            `}
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-2 self-stretch sm:self-center shrink-0 justify-end pt-2 sm:pt-0 border-t sm:border-0 border-slate-100 dark:border-slate-800">
                    <span class="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                        <i data-lucide="clock" class="w-3.5 h-3.5 text-[#0284c7] dark:text-sky-400"></i>
                        <span>${escapeHtml(log.timestamp || '')}</span>
                    </span>
                    <span class="text-xs font-semibold px-2.5 py-1 rounded bg-sky-50 dark:bg-sky-950/60 text-[#0284c7] dark:text-sky-300 border border-sky-200 dark:border-sky-800 flex items-center gap-1.5">
                        <i data-lucide="calendar" class="w-3.5 h-3.5"></i>
                        <span>${escapeHtml(log.date_str || '')}</span>
                    </span>
                </div>
            `;
            historyContainer.appendChild(card);
        });

        // Render Pagination (Main app style)
        if (paginationContainer) {
            const startItem = startIndex + 1;
            const endItem = Math.min(startIndex + logs.length, total);

            const showingText = t('history_showing', `দেখাচ্ছে ${startItem} - ${endItem} (মোট ${total}টি লগ)`)
                .replace('{from}', fmtNum(startItem))
                .replace('{to}', fmtNum(endItem))
                .replace('{total}', fmtNum(total));

            const pageInfoText = t('history_page_info', `পৃষ্ঠা ${currentHistoryPage} / ${totalPages}`)
                .replace('{current}', fmtNum(currentHistoryPage))
                .replace('{total}', fmtNum(totalPages));

            let pageButtonsHtml = '';
            for (let i = 1; i <= totalPages; i++) {
                if (i === 1 || i === totalPages || (i >= currentHistoryPage - 2 && i <= currentHistoryPage + 2)) {
                    const isActive = i === currentHistoryPage;
                    pageButtonsHtml += `
                        <button onclick="window.MediCareUI.changeHistoryPage(${i})" class="min-h-[44px] min-w-[44px] px-3 rounded-md border text-xs sm:text-sm font-bold transition flex items-center justify-center active:scale-95 ${isActive ? 'bg-[#0f2744] dark:bg-[#0284c7] text-white border-transparent shadow-xs' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'}">
                            ${fmtNum(i)}
                        </button>
                    `;
                } else if (i === currentHistoryPage - 3 || i === currentHistoryPage + 3) {
                    pageButtonsHtml += `<span class="px-1 text-slate-400 font-bold select-none">...</span>`;
                }
            }

            paginationContainer.innerHTML = `
                <div class="med-card p-3.5 sm:p-4 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
                    <div class="text-slate-700 dark:text-slate-300 font-semibold text-center sm:text-left flex items-center gap-2 flex-wrap">
                        <span>${showingText}</span>
                        <span class="text-slate-300 dark:text-slate-700">•</span>
                        <span class="px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/60 text-[#0284c7] dark:text-sky-300 border border-sky-200 dark:border-sky-800 font-bold">${pageInfoText}</span>
                    </div>

                    <div class="flex items-center gap-1.5 flex-wrap justify-center">
                        <button onclick="window.MediCareUI.changeHistoryPage(${currentHistoryPage - 1})"
                                ${currentHistoryPage <= 1 ? 'disabled' : ''}
                                class="min-h-[44px] px-3.5 rounded-md border text-xs font-bold transition flex items-center gap-1.5 active:scale-95 ${currentHistoryPage <= 1 ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-800' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-xs'}">
                            <i data-lucide="chevron-left" class="w-4 h-4 stroke-[2.4]"></i>
                            <span>${t('pagination_prev', 'পূর্ববর্তী')}</span>
                        </button>

                        <div class="flex items-center gap-1">
                            ${pageButtonsHtml}
                        </div>

                        <button onclick="window.MediCareUI.changeHistoryPage(${currentHistoryPage + 1})"
                                ${currentHistoryPage >= totalPages ? 'disabled' : ''}
                                class="min-h-[44px] px-3.5 rounded-md border text-xs font-bold transition flex items-center gap-1.5 active:scale-95 ${currentHistoryPage >= totalPages ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-800' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-xs'}">
                            <span>${t('pagination_next', 'পরবর্তী')}</span>
                            <i data-lucide="chevron-right" class="w-4 h-4 stroke-[2.4]"></i>
                        </button>
                    </div>
                </div>
            `;
        }

        if (window.lucide) window.lucide.createIcons();
    }

    // ==========================================
    // ROUTINE ADD / EDIT MODAL
    // ==========================================
    function openModal(editId = null) {
        const form = document.getElementById('routineForm');
        const modalTitle = document.getElementById('routineModalTitle');
        const editingIdInput = document.getElementById('editingRoutineId');

        if (form) form.reset();

        if (editId) {
            const routine = window.MediCareStore.getRoutineById(editId);
            if (routine) {
                if (modalTitle) modalTitle.textContent = window.MediCareI18n ? window.MediCareI18n.t('modal_edit_title') : 'ঔষধের তথ্য সম্পাদনা করুন';
                if (editingIdInput) editingIdInput.value = editId;

                document.getElementById('medName').value = routine.name || '';
                document.getElementById('medDosage').value = routine.dosage || '';
                document.getElementById('medMeal').value = routine.meal || 'খাবারের পরে (After Meal)';
                document.getElementById('medTime').value = routine.time || '08:00';
                document.getElementById('medStock').value = routine.stock !== undefined ? routine.stock : '';
                document.getElementById('medNotes').value = routine.notes || '';

                const typeRadio = document.querySelector(`input[name="medType"][value="${routine.type}"]`);
                if (typeRadio) typeRadio.checked = true;
            }
        } else {
            if (modalTitle) modalTitle.textContent = window.MediCareI18n ? window.MediCareI18n.t('modal_add_title') : 'নতুন ঔষধ / ইনজেকশন যোগ করুন';
            if (editingIdInput) editingIdInput.value = '';

            const now = new Date();
            const nextHour = String((now.getHours() + 1) % 24).padStart(2, '0') + ':00';
            const timeInput = document.getElementById('medTime');
            if (timeInput) timeInput.value = nextHour;
        }

        const modal = document.getElementById('medicineModal');
        if (modal) modal.classList.remove('hidden');
    }

    function closeModal() {
        const modal = document.getElementById('medicineModal');
        if (modal) modal.classList.add('hidden');
    }

    // ==========================================
    // DELETE CONFIRMATION DIALOG
    // ==========================================
    function confirmDelete(id, name) {
        pendingDeleteId = id;
        const modal = document.getElementById('deleteConfirmModal');
        const nameEl = document.getElementById('deleteConfirmMedName');
        if (nameEl) nameEl.textContent = name;
        if (modal) modal.classList.remove('hidden');
    }

    function closeDeleteConfirmModal() {
        const modal = document.getElementById('deleteConfirmModal');
        if (modal) modal.classList.add('hidden');
        pendingDeleteId = null;
    }

    function executePendingDelete() {
        if (pendingDeleteId) {
            window.MediCareApp.deleteRoutine(pendingDeleteId);
            closeDeleteConfirmModal();
            const msg = window.MediCareI18n ? window.MediCareI18n.t('toast_deleted') : 'রুটিনটি সফলভাবে মুছে ফেলা হয়েছে';
            showToast(msg, 'danger');
        }
    }

    function setFilter(filter) {
        window.MediCareStore.setActiveFilter(filter);
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.classList.remove('bg-white', 'text-slate-900', 'shadow-sm', 'dark:bg-slate-700', 'dark:text-white');
            tab.classList.add('text-slate-600', 'dark:text-slate-400');
        });
        const selected = document.getElementById(`filter-${filter}`);
        if (selected) {
            selected.classList.add('bg-white', 'text-slate-900', 'shadow-sm', 'dark:bg-slate-700', 'dark:text-white');
            selected.classList.remove('text-slate-600', 'dark:text-slate-400');
        }
        renderRoutines();
    }

    function setQuickTime(timeStr) {
        const timeInput = document.getElementById('medTime');
        if (timeInput) timeInput.value = timeStr;
    }

    function showAlarmModal(item, onTaken) {
        const modal = document.getElementById('alarmAlertModal');
        const nameEl = document.getElementById('alarmMedName');
        const detailsEl = document.getElementById('alarmMedDetails');
        const timeEl = document.getElementById('alarmMedTime');
        const takeBtn = document.getElementById('alarmTakeBtn');

        if (nameEl) nameEl.textContent = item.name;
        if (detailsEl) detailsEl.textContent = `${item.dosage} • ${item.meal}`;
        if (timeEl) {
            const prefix = window.MediCareI18n ? window.MediCareI18n.t('alarm_time_prefix') : 'নির্ধারিত সময়:';
            timeEl.textContent = `${prefix} ${formatBengaliTime(item.time)}`;
        }

        if (takeBtn) {
            takeBtn.onclick = () => {
                if (typeof onTaken === 'function') onTaken();
                dismissAlarmModal();
                const msg = window.MediCareI18n ? window.MediCareI18n.t('toast_taken') : 'সেবন সফলভাবে সম্পন্ন হয়েছে!';
                showToast(msg, 'success');
            };
        }

        if (modal) modal.classList.remove('hidden');
    }

    function dismissAlarmModal() {
        const modal = document.getElementById('alarmAlertModal');
        if (modal) modal.classList.add('hidden');
        window.MediCareAudio.stopContinuousAlarm();
    }

    return {
        escapeHtml,
        formatBengaliTime,
        getTimeOfDayBadge,
        getTypeIcon,
        getTypeBadge,
        showToast,
        initTheme,
        toggleTheme,
        initFont,
        setFont,
        cycleFont,
        switchTab,
        renderRoutines,
        renderHistoryView,
        changeHistoryPage,
        clearHistoryLogsPrompt,
        closeClearHistoryModal,
        executeClearHistoryLogs,
        setHistoryFilter,
        initHistorySearch,
        openModal,
        closeModal,
        confirmDelete,
        closeDeleteConfirmModal,
        executePendingDelete,
        setFilter,
        setQuickTime,
        showAlarmModal,
        dismissAlarmModal
    };
})();

// Global alias bindings
window.openModal = window.MediCareUI.openModal;
window.closeModal = window.MediCareUI.closeModal;
window.setFilter = window.MediCareUI.setFilter;
window.setQuickTime = window.MediCareUI.setQuickTime;
window.dismissAlarm = window.MediCareUI.dismissAlarmModal;
window.toggleTheme = window.MediCareUI.toggleTheme;
window.switchTab = window.MediCareUI.switchTab;
window.cycleFont = window.MediCareUI.cycleFont;
window.closeDeleteConfirmModal = window.MediCareUI.closeDeleteConfirmModal;
window.executePendingDelete = window.MediCareUI.executePendingDelete;
window.setHistoryFilter = window.MediCareUI.setHistoryFilter;
window.changeHistoryPage = window.MediCareUI.changeHistoryPage;
window.clearHistoryLogsPrompt = window.MediCareUI.clearHistoryLogsPrompt;
window.closeClearHistoryModal = window.MediCareUI.closeClearHistoryModal;
window.executeClearHistoryLogs = window.MediCareUI.executeClearHistoryLogs;
