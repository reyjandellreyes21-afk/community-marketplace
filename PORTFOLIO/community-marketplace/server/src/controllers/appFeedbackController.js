import { AppError } from "../errors/AppError.js";
import { supabaseAdmin } from "../lib/supabase.js";

const rowToApi = (row) => ({
  id: row.id,
  userId: row.user_id,
  category: row.category,
  message: row.message,
  clientPlatform: row.client_platform ?? null,
  createdAt: row.created_at,
});

/**
 * POST /app-feedback — authenticated users submit app experience feedback.
 * Inserts use the service role; `user_id` is always taken from `req.user`.
 */
export const createAppFeedback = async (req, res, next) => {
  try {
    const category = String(req.body?.category || "").trim();
    const message = String(req.body?.message || "").trim();
    const clientPlatform = req.body?.clientPlatform != null ? String(req.body.clientPlatform).trim().slice(0, 64) : null;
    const userAgent = req.headers["user-agent"] != null ? String(req.headers["user-agent"]).slice(0, 512) : null;

    const { data, error } = await supabaseAdmin
      .from("app_experience_feedback")
      .insert({
        user_id: req.user.id,
        category,
        message,
        client_platform: clientPlatform || null,
        user_agent: userAgent,
      })
      .select("id, user_id, category, message, client_platform, created_at")
      .single();

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("app_experience_feedback")) {
        return res.status(503).json({
          error: {
            message: "Feedback storage is not available yet.",
            details: { code: "SCHEMA_MISSING", hint: "Apply migration 20260509120000_app_experience_feedback.sql" },
          },
        });
      }
      throw new AppError(500, error.message);
    }
    if (!data) throw new AppError(500, "Failed to save feedback.");
    return res.status(201).json({ feedback: rowToApi(data) });
  } catch (e) {
    next(e);
  }
};
