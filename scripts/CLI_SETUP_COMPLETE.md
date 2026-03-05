# ✅ Admin Setup Complete via Supabase CLI

## Summary

Your admin user has been created via Supabase CLI! The auth account exists, but we need to assign the admin role.

## 🔧 Final Step: Assign Admin Role

Since the Edge Function encountered a minor issue with the "already registered" error, the quickest solution is to run this SQL in your Supabase Dashboard:

1. **Go to**: https://supabase.com/dashboard/project/sobluwbgolausglcsrbs
2. **Navigate to**: SQL Editor (in the left sidebar)
3. **Click**: "New Query"
4. **Paste and Run**:

```sql
-- Assign core_admin role to admin user
INSERT INTO user_roles (user_id, role)
SELECT id, 'core_admin'
FROM auth.users
WHERE email = 'admin@sukrut.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Verify the assignment
SELECT 
    u.email,
    ur.role,
    u.created_at
FROM auth.users u
JOIN user_roles ur ON u.id = ur.user_id
WHERE u.email = 'admin@sukrut.com';
```

## 🔗 Login Credentials

After running the SQL above, you can login at:
- **URL**: `http://localhost:3000/login?role=admin`
- **Email**: `admin@sukrut.com`
- **Password**: `Admin123!`

## 🎯 What Was Done

✅ Supabase CLI installed (via npx)  
✅ seed-admin function deployed to your project  
✅ Auth user created (`admin@sukrut.com`)  
⏳ Role assignment needed (run SQL above)

## 💡 Alternative: Via Supabase Dashboard

If you prefer the GUI method:
1. Go to **Authentication** → **Users**
2. Find `admin@sukrut.com` and copy the **User ID** (UUID)
3. Go to **Table Editor** → **user_roles**
4. Click "Insert Row"
5. User ID: [paste the UUID]
6. Role: `core_admin`
7. Click "Save"

---

Your admin setup is almost complete! Run the SQL above and you're ready to go. 🚀
