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
    console.log('🚀 Creating admin user...');
    
    try {
        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: 'admin@sukrut.com',
            password: 'Admin123!',
        });

        if (authError) {
            if (authError.message.includes('already registered')) {
                console.log('✅ Admin user already exists in auth');
            } else {
                throw authError;
            }
        } else {
            console.log('✅ Auth user created');
        }

        // Get user ID
        let userId = authData?.user?.id;
        
        if (!userId) {
            const { data: { users } } = await supabase.auth.admin.listUsers();
            const existing = users.find(u => u.email === 'admin@sukrut.com');
            if (existing) userId = existing.id;
        }

        if (userId) {
            // Assign admin role
            const { error: roleError } = await supabase
                .from('user_roles')
                .upsert({ user_id: userId, role: 'core_admin' }, { onConflict: 'user_id, role' });

            if (roleError) throw roleError;
            
            console.log('✅ Admin role assigned');
        }

        console.log('\n✨ Admin user setup complete!');
        console.log('📧 Email: admin@sukrut.com');
        console.log('🔑 Password: @12@');
        console.log('\n🔗 Login at: http://localhost:3000/login?role=admin');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

createAdminUser();
