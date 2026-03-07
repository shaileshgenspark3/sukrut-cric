import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const migrationsDir = path.resolve("supabase/migrations");

if (!fs.existsSync(migrationsDir)) {
  console.error(`❌ Migrations directory not found: ${migrationsDir}`);
  process.exit(1);
}

const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

if (migrationFiles.length === 0) {
  console.log("No .sql migration files found. Nothing to apply.");
  process.exit(0);
}

console.log(`Found ${migrationFiles.length} migration files in ${migrationsDir}`);
console.log("Applying migrations via Supabase CLI...");

const commandArgs = ["db", "push"];
if (process.env.SUPABASE_DB_URL) {
  commandArgs.push("--db-url", process.env.SUPABASE_DB_URL);
}

const result = spawnSync("supabase", commandArgs, {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error("❌ Failed to run `supabase db push`.");
  console.error("Install Supabase CLI and ensure `supabase` is available on PATH.");
  console.error("Manual fallback: run `supabase db push` from the project root.");
  process.exit(1);
}

if ((result.status ?? 1) !== 0) {
  console.error(`❌ Migration command failed with exit code ${result.status}.`);
  process.exit(result.status ?? 1);
}

console.log("✅ Migrations applied successfully.");
