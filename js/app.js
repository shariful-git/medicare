/**
 * MediCare - Main Application Controller
 */

window.MediCareApp = (function () {
    let activeAlarmRoutine = null;

    async function init() {
        // Localization init (Bangladesh -> 'bn', other countries -> 'en')
        if (window.MediCareI18n) {
            window.MediCareI18n.init();
        }

        // Theme & Font init
        window.MediCareUI.initTheme();
        window.MediCareUI.initFont();

        // Storage & SQLite init
        await window.MediCareStore.init();

        // Render date navigation strip and routines
        if (window.MediCareUI.renderDateStrip) {
            window.MediCareUI.renderDateStrip();
        }
        window.MediCareUI.renderRoutines();

        // Hydration UI init
        if (window.MediCareTools) {
            window.MediCareTools.renderHydrationUI();
        }

        // Setup notification & sound buttons
        setupNotificationButton();
        setupSoundToggle();
        setupSearchInput();
        if (window.MediCareUI && window.MediCareUI.initHistorySearch) {
            window.MediCareUI.initHistorySearch();
        }
        setupBMICalculator();
        setupDatabaseImportExport();

        // Update clock and dates
        updateClockAndDates();

        if (window.lucide) {
            window.lucide.createIcons();
        }

        // Run interval every second
        setInterval(updateClockAndDates, 1000);
    }

    function updateClockAndDates() {
        const now = new Date();

        // Date display
        const dateEl = document.getElementById('headerCurrentDate');
        if (dateEl) {
            dateEl.textContent = window.MediCareI18n ? window.MediCareI18n.formatDate(now) : now.toLocaleDateString();
        }

        // Live Clock (HH:MM:SS)
        const hours = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        const secs = String(now.getSeconds()).padStart(2, '0');
        const clockEl = document.getElementById('liveClock');
        if (clockEl) {
            clockEl.textContent = `${hours}:${mins}:${secs}`;
        }

        // Check alarm schedules precisely at minute start (:00 and :01)
        if (secs === '00' || secs === '01') {
            checkDueAlarms(hours, mins);
        }
    }

    function checkDueAlarms(currentHour, currentMin) {
        const currentTimeStr = `${currentHour}:${currentMin}`;
        const todayStr = window.MediCareStore.getTodayDateStr();
        const doses = window.MediCareStore.getDosesForDate(todayStr);

        doses.forEach(dose => {
            if (dose.time === currentTimeStr && !dose.isTaken) {
                triggerMedAlarm(dose);
            }
        });
    }

    function triggerMedAlarm(item) {
        activeAlarmRoutine = item;
        window.MediCareUI.showAlarmModal(item, () => {
            if (item.dateStr && item.routineId) {
                markDoseAsTaken(item.routineId, item.dateStr, item.time);
            } else {
                markAsTaken(item.id || item.routineId);
            }
        });

        window.MediCareAudio.startContinuousAlarm();

        // Native Notification
        if ("Notification" in window && Notification.permission === "granted") {
            try {
                const isEn = window.MediCareI18n && window.MediCareI18n.getLanguage() === 'en';
                const notifTitle = isEn ? `Medication Reminder: ${item.name}` : `ঔষধ সেবনের সময়: ${item.name}`;
                const mealText = window.MediCareI18n ? window.MediCareI18n.formatMeal(item.meal) : item.meal;
                const notifBody = isEn ? `Time to take ${item.dosage} - ${mealText}!` : `${item.dosage} - ${mealText} নেওয়ার সময় হয়েছে!`;
                new Notification(notifTitle, {
                    body: notifBody,
                    icon: 'https://placehold.co/128x128/0d9488/ffffff?text=Medicine'
                });
            } catch (e) {
                console.warn('Native notification failed:', e);
            }
        }
    }

    function triggerDemoAlert() {
        window.MediCareAudio.getAudioContext();
        window.MediCareAudio.playChimeAlert();

        const isEn = window.MediCareI18n && window.MediCareI18n.getLanguage() === 'en';
        const routines = window.MediCareStore.getRoutines();
        const demoItem = routines[0] || {
            id: 'demo-test',
            name: isEn ? 'Demo Alert (Test)' : 'টেস্ট অ্যালার্ম (Demo)',
            dosage: isEn ? '1 Dose' : '১ ডোজ',
            meal: isEn ? 'After Meal' : 'খাবারের পরে',
            time: '12:00'
        };
        triggerMedAlarm(demoItem);
    }

    function markDoseAsTaken(routineId, dateStr, timeStr) {
        window.MediCareStore.markDoseTaken(routineId, dateStr, timeStr);
        if (window.MediCareUI.renderDateStrip) window.MediCareUI.renderDateStrip();
        window.MediCareUI.renderRoutines();
        const msg = window.MediCareI18n ? window.MediCareI18n.t('toast_dose_taken') : 'ডোজ সেবন সম্পন্ন হয়েছে!';
        window.MediCareUI.showToast(msg, 'success');
    }

    function markTimeGroupAsTaken(dateStr, timeStr) {
        const doses = window.MediCareStore.getDosesForDate(dateStr);
        let takenCount = 0;
        doses.forEach(dose => {
            if (dose.time === timeStr && !dose.isTaken) {
                window.MediCareStore.markDoseTaken(dose.routineId, dateStr, timeStr);
                takenCount++;
            }
        });
        if (window.MediCareUI.renderDateStrip) window.MediCareUI.renderDateStrip();
        window.MediCareUI.renderRoutines();
        const msg = window.MediCareI18n ? window.MediCareI18n.t('toast_group_taken', 'উক্ত সময়ের সকল ঔষধ সেবন সম্পন্ন হয়েছে!') : 'উক্ত সময়ের সকল ঔষধ সেবন সম্পন্ন হয়েছে!';
        window.MediCareUI.showToast(msg, 'success');
    }

    function markDoseAsUndo(routineId, dateStr, timeStr) {
        window.MediCareStore.markDoseUndo(routineId, dateStr, timeStr);
        if (window.MediCareUI.renderDateStrip) window.MediCareUI.renderDateStrip();
        window.MediCareUI.renderRoutines();
        const msg = window.MediCareI18n ? window.MediCareI18n.t('toast_dose_undo') : 'ডোজ সেবন আনডু করা হয়েছে';
        window.MediCareUI.showToast(msg, 'info');
    }

    function markAsTaken(id) {
        window.MediCareStore.markTaken(id);
        if (window.MediCareUI.renderDateStrip) window.MediCareUI.renderDateStrip();
        window.MediCareUI.renderRoutines();
        const msg = window.MediCareI18n ? window.MediCareI18n.t('toast_taken') : 'ঔষধ সেবন সম্পন্ন হিসেবে চিহ্নিত হয়েছে!';
        window.MediCareUI.showToast(msg, 'success');
    }

    function markAsUndo(id) {
        window.MediCareStore.markUndo(id);
        if (window.MediCareUI.renderDateStrip) window.MediCareUI.renderDateStrip();
        window.MediCareUI.renderRoutines();
        const msg = window.MediCareI18n ? window.MediCareI18n.t('toast_undo') : 'সেবনের হিসাব আনডু করা হয়েছে';
        window.MediCareUI.showToast(msg, 'info');
    }

    function deleteRoutine(id) {
        window.MediCareStore.deleteRoutine(id);
        if (window.MediCareUI.renderDateStrip) window.MediCareUI.renderDateStrip();
        window.MediCareUI.renderRoutines();
    }

    function handleSaveRoutine(event) {
        event.preventDefault();
        const editingId = document.getElementById('editingRoutineId')?.value;
        const isCloning = document.getElementById('isCloningRoutine')?.value === 'true';
        const name = document.getElementById('medName').value.trim();
        const typeEl = document.querySelector('input[name="medType"]:checked');
        const type = typeEl ? typeEl.value : 'tablet';
        const dosage = document.getElementById('medDosage').value.trim();
        const meal = document.getElementById('medMeal').value;
        const stock = document.getElementById('medStock').value;
        const notes = document.getElementById('medNotes').value.trim();

        const startDate = document.getElementById('medStartDate')?.value || window.MediCareStore.getTodayDateStr();
        const durationDays = parseInt(document.getElementById('medDurationDays')?.value || 3, 10) || 3;
        const endDate = window.MediCareStore.calculateEndDate(startDate, durationDays);

        // Collect all dose times from dynamic inputs
        const timeInputs = document.querySelectorAll('.dose-time-input');
        const times = [];
        timeInputs.forEach(inp => {
            const v = inp.value.trim();
            if (v && !times.includes(v)) {
                times.push(v);
            }
        });
        if (times.length === 0) {
            times.push('08:00');
        }
        times.sort();

        if (!name || !dosage) return;

        if (editingId && !isCloning) {
            window.MediCareStore.updateRoutine(editingId, {
                name,
                type,
                dosage,
                meal,
                times,
                time: times[0],
                startDate,
                durationDays,
                endDate,
                frequency: times.length,
                stock: stock !== '' ? parseInt(stock, 10) : '',
                notes
            });
            window.MediCareUI.closeModal();
            if (window.MediCareUI.renderDateStrip) window.MediCareUI.renderDateStrip();
            window.MediCareUI.renderRoutines();
            const msg = window.MediCareI18n ? window.MediCareI18n.t('toast_updated') : 'ঔষধের তথ্য সফলভাবে আপডেট হয়েছে!';
            window.MediCareUI.showToast(msg, 'success');
        } else {
            const newRoutine = {
                id: 'med-' + Date.now(),
                name,
                type,
                dosage,
                meal,
                times,
                time: times[0],
                startDate,
                durationDays,
                endDate,
                frequency: times.length,
                stock: stock !== '' ? parseInt(stock, 10) : '',
                notes,
                takenHistory: {},
                takenToday: false,
                lastTakenDate: '',
                createdAt: new Date().toISOString()
            };

            window.MediCareStore.addRoutine(newRoutine, isCloning);
            window.MediCareUI.closeModal();
            if (window.MediCareUI.renderDateStrip) window.MediCareUI.renderDateStrip();
            window.MediCareUI.renderRoutines();
            const msg = isCloning
                ? (window.MediCareI18n ? window.MediCareI18n.t('toast_cloned') : 'ঔষধ শিডিউল সফলভাবে ক্লোন ও সংরক্ষণ করা হয়েছে!')
                : (window.MediCareI18n ? window.MediCareI18n.t('toast_added') : 'নতুন রুটিন সফলভাবে যুক্ত হয়েছে!');
            window.MediCareUI.showToast(msg, 'success');
        }
    }

    function setupSearchInput() {
        const searchInput = document.getElementById('medSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                window.MediCareStore.setSearchQuery(e.target.value);
                window.MediCareUI.renderRoutines();
            });
        }
    }

    function setupBMICalculator() {
        const btn = document.getElementById('calcBmiBtn');
        if (!btn) return;

        btn.addEventListener('click', () => {
            const weight = parseFloat(document.getElementById('bmiWeight').value);
            const height = parseFloat(document.getElementById('bmiHeight').value);
            const res = window.MediCareTools.calculateBMI(weight, height);
            const resultContainer = document.getElementById('bmiResultBox');

            if (!res || !resultContainer) {
                alert(window.MediCareI18n ? window.MediCareI18n.t('bmi_invalid_input') : 'অনুগ্রহ করে সঠিক ওজন (কেজি) এবং উচ্চতা (সেমি) দিন।');
                return;
            }

            const scoreLabel = window.MediCareI18n ? window.MediCareI18n.t('bmi_score_label') : 'আপনার বিএমআই স্কোর';
            resultContainer.innerHTML = `
                <div class="p-4 rounded-md border ${res.colorClass} transition-all">
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-semibold uppercase tracking-wider">${scoreLabel}</span>
                        <span class="text-2xl font-bold font-mono">${res.bmi}</span>
                    </div>
                    <div class="font-bold text-sm mt-1">${res.status}</div>
                    <p class="text-xs mt-2 opacity-90">${res.advice}</p>
                </div>
            `;
            resultContainer.classList.remove('hidden');
        });
    }

    function setupDatabaseImportExport() {
        // Export button
        const exportBtn = document.getElementById('exportSqliteBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                if (window.MediCareSQLite) {
                    window.MediCareSQLite.exportDatabaseFile();
                }
            });
        }

        // Import file input
        const importInput = document.getElementById('importSqliteInput');
        if (importInput) {
            importInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    const isEn = window.MediCareI18n && window.MediCareI18n.getLanguage() === 'en';
                    const success = await window.MediCareSQLite.importDatabaseFile(file);
                    if (success) {
                        alert(isEn ? 'SQLite database restored successfully!' : 'SQLite ডাটাবেজ সফলভাবে রিস্টোর করা হয়েছে!');
                        await window.MediCareStore.init();
                        window.MediCareUI.renderRoutines();
                    } else {
                        alert(isEn ? 'Failed to import database file.' : 'ডাটাবেজ ফাইল ইম্পোর্ট করতে ব্যর্থ হয়েছে।');
                    }
                }
            });
        }
    }

    function setupNotificationButton() {
        const btn = document.getElementById('notiPermBtn');
        const label = document.getElementById('notiPermLabel');
        if (!btn || !label) return;

        if (!("Notification" in window)) {
            btn.style.display = 'none';
            return;
        }

        const activeText = window.MediCareI18n ? window.MediCareI18n.t('alert_active') : 'অ্যালার্ট চালু';
        if (Notification.permission === 'granted') {
            label.textContent = activeText;
            btn.classList.add('text-sky-700', 'bg-sky-50', 'border-sky-200', 'dark:bg-sky-950/40', 'dark:text-sky-300');
        } else {
            btn.addEventListener('click', () => {
                window.MediCareAudio.getAudioContext();
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        label.textContent = window.MediCareI18n ? window.MediCareI18n.t('alert_active') : 'অ্যালার্ট চালু';
                        btn.classList.add('text-sky-700', 'bg-sky-50', 'border-sky-200', 'dark:bg-sky-950/40', 'dark:text-sky-300');
                    }
                });
            });
        }
    }

    function setupSoundToggle() {
        const btn = document.getElementById('toggleSoundBtn');
        const icon = document.getElementById('soundIcon');
        if (!btn || !icon) return;

        btn.addEventListener('click', () => {
            window.MediCareAudio.getAudioContext();
            const isEnabled = window.MediCareAudio.toggleSound();
            if (isEnabled) {
                btn.classList.remove('bg-rose-50', 'text-rose-600', 'border-rose-200', 'dark:bg-rose-950/40', 'dark:text-rose-400');
                icon.setAttribute('data-lucide', 'volume-2');
            } else {
                btn.classList.add('bg-rose-50', 'text-rose-600', 'border-rose-200', 'dark:bg-rose-950/40', 'dark:text-rose-400');
                icon.setAttribute('data-lucide', 'volume-x');
            }
            if (window.lucide) {
                window.lucide.createIcons();
            }
        });
    }

    return {
        init,
        markAsTaken,
        markAsUndo,
        markDoseAsTaken,
        markTimeGroupAsTaken,
        markDoseAsUndo,
        deleteRoutine,
        handleSaveRoutine,
        triggerDemoAlert,
        triggerMedAlarm
    };
})();

// Global alias bindings
window.handleSaveRoutine = window.MediCareApp.handleSaveRoutine;
window.triggerDemoAlert = window.MediCareApp.triggerDemoAlert;
window.markAsTaken = window.MediCareApp.markAsTaken;
window.markAsUndo = window.MediCareApp.markAsUndo;
window.markDoseAsTaken = window.MediCareApp.markDoseAsTaken;
window.markTimeGroupAsTaken = window.MediCareApp.markTimeGroupAsTaken;
window.markDoseAsUndo = window.MediCareApp.markDoseAsUndo;
window.deleteRoutine = window.MediCareApp.deleteRoutine;

// Escape key dismiss for modals
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (window.MediCareUI) {
            window.MediCareUI.closeModal();
            window.MediCareUI.closeDeleteConfirmModal();
            window.MediCareUI.closeClearHistoryModal();
            window.MediCareUI.dismissAlarmModal();
        }
        if (window.MediCareAuth) {
            window.MediCareAuth.closeAuthModal();
        }
    }
});

// Bootstrap on DOM ready
window.addEventListener('DOMContentLoaded', () => {
    if (window.MediCareAuth) {
        window.MediCareAuth.init();
    }
    window.MediCareApp.init();
});

