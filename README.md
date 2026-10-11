# 🩺 MediCare - Clinical Boxy Healthcare Portal (MediCare Clinical Suite)

A professional, high-precision clinical medicine and injection schedule, reminder, and healthcare web application. Built with a structured boxy architecture, bilingual localization (Bangla & English) with Bangladesh auto-detection, pure **Anek Bangla** and **Plus Jakarta Sans** typography, a clinical navy color palette, and an institutional background medical watermark logo.

---

## ✨ Key Features & Architecture

1. **🌐 Automatic Bilingual Localization (Bangla & English Localization)**:
   - **Bangladesh Auto-Detection**: If a user visits from Bangladesh (`Asia/Dhaka` timezone or `bn`/`BD` locale), **Bangla** is automatically activated as the default language.
   - **International Visitors**: For visitors from any other country or region worldwide, standard **English** is automatically selected as the default language.
   - **Manual Language Switcher (`বাং / EN`)**: Easily switch between Bangla and English at any time using the header language toggle button.
   - **User Preference Persistence**: Once changed, the language preference is permanently saved in the browser's `localStorage`.
   - **Comprehensive Translation Coverage**: Complete bilingual support across headers, hero banner, progress bars, medicine cards, status badges, meal instructions, water intake tracker, BMI calculator, dose history logs, emergency helplines, modal dialogs, and alert toasts.

2. **📦 Structured Boxy Design (Clinical Architecture)**:
   - Clean, geometric rectangular cards (`border-radius: 6px`) instead of excessive bubble or pill shapes.
   - Clinical Navy (`#0f2744`), Surgical Blue (`#0284c7`), Emerald Green (`#059669`), and high-contrast crisp borders (`#cbd5e1`).
   - Clean, trustworthy information hierarchy modeled after enterprise hospital software and clinical portals.

3. **🏥 Background Medical Watermark Logo on Dashboard**:
   - Subtle opacity institutional medical cross and pulse rhythm watermark embedded into the hero dashboard background (`.dashboard-watermark`).

4. **🔤 Premium Clinical Typography (Anek Bangla & Plus Jakarta Sans)**:
   - Pure **Anek Bangla** font for Bengali text.
   - Modern medical standard **Plus Jakarta Sans** for English text.
   - High-precision monospaced **JetBrains Mono** for numerical values, live clock, and measurements.

5. **📱 Mobile-Optimized UX & One-Handed Usability**:
   - Minimum 44px touch targets (`min-h-[44px]`) on every interactive button for effortless one-handed thumb navigation on smartphones.
   - Boxy mobile bottom navigation bar with instant access action buttons.
   - Dynamic safe padding (`pb-24 sm:pb-8`) to prevent UI occlusion on mobile viewports.

6. **💾 Background SQLite WebAssembly Database & Pagination (20 Per Page)**:
   - Reliable, completely offline data storage within the browser's local sandbox memory.
   - **Unified Card & Typography Architecture**: History and activity log cards share the identical typography, boxy card sizing (`med-card`), 11x11 icon boxes, action badges, and timestamps as the main medicine schedule.
   - **Search & Filter Bar**: Real-time search query input and filter pills (`All`, `Taken`, `Changes & Others`).
   - **Clean 20-Item Pagination**: Swift page navigation (`Previous`, `1`, `2`, `3` ..., `Next`), total log count tracking, and 1-click clinical history clearing.

7. **🛠️ Integrated Clinical Tools**:
   - **Water Intake Tracker**: Boxy gauge display with daily goal completion tracking.
   - **BMI Calculator**: Body Mass Index evaluation with personalized health insights.
   - **Prescription Print Chart**: 1-click formatted clinical chart printing.
   - **Emergency Hotlines**: Direct calling for emergency services (999, 16263, 10655).

---

## 📁 Project Folder Structure

```text
medi/
├── index.html                                  # Primary boxy clinical web application
├── medicine_injection_reminder_web_app.html    # Backward compatible file (synchronized)
├── README.md                                   # Comprehensive project documentation
├── css/
│   └── style.css                               # Boxy tokens, watermark, animations & clinical styles
└── js/
    ├── i18n.js                                 # Bangla & English localization and BD detection engine
    ├── config.js                               # Schema and default configurations
    ├── sqlite-db.js                            # Background WebAssembly SQLite engine
    ├── storage.js                              # CRUD and state management
    ├── tools.js                                # BMI, water tracker & prescription printer
    ├── audio.js                                # Web Audio synthesizer alarms & chimes
    ├── ui.js                                   # Boxy view renderer, modals & notifications
    └── app.js                                  # Lifecycle, search, live clock & alert scanner
```

---

## 🌍 How Localization Works (Localization Logic)

1. **Auto-Detection Algorithm**:
   - Inspects the user's browser timezone: if `Intl.DateTimeFormat().resolvedOptions().timeZone` is `'Asia/Dhaka'`, default language is set to `'bn'` (Bangla).
   - If browser language or region (`navigator.languages` / `navigator.language`) contains `'bn'`, `'bn-BD'`, or `'BD'`, default language is set to `'bn'`.
   - If neither condition matches (e.g., visitors from US, UK, Canada, India, Middle East, etc.), default language automatically resolves to `'en'` (English).

2. **User Preference Override**:
   - When a user clicks the `বাং / EN` toggle button in the header, their selection is stored in `localStorage` under the `medicare_language` key, taking top priority on future visits.

---

## 🚀 Getting Started

Simply open **`index.html`** directly in any modern mobile or desktop web browser. The application runs entirely offline without requiring any server, build step, or active internet connection.
