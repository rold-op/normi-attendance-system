# NORMI Attendance System

RFID-powered campus laboratory and classroom attendance management platform for **Northern Mindanao Colleges, Inc. (NORMI)**.

---

## Features

- **RFID Tap Ingestion & Real-Time Monitoring:** Live attendance logging with support for USB wedge readers and physical ESP32 scanner terminals with flash memory offline buffering.
- **Academic Hierarchy Management:**
  - Colleges and departments management.
  - Classrooms and computer laboratories management.
  - Class timetables and instructor schedule tracking with custom grace periods.
  - Student database with RFID card assignments and card status tracking (Active, Lost, Deactivated).
- **Automated Attendance Analytics:** Daily, weekly, monthly, and yearly scan volume trends, departmental occupancy distribution donut charts, and live tap activity stream.
- **Role-Based Access Control (RBAC):**
  - **Super Admin:** Full platform configuration, user account provisioning, and operational database management.
  - **Dean:** Departmental oversight, schedule reviews, and student rosters.
  - **Instructor:** Attendance sheet tracking and manual attendance overrides.
- **Minimalist Institutional Design System:**
  - Styled with self-hosted **Geist Sans** and **Geist Mono** for high-density, crisp tabular numbers.
  - Subtle Apple-grade hairline borders, generous whitespace, tactile interactions, and institutional Forest Green branding (`#1E5628`).
- **Relational MySQL 8.0 & SQLite Backend:** Full database schema with auto-increment ID counters and referential integrity.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Recharts, Sonner
- **Backend:** Node.js, Express, `mysql2` (MySQL 8.0+), `node:sqlite` (SQLite fallback)
- **Typography:** Self-hosted offline-ready Geist Variable Font family
- **Testing:** Playwright automated visual inspection

---

## Getting Started

### 1. Prerequisites
- **Node.js** (v20+ recommended)
- **MySQL Server 8.0+** (or MySQL Workbench / XAMPP)

### 2. Installation
```bash
git clone https://github.com/rold-op/normi-attendance-system.git
cd normi-attendance-system
npm install
```

### 3. Database Setup (MySQL)
1. Open **MySQL Workbench** or MySQL CLI.
2. Run the provided schema script [normi_attendance_schema.sql](normi_attendance_schema.sql):
   ```bash
   mysql -u root -p < normi_attendance_schema.sql
   ```
3. Create your `.env` configuration from `.env.example`:
   ```env
   DB_TYPE=mysql
   MYSQL_HOST=127.0.0.1
   MYSQL_PORT=3306
   MYSQL_USER=root
   MYSQL_PASSWORD=your_mysql_password
   MYSQL_DATABASE=normi_attendance
   PORT=3000
   ```

### 4. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Production Build
```bash
npm run build
npm start
```

---

## Default Super Admin Account

- **Email:** `admin@normi.edu.ph`
- **Role:** Super Admin
- Initial setup or password configuration can be claimed via the First-Run Setup dialog or configured via `SUPER_ADMIN_PASSWORD` in `.env`.

---

## License

Institutional Property of **Northern Mindanao Colleges, Inc. (NORMI)**.
