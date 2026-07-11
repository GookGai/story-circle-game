/**
 * Authentication routes: register, login, get current user, update avatar
 */

import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../utils/prisma.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

/**
 * Generate a JWT token for a user
 */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

/**
 * Strip password from user object before sending to client
 */
function sanitizeUser(user) {
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

// ─── POST /guest ─────────────────────────────────────────────────────────────
router.post("/guest", async (req, res) => {
  try {
    const { username, avatar } = req.body;

    if (!username || username.trim().length < 1) {
      return res.status(400).json({ error: "กรุณากรอกชื่อเล่น" });
    }

    const cleanName = username.trim().substring(0, 15);

    // Generate a unique username by appending a random tag (e.g. Nick#1234)
    let finalUsername = "";
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      attempts++;
      const randTag = Math.floor(1000 + Math.random() * 9000); // 1000 to 9999
      finalUsername = `${cleanName}#${randTag}`;
      
      const existing = await prisma.user.findUnique({
        where: { username: finalUsername }
      });
      if (!existing) {
        isUnique = true;
      }
    }

    if (!isUnique) {
      finalUsername = `${cleanName}#${Date.now().toString().slice(-4)}`;
    }

    // Create guest user in DB with a random hashed password
    const dummyPassword = Math.random().toString(36) + Date.now().toString();
    const hashedPassword = await bcrypt.hash(dummyPassword, 10);

    const user = await prisma.user.create({
      data: {
        username: finalUsername,
        password: hashedPassword,
        avatar: avatar || "cat",
      },
    });

    const token = generateToken(user);

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
    if (!username || !password) {
      return res.status(400).json({ error: "กรุณากรอก username และ password" });
    }

    if (username.length < 2 || username.length > 20) {
      return res.status(400).json({ error: "Username ต้องมี 2-20 ตัวอักษร" });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: "Password ต้องมีอย่างน้อย 4 ตัวอักษร" });
    }

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return res.status(409).json({ error: "Username นี้ถูกใช้แล้ว" });
    }

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

    if (!username || !password) {
      return res.status(400).json({ error: "กรุณากรอก username และ password" });
    }

    // Find user by username
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: "Username หรือ password ไม่ถูกต้อง" });
    }

    // Compare password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: "Username หรือ password ไม่ถูกต้อง" });
    }

    const token = generateToken(user);

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
