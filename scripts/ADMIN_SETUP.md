# Admin User Setup Guide

Your admin user auth account has been created! Now you need to assign the admin role.

## 📋 Your Credentials
- **Email**: `admin@sukrut.com`
- **Password**: `Admin123!`

## 🔧 Step 1: Get User ID from Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Users**
3. Find the user with email `admin@sukrut.com`
4. Click on the user to see their details
5. **Copy the UUID** (it looks like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

## 🔧 Step 2: Assign Admin Role

1. In the Supabase Dashboard, go to **SQL Editor** (in the left sidebar)
2. Click **New Query**
3. Paste and run this SQL (replace `YOUR_USER_ID` with the UUID you copied):

```sql
INSERT INTO user_roles (user_id, role)
VALUES ('YOUR_USER_ID', 'core_admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

4. Verify it worked by running:
```sql
SELECT * FROM user_roles WHERE role = 'core_admin';
```

## ✅ Step 3: Login

Now you can login at:
- **URL**: `http://localhost:3000/login?role=admin`
- **Email**: `admin@sukrut.com`
- **Password**: `Admin123!`

## 🎯 Troubleshooting

If you see "Security Alert: Invalid login credentials":
- Make sure you copied the correct password: `Admin123!`
- Check that you completed Step 2 to assign the role
- Ensure you're on the Admin login page (not Captain)

## 🔄 Alternative: Using Supabase CLI

If you have Supabase CLI installed, you can also run:

```bash
# Deploy the seed function
supabase functions deploy seed-admin

# Invoke it to create the admin
supabase functions invoke seed-admin
```

---

Need help? Check the user guide at `user_guide.md.resolved`
