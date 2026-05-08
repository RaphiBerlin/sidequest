import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Verify caller is authenticated admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await anonClient.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: adminRow } = await supabase
    .from("users")
    .select("is_admin, email")
    .eq("id", user.id)
    .single();

  const isAdmin = adminRow?.email === Deno.env.get("ADMIN_EMAIL") || adminRow?.is_admin;
  if (!isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });

  // Parse target user ID
  const { user_id } = await req.json().catch(() => ({}));
  if (!user_id) return Response.json({ error: "user_id required" }, { status: 400 });

  // Pick 3 random quests
  const { data: quests } = await supabase
    .from("quests")
    .select("id")
    .limit(3);

  if (!quests?.length) return Response.json({ error: "No quests found" }, { status: 500 });

  // Insert completed sessions spaced a few days apart
  const sessions = quests.map((q, i) => ({
    user_id,
    quest_id: q.id,
    party_ids: [],
    started_at: new Date(Date.now() - (i + 1) * 2 * 24 * 60 * 60 * 1000).toISOString(),
    completed_at: new Date(Date.now() - (i + 1) * 2 * 24 * 60 * 60 * 1000 + 25 * 60 * 1000).toISOString(),
    elapsed_sec: 1500,
    xp_earned: 100,
  }));

  const { data, error } = await supabase.from("quest_sessions").insert(sessions).select("id");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ success: true, inserted: data?.length ?? 0 });
});
