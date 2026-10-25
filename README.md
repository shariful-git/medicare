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

8. **📋 Medicine Schedule Cloning & Modification**:
   - **1-Click Routine Duplication**: Directly clone any existing medicine schedule item using the dedicated clone button.
   - **Customizable Info**: Pre-fills existing medicine properties (name, type, dosage, meal instruction, scheduled time, stock, notes) while allowing full customization before saving.
   - **Non-Destructive Scheduling**: Cloned routines are saved as independent entries without altering the source routine, logged automatically in the SQLite history database with distinct badges.

9. **🔒 Native SQLite File (`medicare.sqlite`) & Authentication**:
   - **Node.js Express Backend (`server.js`)**: Serves direct REST APIs connected to a native `medicare.sqlite` file on disk.
   - **User Accounts & Multi-User Profiles**: Secure password hashing with salt, separate routines and history per user.
   - **1-Click Demo Login**: Pre-configured demo account (`demo` / `123456`) for rapid clinical testing.
   - **Direct `.sqlite` Database Download**: Download the live `.sqlite` database file with 1-click directly from the user profile menu.
   - **Mobile-First Responsive Layout**: All login modals, header dropdowns, and schedule views fit seamlessly on mobile devices (320px+).

10. **👤 Multi-User Data Isolation & 1-Click Fresh Database Reset**:
    - **Strict Per-User Data Isolation**: When User A or User B logs in, registers, or stays in guest mode, each user gets their own completely separate routines, intake history logs, stats, and hydration counter.
    - **Fresh Database State**: Starts completely clean with zero fake demo routines and zero sample history logs.
    - **1-Click Fresh Database Reset (`ডাটাবেজ ফ্রেশ / রিসেট`)**: Accessible directly from both the User Profile Dropdown and the Tools tab. Completely wipes legacy records and restores a fresh slate.

11. **🛡️ Dedicated Clinical Admin Panel (`/admin`)**:
    - **Instant Access Route**: Accessible at `http://localhost:3000/admin` (or `/admin.html`), or via the dedicated **"অ্যাডমিন"** button in the header and User Profile menu.
    - **Pre-Configured Admin Credentials**:
      - **Super Admin**: `admin` / `admin123`
      - **Clinical Demo Admin**: `demo` / `123456`
    - **Executive KPI Dashboard**: Total registered patients, active clinical routines, today's system-wide adherence rate (%), and urgent low-stock (≤ 3 doses) warnings.
    - **Server & Database Diagnostics**: Live process uptime, Node.js version, RAM footprint (RSS / Heap), active database engine (`sqlite3` / `node:sqlite`), database file size on disk (`medicare.sqlite`).
    - **User & Patient Management**: View all registered accounts, create new patients/admins, promote/demote roles, reset passwords, view patient routines, and cascade-delete accounts.
    - **Master Prescription & Stock Monitor**: System-wide view of all medicines and injections across all patients with type filtering (Tablets, Injections, Syrups, etc.) and low-stock alerts.
    - **Live Clinical Audit Trail**: Chronological event logs of doses taken, skipped, and modified with real-time search, action filters, pagination, and 1-click CSV/JSON export.
    - **Database Operations**: 1-click live `.sqlite` file snapshot backup download and SQLite VACUUM optimization.

---

## 📁 Project Folder Structure

```text
medi/
├── index.html                                  # Primary boxy clinical web application
├── admin.html                                  # Clinical Admin Panel & Server Control Suite (/admin)
├── package.json                                # Node.js package definition & scripts
├── server.js                                   # Native SQLite backend server & REST API
├── medicare.sqlite                             # Genuine SQLite relational database file
├── README.md                                   # Comprehensive project documentation
├── css/
│   └── style.css                               # Boxy tokens, watermark, animations & clinical styles
└── js/
    ├── admin.js                                # Admin panel controller & diagnostics manager
    ├── auth.js                                 # User authentication & profile manager
    ├── i18n.js                                 # Bangla & English localization and BD detection engine
    ├── config.js                               # Schema and default configurations
    ├── sqlite-db.js                            # WebAssembly SQLite engine
    ├── storage.js                              # CRUD and state management
    ├── tools.js                                # BMI, water tracker & prescription printer
    ├── audio.js                                # Web Audio synthesizer alarms & chimes
    ├── ui.js                                   # Boxy view renderer, modals & notifications
    └── app.js                                  # Lifecycle, search, live clock & alert scanner
```

---

## 🚀 How to Run the Backend Server

```bash
# Start the server (default port 3000)
node server.js
```
Then open `http://localhost:3000` in your desktop or mobile browser.
*(Or double-click `index.html` to run immediately in standalone mode with full SQLite multi-user support!)*

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
