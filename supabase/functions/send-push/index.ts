import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push";

Deno.serve(async (req) => {
  const { title, body, url = "/", triggered_by = "manual" } = await req.json();

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@sidequest.app",
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
  );

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: subs } = await supabase.from("push_subscriptions").select("*");
  if (!subs?.length) {
    await supabase.from("push_logs").insert({
      title, body, total: 0, sent: 0, failed: 0, triggered_by,
    });
    return Response.json({ sent: 0, total: 0 });
  }

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body, url }),
      )
    ),
  );

  const sent   = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  // Log the push batch
  await supabase.from("push_logs").insert({
    title,
    body,
    total: subs.length,
    sent,
    failed,
    triggered_by,
  });

  return Response.json({ sent, failed, total: subs.length });
});
