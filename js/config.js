/**
 * MediCare - Application Configuration, Constants & Schemas
 */

window.MediCareConfig = {
    STORAGE_KEY: 'medicare_routines_v2',
    HYDRATION_KEY: 'medicare_hydration_v1',
    THEME_KEY: 'medicare_theme_mode',
    
    // SQLite Table Schemas
    SQLITE_SCHEMA: `
        CREATE TABLE IF NOT EXISTS routines (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            dosage TEXT NOT NULL,
            meal TEXT NOT NULL,
            time TEXT NOT NULL,
            stock INTEGER DEFAULT 0,
            notes TEXT,
            takenToday INTEGER DEFAULT 0,
            lastTakenDate TEXT,
            createdAt TEXT
        );

        CREATE TABLE IF NOT EXISTS history_logs (
            id TEXT PRIMARY KEY,
            routine_id TEXT,
            routine_name TEXT,
            action TEXT,
            timestamp TEXT,
            date_str TEXT
        );

        CREATE TABLE IF NOT EXISTS hydration (
            date_str TEXT PRIMARY KEY,
            glasses INTEGER DEFAULT 0,
            target INTEGER DEFAULT 8
        );
    `,

    DEFAULT_ROUTINES: [
        {
            id: 'demo-1',
            name: 'ইনসুলিন (Lantus)',
            type: 'injection',
            dosage: '10 UI',
            meal: 'খাবারের ৩০ মিনিট আগে',
            time: '21:30',
            stock: 5,
            notes: 'ফ্রিজের নিচের দরজায় রাখতে হবে',
            takenToday: false,
            lastTakenDate: '',
            createdAt: new Date().toISOString()
        },
        {
            id: 'demo-2',
            name: 'Napa Extend (৬৬৫ মিলিগ্রাম)',
            type: 'tablet',
            dosage: '১ টি',
            meal: 'খাবারের পরে (After Meal)',
            time: '08:30',
            stock: 14,
            notes: 'জ্বর ও শরীর ব্যথার জন্য',
            takenToday: true,
            lastTakenDate: new Date().toDateString(),
            createdAt: new Date().toISOString()
        },
        {
            id: 'demo-3',
            name: 'Seclo 20mg (ওমিপ্রাজল)',
            type: 'capsule',
            dosage: '১ টি',
            meal: 'খালি পেটে (Empty Stomach)',
            time: '07:30',
            stock: 20,
            notes: 'সকালে ঘুম থেকে উঠে সেব্য',
            takenToday: false,
            lastTakenDate: '',
            createdAt: new Date().toISOString()
        }
    ],

    TYPE_MAPPINGS: {
        injection: {
            label: 'ইনজেকশন',
            color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50',
            icon: 'syringe',
            iconColor: 'text-rose-500'
        },
        capsule: {
            label: 'ক্যাপসুল',
            color: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/50',
            icon: 'shield',
            iconColor: 'text-indigo-500'
        },
        syrup: {
            label: 'সিরাপ',
            color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50',
            icon: 'flask-conical',
            iconColor: 'text-amber-500'
        },
        drop: {
            label: 'ড্রপ',
            color: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/50',
            icon: 'droplet',
            iconColor: 'text-sky-500'
        },
        tablet: {
            label: 'ট্যাবলেট',
            color: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/50',
            icon: 'pill',
            iconColor: 'text-teal-500'
        },
        other: {
            label: 'অন্যান্য',
            color: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
            icon: 'package',
            iconColor: 'text-slate-500'
        }
    },

    EMERGENCY_CONTACTS: [
        {
            title: 'জাতীয় জরুরি সেবা',
            subtitle: 'পুলিশ, অ্যাম্বুলেন্স ও ফায়ার সার্ভিস',
            number: '999',
            icon: 'phone-call',
            color: 'bg-rose-500 text-white'
        },
        {
            title: 'স্বাস্থ্য বাতায়ন',
            subtitle: '২৪/৭ বিনামূল্যে ডাক্তারের পরামর্শ',
            number: '16263',
            icon: 'heart-pulse',
            color: 'bg-teal-600 text-white'
        },
        {
            title: 'IEDCR হেল্পলাইন',
            subtitle: 'রোগ নিয়ন্ত্রণ ও সংক্রামক ব্যাধি',
            number: '10655',
            icon: 'activity',
            color: 'bg-indigo-600 text-white'
        },
        {
            title: 'জাতীয় মানসিক স্বাস্থ্য হেল্পলাইন',
            subtitle: 'মানসিক স্বাস্থ্য পরামর্শ ও সেবা',
            number: '16800',
            icon: 'smile',
            color: 'bg-amber-600 text-white'
        }
    ]
};
