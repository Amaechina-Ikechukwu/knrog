import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Resend } from "resend";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const SENDER_EMAIL = process.env.SENDER_EMAIL || "onboarding@resend.dev";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// CLI session storage for auto-token flow
interface CliSession {
  status: "pending" | "complete";
  apiKey?: string;
  createdAt: number;
}
const cliSessions = new Map<string, CliSession>();

// Clean up expired sessions (older than 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of cliSessions.entries()) {
    if (now - session.createdAt > 10 * 60 * 1000) {
      cliSessions.delete(id);
    }
  }
}, 60 * 1000);

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
    const isCli = cliSessionId && cliSessions.has(cliSessionId);

    // Create user (email verification disabled - all users are verified immediately)
    const [user] = await db.insert(users).values({
      email: validated.email,
      passwordHash,
      verificationToken: null,
      emailVerified: true,
      apiKey,
    }).returning();

    if (!user) {
      return res.status(500).json({ error: "Failed to create user" });
    }

    // If CLI session, complete it with the API key
    if (isCli) {
      completeCliSession(cliSessionId, apiKey);
      return res.status(201).json({
        message: "Account created successfully!",
        userId: user.id,
        apiKey,
      });
    }

    // Return success for web registration
    res.status(201).json({
      message: "Account created successfully!",
      userId: user.id,
      apiKey,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
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
      return res.status(400).json({ error: error.errors[0].message });
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

// POST /api/auth/cli-session - Create a CLI session for auto-token flow
router.post("/cli-session", async (req, res) => {
  const sessionId = uuidv4();
  cliSessions.set(sessionId, {
    status: "pending",
    createdAt: Date.now(),
  });
  res.json({ sessionId });
});

// GET /api/auth/cli-session/:sessionId - Poll for session completion
router.get("/cli-session/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  const session = cliSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: "Session not found or expired" });
  }

  if (session.status === "complete") {
    // Delete session after returning (one-time use)
    cliSessions.delete(sessionId);
    return res.json({ status: "complete", apiKey: session.apiKey });
  }

  res.json({ status: "pending" });
});

// Export helper to complete CLI session (used by register endpoint)
export const completeCliSession = (sessionId: string, apiKey: string) => {
  const session = cliSessions.get(sessionId);
  if (session) {
    session.status = "complete";
    session.apiKey = apiKey;
  }
};

export default router;
