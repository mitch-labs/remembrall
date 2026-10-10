// Remembrall daily recall: sends each person a push with a few things they logged.
// Called hourly by pg_cron (x-cron-secret header), or by a signed-in user with
// {"test": true} to send themselves a test notification right now.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const BUILTIN = [
  { id: "word", recall: "Word of the day" },
  { id: "recipe", recall: "Recipe you saved" },
  { id: "book", recall: "Book you said you'd read" },
  { id: "news", recall: "News you caught" },
  { id: "fact", recall: "Thing you learned" },
  { id: "idea", recall: "Thought you dropped in" },
];
const MAX_RECALL = 3;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

type Item = { id: string; cat: string; text: string; note: string | null; created_at: string };
type Cat = { id: string; label: string; recall: string | null; created_at: string };

function localParts(tz: string, d = new Date()) {
  let zone = tz;
  try { new Intl.DateTimeFormat("en-CA", { timeZone: zone }); } catch { zone = "Asia/Manila"; }
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const date = `${p.year}-${p.month}-${p.day}`;
  const day = Math.floor(Date.UTC(+p.year, +p.month - 1, +p.day) / 86400000);
  return { date, day, hour: +p.hour };
}

// Same rule as the app: kinds that have items rotate by day; within a kind, item = pool[day % len].
export function pick(items: Item[], cats: Cat[], day: number) {
  const order = [
    ...BUILTIN,
    ...[...cats].sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((c) => ({ id: c.id, recall: c.recall || `Your ${c.label.toLowerCase()}` })),
  ];
  const sorted = [...items].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  const kinds = order.filter((k) => sorted.some((i) => i.cat === k.id));
  const out: { recall: string; text: string; note: string | null }[] = [];
  if (!kinds.length) return out;
  const start = day % kinds.length;
  for (let j = 0; j < Math.min(MAX_RECALL, kinds.length); j++) {
    const k = kinds[(start + j) % kinds.length];
    const pool = sorted.filter((i) => i.cat === k.id);
    const it = pool[day % pool.length];
    out.push({ recall: k.recall, text: it.text, note: it.note });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data: cfg, error: cfgErr } = await admin.rpc("get_push_config");
  if (cfgErr || !cfg?.vapid_private) return json({ error: "Push is not configured" }, 500);
  webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public, cfg.vapid_private);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body */ }

  // Who are we sending to?
  let targetUsers: string[] | null = null; // null = everyone due this hour
  let isTest = false;
  if (req.headers.get("x-cron-secret") === cfg.cron_secret) {
    if (typeof body.probe === "string") targetUsers = []; // health check: run nothing
  } else {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    if (!u?.user) return json({ error: "Not signed in" }, 401);
    targetUsers = [u.user.id];
    isTest = true;
  }

  let settingsQ = admin.from("settings").select("user_id, reminders_on, remind_hour, remind_tz, last_sent");
  if (targetUsers) settingsQ = settingsQ.in("user_id", targetUsers.length ? targetUsers : ["00000000-0000-0000-0000-000000000000"]);
  else settingsQ = settingsQ.eq("reminders_on", true);
  const { data: settings, error: sErr } = await settingsQ;
  if (sErr) return json({ error: sErr.message }, 500);

  // A test for someone with no settings row yet still works.
  const rows = settings?.length ? settings : (isTest ? [{ user_id: targetUsers![0], reminders_on: true, remind_hour: 8, remind_tz: "Asia/Manila", last_sent: null }] : []);

  const results: Record<string, unknown>[] = [];
  for (const s of rows) {
    const lp = localParts(s.remind_tz);
    if (!isTest && (lp.hour !== s.remind_hour || s.last_sent === lp.date)) continue;

    const [{ data: items }, { data: cats }, { data: subs }] = await Promise.all([
      admin.from("items").select("id, cat, text, note, created_at").eq("user_id", s.user_id).is("done_at", null),
      admin.from("categories").select("id, label, recall, created_at").eq("user_id", s.user_id),
      admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", s.user_id),
    ]);
    if (!subs?.length) { results.push({ user: s.user_id, skipped: "no devices" }); continue; }

    const picks = pick((items || []) as Item[], (cats || []) as Cat[], lp.day);
    const lines = picks.length
      ? picks.map((p, i) => `${i + 1}. ${p.recall}: ${p.text}`).join("\n")
      : "Nothing left in your orb. Drop something new in today.";
    const payload = JSON.stringify({
      title: picks.length ? "You've forgotten something" : "Remembrall",
      body: lines,
      url: "./",
      tag: "remembrall-" + lp.date,
    });

    let sent = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 60 * 60 * 12 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("id", sub.id);
        results.push({ user: s.user_id, device_error: code ?? String(e).slice(0, 200) });
      }
    }
    if (!isTest && sent > 0) {
      await admin.from("settings").update({ last_sent: lp.date }).eq("user_id", s.user_id);
    }
    results.push({ user: s.user_id, sent, picks: picks.length });
  }
  return json({ ok: true, test: isTest, results });
});
