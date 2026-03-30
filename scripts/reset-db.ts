
import { db } from "../server/src/db";
import { sql } from "drizzle-orm";

async function resetDb() {
  console.log("⚠️  Resetting database...");
  try {
    // Drop logic for PostgreSQL
    await db.execute(sql`DROP SCHEMA public CASCADE;`);
    await db.execute(sql`CREATE SCHEMA public;`);
    await db.execute(sql`GRANT ALL ON SCHEMA public TO public;`);
    
    console.log("✅ Database reset successfully. Tables dropped.");
  } catch (error) {
    console.error("❌ Failed to reset database:", error);
  }
  process.exit(0);
}

resetDb();
