import { pgTable, text, uuid, boolean, timestamp, integer } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").default("user").notNull(), // 'user' | 'admin' | 'paid'
  emailVerified: boolean("email_verified").default(false).notNull(),
  verificationToken: text("verification_token"),
  apiKey: text("api_key").unique(),
  isPaid: boolean("is_paid").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const domains = pgTable("domains", {
  subdomain: text("subdomain").primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
});

// Request logs for paid users - tracks HTTP requests through tunnels
export const domainLogs = pgTable("domain_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  subdomain: text("subdomain").references(() => domains.subdomain).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  method: text("method").notNull(),
  path: text("path").notNull(),
  statusCode: integer("status_code"),
  responseTime: integer("response_time"), // in milliseconds
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
