
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./index";
import path from "path";

export async function runMigrations() {
  console.log("⏳ Starting database migrations...");
  
  try {
    // In Docker/Production, process.cwd() is /app
    // The drizzle folder is at /app/drizzle
    const migrationsFolder = path.join(process.cwd(), "drizzle");
    
    await migrate(db, { migrationsFolder });
    
    console.log("✅ Migrations completed successfully");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}
