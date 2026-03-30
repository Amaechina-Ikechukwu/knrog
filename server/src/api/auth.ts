import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Resend } from "resend";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import {
  FRONTEND_URL,
  JWT_SECRET,
  REQUIRE_EMAIL_VERIFICATION,
} from "../config";
import {
  completeCliSession,
  consumeCliSession,
  createCliSession,
  getCliSession,
} from "../state/cliSessions";

const router = Router();
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SENDER_EMAIL = process.env.SENDER_EMAIL || "onboarding@resend.dev";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// Validation schemas
const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Middleware to verify JWT
export const authMiddleware = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  
  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: string };
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

const sendVerificationEmail = async (email: string, token: string) => {
  if (!resend) {
    throw new Error("Email verification is enabled but RESEND_API_KEY is missing");
  }

  const verifyUrl = `${FRONTEND_URL}/verify?token=${token}`;
  await resend.emails.send({
    from: SENDER_EMAIL,
    to: email,
    subject: "Verify your Knrog email",
    html: `
      <p>Welcome to Knrog.</p>
      <p>Please verify your email to activate your account:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
    `,
  });
};

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { email, password, cliSessionId } = req.body;
    
    // Validate email and password
    const validated = registerSchema.parse({ email, password });

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, validated.email),
    });

    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(validated.password, 12);
    
    // Generate API key for all users (including CLI)
    const apiKey = `knrog_${uuidv4().replace(/-/g, "")}`;
    const cliSession = cliSessionId ? await getCliSession(cliSessionId) : null;
    const isCli = Boolean(cliSession);
    const verificationToken =
      REQUIRE_EMAIL_VERIFICATION && !isCli ? uuidv4().replace(/-/g, "") : null;

    // CLI-initiated signups stay frictionless, web signups verify in production by default.
    const [user] = await db.insert(users).values({
      email: validated.email,
      passwordHash,
      verificationToken,
      emailVerified: !verificationToken,
      apiKey,
    }).returning();

    if (!user) {
      return res.status(500).json({ error: "Failed to create user" });
    }

    if (verificationToken) {
      await sendVerificationEmail(validated.email, verificationToken);
    }

    // If CLI session, complete it with the API key so the browser-assisted flow can finish.
    if (isCli) {
      await completeCliSession(cliSessionId, apiKey);
      return res.status(201).json({
        message: "Account created successfully!",
        userId: user.id,
        apiKey,
        emailVerified: user.emailVerified,
      });
    }

    // Return success for web registration
    res.status(201).json({
      message: verificationToken
        ? "Account created. Check your email to verify your account."
        : "Account created successfully!",
      userId: user.id,
      apiKey,
      emailVerified: user.emailVerified,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0]?.message || "Invalid request" });
    }
    console.error("Registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }

});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (REQUIRE_EMAIL_VERIFICATION && !user.emailVerified) {
      return res.status(403).json({ error: "Please verify your email before signing in" });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        apiKey: user.apiKey,
        isPaid: user.isPaid,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0]?.message || "Invalid request" });
    }
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/verify/:token
router.get("/verify/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const user = await db.query.users.findFirst({
      where: eq(users.verificationToken, token),
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid verification token" });
    }

    await db.update(users)
      .set({ emailVerified: true, verificationToken: null })
      .where(eq(users.id, user.id));

    res.json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/api-key (requires auth)
router.post("/api-key", authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.userId;

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.apiKey) {
      return res.json({ apiKey: user.apiKey });
    }

    const apiKey = `knrog_${uuidv4().replace(/-/g, "")}`;

    await db.update(users)
      .set({ apiKey })
      .where(eq(users.id, userId));

    res.json({ apiKey });
  } catch (error) {
    console.error("API key generation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/api-key/rotate (requires auth)
router.post("/api-key/rotate", authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const apiKey = `knrog_${uuidv4().replace(/-/g, "")}`;

    await db.update(users).set({ apiKey }).where(eq(users.id, userId));
    res.json({ apiKey });
  } catch (error) {
    console.error("API key rotation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/me (requires auth)
router.get("/me", authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.userId;

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      apiKey: user.apiKey,
      isPaid: user.isPaid,
      emailVerified: user.emailVerified,
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/validate - Validate an API key
router.post("/validate", async (req, res) => {
  try {
    const apiKey = req.headers["x-api-key"] as string;
    
    if (!apiKey) {
      return res.status(401).json({ valid: false, error: "API key required" });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.apiKey, apiKey),
    });

    if (!user) {
      return res.status(401).json({ valid: false, error: "Invalid API key" });
    }

    res.json({ valid: true, email: user.email });
  } catch (error) {
    console.error("API key validation error:", error);
    res.status(500).json({ valid: false, error: "Internal server error" });
  }
});

// POST /api/auth/cli-session - Create a CLI session for auto-token flow
router.post("/cli-session", async (req, res) => {
  const session = await createCliSession();
  res.json({ sessionId: session.id });
});

// GET /api/auth/cli-session/:sessionId - Poll for session completion
router.get("/cli-session/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  const session = await getCliSession(sessionId);

  if (!session) {
    return res.status(404).json({ error: "Session not found or expired" });
  }

  if (session.status === "complete") {
    // Delete session after returning (one-time use)
    await consumeCliSession(sessionId);
    return res.json({ status: "complete", apiKey: session.apiKey ?? null });
  }

  res.json({ status: "pending" });
});

export default router;
