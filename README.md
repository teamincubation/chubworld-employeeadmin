# C-Hub HR Admin Panel + Employee Self-Service (ESS) HR System
### Creating Wow World

A complete, production-ready, security-audited business administration and self-service HR system designed specifically for **C-Hub / Chubworld**. It matches the brand's tech-focused, futuristic AI and VR learning identity using a deep purple and magenta brand theme, bold headers, and rounded glassmorphism cards.

---

## Technical Stack
- **Frontend**: React + Vite, Vanilla CSS design system, Lucide React icons, local GPS integration, CSV/Print reports.
- **Backend**: Node.js + Express.js API, JWT session guards, Multer secure file management, rate-limiting, and error sanitization.
- **Database**: MySQL (compatible with Hostinger PHPMyAdmin, UTF8MB4 support).
- **Standards**: Timezone standard **Asia/Kolkata (IST)** on all check-ins, leaves, and audit logs. Currency standard **₹ INR** on salary/allowance records.

---

## Repository Directory Structure
```text
/ERP
  ├── /backend
  │     ├── /config           # Database pools and timezone configs
  │     ├── /controllers      # Auth, Employee, Metadata, Attendance, Leaves, Security logic
  │     ├── /middleware       # RBAC permission guards and user session checks
  │     ├── /routes           # API routes declaration (api.js)
  │     ├── /utils            # Cryptography AES wrappers and audit logger
  │     ├── .env.example      # Sample configurations
  │     ├── server.js         # Entry point, Helmet, CORS, and Rate limiters
  │     └── package.json      
  ├── /frontend
  │     ├── /public           # C-Hub logo assets
  │     ├── /src
  │     │     ├── /components # Sidebar, Topbar, Layout Shells
  │     │     ├── /context    # AuthContext sessions and theme configurations
  │     │     ├── /pages      # Login, Admin Dash, Register, ESS clocking, Leaves, Security
  │     │     ├── App.jsx     # Route router mappings
  │     │     ├── index.css   # Centralized Vanilla CSS design system
  │     │     └── main.jsx    
  │     ├── index.html        # Main title and favicon
  │     └── package.json      
  ├── /database
  │     ├── schema.sql        # MySQL schemas and table definitions
  │     └── seed.sql          # Seed data (Roles, shifts, leaves, Super Admin account)
  ├── README.md               # Main instructions
  └── hostinger_deployment.md # Hostinger hosting guide
```

---

## Local Setup & Installation

### Prerequisite
1. Install [Node.js (v18+)](https://nodejs.org/).
2. Start your local MySQL server (XAMPP, WampServer, or native installer).
3. Create a database named `chub_hr` in MySQL.

### Step 1: Database Setup
Import the database schema and seed data into your local database:
```bash
mysql -u root -p chub_hr < database/schema.sql
mysql -u root -p chub_hr < database/seed.sql
```

### Step 2: Backend Installation
1. Go to the backend folder and configure the local environment:
   ```bash
   cd backend
   ```
2. Open `.env` and adjust the database host, user, port, and password to match your local database settings.
3. Start the local server:
   ```bash
   npm run dev
   ```
   The backend server will launch on port `5000`.

### Step 3: Frontend Installation
1. Open another terminal panel and go to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install React packages and launch the Vite client:
   ```bash
   npm install
   npm run dev
   ```
   The client will open on port `5173` (`http://localhost:5173`).

---

## Authentication Credentials (Seed Data)
Use these credentials on the login screen for initial system access:
- **Email ID**: `superadmin@chubworld.com`
- **Password**: `SuperAdmin@123`
*(Note: Change this password immediately after the first login via Profile settings).*

---

## Core API Endpoints

### 1. Authentication
- `POST /api/auth/login` - Authenticates credentials, writes login logs, returns token.
- `POST /api/auth/forgot-password` - Dispatches password reset tokens.
- `POST /api/auth/reset-password` - Checks token and saves new password.
- `POST /api/auth/change-password` - Securely updates password for active session.
- `GET /api/auth/me` - Verifies current profile details.

### 2. Employees (RBAC & KYC Access Controlled)
- `POST /api/employees` - Creates employee profile and registers draft state.
- `GET /api/employees` - Returns employee roster (sensitive KYC masked).
- `GET /api/employees/:id` - Detailed employee profile view (masked KYC).
- `GET /api/employees/:id/kyc` - Decrypts Aadhaar, PAN, and Bank details. **Triggers VIEW_KYC audit log**.
- `PUT /api/employees/:id` - Edit employee parameters. **Triggers EDIT_EMPLOYEE audit log**.
- `DELETE /api/employees/:id` - Soft-delete employee. Suspends login access.
- `POST /api/employees/:id/documents` - Uploads KYC files (PDF, JPG, PNG).

### 3. Attendance & Geofencing (IST Time Standard)
- `POST /api/attendance/clock-in` - Record check-in. Validates coordinates radius against work locations (Haversine distance).
- `POST /api/attendance/clock-out` - Record check-out. Computes working hours, early exits, and shift grace periods.
- `GET /api/attendance/my-logs` - Returns personal logs for calendar view.
- `POST /api/attendance/corrections` - Submit manual log correction.
- `POST /api/attendance/corrections/:id/approve` - Approve/Reject corrections. Logs changes in audit trail.

### 4. Leaves (CL / SL / EL workflows)
- `POST /api/leaves/request` - Submit leave. Auto-checks balances and requires medical proofs on SL >= 3 days.
- `POST /api/leaves/cancel/:id` - Cancels pending requests, returns balance allocation.
- `POST /api/leaves/approve/:id` - HR/Manager approval triggers.
- `POST /api/leaves/adjust` - Administrative manual balance overrides.

### 5. Security & Audits
- `GET /api/security/audit-logs` - Returns immutable admin action log logs.
- `GET /api/security/login-history` - Monitor successful and brute-force failed login attempts.
- `PUT /api/security/roles/:roleId/permissions` - Custom configurations for Role Permissions mappings.
- `PUT /api/security/settings` - SMTP email and geofence enforcement switches.

---

## Security Implementation Checklist
1. **Passwords**: Securely hashed with 10 salt rounds of `bcryptjs`.
2. **KYC Encryption**: Aadhaar, PAN, and Bank details encrypted using AES-256-CBC with unique Initialization Vectors (IV).
3. **Sensitive Logs**: Masked values are displayed by default. Viewing plain text KYC requires permission check and records a secure audit trail. Plain text values are never stored inside audit logs.
4. **Brute Force Protection**: Core login and reset routes are rate-limited to 50 requests per 15 minutes.
5. **SQL Injection Guard**: Prepared statements used for all SQL queries via the database wrapper.
6. **XSS Protection**: Helmet security headers configured on Express backend, sanitizing browser contexts.
7. **Directory Traversal Guard**: Direct folder routing inside uploads is blocked. Uploaded documents are served only via permission-validation router stream.
