import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { query } from "../db/pool.js";
import { env } from "../config/env.js";

const router = Router();

const authSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email(),
  password: z.string().min(6),
});

router.post("/register", async (req, res, next) => {
  try {
    const payload = authSchema.extend({ name: z.string().min(2) }).parse(req.body);
    const existing = await query("SELECT id FROM users WHERE email = $1 LIMIT 1", [payload.email]);
    if (existing.rowCount) {
      return res.status(409).json({ error: "Email already registered." });
    }
    const hash = await bcrypt.hash(payload.password, 10);
    const inserted = await query(
      "INSERT INTO users(name, email, password_hash) VALUES($1, $2, $3) RETURNING id, name, email",
      [payload.name, payload.email, hash]
    );
    const user = inserted.rows[0];
    const token = jwt.sign({ sub: user.id, email: user.email, roles: ["buyer"] }, env.jwtSecret, {
      expiresIn: "7d",
    });
    return res.status(201).json({ user: { ...user, roles: ["buyer"] }, token });
  } catch (error) {
    return next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const payload = authSchema.pick({ email: true, password: true }).parse(req.body);
    const result = await query(
      "SELECT id, name, email, password_hash, roles FROM users WHERE email = $1 LIMIT 1",
      [payload.email]
    );
    if (!result.rowCount) {
      return res.status(401).json({ error: "Invalid credentials." });
    }
    const user = result.rows[0];
    const ok = await bcrypt.compare(payload.password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials." });
    }
    const token = jwt.sign(
      { sub: user.id, email: user.email, roles: user.roles ?? ["buyer"] },
      env.jwtSecret,
      { expiresIn: "7d" }
    );
    return res.json({
      user: { id: user.id, name: user.name, email: user.email, roles: user.roles ?? ["buyer"] },
      token,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;

