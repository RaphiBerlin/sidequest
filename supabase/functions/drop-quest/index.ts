import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. Pick quest — use provided ID or fall back to random
  let questId: string | null = null;
  try {
    const body = await req.json();
    questId = body?.quest_id ?? null;
  } catch { /* no body */ }

  let picked: { id: string } | null = null;
  let pickError: { message: string } | null = null;

  if (questId) {
    const { data, error } = await supabase
      .from("quests")
      .select("id")
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
      .select("id")
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

  // 2. Clear the existing active quest (table holds at most one row)
  const { error: deleteError } = await supabase
    .from("active_quest")
    .delete()
    .neq("quest_id", "00000000-0000-0000-0000-000000000000"); // matches all rows

  if (deleteError) {
    return Response.json(
      { success: false, error: deleteError.message },
      { status: 500 },
    );
  }

  // 3. Fetch quest title for the push notification
  const { data: questData } = await supabase
    .from("quests")
    .select("title")
    .eq("id", picked.id)
    .single();
  const questTitle = questData?.title ?? "A new quest awaits";

  // 4. Insert the new active quest
  const { error: insertError } = await supabase
    .from("active_quest")
    .insert({
      quest_id: picked.id,
      dropped_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
    });

  if (insertError) {
    return Response.json(
      { success: false, error: insertError.message },
      { status: 500 },
    );
  }

  // 5. Return confirmation
  const response = Response.json({ success: true, quest_id: picked.id });

  // Fire push notification (non-blocking)
  supabase.functions.invoke('send-push', {
    body: { title: '🔥 Quest dropped!', body: questTitle, url: '/quest-drop' }
  }).catch(() => {}) // Don't fail the drop if push fails

  return response;
});
