import { Router } from "express";
import { query } from "../db/pool.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const users = await query(
      "SELECT id, name, email, roles, likes, liked_by_user_ids AS \"likedByUserIds\" FROM users ORDER BY created_at DESC"
    );
    const products = await query(
      "SELECT id, seller_id AS \"sellerId\", seller_name AS \"sellerName\", name, subtitle, rating, distance, price, category, is_promo AS \"isPromo\", stock, image_class AS \"imageClass\", image_data_url AS \"imageDataUrl\", is_active AS \"isActive\", created_at AS \"createdAt\" FROM products ORDER BY created_at DESC"
    );
    const orders = await query("SELECT payload FROM orders ORDER BY created_at DESC");
    const snapshot = {
      users: users.rows,
      products: products.rows,
      orders: orders.rows.map((row) => row.payload),
      cart: [],
      currentUserId: null,
      activeMode: "buyer",
    };
    return res.json(snapshot);
  } catch (error) {
    return next(error);
  }
});

router.post("/orders", async (req, res, next) => {
  try {
    const payload = req.body;
    await query("INSERT INTO orders(payload) VALUES($1)", [payload]);
    return res.status(201).json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.post("/products", async (req, res, next) => {
  try {
    const p = req.body;
    const inserted = await query(
      "INSERT INTO products(id, seller_id, seller_name, name, subtitle, rating, distance, price, category, is_promo, stock, image_class, image_data_url, is_active, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,COALESCE($15::timestamptz, NOW())) RETURNING *",
      [
        p.id,
        p.sellerId,
        p.sellerName,
        p.name,
        p.subtitle,
        p.rating,
        p.distance,
        p.price,
        p.category,
        p.isPromo ?? false,
        p.stock ?? 0,
        p.imageClass ?? "from-slate-200 via-slate-100 to-slate-50",
        p.imageDataUrl ?? null,
        p.isActive ?? true,
        p.createdAt ?? null,
      ]
    );
    return res.status(201).json(inserted.rows[0]);
  } catch (error) {
    return next(error);
  }
});

export default router;

