import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const TEAMS = [
    { name: "Royal Strikers", captain: "Aarav Patel" },
    { name: "Thunder Kings", captain: "Vivaan Sharma" },
    { name: "Golden Eagles", captain: "Aditya Singh" },
    { name: "Storm Riders", captain: "Arjun Mehta" },
    { name: "Fire Blazers", captain: "Kabir Gupta" },
    { name: "Shadow Warriors", captain: "Rohan Desai" },
    { name: "Iron Wolves", captain: "Ishaan Joshi" },
    { name: "Mighty Titans", captain: "Dev Kulkarni" },
    { name: "Rising Phoenix", captain: "Arnav Reddy" },
    { name: "Power Hitters", captain: "Reyansh Nair" },
    { name: "Star Gladiators", captain: "Dhruv Iyer" },
    { name: "Blue Hawks", captain: "Kian Verma" },
    { name: "Wild Lions", captain: "Sai Choudhary" },
    { name: "Night Riders", captain: "Ansh Pandey" },
    { name: "Cosmic Kings", captain: "Vihaan Rao" },
    { name: "Steel Spartans", captain: "Ayaan Mishra" },
    { name: "Turbo Chargers", captain: "Atharv Saxena" },
    { name: "Lightning Bolts", captain: "Rudra Agarwal" },
    { name: "Ocean Warriors", captain: "Parth Bhat" },
    { name: "Desert Falcons", captain: "Neil Kapoor" },
    { name: "Mountain Lions", captain: "Advait Tiwari" },
    { name: "Valley Vipers", captain: "Shivansh Dubey" },
    { name: "Blazing Comets", captain: "Lakshya Chopra" },
    { name: "Dark Knights", captain: "Aarush Malhotra" }
];

const MALE_FIRST = ["Rajesh", "Sunil", "Amit", "Vikram", "Rahul", "Deepak", "Manoj", "Suresh", "Ganesh", "Nitin", "Sandeep", "Ajay", "Vijay", "Pramod", "Sachin", "Ravi", "Ashok", "Dinesh", "Pranav", "Kunal", "Rakesh", "Anil", "Sanjay", "Mahesh", "Prakash", "Kishore", "Nishant", "Varun", "Rishabh", "Yash", "Tushar"];
const FEMALE_FIRST = ["Priya", "Sneha", "Anjali", "Pooja", "Neha", "Divya", "Kavita", "Swati", "Meena", "Ritu", "Sunita", "Geeta", "Anita", "Komal", "Jyoti", "Suman", "Aarti", "Kiran", "Nisha", "Rekha", "Shikha", "Rachna", "Preeti", "Mamta", "Seema"];
const LAST_NAMES = ["Kumar", "Patel", "Shah", "Yadav", "More", "Jadhav", "Pawar", "Shinde", "Chavan", "Gaikwad", "Deshmukh", "Jain", "Thakur", "Bose", "Dutta", "Ghosh", "Sharma", "Singh", "Verma", "Gupta", "Joshi", "Kulkarni", "Rao", "Nair", "Iyer", "Desai", "Mehta", "Reddy"];
const CATEGORIES = ["A+", "A", "B", "C"];
const PRICES: Record<string, number> = { "A+": 2000, "A": 1500, "B": 1000, "C": 500 };
const ROLES = ["Batsman", "Bowler", "All-rounder", "Wicket-keeper"];

const getRandom = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];

serve(async (req) => {
    try {
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        let seededTeamsCount = 0;

        // Check if seeded
        const { data: existingTeams } = await supabaseAdmin.from("teams").select("id").limit(1);
        if (existingTeams && existingTeams.length > 0) {
            return new Response(JSON.stringify({ message: "Data already seeded" }), { status: 200 });
        }

        for (let i = 0; i < TEAMS.length; i++) {
            const email = `captain${i + 1}@sukrut.com`;
            const password = `captain${i + 1}@123`;

            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email, password, email_confirm: true
            });

            let userId = authData?.user?.id;
            if (!userId && authError) {
                const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
                const existing = usersData?.users?.find(u => u.email === email);
                if (existing) userId = existing.id;
            }

            if (userId) {
                await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role: "captain" }, { onConflict: "user_id, role" });

                const phoneNumber = "9" + Math.floor(100000000 + Math.random() * 900000000).toString();

                const { data: teamData, error: teamErr } = await supabaseAdmin.from("teams").insert({
                    team_name: TEAMS[i].name,
                    captain_name: TEAMS[i].captain,
                    captain_user_id: userId,
                    captain_email: email,
                    captain_password: password,
                    phone_number: phoneNumber,
                    team_logo_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(TEAMS[i].name)}`,
                    captain_image_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(TEAMS[i].captain)}`
                }).select().single();

                if (teamData?.id) {
                    await supabaseAdmin.from("auction_rules").insert({
                        team_id: teamData.id,
                        captain_deduction: 0,
                        starting_purse: 3000000,
                        current_purse: 3000000
                    });
                    seededTeamsCount++;
                }
            }
        }

        // Seed 216 players (168 male + 48 female)
        const players = [];

        // Make it deterministic for categories and roles cycle
        for (let i = 0; i < 168; i++) {
            const cat = CATEGORIES[i % 4];
            const role = ROLES[i % 4];
            players.push({
                name: `${getRandom(MALE_FIRST)} ${getRandom(LAST_NAMES)}`,
                category: cat,
                base_price: PRICES[cat],
                playing_role: role,
                gender: "Male",
                image_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=M${i}`
            });
        }

        for (let i = 0; i < 48; i++) {
            const cat = CATEGORIES[i % 4];
            const role = ROLES[i % 4];
            players.push({
                name: `${getRandom(FEMALE_FIRST)} ${getRandom(LAST_NAMES)}`,
                category: cat,
                base_price: PRICES[cat],
                playing_role: role,
                gender: "Female",
                image_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=F${i}`
            });
        }

        // Insert players in chunks
        for (let i = 0; i < players.length; i += 50) {
            await supabaseAdmin.from("players").insert(players.slice(i, i + 50));
        }

        return new Response(JSON.stringify({ success: true, teamsSeeded: seededTeamsCount, playersSeeded: players.length }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { "Content-Type": "application/json" },
            status: 400,
        });
    }
});
