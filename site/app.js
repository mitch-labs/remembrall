// Remembrall — app logic.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";

// ---- Project settings (public values; safe to ship in the browser) ----
const SUPABASE_URL = "https://jjmmjdjpqspipnwlnhmu.supabase.co";
const SUPABASE_KEY = "sb_publishable_PEQeE-s84TUVk6XcDITWlg_uvmZ41bc";
const VAPID_PUBLIC = "BCqzqjATjll1gfogNPH-XUKWA4OCca_jLgCQUbmSE2wlgHUkh-F25ukcBUrnzTGQ5BjFizHhrVIkcdUZEb_KJvg";

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, detectSessionInUrl: true } });
const $ = (id) => document.getElementById(id);

const BUILTIN = [
  { id: "word", label: "Word", recall: "Word of the day", ph: "Inveterate" },
  { id: "recipe", label: "Recipe", recall: "Recipe you saved", ph: "Tiramisu chia seeds" },
  { id: "book", label: "Book", recall: "Book you said you'd read", ph: "The Laws of Human Nature" },
  { id: "news", label: "News", recall: "News you caught", ph: "A headline worth remembering" },
  { id: "fact", label: "Fact", recall: "Thing you learned", ph: "Octopuses have three hearts" },
  { id: "idea", label: "Idea", recall: "Thought you dropped in", ph: "A half-formed idea" },
];
const MAX_RECALL = 3;

let user = null;
let items = [];      // {id, cat, text, note, created_at}
let custom = [];     // {id, label, recall, created_at}
let settings = null; // {reminders_on, remind_hour, remind_tz}
let selCat = "word", filt = "all", confirmId = null, openId = null;
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Manila";

// ---------- categories ----------
function allCats() {
  return [...BUILTIN, ...[...custom].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((c) => ({
    id: c.id, label: c.label, recall: c.recall || `Your ${c.label.toLowerCase()}`, ph: "Something to remember", custom: true,
  }))];
}
const catOf = (id) => allCats().find((c) => c.id === id) || { id, label: "Other", recall: "Something you kept", ph: "" };

// ---------- daily pick (identical rule to the server reminder) ----------
function localDay(tz) {
  let zone = tz;
  try { new Intl.DateTimeFormat("en-CA", { timeZone: zone }); } catch { zone = "Asia/Manila"; }
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, day: Math.floor(Date.UTC(+p.year, +p.month - 1, +p.day) / 86400000) };
}
function pick(list, day) {
  const sorted = list.filter((i) => !i.done_at).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  const kinds = allCats().filter((k) => sorted.some((i) => i.cat === k.id));
  if (!kinds.length) return [];
  const out = [], start = day % kinds.length;
  for (let j = 0; j < Math.min(MAX_RECALL, kinds.length); j++) {
    const k = kinds[(start + j) % kinds.length];
    const pool = sorted.filter((i) => i.cat === k.id);
    out.push({ ...pool[day % pool.length], recall: k.recall });
  }
  return out;
}

// ---------- tiny DOM helper ----------
function el(tag, attrs, text) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text != null) e.textContent = text;
  return e;
}
function flash(id, msg) {
  const t = $(id); t.textContent = msg;
  clearTimeout(t._t); t._t = setTimeout(() => (t.textContent = ""), 4000);
}

// ---------- recall ----------
const today = () => localDay(settings?.remind_tz || TZ);
function isSeen() { try { return localStorage.getItem("rb-seen") === today().date; } catch { return false; } }
function markSeen() { try { localStorage.setItem("rb-seen", today().date); } catch {} renderRecall(); }

function renderRecall() {
  $("recallDate").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const list = $("recallList"); list.textContent = "";
  const picks = pick(items, today().day);
  if (!picks.length) list.appendChild(el("p", { class: "empty" }, items.length
    ? "Everything in the orb is done. Drop in something new and it will come back to you."
    : "Nothing in the orb yet. Drop something in and it will come back to you."));
  for (const p of picks) {
    const li = el("li"), box = el("div");
    box.appendChild(el("span", { class: "k" }, p.recall));
    box.appendChild(el("span", { class: "v" }, p.text));
    if (p.note) { const n = el("span", { class: "n" }); linkify(p.note, n); box.appendChild(n); }
    li.appendChild(box);
    const tick = el("button", { type: "button", class: "tick", "aria-label": `Mark ${p.text} as done` });
    tick.appendChild(el("span", { class: "box", "aria-hidden": "true" }));
    tick.appendChild(el("span", null, "Done"));
    tick.onclick = () => toggleDone(p.id, true);
    li.appendChild(tick); list.appendChild(li);
  }
  const red = !isSeen() && picks.length > 0;
  $("recall").classList.toggle("veiled", red);
  $("recallHint").hidden = !red;
  const st = $("orbState");
  st.textContent = red ? "The smoke is red. You have forgotten something." : picks.length ? "Clear smoke. You remembered." : "The orb is waiting.";
  st.classList.toggle("red", red);
  smoke.target = red ? 1 : 0;
  $("orb").style.setProperty("--glow", red ? "rgba(210,58,68,.35)" : "rgba(220,220,255,.12)");
}

// ---------- ledger ----------
function renderChips() {
  const c = $("catChips"); c.textContent = "";
  const cats = allCats();
  if (!cats.some((x) => x.id === selCat)) selCat = "word";
  for (const cat of cats) {
    const b = el("button", { type: "button", class: "chip", "aria-pressed": String(cat.id === selCat) }, cat.label);
    b.onclick = () => { selCat = cat.id; renderChips(); };
    c.appendChild(b);
  }
  $("text").placeholder = "e.g. " + catOf(selCat).ph;
  renderShelves();
}
function renderShelves() {
  const s = $("shelves"); s.textContent = "";
  const cats = allCats();
  if (filt !== "all" && !cats.some((c) => c.id === filt)) filt = "all";
  for (const cat of [{ id: "all", label: "Everything" }, ...cats]) {
    const n = cat.id === "all" ? items.length : items.filter((i) => i.cat === cat.id).length;
    const b = el("button", { type: "button", class: "shelf", "aria-pressed": String(cat.id === filt) });
    b.appendChild(el("span", { class: "sl" }, cat.label));
    const nd = (cat.id === "all" ? items : items.filter((i) => i.cat === cat.id)).filter((i) => i.done_at).length;
    b.appendChild(el("span", { class: "sc" }, n === 0 ? "Nothing yet" : n + (n === 1 ? " thing" : " things") + (nd ? ` · ${nd} done` : "")));
    b.onclick = () => { filt = cat.id; if (cat.id !== "all") selCat = cat.id; renderChips(); renderList(); };
    s.appendChild(b);
  }
  const nb = el("button", { type: "button", class: "shelf new" });
  nb.appendChild(el("span", { class: "sl" }, "+ New category"));
  nb.appendChild(el("span", { class: "sc" }, "Movies, places, quotes…"));
  nb.onclick = () => { $("newCat").hidden = false; $("ncName").focus(); };
  s.appendChild(nb);
  const cur = catOf(filt);
  $("viewTitle").textContent = filt === "all" ? "Everything" : cur.label;
  $("delCat").hidden = !(filt !== "all" && cur.custom && !items.some((i) => i.cat === filt));
}
function renderList() {
  const ul = $("items"); ul.textContent = "";
  const q = $("q").value.trim().toLowerCase();
  $("count").textContent = items.length + (items.length === 1 ? " thing kept" : " things kept");
  const shown = [...items].sort((a, b) => (!!a.done_at - !!b.done_at) || b.created_at.localeCompare(a.created_at))
    .filter((i) => filt === "all" || i.cat === filt)
    .filter((i) => !q || (i.text + " " + (i.note || "")).toLowerCase().includes(q));
  if (!shown.length) {
    ul.appendChild(el("li", { class: "empty" }, q ? "Nothing matches that." :
      filt === "all" ? "Your ledger is empty. Drop in the first thing you want to remember." :
      `Nothing in ${catOf(filt).label} yet. Pick it above and drop something in.`));
    return;
  }
  for (const i of shown) {
    const open = openId === i.id;
    const li = el("li", { class: "entry" + (open ? " open" : "") + (i.done_at ? " done" : "") });
    const head = el("button", { type: "button", class: "entry-head", "aria-expanded": String(open), "aria-controls": "d-" + i.id });
    if (filt === "all") head.appendChild(el("span", { class: "tag" }, catOf(i.cat).label));
    head.appendChild(el("span", { class: "entry-title" }, i.text));
    if (i.done_at) head.appendChild(el("span", { class: "done-pill" }, "Done"));
    head.appendChild(el("span", { class: "chev", "aria-hidden": "true" }, open ? "–" : "+"));
    head.onclick = () => { openId = open ? null : i.id; confirmId = null; renderList(); };
    li.appendChild(head);

    if (open) {
      const d = el("div", { class: "entry-body", id: "d-" + i.id });
      const memo = el("p", { class: "memo" });
      if (i.note) linkify(i.note, memo);
      else { memo.classList.add("blank"); memo.textContent = "No memory line for this one."; }
      d.appendChild(memo);
      const foot = el("div", { class: "entry-foot" });
      const fmt = (d) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
      foot.appendChild(el("time", { datetime: i.created_at }, "Kept " + fmt(i.created_at) + (i.done_at ? " · Done " + fmt(i.done_at) : "")));
      const actions = el("div", { class: "row" });
      const tick = el("button", { type: "button", class: "tick" + (i.done_at ? " on" : ""), "aria-pressed": String(!!i.done_at) });
      tick.appendChild(el("span", { class: "box", "aria-hidden": "true" }));
      tick.appendChild(el("span", null, i.done_at ? "Done. Tap to bring it back" : "Mark as done"));
      tick.onclick = () => toggleDone(i.id, !i.done_at);
      actions.appendChild(tick);
      const del = el("button", { type: "button", class: "del" + (confirmId === i.id ? " confirm" : "") }, confirmId === i.id ? "Tap again to delete" : "Remove");
      del.onclick = () => {
        if (confirmId === i.id) return removeItem(i.id);
        confirmId = i.id; renderList();
        setTimeout(() => { if (confirmId === i.id) { confirmId = null; renderList(); } }, 4000);
      };
      actions.appendChild(del); foot.appendChild(actions); d.appendChild(foot); li.appendChild(d);
    }
    ul.appendChild(li);
  }
}

// Turns web addresses in a note into tappable links that open in a new tab.
const URL_RE = /\b(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+\.[^\s<>"']+)/gi;
function linkify(text, into) {
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    let raw = m[0];
    const trail = raw.match(/[.,;:!?)\]]+$/);   // leave sentence punctuation outside the link
    if (trail) raw = raw.slice(0, -trail[0].length);
    if (m.index > last) into.appendChild(document.createTextNode(text.slice(last, m.index)));
    let href = raw.startsWith("www.") ? "https://" + raw : raw;
    try { href = new URL(href).href; } catch { into.appendChild(document.createTextNode(raw)); last = m.index + raw.length; continue; }
    let label = raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
    if (label.length > 48) label = label.slice(0, 45) + "…";
    const a = el("a", { href, target: "_blank", rel: "noopener noreferrer" }, label);
    a.title = href;
    into.appendChild(a);
    last = m.index + raw.length;
  }
  if (last < text.length) into.appendChild(document.createTextNode(text.slice(last)));
}
function renderAll() { renderChips(); renderRecall(); renderList(); }

// ---------- data ----------
async function load() {
  const [it, ca, se] = await Promise.all([
    sb.from("items").select("id, cat, text, note, created_at, done_at").order("created_at"),
    sb.from("categories").select("id, label, recall, created_at").order("created_at"),
    sb.from("settings").select("reminders_on, remind_hour, remind_tz").maybeSingle(),
  ]);
  if (it.error || ca.error) { flash("toast", "Could not load your ledger. Check your connection and reopen the app."); return; }
  items = it.data; custom = ca.data;
  settings = se.data || null;
  if (settings && settings.remind_tz !== TZ) saveSettings({ remind_tz: TZ });
  renderAll(); renderReminders();
}

$("logForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("text").value.trim(); if (!text) return;
  const note = $("note").value.trim() || null;
  $("keepBtn").disabled = true;
  const { data, error } = await sb.from("items").insert({ cat: selCat, text, note }).select("id, cat, text, note, created_at, done_at").single();
  $("keepBtn").disabled = false;
  if (error) return flash("toast", "That did not save. Check your connection and try again.");
  items.push(data); $("text").value = ""; $("note").value = ""; $("text").focus();
  renderAll(); flash("toast", "Kept. It will come back to you.");
});
async function removeItem(id) {
  confirmId = null;
  const { error } = await sb.from("items").delete().eq("id", id);
  if (error) return flash("toast", "Could not remove that. Try again.");
  items = items.filter((i) => i.id !== id); renderAll();
}
async function toggleDone(id, done) {
  const done_at = done ? new Date().toISOString() : null;
  const { error } = await sb.from("items").update({ done_at }).eq("id", id);
  if (error) return flash("toast", "Could not update that. Try again.");
  const it = items.find((i) => i.id === id); if (it) it.done_at = done_at;
  renderAll();
  flash("toast", done ? "Marked as done. It won't come back in your reminders." : "Brought back. It can turn up in your reminders again.");
}
$("q").addEventListener("input", renderList);
$("orb").addEventListener("click", () => { smoke.pulse = 1; markSeen(); });

$("newCat").addEventListener("submit", async (e) => {
  e.preventDefault();
  const label = $("ncName").value.trim(); if (!label) return;
  if (allCats().some((c) => c.label.toLowerCase() === label.toLowerCase())) return flash("toast", `You already have ${label}.`);
  const { data, error } = await sb.from("categories").insert({ label, recall: $("ncRecall").value.trim() || null }).select().single();
  if (error) return flash("toast", "That category did not save. Try again.");
  custom.push(data); $("ncName").value = ""; $("ncRecall").value = ""; $("newCat").hidden = true;
  selCat = data.id; filt = data.id; renderAll(); $("text").focus();
});
$("ncCancel").onclick = () => ($("newCat").hidden = true);
$("delCat").onclick = async () => {
  const b = $("delCat"), id = filt;
  if (b.dataset.armed !== id) {
    b.dataset.armed = id; b.textContent = "Tap again to remove";
    setTimeout(() => { b.dataset.armed = ""; b.textContent = "Remove this category"; }, 4000);
    return;
  }
  b.dataset.armed = ""; b.textContent = "Remove this category";
  const { error } = await sb.from("categories").delete().eq("id", id);
  if (error) return flash("toast", "Could not remove it. Try again.");
  custom = custom.filter((c) => c.id !== id); filt = "all"; renderAll();
};

// ---------- reminders (web push) ----------
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const pushSupported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

for (let h = 0; h < 24; h++) {
  const label = new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  $("remindHour").appendChild(el("option", { value: String(h) }, label));
}

async function saveSettings(patch) {
  const next = { reminders_on: false, remind_hour: 8, remind_tz: TZ, ...(settings || {}), ...patch, user_id: user.id, updated_at: new Date().toISOString() };
  const { error } = await sb.from("settings").upsert(next);
  if (error) { flash("pushMsg", "Could not save your reminder setting. Try again."); return false; }
  settings = { reminders_on: next.reminders_on, remind_hour: next.remind_hour, remind_tz: next.remind_tz };
  return true;
}
async function deviceSubscription() {
  if (!pushSupported) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}
function b64ToBytes(s) {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
async function subscribeDevice() {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("denied");
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC) });
  const j = sub.toJSON();
  const { error } = await sb.from("push_subscriptions").upsert(
    { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_id: user.id }, { onConflict: "endpoint" });
  if (error) throw error;
}

async function renderReminders() {
  const on = !!settings?.reminders_on;
  $("remindHour").value = String(settings?.remind_hour ?? 8);
  $("tzLine").textContent = `Time zone: ${(settings?.remind_tz || TZ).replace(/_/g, " ")}`;
  const note = $("pushNote");
  let hasDevice = false;
  try { hasDevice = !!(await deviceSubscription()); } catch {}
  $("remindOn").checked = on && hasDevice;
  $("testPush").hidden = !(on && hasDevice);

  if (!pushSupported) {
    $("remindOn").disabled = true; note.hidden = false;
    note.textContent = isIOS && !isStandalone
      ? "On iPhone and iPad, reminders work once Remembrall is on your home screen. Tap Share, then Add to Home Screen, and open it from there."
      : "This browser cannot show reminders. Try Chrome, Edge, Firefox or Safari.";
  } else if (Notification.permission === "denied") {
    $("remindOn").disabled = true; note.hidden = false;
    note.textContent = "Notifications are blocked for Remembrall. Allow them in your browser or phone settings, then reopen the app.";
  } else {
    $("remindOn").disabled = false;
    note.hidden = !(on && !hasDevice);
    note.textContent = "Reminders are on for another device. Switch them on here to get them on this one too.";
  }
}

$("remindOn").addEventListener("change", async (e) => {
  const want = e.target.checked;
  e.target.disabled = true;
  try {
    if (want) {
      await subscribeDevice();
      if (await saveSettings({ reminders_on: true, remind_tz: TZ })) flash("pushMsg", "Reminders on. You'll hear from the orb every day.");
    } else {
      const sub = await deviceSubscription();
      if (sub) { await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint); await sub.unsubscribe(); }
      const { count } = await sb.from("push_subscriptions").select("id", { count: "exact", head: true });
      if (!count) await saveSettings({ reminders_on: false });
      flash("pushMsg", "Reminders off on this device.");
    }
  } catch (err) {
    flash("pushMsg", err?.message === "denied"
      ? "Notifications were not allowed. You can allow them in your browser settings."
      : "Could not turn on reminders on this device. Try again.");
  }
  await renderReminders();
});
$("remindHour").addEventListener("change", async (e) => {
  if (await saveSettings({ remind_hour: +e.target.value, remind_tz: TZ })) flash("pushMsg", "Reminder time saved.");
});
$("testPush").addEventListener("click", async () => {
  $("testPush").disabled = true;
  const { data: s } = await sb.auth.getSession();
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/daily-recall`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session.access_token}`, apikey: SUPABASE_KEY },
      body: JSON.stringify({ test: true }),
    });
    const j = await r.json();
    const sent = (j.results || []).reduce((n, x) => n + (x.sent || 0), 0);
    flash("pushMsg", sent ? "Sent. It should arrive in a few seconds." : "The test did not reach this device. Switch reminders off and on, then try again.");
  } catch { flash("pushMsg", "Could not send the test. Check your connection."); }
  $("testPush").disabled = false;
});

// ---------- install ----------
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); deferredPrompt = e;
  $("installPanel").hidden = false; $("installBtn").hidden = false;
  $("installText").textContent = "Install Remembrall so it opens like an app, with its own icon.";
});
$("installBtn").addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null;
  $("installPanel").hidden = true;
});
window.addEventListener("appinstalled", () => ($("installPanel").hidden = true));
if (isIOS && !isStandalone) {
  $("installPanel").hidden = false;
  $("installText").textContent = "In Safari, tap the Share button, then Add to Home Screen. Open Remembrall from your home screen to get daily reminders.";
}

// ---------- auth ----------
const SITE = location.origin + location.pathname;
let authMode = "signin", recovering = false;
function setAuthMode(m) {
  authMode = m;
  document.querySelectorAll("#authTabs .chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
  $("authBtn").textContent = m === "signin" ? "Sign in" : "Create account";
  $("password").autocomplete = m === "signin" ? "current-password" : "new-password";
  $("forgotBtn").hidden = m !== "signin";
  $("authMsg").textContent = "";
}
document.querySelectorAll("#authTabs .chip").forEach((b) => (b.onclick = () => setAuthMode(b.dataset.mode)));

$("authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("email").value.trim(), password = $("password").value;
  $("authBtn").disabled = true;
  if (authMode === "signin") {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) flash("authMsg", /confirm/i.test(error.message)
      ? "Confirm your email first. Open the link we sent you, then sign in here."
      : "That email and password don't match. Try again, or reset your password.");
  } else {
    const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: SITE } });
    if (error) {
      flash("authMsg", /rate|too many|seconds/i.test(error.message)
        ? "Too many sign-up emails just now. Wait a few minutes, then try again."
        : /registered|exists/i.test(error.message) ? "That email already has an account. Sign in instead."
        : /password/i.test(error.message) ? "Use a password of at least 6 characters." : "Could not create the account. Try again.");
    } else if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      // Supabase answers "success" without sending anything when the email is already registered.
      setAuthMode("signin");
      $("authMsg").textContent = `${email} already has an account. Sign in, or tap Forgot password to set a new password.`;
    } else if (!data.session) {
      setAuthMode("signin");
      $("authMsg").textContent = `Almost there. We emailed ${email} a link to confirm your account. Open it, then sign in here.`;
    }
  }
  $("authBtn").disabled = false;
});
$("forgotBtn").onclick = async () => {
  const email = $("email").value.trim();
  if (!email) { $("email").focus(); return flash("authMsg", "Enter your email above, then tap Forgot password again."); }
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: SITE });
  $("authMsg").textContent = error ? "Could not send the reset email. Wait a few minutes and try again."
    : `If ${email} has an account, a reset link is on its way. Open it on this device.`;
};
$("resetForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const { error } = await sb.auth.updateUser({ password: $("newPassword").value });
  if (error) return flash("authMsg", "Could not save that password. Use at least 6 characters.");
  recovering = false; $("resetForm").hidden = true; $("authForm").hidden = false; $("authTabs").hidden = false;
  show("app"); load();
});
$("signOut").onclick = async () => { await sb.auth.signOut(); };

function show(view) {
  $("loading").hidden = true;
  $("authView").hidden = view !== "auth";
  $("appView").hidden = view !== "app";
  $("account").hidden = view !== "app";
}
let lastUserId = null;
sb.auth.onAuthStateChange((evt, session) => {
  user = session?.user || null;
  if (evt === "PASSWORD_RECOVERY") recovering = true;
  if (recovering && user) {
    show("auth"); $("authForm").hidden = true; $("authTabs").hidden = true; $("resetForm").hidden = false;
    return;
  }
  if (!user) { lastUserId = null; items = []; custom = []; settings = null; smoke.target = 1; show("auth"); return; }
  $("who").textContent = user.email || "";
  show("app");
  if (user.id !== lastUserId) { lastUserId = user.id; setTimeout(load, 0); }
});
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && user) load(); });

// ---------- smoke ----------
const smoke = { target: 1, mix: 1, pulse: 0 };
function animateSmoke(cv) {
  const cx = cv.getContext("2d"), W = cv.width, R = W / 2;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const puffs = Array.from({ length: 46 }, () => ({
    a: Math.random() * Math.PI * 2, r: Math.random() * R * 0.6, s: (0.15 + Math.random() * 0.35) * (Math.random() < 0.5 ? -1 : 1),
    size: R * (0.25 + Math.random() * 0.35), ph: Math.random() * 10, al: 0.05 + Math.random() * 0.07,
  }));
  function frame(t) {
    smoke.mix += (smoke.target - smoke.mix) * 0.03; smoke.pulse *= 0.96;
    const m = smoke.mix, tt = t / 1000;
    cx.clearRect(0, 0, W, W);
    const g = cx.createRadialGradient(R * 0.8, R * 0.7, R * 0.1, R, R, R);
    g.addColorStop(0, "rgba(60,55,80,.55)"); g.addColorStop(1, "rgba(12,10,20,.95)");
    cx.fillStyle = g; cx.beginPath(); cx.arc(R, R, R, 0, Math.PI * 2); cx.fill();
    cx.save(); cx.beginPath(); cx.arc(R, R, R * 0.98, 0, Math.PI * 2); cx.clip();
    cx.globalCompositeOperation = "lighter";
    const rr = Math.round(225 - 15 * m), gg = Math.round(225 - 185 * m), bb = Math.round(235 - 183 * m);
    for (const p of puffs) {
      const a = p.a + (reduce ? 0 : tt * p.s * 0.25);
      const rad = p.r + Math.sin(tt * 0.4 + p.ph) * R * 0.08;
      const x = R + Math.cos(a) * rad, y = R + Math.sin(a) * rad * 0.85 + Math.sin(tt * 0.3 + p.ph) * R * 0.05;
      const sz = p.size * (1 + smoke.pulse * 0.4), al = p.al * (1 + m * 0.6 + smoke.pulse);
      const pg = cx.createRadialGradient(x, y, 0, x, y, sz);
      pg.addColorStop(0, `rgba(${rr},${gg},${bb},${al})`); pg.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);
      cx.fillStyle = pg; cx.fillRect(x - sz, y - sz, sz * 2, sz * 2);
    }
    cx.restore();
    if (!reduce || Math.abs(smoke.target - smoke.mix) > 0.01 || smoke.pulse > 0.01) requestAnimationFrame(frame);
    else setTimeout(() => requestAnimationFrame(frame), 500);
  }
  requestAnimationFrame(frame);
}
document.querySelectorAll("canvas.smoke").forEach(animateSmoke);

// ---------- service worker ----------
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
