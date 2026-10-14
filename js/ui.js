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
            renderDateStrip();
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
    // HORIZONTAL DATE STRIP CONTROLLER
    // ==========================================
    function renderDateStrip() {
        const container = document.getElementById('dateStripScroll');
        if (!container) return;

        const selectedDate = window.MediCareStore.getSelectedDate();
        const todayStr = window.MediCareStore.getTodayDateStr();
        const t = (k, def) => window.MediCareI18n ? window.MediCareI18n.t(k, def) : def;

        // Generate a 31-day window around today (-5 days to +25 days)
        const dates = [];
        const baseNow = new Date();
        for (let offset = -5; offset <= 25; offset++) {
            const d = new Date(baseNow);
            d.setDate(baseNow.getDate() + offset);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${day}`;
            dates.push({ dateObj: d, dateStr });
        }

        container.innerHTML = '';

        dates.forEach(({ dateObj, dateStr }) => {
            const isToday = dateStr === todayStr;
            const isActive = dateStr === selectedDate;
            const status = window.MediCareStore.getDateBadgeStatus(dateStr);

            let dotHtml = '';
            if (status.hasMeds) {
                if (status.allTaken) {
                    dotHtml = `<span class="date-dot dot-completed" title="${t('stat_taken', 'সম্পন্ন')} (${status.taken}/${status.total})"></span>`;
                } else {
                    dotHtml = `<span class="date-dot dot-pending" title="${t('stat_pending', 'বাকি আছে')} (${status.total - status.taken}/${status.total})"></span>`;
                }
            }

            const dayName = isToday 
                ? (window.MediCareI18n && window.MediCareI18n.getLanguage() === 'bn' ? 'আজ' : 'Today')
                : (window.MediCareI18n ? window.MediCareI18n.getDayShortName(dateObj) : dateObj.toLocaleDateString('en-US', { weekday: 'short' }));
            
            const monthName = window.MediCareI18n ? window.MediCareI18n.getMonthShortName(dateObj) : dateObj.toLocaleDateString('en-US', { month: 'short' });
            const dayNum = window.MediCareI18n ? window.MediCareI18n.formatNumber(dateObj.getDate()) : dateObj.getDate();

            const card = document.createElement('div');
            card.id = `dateCard_${dateStr}`;
            card.className = `date-strip-card ${isActive ? 'active' : ''} ${isToday ? 'is-today' : ''}`;
            card.setAttribute('role', 'button');
            card.setAttribute('aria-label', `Date ${dateStr}`);
            card.onclick = () => selectDate(dateStr);

            card.innerHTML = `
                <span class="text-[10px] font-bold uppercase tracking-wider opacity-85 leading-tight">${escapeHtml(dayName)}</span>
                <span class="text-base sm:text-lg font-black font-mono leading-none my-1">${dayNum}</span>
                <span class="text-[10px] opacity-75 font-semibold">${escapeHtml(monthName)}</span>
                <div class="h-2 flex items-center justify-center mt-1">
                    ${dotHtml}
                </div>
            `;

            container.appendChild(card);
        });

        // Update Title & Badge for currently selected date
        updateSelectedDateHeader(selectedDate, todayStr);
    }

    function updateSelectedDateHeader(selectedDate, todayStr) {
        const titleEl = document.getElementById('selectedDateDisplayTitle');
        const badgeEl = document.getElementById('selectedDateCountBadge');
        if (!titleEl) return;

        const isToday = selectedDate === todayStr;
        const parts = selectedDate.split('-').map(Number);
        const selObj = new Date(parts[0], parts[1] - 1, parts[2]);

        const formattedDate = window.MediCareI18n ? window.MediCareI18n.formatDate(selObj) : selObj.toLocaleDateString();
        const t = (k, def) => window.MediCareI18n ? window.MediCareI18n.t(k, def) : def;

        if (isToday) {
            const shortFormatted = window.MediCareI18n ? window.MediCareI18n.formatDateShort(selObj) : `${selObj.getDate()} ${selObj.getMonth() + 1}`;
            titleEl.textContent = `${t('btn_today', 'আজকের দিন')}, ${shortFormatted} (${t('active_status', 'সক্রিয়')})`;
        } else {
            titleEl.textContent = `${formattedDate}`;
        }

        const stats = window.MediCareStore.getStatsForDate(selectedDate);
        if (badgeEl) {
            const fmtNum = (n) => window.MediCareI18n ? window.MediCareI18n.formatNumber(n) : n;
            badgeEl.textContent = `${fmtNum(stats.total)}টি ডোজ (${fmtNum(stats.taken)}টি সম্পন্ন)`;
        }
    }

    function selectDate(dateStr) {
        if (!dateStr) return;
        window.MediCareStore.setSelectedDate(dateStr);

        // Update active class on date strip cards
        document.querySelectorAll('.date-strip-card').forEach(c => c.classList.remove('active'));
        const targetCard = document.getElementById(`dateCard_${dateStr}`);
        if (targetCard) {
            targetCard.classList.add('active');
            targetCard.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }

        const todayStr = window.MediCareStore.getTodayDateStr();
        updateSelectedDateHeader(dateStr, todayStr);
        renderRoutines();
    }

    function scrollDateStrip(direction) {
        const container = document.getElementById('dateStripScroll');
        if (!container) return;
        const scrollAmount = direction === 'left' ? -220 : 220;
        container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }

    function goToToday() {
        const todayStr = window.MediCareStore.getTodayDateStr();
        selectDate(todayStr);
    }

    // ==========================================
    // ROUTINES RENDERING (DYNAMIC FOR SELECTED DATE)
    // ==========================================
    function renderRoutines() {
        const listEl = document.getElementById('medicineList');
        const emptyEl = document.getElementById('emptyState');
        if (!listEl) return;

        listEl.innerHTML = '';
        const selectedDate = window.MediCareStore.getSelectedDate();
        const filtered = window.MediCareStore.getFilteredDosesForDate(selectedDate);
        const stats = window.MediCareStore.getStatsForDate(selectedDate);

        // Update Counter Stats & Progress Bar
        const statTotal = document.getElementById('statTotal');
        const statPending = document.getElementById('statPending');
        const statTaken = document.getElementById('statTaken');
        const statPercent = document.getElementById('statPercent');
        const progressBar = document.getElementById('dailyProgressBar');
        const greetingEl = document.getElementById('heroGreetingText');

        const fmt = (n) => window.MediCareI18n ? window.MediCareI18n.formatNumber(n) : n;

        if (greetingEl) greetingEl.textContent = getGreetingText();
        if (statTotal) statTotal.textContent = fmt(stats.total);
        if (statPending) statPending.textContent = fmt(stats.pending);
        if (statTaken) statTaken.textContent = fmt(stats.taken);
        if (statPercent) statPercent.textContent = `${fmt(stats.percentage)}%`;
        if (progressBar) progressBar.style.width = `${stats.percentage}%`;

        // Update date badge on date strip too
        const todayStr = window.MediCareStore.getTodayDateStr();
        updateSelectedDateHeader(selectedDate, todayStr);

        if (filtered.length === 0) {
            if (emptyEl) {
                emptyEl.classList.remove('hidden');
                const emptyTitle = document.getElementById('emptyStateTitle');
                const emptyDesc = document.getElementById('emptyStateDesc');
                const t = (k, def) => window.MediCareI18n ? window.MediCareI18n.t(k, def) : def;
                if (emptyTitle) emptyTitle.textContent = t('empty_title', 'উক্ত তারিখে কোনো রুটিন পাওয়া যায়নি');
                if (emptyDesc) emptyDesc.textContent = t('empty_desc', 'এই তারিখে কোনো ঔষধের সেবন তালিকা নেই। নতুন ঔষধের কোর্স যোগ করুন।');
            }
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
        const btnClone = t('btn_clone', 'ক্লোন করুন');
        const btnDelete = t('btn_delete', 'ডিলিট করুন');

        filtered.forEach(item => {
            const card = document.createElement('div');
            const isLowStock = item.stock !== undefined && item.stock !== '' && Number(item.stock) <= 3;
            const isOutOfStock = item.stock !== undefined && item.stock !== '' && Number(item.stock) === 0;

            card.className = `med-card p-3.5 sm:p-4 rounded-md ${
                item.isTaken 
                    ? 'bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800' 
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs'
            } transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5`;

            const dayIndexFormatted = fmt(item.dayIndex);
            const durationFormatted = fmt(item.durationDays);

            card.innerHTML = `
                <div class="flex items-start gap-3 flex-1 min-w-0">
                    <div class="w-11 h-11 rounded-md flex items-center justify-center shrink-0 border ${
                        item.isTaken 
                            ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400' 
                            : 'bg-sky-50 dark:bg-sky-950/60 border-sky-200/70 dark:border-sky-800/60 text-[#0284c7] dark:text-sky-400'
                    }">
                        ${getTypeIcon(item.type)}
                    </div>
                    <div class="space-y-1 min-w-0 flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <h3 class="font-bold text-sm sm:text-base truncate ${item.isTaken ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}">
                                ${escapeHtml(item.name)}
                            </h3>
                            ${getTypeBadge(item.type)}
                            ${getTimeOfDayBadge(item.time)}
                            <span class="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-mono border border-slate-200 dark:border-slate-700">
                                ⏰ ${formatBengaliTime(item.time)}
                            </span>
                            <span class="text-[11px] font-semibold px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/60 text-[#0284c7] dark:text-sky-300 border border-sky-200 dark:border-sky-800 font-mono">
                                📅 ${durationFormatted} দিনের কোর্সের ${dayIndexFormatted}ম দিন
                            </span>
                        </div>
                        <div class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium flex-wrap pt-0.5">
                            <span><b>${dosageLabel}</b> ${escapeHtml(item.dosage)}</span>
                            <span>•</span>
                            <span><b>${mealLabel}</b> ${escapeHtml(item.meal)}</span>
                            ${item.stock !== undefined && item.stock !== '' ? `
                                <span>•</span>
                                <span class="${isLowStock ? 'text-rose-600 dark:text-rose-400 font-bold low-stock-badge' : ''}">
                                    ${isOutOfStock ? stockOutLabel : `${stockLabel} ${fmt(item.stock)}`}
                                </span>
                            ` : ''}
                        </div>
                        ${item.notes ? `<p class="text-[11px] text-slate-400 dark:text-slate-500 italic font-normal truncate">${notePrefix} ${escapeHtml(item.notes)}</p>` : ''}
                    </div>
                </div>

                <div class="flex items-center gap-2 self-stretch sm:self-center shrink-0 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-0 border-slate-100 dark:border-slate-800">
                    ${!item.isTaken ? `
                        <button onclick="window.MediCareApp.markDoseAsTaken('${item.routineId}', '${item.dateStr}', '${item.time}')" class="flex-1 sm:flex-initial min-h-[44px] px-4 py-2.5 rounded-md bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 active:scale-95">
                            <i data-lucide="check" class="w-4 h-4 stroke-[2.5]"></i>
                            ${btnTaken}
                        </button>
                    ` : `
                        <button onclick="window.MediCareApp.markDoseAsUndo('${item.routineId}', '${item.dateStr}', '${item.time}')" class="flex-1 sm:flex-initial min-h-[44px] px-3.5 py-2.5 rounded-md border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition flex items-center justify-center gap-1 active:scale-95">
                            <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                            ${btnUndo}
                        </button>
                    `}
                    <button onclick="window.MediCareUI.openModal('${item.routineId}')" title="${btnEdit}" aria-label="${btnEdit}" class="min-h-[44px] min-w-[44px] p-2.5 rounded-md border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-[#0284c7] hover:border-[#0284c7] hover:bg-sky-50 dark:hover:bg-sky-950/40 transition flex items-center justify-center active:scale-95">
                        <i data-lucide="edit-3" class="w-4 h-4"></i>
                    </button>
                    <button onclick="window.MediCareUI.cloneRoutine('${item.routineId}')" title="${btnClone}" aria-label="${btnClone}" class="min-h-[44px] min-w-[44px] p-2.5 rounded-md border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-teal-600 hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-950/40 transition flex items-center justify-center active:scale-95">
                        <i data-lucide="copy" class="w-4 h-4"></i>
                    </button>
                    <button onclick="window.MediCareUI.confirmDelete('${item.routineId}', '${escapeHtml(item.name)}')" title="${btnDelete}" aria-label="${btnDelete}" class="min-h-[44px] min-w-[44px] p-2.5 rounded-md border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-rose-600 hover:border-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition flex items-center justify-center active:scale-95">
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
        if (act === 'action_cloned' || act.includes('ক্লোন') || act.includes('cloned')) {
            return {
                label: t('log_action_cloned', 'শিডিউল ক্লোন করে যুক্ত করা হয়েছে'),
                icon: 'copy',
                badgeClass: 'bg-teal-50 dark:bg-teal-950/60 border-teal-300 dark:border-teal-800 text-teal-700 dark:text-teal-300',
                textClass: 'text-teal-700 dark:text-teal-300'
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
    // COURSE DURATION & FREQUENCY CONTROLLERS
    // ==========================================
    function setDurationPreset(days) {
        const input = document.getElementById('medDurationDays');
        if (input) {
            input.value = days;
        }
        document.querySelectorAll('.duration-chip').forEach(btn => {
            const d = parseInt(btn.getAttribute('data-days'), 10);
            if (d === days) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        onCourseConfigChanged();
    }

    function setFrequencyPreset(freq) {
        document.querySelectorAll('.freq-chip').forEach(btn => {
            const f = parseInt(btn.getAttribute('data-freq'), 10);
            if (f === freq) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Smart preset times based on standard medical frequencies
        let presetTimes = ['08:00'];
        if (freq === 1) {
            presetTimes = ['08:00'];
        } else if (freq === 2) {
            presetTimes = ['08:00', '21:00'];
        } else if (freq === 3) {
            presetTimes = ['08:00', '14:00', '21:00'];
        } else if (freq === 4) {
            presetTimes = ['08:00', '13:00', '18:00', '22:00'];
        }

        renderDoseTimeSlots(presetTimes);
        onCourseConfigChanged();
    }

    function renderDoseTimeSlots(timesList) {
        const container = document.getElementById('doseTimesList');
        if (!container) return;
        container.innerHTML = '';

        const t = (k, def) => window.MediCareI18n ? window.MediCareI18n.t(k, def) : def;
        const fmt = (n) => window.MediCareI18n ? window.MediCareI18n.formatNumber(n) : n;

        const defaultLabels = [
            t('dose_slot_morning', 'সকালের ডোজ'),
            t('dose_slot_noon', 'দুপুরের ডোজ'),
            t('dose_slot_evening', 'সন্ধ্যার ডোজ'),
            t('dose_slot_night', 'রাতের ডোজ')
        ];

        timesList.forEach((timeVal, idx) => {
            const row = document.createElement('div');
            row.className = 'dose-time-row flex items-center justify-between gap-3';
            const label = defaultLabels[idx] || `${t('dose_slot_custom', 'ডোজ')} ${fmt(idx + 1)}`;

            row.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="w-6 h-6 rounded bg-[#0284c7]/10 text-[#0284c7] dark:text-sky-300 font-bold text-xs flex items-center justify-center font-mono">
                        ${fmt(idx + 1)}
                    </span>
                    <span class="text-xs font-bold text-slate-800 dark:text-slate-200">${escapeHtml(label)}</span>
                </div>
                <div class="flex items-center gap-2">
                    <input type="time" value="${timeVal || '08:00'}" required onchange="window.MediCareUI.onCourseConfigChanged()" class="dose-time-input px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold focus:border-[#0284c7] outline-none">
                    ${timesList.length > 1 ? `
                        <button type="button" onclick="window.MediCareUI.removeCustomTimeSlot(this)" title="মুছে ফেলুন" class="p-1.5 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition">
                            <i data-lucide="x" class="w-3.5 h-3.5"></i>
                        </button>
                    ` : ''}
                </div>
            `;
            container.appendChild(row);
        });

        if (window.lucide) window.lucide.createIcons();
    }

    function addCustomTimeSlot(defaultTime = '12:00') {
        const container = document.getElementById('doseTimesList');
        if (!container) return;

        const currentTimes = [];
        container.querySelectorAll('.dose-time-input').forEach(inp => currentTimes.push(inp.value));
        currentTimes.push(defaultTime);
        renderDoseTimeSlots(currentTimes);
        onCourseConfigChanged();
    }

    function removeCustomTimeSlot(btn) {
        const row = btn.closest('.dose-time-row');
        if (row) {
            row.remove();
            onCourseConfigChanged();
        }
    }

    function onCourseConfigChanged() {
        const startDateInp = document.getElementById('medStartDate');
        const durationInp = document.getElementById('medDurationDays');
        const rangeSummary = document.getElementById('courseDateRangeSummary');
        const summaryText = document.getElementById('courseSummaryText');
        const suggestedStockTag = document.getElementById('suggestedStockTag');
        const stockInput = document.getElementById('medStock');

        const startDate = startDateInp ? startDateInp.value : window.MediCareStore.getTodayDateStr();
        const duration = Math.max(1, parseInt(durationInp ? durationInp.value : 3, 10) || 1);
        const endDate = window.MediCareStore.calculateEndDate(startDate, duration);

        const timeInputs = document.querySelectorAll('.dose-time-input');
        const freqCount = timeInputs.length || 1;
        const totalDoses = duration * freqCount;

        const fmt = (n) => window.MediCareI18n ? window.MediCareI18n.formatNumber(n) : n;

        if (rangeSummary) {
            rangeSummary.textContent = `${fmt(duration)} দিন (${startDate} থেকে ${endDate})`;
        }

        if (summaryText) {
            summaryText.textContent = `${fmt(duration)} দিনের কোর্স • প্রতিদিন ${fmt(freqCount)} বার • সর্বমোট ${fmt(totalDoses)}টি ডোজ`;
        }

        if (suggestedStockTag) {
            suggestedStockTag.textContent = `মোট প্রয়োজন: ${fmt(totalDoses)}টি`;
        }

        // Auto-suggest stock if empty
        if (stockInput && (!stockInput.value || stockInput.dataset.autoFilled === 'true')) {
            stockInput.value = totalDoses;
            stockInput.dataset.autoFilled = 'true';
        }
    }

    // ==========================================
    // ROUTINE ADD / EDIT / CLONE MODAL
    // ==========================================
    function openModal(editId = null, isClone = false) {
        const form = document.getElementById('routineForm');
        const modalTitle = document.getElementById('routineModalTitle');
        const modalTitleText = document.getElementById('routineModalTitleText');
        const modalIcon = document.getElementById('routineModalIcon');
        const editingIdInput = document.getElementById('editingRoutineId');
        const isCloningInput = document.getElementById('isCloningRoutine');
        const cloneNoticeBanner = document.getElementById('cloneNoticeBanner');
        const submitBtnText = document.getElementById('routineModalSubmitText');

        if (form) form.reset();

        const t = (k, def) => window.MediCareI18n ? window.MediCareI18n.t(k, def) : def;

        const selectedDate = window.MediCareStore.getSelectedDate();
        const startDateInp = document.getElementById('medStartDate');
        const durationInp = document.getElementById('medDurationDays');
        const stockInput = document.getElementById('medStock');
        if (stockInput) delete stockInput.dataset.autoFilled;

        if (editId) {
            const routine = window.MediCareStore.getRoutineById(editId);
            if (routine) {
                if (isClone) {
                    // CLONE ROUTINE MODE
                    if (isCloningInput) isCloningInput.value = 'true';
                    if (editingIdInput) editingIdInput.value = '';
                    if (cloneNoticeBanner) cloneNoticeBanner.classList.remove('hidden');

                    const cloneTitle = t('modal_clone_title', 'ঔষধ শিডিউল ক্লোন করুন');
                    if (modalTitleText) modalTitleText.textContent = cloneTitle;
                    if (modalIcon) {
                        modalIcon.setAttribute('data-lucide', 'copy');
                        modalIcon.className = 'w-5 h-5 text-teal-600 dark:text-teal-400';
                    }
                    if (submitBtnText) submitBtnText.textContent = t('btn_clone_save', 'ক্লোন সংরক্ষণ করুন');
                } else {
                    // EDIT EXISTING ROUTINE MODE
                    if (isCloningInput) isCloningInput.value = 'false';
                    if (editingIdInput) editingIdInput.value = editId;
                    if (cloneNoticeBanner) cloneNoticeBanner.classList.add('hidden');

                    const editTitle = t('modal_edit_title', 'ঔষধের তথ্য সম্পাদনা করুন');
                    if (modalTitleText) modalTitleText.textContent = editTitle;
                    if (modalIcon) {
                        modalIcon.setAttribute('data-lucide', 'edit-3');
                        modalIcon.className = 'w-5 h-5 text-[#0284c7] dark:text-sky-400';
                    }
                    if (submitBtnText) submitBtnText.textContent = t('btn_save', 'সংরক্ষণ করুন');
                }

                document.getElementById('medName').value = routine.name || '';
                document.getElementById('medDosage').value = routine.dosage || '';
                document.getElementById('medMeal').value = routine.meal || 'খাবারের পরে (After Meal)';
                document.getElementById('medStock').value = routine.stock !== undefined ? routine.stock : '';
                document.getElementById('medNotes').value = routine.notes || '';

                if (startDateInp) startDateInp.value = routine.startDate || selectedDate;
                if (durationInp) durationInp.value = routine.durationDays || 3;

                setDurationPreset(parseInt(routine.durationDays, 10) || 3);

                const times = Array.isArray(routine.times) && routine.times.length > 0 ? routine.times : (routine.time ? [routine.time] : ['08:00', '14:00', '21:00']);
                renderDoseTimeSlots(times);

                document.querySelectorAll('.freq-chip').forEach(btn => {
                    const f = parseInt(btn.getAttribute('data-freq'), 10);
                    btn.classList.toggle('active', f === times.length);
                });

                const typeRadio = document.querySelector(`input[name="medType"][value="${routine.type}"]`);
                if (typeRadio) typeRadio.checked = true;
            }
        } else {
            // ADD NEW ROUTINE MODE
            if (isCloningInput) isCloningInput.value = 'false';
            if (editingIdInput) editingIdInput.value = '';
            if (cloneNoticeBanner) cloneNoticeBanner.classList.add('hidden');

            const addTitle = t('modal_add_title', 'নতুন ঔষধ / ইনজেকশন যোগ করুন');
            if (modalTitleText) modalTitleText.textContent = addTitle;
            if (modalIcon) {
                modalIcon.setAttribute('data-lucide', 'pill');
                modalIcon.className = 'w-5 h-5 text-[#0284c7] dark:text-sky-400';
            }
            if (submitBtnText) submitBtnText.textContent = t('btn_save', 'সংরক্ষণ করুন');

            if (startDateInp) startDateInp.value = selectedDate || window.MediCareStore.getTodayDateStr();
            if (durationInp) durationInp.value = 3;

            setDurationPreset(3);
            setFrequencyPreset(3); // default 3 times per day (8:00, 14:00, 21:00)
        }

        onCourseConfigChanged();

        if (window.lucide) window.lucide.createIcons();

        const modal = document.getElementById('medicineModal');
        if (modal) modal.classList.remove('hidden');
    }

    function closeModal() {
        const modal = document.getElementById('medicineModal');
        if (modal) modal.classList.add('hidden');
        const isCloningInput = document.getElementById('isCloningRoutine');
        if (isCloningInput) isCloningInput.value = 'false';
        const cloneNoticeBanner = document.getElementById('cloneNoticeBanner');
        if (cloneNoticeBanner) cloneNoticeBanner.classList.add('hidden');
    }

    function cloneRoutine(id) {
        openModal(id, true);
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
        renderDateStrip,
        selectDate,
        scrollDateStrip,
        goToToday,
        renderRoutines,
        setDurationPreset,
        setFrequencyPreset,
        renderDoseTimeSlots,
        addCustomTimeSlot,
        removeCustomTimeSlot,
        onCourseConfigChanged,
        renderHistoryView,
        changeHistoryPage,
        clearHistoryLogsPrompt,
        closeClearHistoryModal,
        executeClearHistoryLogs,
        setHistoryFilter,
        initHistorySearch,
        openModal,
        closeModal,
        cloneRoutine,
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
window.cloneRoutine = window.MediCareUI.cloneRoutine;
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
window.selectDate = window.MediCareUI.selectDate;
window.scrollDateStrip = window.MediCareUI.scrollDateStrip;
window.goToToday = window.MediCareUI.goToToday;

