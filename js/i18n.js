/**
 * MediCare - Internationalization & Localization (i18n) Engine
 * Supports: Bangla ('bn') and English ('en')
 * Default Rule: Bangladesh (Asia/Dhaka, bn, BD) -> 'bn', All other countries -> 'en'
 */

window.MediCareI18n = (function () {
    let currentLang = 'en';

    const TRANSLATIONS = {
        bn: {
            app_title: 'মেডিকেয়ার',
            app_badge: 'ক্লিনিক্যাল সংস্করণ',
            system_time: 'সিস্টেম সময়',
            active_status: 'সক্রিয়',
            alert_btn: 'অ্যালার্ট',
            alert_active: 'অ্যালার্ট চালু',

            // Hero Banner
            greeting_morning: 'শুভ সকাল!',
            greeting_afternoon: 'শুভ দুপুর!',
            greeting_evening: 'শুভ বিকেল!',
            greeting_night: 'শুভ রাত্রি!',
            hero_tagline: 'নিয়মিত সময়সূচি অনুযায়ী ঔষধ সেবন নিশ্চিত করুন',
            hero_title: 'দৈনিক ঔষধ ও ইনজেকশন সেবা সূচি',
            hero_desc: 'ট্যাবলেট, ইনজেকশন কিংবা সিরাপ—প্রতিটি ঔষধের নির্ভুল শিডিউল, রিমাইন্ডার এবং ক্লিনিক্যাল অ্যালার্ট।',
            progress_label: 'আজকের রুটিন সম্পন্ন:',
            stat_total: 'মোট:',
            stat_pending: 'বাকি:',
            stat_taken: 'সম্পন্ন:',
            item_unit: 'টি',
            add_routine_btn: 'নতুন রুটিন যোগ করুন',
            print_prescription_btn: 'প্রেসক্রিপশন প্রিন্ট',

            // Navigation Tabs
            tab_schedule: 'ঔষধ শিডিউল',
            tab_tools: 'পানি ও বিএমআই টুলস',
            tab_history: 'সেবনের ইতিহাস',
            tab_emergency: 'জরুরি হেল্পলাইন',

            // Search & Filter Bar
            search_placeholder: 'ঔষধের নাম বা নোট দিয়ে খুঁজুন...',
            filter_all: 'সবগুলো',
            filter_pending: 'বাকি আছে',
            filter_taken: 'সেবন করেছি',
            sound_test: 'সাউন্ড টেস্ট',

            // Empty State
            empty_title: 'কোনো রুটিন পাওয়া যায়নি',
            empty_desc: 'আপনার ঔষধ বা ইনজেকশনের নিয়ম যুক্ত করতে নতুন রুটিন যোগ করুন।',

            // Routine Card Labels & Buttons
            dosage_label: 'পরিমাণ:',
            meal_label: 'নির্দেশনা:',
            stock_label: 'স্টক:',
            stock_out: '❌ স্টক শেষ',
            note_prefix: 'নোট:',
            btn_taken: 'খেয়েছি',
            btn_undo: 'আনডু',
            btn_edit: 'সম্পাদনা করুন',
            btn_clone: 'ক্লোন করুন',
            btn_delete: 'ডিলিট করুন',

            // Time of Day Badges
            time_morning: '🌅 সকাল',
            time_noon: '☀️ দুপুর',
            time_evening: '🌆 সন্ধ্যা',
            time_night: '🌙 রাত',

            // Medicine Types
            type_tablet: 'ট্যাবলেট',
            type_injection: 'ইনজেকশন',
            type_capsule: 'ক্যাপসুল',
            type_syrup: 'সিরাপ',
            type_drop: 'ড্রপ',
            type_other: 'অন্যান্য',

            // Hydration Tool
            water_title: 'পানি পানের ট্র্যাকার',
            water_subtitle: 'প্রতিদিন পর্যাপ্ত পানি পান সুস্থতার চাবিকাঠি',
            water_today: 'আজকের সেবন:',
            water_goal_prefix: 'মিলি (লক্ষ্য:',
            water_goal_suffix: 'মিলি)',
            water_tip: 'ঔষধ সেবনের পূর্বে ও পরে ১ গ্লাস পানি পান ওষুধের সঠিক শোষণ নিশ্চিত করে।',
            btn_add_glass: '+১ গ্লাস (২৫০ মিলি)',

            // BMI Tool
            bmi_title: 'বিএমআই (BMI) ক্যালকুলেটর',
            bmi_subtitle: 'শরীরের ওজন ও উচ্চতার অনুপাত যাচাই করুন',
            weight_label: 'ওজন (কেজি)',
            weight_placeholder: 'যেমন: 68',
            height_label: 'উচ্চতা (সেমি)',
            height_placeholder: 'যেমন: 170',
            btn_calc_bmi: 'বিএমআই হিসাব করুন',
            bmi_score_label: 'আপনার বিএমআই স্কোর',
            bmi_underweight: 'কম ওজন (Underweight)',
            bmi_underweight_advice: 'পুষ্টিকর সুষম খাবার গ্রহণ করুন এবং ডাক্তারের পরামর্শ অনুযায়ী ভিটামিন যুক্ত করুন।',
            bmi_healthy: 'স্বাভাবিক ওজন (Healthy)',
            bmi_healthy_advice: 'আপনার ওজন একদম আদর্শ! নিয়মিত হাঁটাচলা ও স্বাস্থ্যকর খাদ্যাভ্যাস বজায় রাখুন।',
            bmi_overweight: 'অতিরিক্ত ওজন (Overweight)',
            bmi_overweight_advice: 'মিষ্টি ও অতিরিক্ত তৈলাক্ত খাবার এড়িয়ে চলুন এবং প্রতিদিন অন্তত ৩০ মিনিট হাঁটুন।',
            bmi_obese: 'স্থূলতা (Obese)',
            bmi_obese_advice: 'ডাক্তার বা পুষ্টিবিদের পরামর্শ নিন এবং নিয়মিত শারীরিক ব্যায়াম শুরু করুন।',
            bmi_invalid_input: 'অনুগ্রহ করে সঠিক ওজন (কেজি) এবং উচ্চতা (সেমি) দিন।',

            // History Log View & Pagination
            history_title: 'ঔষধ সেবনের ইতিহাস ও অ্যাক্টিভিটি লগ',
            history_subtitle: 'প্রতিটি ডোজ কখন গ্রহণ বা পরিবর্তন করা হয়েছে তার নির্ভরযোগ্য তালিকা।',
            history_empty_title: 'এখনো কোনো সেবনের ইতিহাস রেকর্ড হয়নি।',
            history_empty_subtitle: 'ঔষধ গ্রহণ বা আনডু করলে তা স্বয়ংক্রিয়ভাবে এখানে তালিকাভুক্ত হবে।',
            history_search_placeholder: 'ইতিহাস বা ঔষধের নাম দিয়ে খুঁজুন...',
            history_filter_changes: 'পরিবর্তন ও অন্যান্য',
            history_page_size: 'প্রতি পৃষ্ঠায় ২০টি',
            history_total_badge: 'মোট {total}টি লগ (২০টি/পৃষ্ঠা)',
            history_showing: 'দেখাচ্ছে {from} - {to} (মোট {total}টি লগ)',
            history_page_info: 'পৃষ্ঠা {current} / {total}',
            pagination_prev: 'পূর্ববর্তী',
            pagination_next: 'পরবর্তী',
            pagination_first: 'প্রথম',
            pagination_last: 'শেষ',
            clear_history_btn: 'হিস্ট্রি মুছুন',
            clear_history_confirm: 'আপনি কি নিশ্চিত যে সমস্ত সেবনের ইতিহাস মুছে ফেলতে চান? এটি পুনরায় ফিরিয়ে আনা যাবে না।',
            clear_history_modal_title: 'সেবনের ইতিহাস মুছে ফেলতে চান?',
            clear_history_modal_desc: 'আপনার সকল অতীত সেবনের রেকর্ড এবং অ্যাক্টিভিটি লগ স্থায়ীভাবে মুছে যাবে। এটি আর পুনরুদ্ধার করা যাবে না। আপনি কি নিশ্চিত?',
            toast_history_cleared: 'সমস্ত সেবনের ইতিহাস সফলভাবে মুছে ফেলা হয়েছে',
            log_action_taken: 'ডোজ গ্রহণ করা হয়েছে',
            log_action_undo: 'ডোজ আনডু করা হয়েছে',
            log_action_added: 'নতুন রুটিন যুক্ত করা হয়েছে',
            log_action_cloned: 'শিডিউল ক্লোন করে যুক্ত করা হয়েছে',
            log_action_updated: 'রুটিন তথ্য আপডেট করা হয়েছে',
            log_action_deleted: 'রুটিন মুছে ফেলা হয়েছে',

            // Emergency Contacts View
            emergency_title: 'জরুরি হেল্পলাইন ও হটলাইন নম্বর',
            emergency_subtitle: 'যেকোনো স্বাস্থ্য বা মেডিকেল জরুরি প্রয়োজনে সরাসরি কল করুন।',
            btn_call: 'কল করুন',
            em_national_title: 'জাতীয় জরুরি সেবা (৯৯৯)',
            em_national_sub: 'পুলিশ, অ্যাম্বুলেন্স ও ফায়ার সার্ভিস',
            em_health_title: 'স্বাস্থ্য বাতায়ন (১৬২৬৩)',
            em_health_sub: '২৪/৭ বিনামূল্যে ডাক্তারের পরামর্শ',
            em_iedcr_title: 'IEDCR হেল্পলাইন (১০৬৫৫)',
            em_iedcr_sub: 'রোগ নিয়ন্ত্রণ ও সংক্রামক ব্যাধি',
            em_mental_title: 'মানসিক স্বাস্থ্য হেল্পলাইন (১৬৮০০)',
            em_mental_sub: 'মানসিক স্বাস্থ্য ও কাউন্সেলিং সেবা',

            // Routine Add/Edit Modal
            modal_add_title: 'নতুন ঔষধ / ইনজেকশন যোগ করুন',
            modal_edit_title: 'ঔষধের তথ্য সম্পাদনা করুন',
            modal_clone_title: 'ঔষধ শিডিউল ক্লোন করুন',
            modal_clone_banner_title: 'ঔষধ শিডিউল ক্লোন মোড',
            modal_clone_notice: 'পূর্ববর্তী তথ্যের ওপর ভিত্তি করে নতুন শিডিউল তৈরি হচ্ছে। আপনি চাইলে সময়, ডোজ বা যেকোনো গুরুত্বপূর্ণ তথ্য পরিবর্তন করে সংরক্ষণ করতে পারেন।',
            btn_clone_save: 'ক্লোন সংরক্ষণ করুন',
            field_name: 'ঔষধ অথবা ইনজেকশনের নাম *',
            placeholder_name: 'যেমন: Napa Extra, Lantus Insulin, Seclo',
            field_type: 'ধরন নির্বাচন করুন',
            field_dosage: 'ডোজ / পরিমাণ *',
            placeholder_dosage: '১টি / 10 UI / ২ চামচ',
            field_meal: 'খাবার নির্দেশনা',
            meal_before: 'খাবারের আগে (Before Meal)',
            meal_after: 'খাবারের পরে (After Meal)',
            meal_with: 'খাবারের সাথে (With Meal)',
            meal_empty: 'খালি পেটে (Empty Stomach)',
            meal_anytime: 'যেকোনো সময় (Anytime)',
            field_time: 'সেবনের নির্ধারিত সময় (HH:MM) *',
            time_quick: 'সহজে বাছুন:',
            time_quick_morning: 'সকাল ৮:০০',
            time_quick_afternoon: 'দুপুর ২:০০',
            time_quick_night: 'রাত ৯:০০',
            field_stock: 'স্টক বা বাকি সংখ্যা (ঐচ্ছিক)',
            placeholder_stock: 'যেমন: ৩০',
            field_notes: 'বিশেষ কোনো নোট',
            placeholder_notes: 'ঠান্ডা জায়গায় রাখুন, ইত্যাদি',
            btn_cancel: 'বাতিল',
            btn_save: 'সংরক্ষণ করুন',

            // Delete Modal
            delete_modal_title: 'রুটিন মুছে ফেলতে চান?',
            delete_modal_desc_suffix: 'এর শিডিউলটি স্থায়ীভাবে মুছে ফেলা হবে। আপনি কি নিশ্চিত?',
            btn_delete_confirm: 'মুছে ফেলুন',

            // Alarm Modal
            alarm_title: 'ঔষধ সেবনের সময় হয়েছে!',
            alarm_btn_take: 'খেয়েছি / সেবন করেছি',
            alarm_btn_snooze: 'পরে মনে করিয়ে দিন (Snooze)',
            alarm_time_prefix: 'নির্ধারিত সময়:',

            // Toast Alerts
            toast_taken: 'ঔষধ সেবন সম্পন্ন হিসেবে চিহ্নিত হয়েছে!',
            toast_undo: 'সেবনের হিসাব আনডু করা হয়েছে',
            toast_deleted: 'রুটিনটি সফলভাবে মুছে ফেলা হয়েছে',
            toast_updated: 'ঔষধের তথ্য সফলভাবে আপডেট হয়েছে!',
            toast_added: 'নতুন রুটিন সফলভাবে যুক্ত হয়েছে!',
            toast_cloned: 'ঔষধ শিডিউল সফলভাবে ক্লোন ও সংরক্ষণ করা হয়েছে!',
            toast_dark_on: 'ডার্ক মোড সক্রিয় হয়েছে',
            toast_light_on: 'লাইট মোড সক্রিয় হয়েছে',
            toast_lang_switched: 'ভাষা পরিবর্তন: বাংলা'
        },

        en: {
            app_title: 'MediCare',
            app_badge: 'Clinical Edition',
            system_time: 'System Time',
            active_status: 'Active',
            alert_btn: 'Alert',
            alert_active: 'Alert Active',

            // Hero Banner
            greeting_morning: 'Good morning!',
            greeting_afternoon: 'Good afternoon!',
            greeting_evening: 'Good evening!',
            greeting_night: 'Good night!',
            hero_tagline: 'Ensure timely medication for healthy living',
            hero_title: 'Daily Medicine & Injection Schedule',
            hero_desc: 'Tablets, injections, or syrups—accurate dosage scheduling, stock tracking, and clinical alerts.',
            progress_label: "Today's Routine Progress:",
            stat_total: 'Total:',
            stat_pending: 'Pending:',
            stat_taken: 'Taken:',
            item_unit: 'doses',
            add_routine_btn: 'Add New Routine',
            print_prescription_btn: 'Print Schedule',

            // Navigation Tabs
            tab_schedule: 'Medicine Schedule',
            tab_tools: 'Water & BMI Tools',
            tab_history: 'Intake History',
            tab_emergency: 'Emergency Helplines',

            // Search & Filter Bar
            search_placeholder: 'Search by medicine name or notes...',
            filter_all: 'All',
            filter_pending: 'Pending',
            filter_taken: 'Taken',
            sound_test: 'Sound Test',

            // Empty State
            empty_title: 'No Routines Found',
            empty_desc: 'Add a new routine to schedule your medicines or injections.',

            // Routine Card Labels & Buttons
            dosage_label: 'Dosage:',
            meal_label: 'Instructions:',
            stock_label: 'Stock:',
            stock_out: '❌ Out of stock',
            note_prefix: 'Note:',
            btn_taken: 'Taken',
            btn_undo: 'Undo',
            btn_edit: 'Edit',
            btn_clone: 'Clone',
            btn_delete: 'Delete',

            // Time of Day Badges
            time_morning: '🌅 Morning',
            time_noon: '☀️ Afternoon',
            time_evening: '🌆 Evening',
            time_night: '🌙 Night',

            // Medicine Types
            type_tablet: 'Tablet',
            type_injection: 'Injection',
            type_capsule: 'Capsule',
            type_syrup: 'Syrup',
            type_drop: 'Drops',
            type_other: 'Other',

            // Hydration Tool
            water_title: 'Water Intake Tracker',
            water_subtitle: 'Adequate daily hydration is key to wellbeing',
            water_today: "Today's Intake:",
            water_goal_prefix: 'ml (Goal:',
            water_goal_suffix: 'ml)',
            water_tip: 'Drinking 1 glass of water before and after medicine ensures proper absorption.',
            btn_add_glass: '+1 Glass (250 ml)',

            // BMI Tool
            bmi_title: 'BMI Calculator',
            bmi_subtitle: 'Check your weight-to-height ratio',
            weight_label: 'Weight (kg)',
            weight_placeholder: 'e.g. 68',
            height_label: 'Height (cm)',
            height_placeholder: 'e.g. 170',
            btn_calc_bmi: 'Calculate BMI',
            bmi_score_label: 'Your BMI Score',
            bmi_underweight: 'Underweight',
            bmi_underweight_advice: 'Consume nutrient-rich balanced foods and consult a doctor regarding vitamins.',
            bmi_healthy: 'Normal / Healthy Weight',
            bmi_healthy_advice: 'Your weight is ideal! Maintain active habits and a balanced diet.',
            bmi_overweight: 'Overweight',
            bmi_overweight_advice: 'Reduce sugary and high-calorie foods; aim for at least 30 minutes of walking daily.',
            bmi_obese: 'Obese',
            bmi_obese_advice: 'Consult a physician or dietitian and start a tailored exercise routine.',
            bmi_invalid_input: 'Please enter valid weight (kg) and height (cm).',

            // History Log View & Pagination
            history_title: 'Dose Intake History & Logs',
            history_subtitle: 'A reliable log of when each medication was taken or modified.',
            history_empty_title: 'No intake history recorded yet.',
            history_empty_subtitle: 'Taking doses or undoing actions will automatically be logged here.',
            history_search_placeholder: 'Search history by medicine or action...',
            history_filter_changes: 'Modifications & Logs',
            history_page_size: '20 per page',
            history_total_badge: 'Total {total} logs (20/page)',
            history_showing: 'Showing {from} - {to} of {total} logs',
            history_page_info: 'Page {current} of {total}',
            pagination_prev: 'Previous',
            pagination_next: 'Next',
            pagination_first: 'First',
            pagination_last: 'Last',
            clear_history_btn: 'Clear Logs',
            clear_history_confirm: 'Are you sure you want to clear all medication intake logs? This action cannot be undone.',
            clear_history_modal_title: 'Clear History Logs?',
            clear_history_modal_desc: 'All past intake records and activity logs will be permanently deleted. This action cannot be undone. Are you sure?',
            toast_history_cleared: 'All intake history logs cleared successfully',
            log_action_taken: 'Dose administered',
            log_action_undo: 'Dose was undone',
            log_action_added: 'New routine added',
            log_action_cloned: 'Routine cloned & scheduled',
            log_action_updated: 'Routine updated',
            log_action_deleted: 'Routine removed',

            // Emergency Contacts View
            emergency_title: 'Emergency Helplines & Hotlines',
            emergency_subtitle: 'Call directly for immediate medical or health assistance.',
            btn_call: 'Call',
            em_national_title: 'National Emergency Service (999)',
            em_national_sub: 'Police, Ambulance & Fire Service',
            em_health_title: 'Health Helpline (16263)',
            em_health_sub: '24/7 Free Doctor Consultation',
            em_iedcr_title: 'IEDCR Helpline (10655)',
            em_iedcr_sub: 'Disease Control & Epidemic Center',
            em_mental_title: 'Mental Health Helpline (16800)',
            em_mental_sub: 'Mental Health & Counseling Service',

            // Routine Add/Edit Modal
            modal_add_title: 'Add New Medicine / Injection',
            modal_edit_title: 'Edit Medicine Routine',
            modal_clone_title: 'Clone Medicine Schedule',
            modal_clone_banner_title: 'Medicine Schedule Clone Mode',
            modal_clone_notice: 'Creating a duplicate routine based on this schedule. Modify time, dosage, or any details before saving.',
            btn_clone_save: 'Save Cloned Routine',
            field_name: 'Medicine / Injection Name *',
            placeholder_name: 'e.g. Napa Extra, Lantus Insulin, Seclo',
            field_type: 'Select Type',
            field_dosage: 'Dosage / Quantity *',
            placeholder_dosage: '1 tab / 10 UI / 2 spoons',
            field_meal: 'Meal Instruction',
            meal_before: 'Before Meal',
            meal_after: 'After Meal',
            meal_with: 'With Meal',
            meal_empty: 'Empty Stomach',
            meal_anytime: 'Anytime',
            field_time: 'Scheduled Time (HH:MM) *',
            time_quick: 'Quick Pick:',
            time_quick_morning: '8:00 AM',
            time_quick_afternoon: '2:00 PM',
            time_quick_night: '9:00 PM',
            field_stock: 'Stock Count (Optional)',
            placeholder_stock: 'e.g. 30',
            field_notes: 'Special Notes',
            placeholder_notes: 'Keep in cool place, etc.',
            btn_cancel: 'Cancel',
            btn_save: 'Save Routine',

            // Delete Modal
            delete_modal_title: 'Delete Routine?',
            delete_modal_desc_suffix: 'will be permanently removed from your schedule. Are you sure?',
            btn_delete_confirm: 'Delete',

            // Alarm Modal
            alarm_title: 'Time to Take Your Medicine!',
            alarm_btn_take: 'Taken / Administered',
            alarm_btn_snooze: 'Remind Later (Snooze)',
            alarm_time_prefix: 'Scheduled Time:',

            // Toast Alerts
            toast_taken: 'Medication marked as taken!',
            toast_undo: 'Medication intake was undone',
            toast_deleted: 'Routine successfully deleted',
            toast_updated: 'Routine updated successfully!',
            toast_added: 'New routine added successfully!',
            toast_cloned: 'Medicine schedule cloned and saved successfully!',
            toast_dark_on: 'Dark mode enabled',
            toast_light_on: 'Light mode enabled',
            toast_lang_switched: 'Language switched: English'
        }
    };

    /**
     * Determine default language based on user location:
     * If Bangladesh (Asia/Dhaka, bn-BD, or BD) -> 'bn'
     * Any other country -> 'en'
     */
    function detectDefaultLanguage() {
        // 1. Honor explicit saved user choice if present
        const saved = localStorage.getItem('medicare_language');
        if (saved === 'bn' || saved === 'en') {
            return saved;
        }

        try {
            // 2. Primary check: Timezone of Bangladesh is 'Asia/Dhaka'
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (timeZone === 'Asia/Dhaka') {
                return 'bn';
            }

            // 3. Secondary check: Navigator languages for Bangladesh
            const langs = navigator.languages || [navigator.language || ''];
            for (const l of langs) {
                const lower = l.toLowerCase();
                if (lower === 'bn' || lower.startsWith('bn-') || lower.endsWith('-bd') || lower.includes('bd')) {
                    return 'bn';
                }
            }
        } catch (e) {
            console.warn('Language auto-detection exception:', e);
        }

        // 4. Fallback for any other country in the world
        return 'en';
    }

    function init() {
        currentLang = detectDefaultLanguage();
        applyLanguage(currentLang, false);
    }

    function getLanguage() {
        return currentLang;
    }

    function setLanguage(lang, notify = true) {
        if (lang !== 'bn' && lang !== 'en') return;
        currentLang = lang;
        localStorage.setItem('medicare_language', lang);
        applyLanguage(lang, notify);
    }

    function toggleLanguage() {
        const nextLang = currentLang === 'bn' ? 'en' : 'bn';
        setLanguage(nextLang, true);
    }

    function t(key, defaultVal = '') {
        const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
        return dict[key] !== undefined ? dict[key] : (defaultVal || key);
    }

    function formatTime(timeStr) {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':');
        const hour = parseInt(h, 10);
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${m} ${period}`;
    }

    function formatDate(dateObj = new Date()) {
        const locale = currentLang === 'bn' ? 'bn-BD' : 'en-US';
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return dateObj.toLocaleDateString(locale, options);
    }

    function getTimeOfDayBadge(timeStr) {
        if (!timeStr) return '';
        const [h] = timeStr.split(':');
        const hour = parseInt(h, 10);
        if (hour >= 5 && hour < 12) {
            return `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40">${t('time_morning')}</span>`;
        } else if (hour >= 12 && hour < 16) {
            return `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300 border border-orange-200/60 dark:border-orange-800/40">${t('time_noon')}</span>`;
        } else if (hour >= 16 && hour < 19) {
            return `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40">${t('time_evening')}</span>`;
        } else {
            return `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40">${t('time_night')}</span>`;
        }
    }

    function getGreetingText() {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return t('greeting_morning');
        if (hour >= 12 && hour < 16) return t('greeting_afternoon');
        if (hour >= 16 && hour < 19) return t('greeting_evening');
        return t('greeting_night');
    }

    function applyLanguage(lang, notify = false) {
        document.documentElement.lang = lang;

        // Apply translations to all DOM elements tagged with data-i18n
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) {
                el.textContent = t(key);
            }
        });

        // Apply placeholder translations
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (key) {
                el.setAttribute('placeholder', t(key));
            }
        });

        // Apply title translations
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (key) {
                el.setAttribute('title', t(key));
            }
        });

        // Update Language Switcher Button UI
        const langLabel = document.getElementById('currentLangLabel');
        if (langLabel) {
            langLabel.textContent = lang === 'bn' ? 'বাং' : 'EN';
        }

        // Update Date in header
        const dateEl = document.getElementById('headerCurrentDate');
        if (dateEl) {
            dateEl.textContent = formatDate(new Date());
        }

        // Re-render UI components if present
        if (window.MediCareUI) {
            window.MediCareUI.renderRoutines();
            window.MediCareUI.renderHistoryView();
        }
        if (window.MediCareTools) {
            window.MediCareTools.renderHydrationUI();
        }

        if (notify && window.MediCareUI) {
            window.MediCareUI.showToast(t('toast_lang_switched'), 'info');
        }
    }

    function formatNumber(num) {
        if (num === null || num === undefined) return '';
        if (currentLang === 'bn') {
            const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
            return String(num).replace(/\d/g, d => bnDigits[Number(d)]);
        }
        return String(num);
    }

    return {
        init,
        getLanguage,
        setLanguage,
        toggleLanguage,
        detectDefaultLanguage,
        t,
        formatTime,
        formatDate,
        formatNumber,
        getTimeOfDayBadge,
        getGreetingText,
        applyLanguage,
        TRANSLATIONS
    };
})();
