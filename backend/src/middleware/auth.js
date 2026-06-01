/**
 * Authentication middleware for Express and Socket.IO
 * Handles JWT verification for both HTTP requests and WebSocket connections
 */

import jwt from "jsonwebtoken";

/**
 * Express middleware: verifies JWT from Authorization header
 * Attaches decoded user { id, username } to req.user
 */
export function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "กรุณาเข้าสู่ระบบ (No token provided)" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user info to request object
    req.user = { id: decoded.id, username: decoded.username };
    next();
  } catch (error) {
    return res.status(401).json({ error: "Token ไม่ถูกต้องหรือหมดอายุ (Invalid or expired token)" });
  }
}

/**
 * Socket.IO middleware: verifies JWT from handshake auth
 * Attaches decoded user { id, username } to socket.user
 */
export function authenticateSocket(socket, next) {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = { id: decoded.id, username: decoded.username };
    next();
  } catch (error) {
    next(new Error("Invalid or expired token"));
  }
}
