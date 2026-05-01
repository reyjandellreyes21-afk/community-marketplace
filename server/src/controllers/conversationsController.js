import { AppError } from "../errors/AppError.js";
import { supabaseAdmin } from "../lib/supabase.js";

const firstRow = (rows) => (Array.isArray(rows) && rows.length > 0 ? rows[0] : null);

const isConversationMessagesEditedAtMissingError = (error) => {
  if (!error) return false;
  const msg = String(error.message || "");
  return (
    /conversation_messages\.edited_at/i.test(msg) &&
    (error.code === "PGRST204" || error.code === "42703" || /does not exist/i.test(msg) || /schema cache/i.test(msg))
  );
};

const isConversationMessagesDeletedAtMissingError = (error) => {
  if (!error) return false;
  const msg = String(error.message || "");
  return (
    /conversation_messages\.deleted_at/i.test(msg) &&
    (error.code === "PGRST204" || error.code === "42703" || /does not exist/i.test(msg) || /schema cache/i.test(msg))
  );
};

const messageRowToApi = (row) => ({
  id: row.id,
  conversationId: row.conversation_id,
  senderId: row.sender_id,
  body: row.body,
  createdAt: row.created_at,
  editedAt: row.edited_at,
  deletedAt: row.deleted_at,
});

const conversationRowToApi = (row, extras = {}) => ({
  id: row.id,
  type: row.type,
  orderId: row.order_id ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  ...extras,
});

const ensureConversationParticipant = async (conversationId, userId) => {
  const { data, error } = await supabaseAdmin
    .from("conversation_participants")
    .select("conversation_id,user_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(403, "Forbidden.");
};

const ensureOrderParticipant = async ({ orderId, userId, roleHint }) => {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id,buyer_id,seller_id,accepted_courier_assignment_id")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!order) throw new AppError(404, "Order not found.");

  let courierId = null;
  if (order.accepted_courier_assignment_id) {
    const { data: bid, error: bidErr } = await supabaseAdmin
      .from("courier_assignments")
      .select("courier_id")
      .eq("id", order.accepted_courier_assignment_id)
      .maybeSingle();
    if (bidErr) throw new AppError(500, bidErr.message);
    courierId = bid?.courier_id || null;
  }

  const allowed = new Set([order.buyer_id, order.seller_id, courierId].filter(Boolean));
  if (!allowed.has(userId)) throw new AppError(403, "You are not part of this order.");

  if (roleHint === "buyer" && order.buyer_id !== userId) throw new AppError(403, "Role mismatch.");
  if (roleHint === "seller" && order.seller_id !== userId) throw new AppError(403, "Role mismatch.");
  if (roleHint === "courier" && courierId !== userId) throw new AppError(403, "Role mismatch.");

  const participants = [
    { userId: order.buyer_id, role: "buyer" },
    { userId: order.seller_id, role: "seller" },
  ];
  if (courierId) participants.push({ userId: courierId, role: "courier" });
  return participants;
};

export const createConversation = async (req, res, next) => {
  try {
    const type = String(req.body.type || "").trim();

    if (type === "direct") {
      const targetUserId = String(req.body.targetUserId || "").trim();
      if (!targetUserId) throw new AppError(400, "targetUserId is required for direct conversations.");
      if (targetUserId === req.user.id) throw new AppError(400, "You cannot start a direct conversation with yourself.");

      const participantIds = [req.user.id, targetUserId].sort();
      const { data: existingRows, error: exErr } = await supabaseAdmin
        .from("conversations")
        .select("id,type,order_id,created_at,updated_at,conversation_participants!inner(user_id)")
        .eq("type", "direct")
        .in("conversation_participants.user_id", participantIds);
      if (exErr) throw new AppError(500, exErr.message);

      const existing = (existingRows || []).find((row) => {
        const ids = (row.conversation_participants || []).map((p) => String(p.user_id)).sort();
        return ids.length === 2 && ids[0] === participantIds[0] && ids[1] === participantIds[1];
      });
      if (existing) {
        return res.status(200).json({ conversation: conversationRowToApi(existing) });
      }

      const now = new Date().toISOString();
      const { data: inserted, error: ierr } = await supabaseAdmin
        .from("conversations")
        .insert({ type: "direct", created_at: now, updated_at: now })
        .select("*")
        .single();
      if (ierr) throw new AppError(400, ierr.message);

      const participantRows = participantIds.map((uid) => ({
        conversation_id: inserted.id,
        user_id: uid,
        role: "member",
        joined_at: now,
      }));
      const { error: perr } = await supabaseAdmin.from("conversation_participants").insert(participantRows);
      if (perr) throw new AppError(400, perr.message);

      return res.status(201).json({ conversation: conversationRowToApi(inserted) });
    }

    if (type !== "order") throw new AppError(400, "Unsupported conversation type.");
    const orderId = String(req.body.orderId || "").trim();
    if (!orderId) throw new AppError(400, "orderId is required for order conversations.");
    const roleHint = req.body.roleHint != null ? String(req.body.roleHint).trim() : null;
    const participants = await ensureOrderParticipant({ orderId, userId: req.user.id, roleHint });

    const { data: existingRows, error: exErr } = await supabaseAdmin
      .from("conversations")
      .select("*")
      .eq("type", "order")
      .eq("order_id", orderId)
      .limit(1);
    if (exErr) throw new AppError(500, exErr.message);
    const existing = firstRow(existingRows);
    if (existing) return res.status(200).json({ conversation: conversationRowToApi(existing) });

    const now = new Date().toISOString();
    const { data: inserted, error: ierr } = await supabaseAdmin
      .from("conversations")
      .insert({ type: "order", order_id: orderId, created_at: now, updated_at: now })
      .select("*")
      .single();
    if (ierr) throw new AppError(400, ierr.message);

    const participantRows = participants.map((p) => ({
      conversation_id: inserted.id,
      user_id: p.userId,
      role: p.role,
      joined_at: now,
    }));
    const { error: perr } = await supabaseAdmin.from("conversation_participants").insert(participantRows);
    if (perr) throw new AppError(400, perr.message);

    return res.status(201).json({ conversation: conversationRowToApi(inserted) });
  } catch (e) {
    next(e);
  }
};

export const listConversations = async (req, res, next) => {
  try {
    const { data: memberships, error: merr } = await supabaseAdmin
      .from("conversation_participants")
      .select("conversation_id,role,joined_at")
      .eq("user_id", req.user.id);
    if (merr?.code === "PGRST205") return res.json({ conversations: [] });
    if (merr) throw new AppError(500, merr.message);

    const conversationIds = (memberships || []).map((m) => m.conversation_id).filter(Boolean);
    if (conversationIds.length === 0) return res.json({ conversations: [] });

    const { data: rows, error } = await supabaseAdmin
      .from("conversations")
      .select("*")
      .in("id", conversationIds)
      .order("updated_at", { ascending: false });
    if (error) throw new AppError(500, error.message);

    const { data: participantRows, error: perr } = await supabaseAdmin
      .from("conversation_participants")
      .select("conversation_id,user_id,role,joined_at")
      .in("conversation_id", conversationIds);
    if (perr) throw new AppError(500, perr.message);

    const { data: readRows, error: rerr } = await supabaseAdmin
      .from("conversation_reads")
      .select("conversation_id,last_read_message_id,updated_at")
      .eq("user_id", req.user.id)
      .in("conversation_id", conversationIds);
    if (rerr) throw new AppError(500, rerr.message);

    let { data: lastMessages, error: lmerr } = await supabaseAdmin
      .from("conversation_messages")
      .select("id,conversation_id,sender_id,body,created_at,edited_at,deleted_at")
      .in("conversation_id", conversationIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (isConversationMessagesEditedAtMissingError(lmerr)) {
      ({ data: lastMessages, error: lmerr } = await supabaseAdmin
        .from("conversation_messages")
        .select("id,conversation_id,sender_id,body,created_at,deleted_at")
        .in("conversation_id", conversationIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }));
    }
    if (isConversationMessagesDeletedAtMissingError(lmerr)) {
      ({ data: lastMessages, error: lmerr } = await supabaseAdmin
        .from("conversation_messages")
        .select("id,conversation_id,sender_id,body,created_at,edited_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false }));
      if (isConversationMessagesEditedAtMissingError(lmerr)) {
        ({ data: lastMessages, error: lmerr } = await supabaseAdmin
          .from("conversation_messages")
          .select("id,conversation_id,sender_id,body,created_at")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false }));
      }
    }
    if (lmerr) throw new AppError(500, lmerr.message);

    const userIds = [...new Set((participantRows || []).map((p) => String(p.user_id)).filter(Boolean))];
    let profilesById = new Map();
    if (userIds.length > 0) {
      const { data: profiles, error: prErr } = await supabaseAdmin
        .from("profiles")
        .select("id,username,first_name,last_name")
        .in("id", userIds);
      if (prErr) throw new AppError(500, prErr.message);
      profilesById = new Map(
        (profiles || []).map((p) => [
          String(p.id),
          {
            id: p.id,
            username: String(p.username || "").trim() || null,
            displayName: [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || String(p.username || "").trim() || "Member",
          },
        ]),
      );
    }

    const byConversationId = new Map((memberships || []).map((m) => [String(m.conversation_id), m]));
    const participantsByConversation = new Map();
    for (const p of participantRows || []) {
      const key = String(p.conversation_id);
      if (!participantsByConversation.has(key)) participantsByConversation.set(key, []);
      const profile = profilesById.get(String(p.user_id)) || { id: p.user_id, username: null, displayName: "Member" };
      participantsByConversation.get(key).push({
        userId: p.user_id,
        role: p.role || "member",
        joinedAt: p.joined_at || null,
        profile,
      });
    }
    const readByConversation = new Map((readRows || []).map((r) => [String(r.conversation_id), r]));
    const latestMessageByConversation = new Map();
    for (const msg of lastMessages || []) {
      const key = String(msg.conversation_id);
      if (!latestMessageByConversation.has(key)) latestMessageByConversation.set(key, msg);
    }

    const out = (rows || []).map((row) => {
      const m = byConversationId.get(String(row.id));
      const read = readByConversation.get(String(row.id));
      const latest = latestMessageByConversation.get(String(row.id));
      return conversationRowToApi(row, {
        role: m?.role || "member",
        joinedAt: m?.joined_at || null,
        participants: participantsByConversation.get(String(row.id)) || [],
        lastMessage: latest ? messageRowToApi(latest) : null,
        readState: {
          lastReadMessageId: read?.last_read_message_id || null,
          updatedAt: read?.updated_at || null,
        },
      });
    });
    return res.json({ conversations: out });
  } catch (e) {
    next(e);
  }
};

export const listConversationMessages = async (req, res, next) => {
  try {
    const conversationId = String(req.params.id);
    const limit = req.query.limit != null ? Number(req.query.limit) : 50;
    const before = req.query.before != null ? String(req.query.before) : null;
    await ensureConversationParticipant(conversationId, req.user.id);

    let cursorCreatedAt = null;
    if (before) {
      const { data: cursorMsg, error: cerr } = await supabaseAdmin
        .from("conversation_messages")
        .select("id,conversation_id,created_at")
        .eq("id", before)
        .maybeSingle();
      if (cerr) throw new AppError(500, cerr.message);
      if (cursorMsg && String(cursorMsg.conversation_id) === conversationId) cursorCreatedAt = cursorMsg.created_at;
    }

    let q = supabaseAdmin
      .from("conversation_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (cursorCreatedAt) q = q.lt("created_at", cursorCreatedAt);

    let { data, error } = await q;
    if (isConversationMessagesDeletedAtMissingError(error)) {
      let fallbackQ = supabaseAdmin
        .from("conversation_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (cursorCreatedAt) fallbackQ = fallbackQ.lt("created_at", cursorCreatedAt);
      ({ data, error } = await fallbackQ);
    }
    if (error) throw new AppError(500, error.message);
    const messages = (data || []).slice().reverse().map(messageRowToApi);
    return res.json({ messages });
  } catch (e) {
    next(e);
  }
};

export const createConversationMessage = async (req, res, next) => {
  try {
    const conversationId = String(req.params.id);
    const bodyText = String(req.body.body || "").trim();
    if (!bodyText) throw new AppError(400, "Message body is required.");
    await ensureConversationParticipant(conversationId, req.user.id);

    const now = new Date().toISOString();
    const row = {
      conversation_id: conversationId,
      sender_id: req.user.id,
      body: bodyText.slice(0, 4000),
      created_at: now,
    };
    const { data, error } = await supabaseAdmin.from("conversation_messages").insert(row).select("*").single();
    if (error) throw new AppError(400, error.message);

    const { error: uerr } = await supabaseAdmin.from("conversations").update({ updated_at: now }).eq("id", conversationId);
    if (uerr) throw new AppError(500, uerr.message);

    return res.status(201).json({ message: messageRowToApi(data) });
  } catch (e) {
    next(e);
  }
};

export const markConversationRead = async (req, res, next) => {
  try {
    const conversationId = String(req.params.id);
    const lastReadMessageId = req.body.lastReadMessageId != null ? String(req.body.lastReadMessageId) : null;
    await ensureConversationParticipant(conversationId, req.user.id);

    if (lastReadMessageId) {
      const { data: msg, error: merr } = await supabaseAdmin
        .from("conversation_messages")
        .select("id,conversation_id")
        .eq("id", lastReadMessageId)
        .maybeSingle();
      if (merr) throw new AppError(500, merr.message);
      if (!msg || String(msg.conversation_id) !== conversationId) {
        throw new AppError(400, "lastReadMessageId does not belong to this conversation.");
      }
    }

    const row = {
      conversation_id: conversationId,
      user_id: req.user.id,
      last_read_message_id: lastReadMessageId,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabaseAdmin.from("conversation_reads").upsert(row, { onConflict: "conversation_id,user_id" });
    if (error) throw new AppError(400, error.message);
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};
