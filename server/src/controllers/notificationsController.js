import { AppError } from "../errors/AppError.js";
import { supabaseAdmin } from "../lib/supabase.js";

const notificationRowToApi = (row) => ({
  id: row.id,
  userId: row.user_id,
  actorId: row.actor_id ?? null,
  type: row.type,
  entityType: row.entity_type || null,
  entityId: row.entity_id ?? null,
  title: row.title,
  body: row.body,
  metadata: row.metadata || {},
  isRead: Boolean(row.is_read),
  readAt: row.read_at ?? null,
  createdAt: row.created_at,
});

export const listNotifications = async (req, res, next) => {
  try {
    const limit = req.query.limit != null ? Number(req.query.limit) : 50;
    const offset = req.query.offset != null ? Number(req.query.offset) : 0;
    const type = req.query.type != null ? String(req.query.type).trim() : "";
    const unreadOnly = String(req.query.unreadOnly || "").toLowerCase() === "true";

    let q = supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (type) q = q.eq("type", type);
    if (unreadOnly) q = q.eq("is_read", false);

    const { data, error } = await q;
    if (error?.code === "PGRST205") {
      /* 200 so the client can read schemaMissing; apiRequest treats 503 as thrown Error. */
      return res.json({
        notifications: [],
        unreadCount: 0,
        schemaMissing: true,
        note: "Apply migration `supabase/migrations/20260427154500_notifications_backend.sql`.",
      });
    }
    if (error) throw new AppError(500, error.message);

    const { count: unreadCount, error: cErr } = await supabaseAdmin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", req.user.id)
      .eq("is_read", false);
    if (cErr) throw new AppError(500, cErr.message);

    return res.json({
      notifications: (data || []).map(notificationRowToApi),
      unreadCount: unreadCount || 0,
      paging: { limit, offset },
    });
  } catch (e) {
    next(e);
  }
};

export const markNotificationRead = async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .update({ is_read: true, read_at: now })
      .eq("id", id)
      .eq("user_id", req.user.id)
      .select("*")
      .maybeSingle();
    if (error) throw new AppError(500, error.message);
    if (!data) throw new AppError(404, "Notification not found.");
    return res.json({ notification: notificationRowToApi(data) });
  } catch (e) {
    next(e);
  }
};

export const markNotificationsReadBulk = async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(String).filter(Boolean) : [];
    const now = new Date().toISOString();
    if (ids.length > 0) {
      const { error } = await supabaseAdmin
        .from("notifications")
        .update({ is_read: true, read_at: now })
        .eq("user_id", req.user.id)
        .in("id", ids);
      if (error) throw new AppError(500, error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("notifications")
        .update({ is_read: true, read_at: now })
        .eq("user_id", req.user.id)
        .eq("is_read", false);
      if (error) throw new AppError(500, error.message);
    }
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

export const deleteNotification = async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .delete()
      .eq("id", id)
      .eq("user_id", req.user.id)
      .select("id")
      .maybeSingle();
    if (error) throw new AppError(500, error.message);
    if (!data) throw new AppError(404, "Notification not found.");
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

export const deleteAllNotifications = async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin
      .from("notifications")
      .delete()
      .eq("user_id", req.user.id);
    if (error) throw new AppError(500, error.message);
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
