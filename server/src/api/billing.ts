import { Router } from "express";
import Flutterwave from "flutterwave-node-v3";
import { db } from "../db";
import { users, subscriptions, payments, usageLogs, PLAN_LIMITS, PlanType } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "./auth";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

const router = Router();

// Flutterwave configuration
const FLW_PUBLIC_KEY = process.env.FLUTTERWAVE_PUBLIC_KEY || "";
const FLW_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY || "";
const FLW_WEBHOOK_SECRET = process.env.FLUTTERWAVE_WEBHOOK_SECRET || "";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Initialize Flutterwave
const flw = new Flutterwave(FLW_PUBLIC_KEY, FLW_SECRET_KEY);

// Helper to get current billing period (YYYY-MM)
const getCurrentBillingPeriod = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

// Helper to get user's current plan
export const getUserPlan = async (userId: string): Promise<{ plan: PlanType; subscription: any | null }> => {
  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  if (!subscription || subscription.status !== "active") {
    return { plan: "free", subscription: null };
  }

  // Check if subscription has expired
  if (subscription.currentPeriodEnd && new Date() > subscription.currentPeriodEnd) {
    // Mark as expired
    await db.update(subscriptions)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(subscriptions.id, subscription.id));
    return { plan: "free", subscription: null };
  }

  return { plan: subscription.plan as PlanType, subscription };
};

// Helper to get user's usage for current billing period
export const getUserUsage = async (userId: string) => {
  const billingPeriod = getCurrentBillingPeriod();
  
  let usage = await db.query.usageLogs.findFirst({
    where: and(
      eq(usageLogs.userId, userId),
      eq(usageLogs.billingPeriod, billingPeriod)
    ),
  });

  if (!usage) {
    // Create usage record for this period
    const [newUsage] = await db.insert(usageLogs).values({
      userId,
      billingPeriod,
      requestCount: 0,
      bandwidthBytes: 0,
    }).returning();
    usage = newUsage;
  }

  return usage;
};

// Helper to track usage
export const trackUsage = async (userId: string, bytes: number) => {
  const billingPeriod = getCurrentBillingPeriod();
  
  const existing = await db.query.usageLogs.findFirst({
    where: and(
      eq(usageLogs.userId, userId),
      eq(usageLogs.billingPeriod, billingPeriod)
    ),
  });

  if (existing) {
    await db.update(usageLogs)
      .set({
        requestCount: existing.requestCount + 1,
        bandwidthBytes: existing.bandwidthBytes + bytes,
        updatedAt: new Date(),
      })
      .where(eq(usageLogs.id, existing.id));
  } else {
    await db.insert(usageLogs).values({
      userId,
      billingPeriod,
      requestCount: 1,
      bandwidthBytes: bytes,
    });
  }
};

// Check if user is within their plan limits
export const checkUserLimits = async (userId: string): Promise<{ withinLimits: boolean; reason?: string }> => {
  const { plan } = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];
  const usage = await getUserUsage(userId);

  if (usage.bandwidthBytes >= limits.bandwidthBytes) {
    return { withinLimits: false, reason: "Bandwidth limit exceeded. Please upgrade your plan." };
  }

  return { withinLimits: true };
};

// POST /api/billing/initialize - Initialize a payment for a plan
router.post("/initialize", authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const { plan } = req.body as { plan: PlanType };

    if (!plan || !PLAN_LIMITS[plan]) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    if (plan === "free") {
      return res.status(400).json({ error: "Cannot purchase free plan" });
    }

    // Get user
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Generate unique transaction reference
    const txRef = `knrog_${uuidv4().replace(/-/g, "")}`;
    const amount = PLAN_LIMITS[plan].priceKobo / 100; // Convert kobo to Naira

    // Create payment record
    await db.insert(payments).values({
      userId,
      amount: PLAN_LIMITS[plan].priceKobo,
      status: "pending",
      flutterwaveRef: txRef,
    });

    // Generate Flutterwave payment link
    const payload = {
      tx_ref: txRef,
      amount: amount.toString(),
      currency: "NGN",
      redirect_url: `${FRONTEND_URL}/billing/callback`,
      customer: {
        email: user.email,
        name: user.email.split("@")[0],
      },
      customizations: {
        title: "Knrog Subscription",
        description: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan - Monthly`,
        logo: `${FRONTEND_URL}/logo.png`,
      },
      meta: {
        userId,
        plan,
      },
    };

    const response = await flw.Charge.card(payload);
    
    // For standard payment, use payment link
    const paymentLink = `https://checkout.flutterwave.com/v3/hosted/pay/${txRef}`;
    
    // Alternative: Use Flutterwave Standard
    res.json({
      paymentLink: `https://checkout.flutterwave.com/v3/hosted/pay?tx_ref=${txRef}&amount=${amount}&currency=NGN&redirect_url=${encodeURIComponent(`${FRONTEND_URL}/billing/callback`)}&customer[email]=${encodeURIComponent(user.email)}&public_key=${FLW_PUBLIC_KEY}&customizations[title]=${encodeURIComponent("Knrog Subscription")}&customizations[description]=${encodeURIComponent(`${plan} Plan`)}&meta[userId]=${userId}&meta[plan]=${plan}`,
      txRef,
      amount,
      plan,
    });
  } catch (error) {
    console.error("Payment initialization error:", error);
    res.status(500).json({ error: "Failed to initialize payment" });
  }
});

// GET /api/billing/verify/:txRef - Verify a payment
router.get("/verify/:txRef", authMiddleware, async (req: any, res) => {
  try {
    const { txRef } = req.params;
    const userId = req.user.userId;

    // Find payment record
    const payment = await db.query.payments.findFirst({
      where: eq(payments.flutterwaveRef, txRef),
    });

    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    if (payment.userId !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Already processed?
    if (payment.status === "successful") {
      const subscription = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, userId),
      });
      return res.json({ success: true, status: "successful", subscription });
    }

    // Verify with Flutterwave
    const response = await flw.Transaction.verify({ id: txRef });

    if (response.status === "success" && response.data.status === "successful") {
      // Get plan from meta
      const plan = response.data.meta?.plan as PlanType || "pro";
      
      // Update payment
      await db.update(payments)
        .set({ 
          status: "successful",
          flutterwaveTxId: response.data.id?.toString(),
        })
        .where(eq(payments.id, payment.id));

      // Create or update subscription
      const periodStart = new Date();
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const existingSub = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, userId),
      });

      if (existingSub) {
        await db.update(subscriptions)
          .set({
            plan,
            status: "active",
            flutterwaveRef: txRef,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, existingSub.id));
      } else {
        await db.insert(subscriptions).values({
          userId,
          plan,
          status: "active",
          flutterwaveRef: txRef,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        });
      }

      // Update user isPaid flag for backward compatibility
      await db.update(users)
        .set({ isPaid: true })
        .where(eq(users.id, userId));

      const subscription = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, userId),
      });

      return res.json({ success: true, status: "successful", subscription });
    } else {
      // Payment failed
      await db.update(payments)
        .set({ status: "failed" })
        .where(eq(payments.id, payment.id));

      return res.json({ success: false, status: "failed", message: response.data.processor_response || "Payment failed" });
    }
  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({ error: "Failed to verify payment" });
  }
});

// POST /api/billing/webhook - Handle Flutterwave webhooks
router.post("/webhook", async (req, res) => {
  try {
    // Verify webhook signature
    const signature = req.headers["verif-hash"];
    if (signature !== FLW_WEBHOOK_SECRET) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    const { event, data } = req.body;

    if (event === "charge.completed" && data.status === "successful") {
      const txRef = data.tx_ref;
      const plan = data.meta?.plan as PlanType || "pro";
      const userId = data.meta?.userId;

      if (!userId) {
        console.error("Webhook: Missing userId in meta");
        return res.status(400).json({ error: "Missing userId" });
      }

      // Update payment
      await db.update(payments)
        .set({ 
          status: "successful",
          flutterwaveTxId: data.id?.toString(),
        })
        .where(eq(payments.flutterwaveRef, txRef));

      // Create or update subscription
      const periodStart = new Date();
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const existingSub = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, userId),
      });

      if (existingSub) {
        await db.update(subscriptions)
          .set({
            plan,
            status: "active",
            flutterwaveRef: txRef,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, existingSub.id));
      } else {
        await db.insert(subscriptions).values({
          userId,
          plan,
          status: "active",
          flutterwaveRef: txRef,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        });
      }

      // Update user isPaid flag
      await db.update(users)
        .set({ isPaid: true })
        .where(eq(users.id, userId));

      console.log(`Webhook: Subscription activated for user ${userId}, plan: ${plan}`);
    }

    res.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// GET /api/billing/subscription - Get current subscription
router.get("/subscription", authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.userId;

    const { plan, subscription } = await getUserPlan(userId);
    const usage = await getUserUsage(userId);
    const limits = PLAN_LIMITS[plan];

    res.json({
      plan,
      subscription,
      usage: {
        requestCount: usage.requestCount,
        bandwidthBytes: usage.bandwidthBytes,
        billingPeriod: usage.billingPeriod,
      },
      limits: {
        domains: limits.domains,
        connections: limits.connections,
        bandwidthBytes: limits.bandwidthBytes,
        logRetentionDays: limits.logRetentionDays,
        customSubdomains: limits.customSubdomains,
      },
      pricing: {
        free: { price: 0, label: "Free" },
        pro: { price: PLAN_LIMITS.pro.priceKobo / 100, label: "₦2,500/mo" },
        enterprise: { price: PLAN_LIMITS.enterprise.priceKobo / 100, label: "₦10,000/mo" },
      },
    });
  } catch (error) {
    console.error("Get subscription error:", error);
    res.status(500).json({ error: "Failed to get subscription" });
  }
});

// POST /api/billing/cancel - Cancel subscription
router.post("/cancel", authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.userId;

    const subscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId),
    });

    if (!subscription) {
      return res.status(404).json({ error: "No active subscription" });
    }

    // Mark as cancelled (will expire at period end)
    await db.update(subscriptions)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(subscriptions.id, subscription.id));

    res.json({ 
      success: true, 
      message: "Subscription cancelled. Access continues until end of billing period.",
      expiresAt: subscription.currentPeriodEnd,
    });
  } catch (error) {
    console.error("Cancel subscription error:", error);
    res.status(500).json({ error: "Failed to cancel subscription" });
  }
});

// GET /api/billing/payments - Get payment history
router.get("/payments", authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.userId;

    const userPayments = await db.query.payments.findMany({
      where: eq(payments.userId, userId),
      orderBy: (p, { desc }) => [desc(p.createdAt)],
      limit: 20,
    });

    res.json({ payments: userPayments });
  } catch (error) {
    console.error("Get payments error:", error);
    res.status(500).json({ error: "Failed to get payments" });
  }
});

export default router;
