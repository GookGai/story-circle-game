/**
 * Authentication routes: register, login, get current user, update avatar
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../utils/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { randomBytes } from "node:crypto";
import { isAdminUser, isReservedAdminUsername } from '../utils/adminPolicy.js';
import { recordUsage, rememberUsageUser } from '../usage/store.js';
import { sourceOf } from '../usage/policy.js';

const router = Router();

/**
 * Generate a JWT token for a user
 */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );
}

/**
 * Strip password from user object before sending to client
 */
function sanitizeUser(user) {
  rememberUsageUser(user);
  const { password, ...userWithoutPassword } = user;
  return { ...userWithoutPassword, isAdmin: isAdminUser(user) };
}

// ─── POST /guest ─────────────────────────────────────────────────────────────
router.post("/guest", async (req, res) => {
  try {
    const { username, avatar } = req.body;

    if (
      typeof username !== "string" ||
      username.trim().length < 1 ||
      username.trim().length > 20
    ) {
      return res.status(400).json({ error: "กรุณากรอกชื่อเล่น" });
    }

    const cleanName = username.trim().replace(/#/g, "").substring(0, 15);
    if (!cleanName)
      return res.status(400).json({ error: "กรุณาใช้ชื่อเล่นที่มีตัวอักษร" });

    // A 48-bit internal tag avoids a name-availability query per guest. The
    // unique database constraint remains the final authority on collisions.
    const finalUsername = `${cleanName}#${randomBytes(6).readUIntBE(0, 6)}`;

    // Guests are excluded from password login and do not need a bcrypt hash.
    const hashedPassword = `guest:${randomBytes(32).toString("hex")}`;

    const user = await prisma.user.create({
      data: {
        username: finalUsername,
        password: hashedPassword,
        isGuest: true,
        avatar: avatar || "cat",
      },
    });

    const token = generateToken(user);
    recordUsage({ type: 'ACCOUNT_CREATED', user, source: sourceOf(req) });

    res.status(201).json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Guest login error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการเข้าร่วมแบบชั่วคราว" });
  }
});

// ─── POST /register ──────────────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { username, password, avatar } = req.body;

    // Validate input
    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !username ||
      !password
    ) {
      return res.status(400).json({ error: "กรุณากรอก username และ password" });
    }

    if (username.length < 2 || username.length > 20) {
      return res.status(400).json({ error: "Username ต้องมี 2-20 ตัวอักษร" });
    }

    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: "Password ต้องมี 8–128 ตัวอักษร" });
    }

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return res.status(409).json({ error: "Username นี้ถูกใช้แล้ว" });
    }
    if (isReservedAdminUsername(username)) return res.status(403).json({ error: 'ชื่อบัญชีนี้สงวนไว้สำหรับผู้ดูแล' });

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        avatar: avatar || "cat",
      },
    });

    const token = generateToken(user);
    recordUsage({ type: 'ACCOUNT_CREATED', user, source: sourceOf(req) });

    res.status(201).json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการสมัคร" });
  }
});

// ─── POST /login ─────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !username ||
      !password ||
      password.length > 128
    ) {
      return res.status(400).json({ error: "กรุณากรอก username และ password" });
    }

    // Find user by username
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || user.isGuest) {
      return res
        .status(401)
        .json({ error: "Username หรือ password ไม่ถูกต้อง" });
    }

    // Compare password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res
        .status(401)
        .json({ error: "Username หรือ password ไม่ถูกต้อง" });
    }

    const token = generateToken(user);
    recordUsage({ type: 'LOGIN', user, source: sourceOf(req) });

    res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการเข้าสู่ระบบ" });
  }
});

// ─── GET /me ─────────────────────────────────────────────────────────────────
router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(404).json({ error: "ไม่พบผู้ใช้" });
    }

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    console.error("Get me error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาด" });
  }
});

// ─── PUT /avatar ─────────────────────────────────────────────────────────────
router.put("/avatar", authenticate, async (req, res) => {
  try {
    const { avatar } = req.body;

    if (!avatar) {
      return res.status(400).json({ error: "กรุณาเลือก avatar" });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatar },
    });

    res.json({ user: sanitizeUser(user) });
  } catch (error) {
    console.error("Update avatar error:", error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการอัพเดท avatar" });
  }
});

export default router;
