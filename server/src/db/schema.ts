import { pgTable, text, uuid, boolean, timestamp, integer, bigint } from "drizzle-orm/pg-core";

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

// Subscription plans for billing
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull().unique(),
  plan: text("plan").default("free").notNull(), // 'free' | 'pro' | 'enterprise'
  status: text("status").default("active").notNull(), // 'active' | 'cancelled' | 'expired' | 'pending'
  flutterwaveRef: text("flutterwave_ref"), // Transaction reference
  flutterwaveSubId: text("flutterwave_sub_id"), // Subscription ID for recurring
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Monthly usage tracking for bandwidth and requests
export const usageLogs = pgTable("usage_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  billingPeriod: text("billing_period").notNull(), // e.g., "2026-01"
  requestCount: integer("request_count").default(0).notNull(),
  bandwidthBytes: bigint("bandwidth_bytes", { mode: "number" }).default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Payment history
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id),
  amount: integer("amount").notNull(), // in kobo (NGN smallest unit)
  currency: text("currency").default("NGN").notNull(),
  status: text("status").notNull(), // 'pending' | 'successful' | 'failed'
  flutterwaveRef: text("flutterwave_ref").unique(),
  flutterwaveTxId: text("flutterwave_tx_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Plan limits configuration
export const PLAN_LIMITS = {
  free: {
    domains: 1,
    connections: 1,
    bandwidthBytes: 500 * 1024 * 1024, // 500MB
    logRetentionDays: 0,
    customSubdomains: false,
    priceKobo: 0,
  },
  pro: {
    domains: 10,
    connections: 5,
    bandwidthBytes: 10 * 1024 * 1024 * 1024, // 10GB
    logRetentionDays: 7,
    customSubdomains: true,
    priceKobo: 250000, // ₦2,500
  },
  enterprise: {
    domains: Infinity,
    connections: Infinity,
    bandwidthBytes: Infinity,
    logRetentionDays: 30,
    customSubdomains: true,
    priceKobo: 1000000, // ₦10,000
  },
} as const;

export type PlanType = keyof typeof PLAN_LIMITS;
