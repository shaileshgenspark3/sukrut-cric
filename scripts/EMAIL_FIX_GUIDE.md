# 🔧 Fix Email Confirmation Issue - Step by Step

## Problem
You're seeing "Security Alert: Email not confirmed" when trying to login as admin.

## Solution
Follow these exact steps:

---

## Step 1: Open Supabase Dashboard

Go to: **https://supabase.com/dashboard/project/sobluwbgolausglcsrbs**

---

## Step 2: Open SQL Editor

In the **left sidebar**, click on **SQL Editor** (looks like a terminal/terminal icon)

---

## Step 3: Create New Query

Click the **"New Query"** button

---

## Step 4: Copy & Paste This SQL

Copy the entire block below and paste it into the SQL editor:

```sql
-- Check current status
SELECT 
  id,
  email,
  email_confirmed_at,
  CASE 
    WHEN email_confirmed_at IS NOT NULL THEN '✅ Confirmed'
    ELSE '❌ Not Confirmed'
  END as status
FROM auth.users
WHERE email = 'admin@sukrut.com';

-- Confirm the email
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'admin@sukrut.com';

-- Assign admin role
INSERT INTO user_roles (user_id, role)
SELECT id, 'core_admin' FROM auth.users WHERE email = 'admin@sukrut.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Verify everything
SELECT
  u.email,
  ur.role,
  u.email_confirmed_at,
  CASE 
    WHEN u.email_confirmed_at IS NOT NULL THEN '✅ Ready to Login'
    ELSE '❌ Email not confirmed'
  END as status
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
WHERE u.email = 'admin@sukrut.com';
```

---

## Step 5: Run the Query

Click the **"Run"** button (or press `Ctrl+Enter`)

---

## Step 6: Check Results

You should see two result tables:

1. **Before update** - Shows current status
2. **After update** - Should show "✅ Ready to Login" and role = "core_admin"

---

## Step 7: Login

Go to: **https://sukrut-cric.vercel.app/login?role=admin**

**Email**: `admin@sukrut.com`  
**Password**: `Admin123!`

---

## ❓ Still Having Issues?

### Check 1: Verify User Exists

In SQL Editor, run:
```sql
SELECT * FROM auth.users WHERE email = 'admin@sukrut.com';
```

If no results, the user doesn't exist. Run this to create:
```sql
-- Note: This is a backup method if user doesn't exist
-- You may need to create the user via the Dashboard instead
```

### Check 2: Try Creating User via Dashboard

1. Go to **Authentication** → **Users**
2. Click **"Add User"** → **"Create new user"**
3. Email: `admin@sukrut.com`
4. Password: `Admin123!`
5. ✅ Check **"Auto Confirm User"**
6. Click **"Create User"**

Then run the SQL above again to assign the role.

---

## 🎯 Alternative: Create Fresh Admin User

If the above doesn't work, create a brand new admin user:

1. Go to **Authentication** → **Users**
2. Click **"Add User"** → **"Create new user"**
3. Email: `superadmin@sukrut.com`
4. Password: `SuperAdmin123!`
5. ✅ Check **"Auto Confirm User"**
6. Click **"Create User"**

Then run this SQL:
```sql
INSERT INTO user_roles (user_id, role)
SELECT id, 'core_admin' FROM auth.users WHERE email = 'superadmin@sukrut.com'
ON CONFLICT (user_id, role) DO NOTHING;
```

Login with: `superadmin@sukrut.com` / `SuperAdmin123!`

---

## 📞 Need More Help?

- Check Supabase Logs: **https://supabase.com/dashboard/project/sobluwbgolausglcsrbs/logs**
- Check Auth Settings: **https://supabase.com/dashboard/project/sobluwbgolausglcsrbs/auth/providers**
