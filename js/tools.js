/**
 * MediCare - Healthcare Tools & Utilities Module
 * Features:
 *  1. BMI & Health Calculator
 *  2. Hydration & Water Intake Tracker
 *  3. Emergency Medical Helplines
 *  4. Printable Prescription Schedule Generator
 *  5. SQLite Database Console & Backup Tools
 */

window.MediCareTools = (function () {

    // ==========================================
    // 1. BMI CALCULATOR
    // ==========================================
    function calculateBMI(weightKg, heightCm) {
        if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) {
            return null;
        }
        const heightM = heightCm / 100;
        const bmi = (weightKg / (heightM * heightM)).toFixed(1);

        const t = (k, def) => window.MediCareI18n ? window.MediCareI18n.t(k, def) : def;
        let status = '';
        let colorClass = '';
        let advice = '';

        if (bmi < 18.5) {
            status = t('bmi_underweight', 'কম ওজন (Underweight)');
            colorClass = 'text-amber-500 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800';
            advice = t('bmi_underweight_advice', 'পুষ্টিকর সুষম খাবার গ্রহণ করুন এবং ডাক্তারের পরামর্শ অনুযায়ী ভিটামিন যুক্ত করুন।');
        } else if (bmi >= 18.5 && bmi <= 24.9) {
            status = t('bmi_healthy', 'স্বাভাবিক ওজন (Healthy)');
            colorClass = 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800';
            advice = t('bmi_healthy_advice', 'আপনার ওজন একদম আদর্শ! নিয়মিত হাঁটাচলা ও স্বাস্থ্যকর খাদ্যাভ্যাস বজায় রাখুন।');
        } else if (bmi >= 25.0 && bmi <= 29.9) {
            status = t('bmi_overweight', 'অতিরিক্ত ওজন (Overweight)');
            colorClass = 'text-orange-500 bg-orange-50 border-orange-200 dark:bg-orange-950/40 dark:border-orange-800';
            advice = t('bmi_overweight_advice', 'মিষ্টি ও অতিরিক্ত তৈলাক্ত খাবার এড়িয়ে চলুন এবং প্রতিদিন অন্তত ৩০ মিনিট হাঁটুন।');
        } else {
            status = t('bmi_obese', 'স্থূলতা (Obese)');
            colorClass = 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800';
            advice = t('bmi_obese_advice', 'ডাক্তার বা পুষ্টিবিদের পরামর্শ নিন এবং নিয়মিত শারীরিক ব্যায়াম শুরু করুন।');
        }

        return { bmi, status, colorClass, advice };
    }

    // ==========================================
    // 2. HYDRATION TRACKER
    // ==========================================
    function addWaterGlass() {
        const updated = window.MediCareStore.updateHydration(1);
        renderHydrationUI();
    }

    function removeWaterGlass() {
        const updated = window.MediCareStore.updateHydration(-1);
        renderHydrationUI();
    }

    function renderHydrationUI() {
        const { data } = window.MediCareStore.getHydration();
        const glasses = data.glasses || 0;
        const target = data.target || 8;
        const percent = Math.min(100, Math.round((glasses / target) * 100));

        const countEl = document.getElementById('waterGlassCount');
        const fillEl = document.getElementById('waterWaveFill');
        const textEl = document.getElementById('waterPercentText');
        const mlEl = document.getElementById('waterMlText');

        const goalPre = window.MediCareI18n ? window.MediCareI18n.t('water_goal_prefix', 'মিলি (লক্ষ্য:') : 'মিলি (লক্ষ্য:';
        const goalSuf = window.MediCareI18n ? window.MediCareI18n.t('water_goal_suffix', 'মিলি)') : 'মিলি)';

        if (countEl) countEl.textContent = `${glasses} / ${target}`;
        if (textEl) textEl.textContent = `${percent}%`;
        if (mlEl) mlEl.textContent = `${glasses * 250} ${goalPre} ${target * 250} ${goalSuf}`;
        if (fillEl) fillEl.style.height = `${percent}%`;
    }

    // ==========================================
    // 3. PRINT PRESCRIPTION SCHEDULE
    // ==========================================
    function printPrescriptionSchedule() {
        const routines = window.MediCareStore.getRoutines();
        const printWindow = window.open('', '_blank');
        const now = new Date();
        const isBn = !window.MediCareI18n || window.MediCareI18n.getLanguage() === 'bn';
        const dateStr = window.MediCareI18n ? window.MediCareI18n.formatDate(now) : now.toLocaleDateString();

        const titleText = isBn ? 'মেডিকেয়ার - ঔষধ সেবনের রুটিন চার্ট' : 'MediCare - Medication Schedule Chart';
        const printDateLabel = isBn ? 'প্রিন্ট তারিখ:' : 'Printed on:';
        const colSerial = isBn ? 'ক্রম' : 'SL';
        const colName = isBn ? 'ঔষধ / ইনজেকশনের নাম' : 'Medicine / Injection Name';
        const colType = isBn ? 'ধরন' : 'Type';
        const colDosage = isBn ? 'ডোজ' : 'Dosage';
        const colMeal = isBn ? 'খাবার নিয়ম' : 'Meal Rule';
        const colTime = isBn ? 'নির্ধারিত সময়' : 'Scheduled Time';
        const colNotes = isBn ? 'বিশেষ নোট' : 'Special Notes';
        const footerNote = isBn 
            ? '* চিকিৎসকের পরামর্শ অনুযায়ী নিয়মিত সঠিক সময়ে ঔষধ গ্রহণ করুন। সুস্থ থাকুন, নিরাপদে থাকুন।'
            : '* Take medications strictly according to your physician\'s advice. Stay safe and healthy.';

        const html = `
            <!DOCTYPE html>
            <html lang="${isBn ? 'bn' : 'en'}">
            <head>
                <meta charset="UTF-8">
                <title>${titleText}</title>
                <link href="https://fonts.googleapis.com/css2?family=Anek+Bangla:wght@400;600;700&family=Plus+Jakarta+Sans:wght@500;600;700&display=swap" rel="stylesheet">
                <style>
                    body { font-family: ${isBn ? "'Anek Bangla'" : "'Plus Jakarta Sans'"}, -apple-system, sans-serif; padding: 25px; color: #1e293b; }
                    .header { text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; }
                    .title { font-size: 22px; font-weight: 700; color: #0f2744; margin: 0; }
                    .date { font-size: 13px; color: #64748b; margin-top: 5px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th, td { border: 1px solid #cbd5e1; padding: 10px 14px; text-align: left; font-size: 13px; }
                    th { background-color: #f0fdfa; color: #0f2744; font-weight: 700; }
                    tr:nth-child(even) { background-color: #f8fafc; }
                    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; background: #e2e8f0; }
                    .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1 class="title">🩺 ${titleText}</h1>
                    <div class="date">${printDateLabel} ${dateStr}</div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>${colSerial}</th>
                            <th>${colName}</th>
                            <th>${colType}</th>
                            <th>${colDosage}</th>
                            <th>${colMeal}</th>
                            <th>${colTime}</th>
                            <th>${colNotes}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${routines.map((r, i) => `
                            <tr>
                                <td>${i + 1}</td>
                                <td><b>${escapeHtml(r.name)}</b></td>
                                <td><span class="badge">${escapeHtml(r.type)}</span></td>
                                <td>${escapeHtml(r.dosage)}</td>
                                <td>${escapeHtml(r.meal)}</td>
                                <td><b>${window.MediCareI18n ? window.MediCareI18n.formatTime(r.time) : r.time}</b></td>
                                <td>${escapeHtml(r.notes || '-')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="footer">
                    ${footerNote}
                </div>
                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    }

    // ==========================================
    // 4. SQLITE QUERY RUNNER & CONSOLE
    // ==========================================
    function executeConsoleQuery() {
        const input = document.getElementById('sqlQueryInput');
        const output = document.getElementById('sqlQueryResult');
        if (!input || !output) return;

        const query = input.value.trim();
        if (!query) return;

        if (!window.MediCareSQLite || !window.MediCareSQLite.isReady()) {
            output.innerHTML = `<div class="p-3 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200">SQLite ডাটাবেজ এখনো প্রস্তুত হয়নি। অনুগ্রহ করে পেজটি রিফ্রেশ করুন।</div>`;
            return;
        }

        const res = window.MediCareSQLite.runQuery(query);
        if (!res.success) {
            output.innerHTML = `<div class="p-3 text-xs font-mono text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200">❌ Error: ${escapeHtml(res.error)}</div>`;
            return;
        }

        if (!res.result || res.result.length === 0) {
            output.innerHTML = `<div class="p-3 text-xs font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200">✅ Query executed successfully. (0 rows returned or DDL/DML statement executed)</div>`;
            // Refresh application store
            window.MediCareStore.init().then(() => {
                if (window.MediCareUI) window.MediCareUI.renderRoutines();
            });
            return;
        }

        // Render table
        const first = res.result[0];
        const cols = first.columns;
        const rows = first.values;

        let tableHtml = `
            <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table class="w-full text-xs text-left">
                    <thead class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                        <tr>
                            ${cols.map(c => `<th class="p-2.5 whitespace-nowrap">${escapeHtml(c)}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-slate-800 dark:text-slate-200">
                        ${rows.map(r => `
                            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                ${r.map(val => `<td class="p-2.5 whitespace-nowrap">${escapeHtml(String(val))}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <p class="text-[11px] text-slate-400 mt-2">মোট রেজাল্ট: ${rows.length} টি রো</p>
        `;

        output.innerHTML = tableHtml;
    }

    function setQuickSql(query) {
        const input = document.getElementById('sqlQueryInput');
        if (input) {
            input.value = query;
            executeConsoleQuery();
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        return String(text).replace(/[&<>"']/g, function (m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
        });
    }

    return {
        calculateBMI,
        addWaterGlass,
        removeWaterGlass,
        renderHydrationUI,
        printPrescriptionSchedule,
        executeConsoleQuery,
        setQuickSql
    };
})();

// Global helpers
window.addWaterGlass = window.MediCareTools.addWaterGlass;
window.removeWaterGlass = window.MediCareTools.removeWaterGlass;
window.printPrescriptionSchedule = window.MediCareTools.printPrescriptionSchedule;
window.executeConsoleQuery = window.MediCareTools.executeConsoleQuery;
window.setQuickSql = window.MediCareTools.setQuickSql;
