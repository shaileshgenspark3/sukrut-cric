const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdminUser() {
    console.log('🚀 Creating admin user with direct signup...');
    
    try {
        // Create auth user with email confirmation
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: 'admin@sukrut.com',
            password: 'Admin123!',
            options: {
                emailRedirectTo: `${supabaseUrl}/login?role=admin`,
                data: {
                    name: 'Admin'
                }
            }
        });

        if (authError) {
            if (authError.message.includes('already registered')) {
                console.log('✅ Admin user already exists');
                
                // Try to confirm the existing user
                const { data: { users } } = await supabase.auth.admin.listUsers();
                const existing = users.find(u => u.email === 'admin@sukrut.com');
                
                if (existing && !existing.email_confirmed_at) {
                    console.log('⚠️  User exists but email not confirmed');
                    console.log('📝 Please run this SQL in Supabase Dashboard to confirm:');
                    console.log('');
                    console.log('UPDATE auth.users');
                    console.log('SET email_confirmed_at = now()');
                    console.log('WHERE email = \'admin@sukrut.com\';');
                    console.log('');
                } else if (existing && existing.email_confirmed_at) {
                    console.log('✅ User is already confirmed');
                }
            } else {
                throw authError;
            }
        } else {
            console.log('✅ Auth user created');
            console.log('📧 Email: admin@sukrut.com');
            console.log('🔑 Password: Admin123!');
            console.log('⚠️  Check your email to confirm, or use the SQL below');
        }

        // Get user ID
        let userId = authData?.user?.id;
        
        if (!userId) {
            const { data: { users } } = await supabase.auth.admin.listUsers();
            const existing = users.find(u => u.email === 'admin@sukrut.com');
            if (existing) userId = existing.id;
        }

        // Assign admin role
        if (userId) {
            const { error: roleError } = await supabase
                .from('user_roles')
                .upsert({ user_id: userId, role: 'core_admin' }, { onConflict: 'user_id, role' });

            if (roleError) {
                console.log('⚠️  Could not assign role via API (RLS policy)');
                console.log('📝 Please run this SQL in Supabase Dashboard:');
                console.log('');
                console.log('INSERT INTO user_roles (user_id, role)');
                console.log(`SELECT id, 'core_admin'`);
                console.log('FROM auth.users');
                console.log('WHERE email = \'admin@sukrut.com\'');
                console.log('ON CONFLICT (user_id, role) DO NOTHING;');
                console.log('');
            } else {
                console.log('✅ Admin role assigned');
            }
        }

        console.log('\n✨ Setup instructions:');
        console.log('1. If email not confirmed, run:');
        console.log('   UPDATE auth.users SET email_confirmed_at = now() WHERE email = \'admin@sukrut.com\';');
        console.log('');
        console.log('2. If role not assigned, run:');
        console.log('   INSERT INTO user_roles (user_id, role)');
        console.log('   SELECT id, \'core_admin\' FROM auth.users WHERE email = \'admin@sukrut.com\'');
        console.log('   ON CONFLICT (user_id, role) DO NOTHING;');
        console.log('');
        console.log('3. Then login at: http://localhost:3000/login?role=admin');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

createAdminUser();
