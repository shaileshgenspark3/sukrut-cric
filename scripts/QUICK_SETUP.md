# ✅ Quick Admin Setup (No Functions Required)

## The Problem
You're seeing "Email not confirmed" error because the admin user exists but the email wasn't confirmed.

## 🚀 The Solution (3 SQL Commands)

Run these in your **Supabase Dashboard SQL Editor**:

### Step 1: Confirm the Email
```sql
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email = 'admin@sukrut.com';
```

### Step 2: Assign Admin Role
```sql
INSERT INTO user_roles (user_id, role)
SELECT id, 'core_admin'
FROM auth.users
WHERE email = 'admin@sukrut.com'
ON CONFLICT (user_id, role) DO NOTHING;
```

### Step 3: Verify Setup
```sql
SELECT
  u.email,
  ur.role,
  u.email_confirmed_at,
  CASE 
    WHEN u.email_confirmed_at IS NOT NULL THEN '✅ Confirmed'
    ELSE '❌ Not Confirmed'
  END as status
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
WHERE u.email = 'admin@sukrut.com';
```

---

## 🔗 Then Login

**URL**: https://sukrut-cric.vercel.app/login?role=admin  
**Email**: `admin@sukrut.com`  
**Password**: `Admin123!`

---

## 🎯 All at Once

Or just copy-paste this single block:

```sql
-- Confirm email
UPDATE auth.users SET email_confirmed_at = now() WHERE email = 'admin@sukrut.com';

-- Assign role
INSERT INTO user_roles (user_id, role)
SELECT id, 'core_admin' FROM auth.users WHERE email = 'admin@sukrut.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Verify
SELECT u.email, ur.role, u.email_confirmed_at
FROM auth.users u LEFT JOIN user_roles ur ON u.id = ur.user_id
WHERE u.email = 'admin@sukrut.com';
```

That's it! No functions, no scripts, just 3 SQL commands. ✨
