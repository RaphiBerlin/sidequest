import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* no body */ }

  // ── Schedule a future drop ────────────────────────────────────────────────
  if (body.action === "schedule") {
    const { quest_id = null, scheduled_at, label = null } = body as Record<string, unknown>;
    if (!scheduled_at) {
      return Response.json({ error: "scheduled_at required" }, { status: 400 });
    }
    const { data, error } = await supabase
      .from("quest_schedule")
      .insert({ quest_id: quest_id || null, scheduled_at, label })
      .select("id, scheduled_at, label")
      .single();
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true, schedule: data });
  }

  // ── Cancel a scheduled drop ───────────────────────────────────────────────
  if (body.action === "cancel") {
    const { id } = body as Record<string, unknown>;
    if (!id) return Response.json({ error: "id required" }, { status: 400 });
    const { error } = await supabase
      .from("quest_schedule")
      .delete()
      .eq("id", id)
      .eq("executed", false);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ success: true });
  }

  // ── Cron tick: auto-execute any overdue scheduled drops ───────────────────
  if (body.action === "cron") {
    const { data: pending } = await supabase
      .from("quest_schedule")
      .select("id, quest_id")
      .eq("executed", false)
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(1);

    if (!pending?.length) {
      return Response.json({ success: true, message: "no pending drops" });
    }

    const row = pending[0];
    // Execute the drop using the quest_id from the schedule (or random)
    body = { quest_id: row.quest_id ?? undefined };

    // Mark as executed before dropping (prevent double-fire)
    await supabase
      .from("quest_schedule")
      .update({ executed: true, executed_at: new Date().toISOString() })
      .eq("id", row.id);
  }

  // ── Drop a quest now ──────────────────────────────────────────────────────
  let questId: string | null = (body.quest_id as string) ?? null;

  let picked: { id: string } | null = null;
  let pickError: { message: string } | null = null;

  if (questId) {
    const { data, error } = await supabase
      .from("quests")
      .select("id, duration_min")
      .eq("id", questId)
      .single();
    picked = data;
    pickError = error;
  } else {
    const { count } = await supabase
      .from("quests")
      .select("*", { count: "exact", head: true })
      .throwOnError();
    const randomOffset = Math.floor(Math.random() * (count ?? 1));
    const { data, error } = await supabase
      .from("quests")
      .select("id, duration_min")
      .range(randomOffset, randomOffset)
      .single();
    picked = data;
    pickError = error;
  }

  if (pickError || !picked) {
    return Response.json(
      { success: false, error: pickError?.message ?? "No quests found" },
      { status: 500 },
    );
  }

  // Clear existing active quest
  await supabase
    .from("active_quest")
    .delete()
    .neq("quest_id", "00000000-0000-0000-0000-000000000000");

  // Fetch quest title + duration for push notification and expiry
  const { data: questData } = await supabase
    .from("quests")
    .select("title, duration_min")
    .eq("id", picked.id)
    .single();
  const questTitle = questData?.title ?? "A new quest awaits";
  const durationMs = ((questData?.duration_min ?? (picked as any).duration_min ?? 45) as number) * 60 * 1000;

  // Insert new active quest
  const { error: insertError } = await supabase
    .from("active_quest")
    .insert({
      quest_id: picked.id,
      dropped_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + durationMs).toISOString(),
    });

  if (insertError) {
    return Response.json(
      { success: false, error: insertError.message },
      { status: 500 },
    );
  }

  const response = Response.json({ success: true, quest_id: picked.id });

  // Fire push notification (non-blocking)
  const triggeredBy = body.action === "cron" ? "cron" : body.quest_id ? "manual" : "quest_drop";
  supabase.functions.invoke("send-push", {
    body: { title: "🔥 Quest dropped!", body: questTitle, url: "/quest-drop", triggered_by: triggeredBy },
  }).catch(() => {});

  return response;
});
