# Hostinger Node.js Deployment & Configuration Guide
## C-Hub HR Admin Panel and ESS Dashboard System

This document outlines the step-by-step procedure for deploying the **C-Hub HR Admin Panel and ESS Dashboard** on Hostinger Shared Hosting (with Node.js support) or Hostinger VPS.

---

### Step 1: Database Installation on Hostinger phpMyAdmin

1. Log into your Hostinger **hPanel**.
2. Navigate to **Databases** -> **MySQL Databases**.
3. Create a new Database:
   - Database Name: `u123456_chub_hr`
   - MySQL Username: `u123456_chub_user`
   - Password: `YourSecureDatabasePassword`
4. Once created, click on **Enter phpMyAdmin**.
5. Select your newly created database, click on the **Import** tab.
6. Choose the [schema.sql](file:///d:/Adnan%20Vellicheri/WORKS/CHUB/ERP/database/schema.sql) file from your local build and click **Go** / **Import**.
7. Repeat the same import procedure for [seed.sql](file:///d:/Adnan%20Vellicheri/WORKS/CHUB/ERP/database/seed.sql) to inject the default roles, departments, shifts, and the Super Admin credentials.

---

### Step 2: Upload Backend Files to Hostinger Node.js Application Manager

Hostinger Shared Hosting provides a Node.js App Manager (powered by Phusion Passenger).

1. Zip your `/backend` directory (exclude the `node_modules` folder to keep the size small).
2. In hPanel, go to **Files** -> **File Manager** and open your website's public HTML or home root.
3. Upload the zipped file and extract it to a directory, e.g., `/home/username/chub-hr-backend`.
4. In hPanel, navigate to **Advanced** -> **Node.js** to configure your app:
   - **App Directory**: `/home/username/chub-hr-backend`
   - **App Domain/URL**: Select sub-domain (e.g. `api.chubworld.com` or direct sub-directory)
   - **Startup File**: `server.js`
   - **Node Version**: Select `18.x`, `20.x` or higher.
5. Create a `.env` file inside `/home/username/chub-hr-backend` and configure production secrets (see environment configuration details below).
6. In Hostinger Node.js App page, click **Run npm install** or launch npm build via Hostinger SSH console:
   ```bash
   cd /home/username/chub-hr-backend
   npm install --production
   ```
7. Click **Start App** / **Restart App** in the Node.js App Manager.

---

### Step 3: Configure Backend Production Environment (`.env`)

Create this `.env` file in the backend root directory on your Hostinger host:

```env
PORT=5000
NODE_ENV=production

# Hostinger Database credentials
DB_HOST=127.0.0.1
DB_USER=u123456_chub_user
DB_PASS=YourSecureDatabasePassword
DB_NAME=u123456_chub_hr
DB_PORT=3306

# Security Settings
JWT_SECRET=YOUR_PRODUCTION_SECRET_KEY_MAKE_IT_VERY_LONG_AND_COMPLEX
JWT_EXPIRES_IN=8h
ENCRYPTION_KEY=64_HEX_CHARACTERS_FOR_AES_256_CBC_ENCRYPTION_KEY_FOR_KYC

# Local Secure Storage path for uploads
UPLOAD_DIR=/home/username/chub-hr-backend/uploads
```

---

### Step 4: Build and Deploy Frontend (React app)

1. Open your local React frontend code: [App.jsx](file:///d:/Adnan%20Vellicheri/WORKS/CHUB/ERP/frontend/src/App.jsx).
2. Confirm the API endpoint in [AuthContext.jsx](file:///d:/Adnan%20Vellicheri/WORKS/CHUB/ERP/frontend/src/context/AuthContext.jsx#L5) is mapping to your production Hostinger domain (e.g. `https://api.chubworld.com/api` or `https://chubworld.com/api`).
3. Compile the React production build:
   ```bash
   cd frontend
   npm run build
   ```
   This will generate a compiled production folder `/frontend/dist`.
4. In Hostinger hPanel File Manager, upload all contents of the compiled `/dist` directory to your main domain public HTML directory (e.g. `/public_html`).
5. Ensure a `.htaccess` file is placed in your public HTML directory to route all requests back to React router (preventing 404 errors on page refresh):

   ```apache
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
   </IfModule>
   ```

---

### Step 5: Initial Access & Security Guidelines

1. **Initial Sign-In**: Navigate to your website login page and enter the default credentials:
   - **Email ID**: `superadmin@chubworld.com`
   - **Password**: `SuperAdmin@123`
2. **Force Update**: Go to **My Profile** -> **Security Credentials Update** and override `SuperAdmin@123` with a production-grade password immediately.
3. **Audit Monitoring**: Periodically check the **Security & Audits** -> **Operational Audit logs** to verify that KYC decrypted events are fully logged and IP/User Agents match authorized locations.
