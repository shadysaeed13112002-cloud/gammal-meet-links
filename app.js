/* Gammal Meet Links: creates a 1-hour Google Calendar event with a Meet link
   on the signed-in user's calendar and prepares a copy-ready message. */
(function () {
  "use strict";

  const CFG = Object.assign(
    { TIME_ZONE: "Africa/Cairo", DURATION_MINUTES: 60, DEFAULT_WEEKS: 8 },
    (typeof window !== "undefined" && window.APP_CONFIG) || {}
  );
  const SCOPES = "https://www.googleapis.com/auth/calendar.events openid email";
  const API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

  // Arabic week order starting Saturday. js = Date#getUTCDay(), rr = RRULE code.
  const DAYS = [
    { js: 6, rr: "SA", ar: "السبت" },
    { js: 0, rr: "SU", ar: "الأحد" },
    { js: 1, rr: "MO", ar: "الاثنين" },
    { js: 2, rr: "TU", ar: "الثلاثاء" },
    { js: 3, rr: "WE", ar: "الأربعاء" },
    { js: 4, rr: "TH", ar: "الخميس" },
    { js: 5, rr: "FR", ar: "الجمعة" },
  ];

  // ---------- pure helpers (also used by tests) ----------

  function to24h(hour12, minute, ampm) {
    let h = Number(hour12) % 12;
    if (ampm === "PM") h += 12;
    return { h, m: Number(minute) };
  }

  function pad(n) { return String(n).padStart(2, "0"); }

  // Local "wall clock" date-time string; the timeZone field tells Google how to read it.
  function localDateTime(dateStr, h, m, addMinutes) {
    const [y, mo, d] = dateStr.split("-").map(Number);
    const t = new Date(Date.UTC(y, mo - 1, d, h, m) + (addMinutes || 0) * 60000);
    return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}` +
      `T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:00`;
  }

  function weekdayOf(dateStr) {
    const [y, mo, d] = dateStr.split("-").map(Number);
    return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  }

  function addDays(dateStr, n) {
    const [y, mo, d] = dateStr.split("-").map(Number);
    const t = new Date(Date.UTC(y, mo - 1, d + n));
    return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
  }

  // slots: [{js, rr, h, m}] -> one weekly series per distinct time.
  function buildWeeklySeries(startDate, slots, weeks) {
    const groups = new Map();
    for (const s of slots) {
      const key = `${s.h}:${s.m}`;
      if (!groups.has(key)) groups.set(key, { h: s.h, m: s.m, days: [] });
      groups.get(key).days.push(s);
    }
    const series = [];
    for (const g of groups.values()) {
      const jsDays = new Set(g.days.map((d) => d.js));
      let first = startDate;
      for (let i = 0; i < 7 && !jsDays.has(weekdayOf(first)); i++) first = addDays(first, 1);
      const byday = DAYS.filter((d) => jsDays.has(d.js)).map((d) => d.rr).join(",");
      series.push({
        start: localDateTime(first, g.h, g.m),
        end: localDateTime(first, g.h, g.m, CFG.DURATION_MINUTES),
        recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${byday};COUNT=${weeks * g.days.length}`],
      });
    }
    series.sort((a, b) => (a.start < b.start ? -1 : 1));
    return series;
  }

  const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

  function dayName(dateStr) { return DAYS.find((d) => d.js === weekdayOf(dateStr)).ar; }

  // "2026-11-22" -> "الأحد 22 نوفمبر 2026"
  function fmtDate(dateStr) {
    const [y, mo, d] = dateStr.split("-").map(Number);
    return `${dayName(dateStr)} ${d} ${MONTHS_AR[mo - 1]} ${y}`;
  }

  // 19, 0 -> "7:00 م" (Arabic AM/PM marks avoid bidi reordering in WhatsApp)
  function fmtTime(h, m) {
    const total = ((h * 60 + m) % 1440 + 1440) % 1440;
    const hh = Math.floor(total / 60), mm = total % 60;
    return `${hh % 12 || 12}:${pad(mm)} ${hh < 12 ? "ص" : "م"}`;
  }

  function fmtRange(h, m) {
    return `من ${fmtTime(h, m)} لـ ${fmtTime(h, m + CFG.DURATION_MINUTES)}`;
  }

  // info: {type:"once", date, h, m} or {type:"weekly", startDate, weeks, slots:[{js, ar, h, m}]}
  function sessionDetails(info) {
    if (info.type === "once") {
      return [`📅 ${fmtDate(info.date)}`, `⏰ ${fmtRange(info.h, info.m)} (بتوقيت القاهرة)`];
    }
    const start = weekdayOf(info.startDate);
    const ordered = info.slots.slice().sort((a, b) => ((a.js - start + 7) % 7) - ((b.js - start + 7) % 7));
    const firstOf = (s) => addDays(info.startDate, (s.js - start + 7) % 7);
    const firstDate = firstOf(ordered[0]);
    const lastDate = ordered.map((s) => addDays(firstOf(s), 7 * (info.weeks - 1))).sort().pop();
    const lines = [`🔁 كل أسبوع لمدة ${info.weeks} ${info.weeks === 1 ? "أسبوع" : info.weeks <= 10 ? "أسابيع" : "أسبوع"}`];
    for (const s of ordered) lines.push(`📅 ${s.ar} ${fmtRange(s.h, s.m)}`);
    lines.push(`🗓️ من ${fmtDate(firstDate)} لحد ${fmtDate(lastDate)}`);
    lines.push("⏰ المواعيد بتوقيت القاهرة");
    return lines;
  }

  function buildMessage(name, link, details) {
    return [`*${name}*`, ...(details || []), `🔗 ${link}`].join("\n");
  }

  // Returns digits in international format (Egypt +20 by default), or "" if invalid.
  function normalizePhone(raw) {
    let s = String(raw || "").trim().replace(/[\s\-().]/g, "");
    if (s.startsWith("+")) s = s.slice(1);
    else if (s.startsWith("00")) s = s.slice(2);
    else if (s.startsWith("0")) s = "20" + s.slice(1);
    else if (/^1\d{9}$/.test(s)) s = "20" + s;
    return /^\d{8,15}$/.test(s) ? s : "";
  }

  function waLink(phone, text) {
    return `https://wa.me/${phone || ""}?text=${encodeURIComponent(text)}`;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { to24h, localDateTime, weekdayOf, addDays, buildWeeklySeries, buildMessage, sessionDetails, fmtDate, fmtTime, normalizePhone, waLink, DAYS };
    return;
  }

  // ---------- auth ----------

  const $ = (id) => document.getElementById(id);
  let tokenClient = null;
  let auth = loadJSON(sessionStorage, "auth");
  let pendingToken = null;

  function loadJSON(store, key) {
    try { return JSON.parse(store.getItem(key)) || null; } catch (_) { return null; }
  }
  function saveJSON(store, key, val) {
    try { store.setItem(key, JSON.stringify(val)); } catch (_) { /* ignore */ }
  }

  function tokenValid() { return auth && auth.token && Date.now() < auth.expiresAt - 60000; }

  function initAuth() {
    if (!window.google || !google.accounts || !google.accounts.oauth2) {
      setTimeout(initAuth, 200);
      return;
    }
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CFG.CLIENT_ID,
      scope: SCOPES,
      callback: onToken,
      error_callback: (err) => {
        if (pendingToken) { pendingToken.reject(new Error(err.message || err.type)); pendingToken = null; }
      },
    });
    render();
  }

  async function onToken(resp) {
    if (resp.error) {
      if (pendingToken) { pendingToken.reject(new Error(resp.error)); pendingToken = null; }
      return;
    }
    const email = (auth && auth.email) || (await fetchEmail(resp.access_token));
    auth = { token: resp.access_token, expiresAt: Date.now() + Number(resp.expires_in) * 1000, email };
    saveJSON(sessionStorage, "auth", auth);
    saveJSON(localStorage, "lastEmail", email);
    if (pendingToken) { pendingToken.resolve(auth.token); pendingToken = null; }
    render();
  }

  async function fetchEmail(token) {
    try {
      const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return (await r.json()).email || "";
    } catch (_) { return ""; }
  }

  // Must be called synchronously inside a click/submit so the popup is allowed.
  function ensureToken() {
    if (tokenValid()) return Promise.resolve(auth.token);
    if (!tokenClient) return Promise.reject(new Error("صفحة جوجل لسه بتحمّل. جرّب تاني بعد ثانية."));
    return new Promise((resolve, reject) => {
      pendingToken = { resolve, reject };
      const hint = (auth && auth.email) || loadJSON(localStorage, "lastEmail") || undefined;
      tokenClient.requestAccessToken({ prompt: "", hint });
    });
  }

  function signOut() {
    if (auth && auth.token) google.accounts.oauth2.revoke(auth.token, () => {});
    auth = null;
    try { sessionStorage.removeItem("auth"); localStorage.removeItem("lastEmail"); } catch (_) {}
    render();
  }

  // ---------- calendar API ----------

  async function api(method, url, token, body) {
    const r = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) {
      auth = null;
      try { sessionStorage.removeItem("auth"); } catch (_) {}
      throw new Error("انتهت صلاحية الدخول. اضغط الزرار تاني.");
    }
    if (!r.ok) throw new Error((data.error && data.error.message) || `HTTP ${r.status}`);
    return data;
  }

  function meetLink(ev) {
    if (ev.hangoutLink) return ev.hangoutLink;
    const ep = ev.conferenceData && (ev.conferenceData.entryPoints || []).find((e) => e.entryPointType === "video");
    return ep ? ep.uri : "";
  }

  async function insertEvent(token, name, s, conference) {
    const body = {
      summary: name,
      start: { dateTime: s.start, timeZone: CFG.TIME_ZONE },
      end: { dateTime: s.end, timeZone: CFG.TIME_ZONE },
      conferenceData: conference || {
        createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } },
      },
    };
    if (s.recurrence) body.recurrence = s.recurrence;
    let ev = await api("POST", `${API}?conferenceDataVersion=1`, token, body);
    // Meet creation is usually instant but can be "pending" for a moment.
    for (let i = 0; i < 6 && !meetLink(ev); i++) {
      await new Promise((r) => setTimeout(r, 1000));
      ev = await api("GET", `${API}/${encodeURIComponent(ev.id)}`, token);
    }
    if (!meetLink(ev)) throw new Error("الإيفنت اتعمل بس لينك الـ Meet لسه ماظهرش. افتحه من الكالندر.");
    return ev;
  }

  // ---------- UI ----------

  function timePicker(container, prefix, defaults) {
    const d = defaults || { h: "7", m: "00", ap: "PM" };
    const hours = Array.from({ length: 12 }, (_, i) => String(i + 1));
    const mins = Array.from({ length: 12 }, (_, i) => pad(i * 5));
    container.innerHTML =
      `<select data-part="h" aria-label="ساعة">${hours.map((h) => `<option${h === d.h ? " selected" : ""}>${h}</option>`).join("")}</select>` +
      `<select data-part="m" aria-label="دقيقة">${mins.map((m) => `<option${m === d.m ? " selected" : ""}>${m}</option>`).join("")}</select>` +
      `<select data-part="ap" aria-label="AM/PM"><option${d.ap === "AM" ? " selected" : ""}>AM</option><option${d.ap === "PM" ? " selected" : ""}>PM</option></select>`;
    container.dataset.prefix = prefix;
  }

  function readTime(container) {
    const get = (p) => container.querySelector(`[data-part="${p}"]`).value;
    return to24h(get("h"), get("m"), get("ap"));
  }

  function buildDays() {
    const wrap = $("days");
    wrap.innerHTML = "";
    for (const d of DAYS) {
      const row = document.createElement("div");
      row.className = "day off";
      row.innerHTML = `<label><input type="checkbox" value="${d.js}"> ${d.ar}</label><div class="time"></div>`;
      timePicker(row.querySelector(".time"), `d${d.js}`);
      row.querySelector("input").addEventListener("change", (e) => row.classList.toggle("off", !e.target.checked));
      wrap.appendChild(row);
    }
  }

  function today() {
    const t = new Date();
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
  }

  function render() {
    const configured = CFG.CLIENT_ID && !CFG.CLIENT_ID.startsWith("PASTE_");
    $("configWarning").hidden = configured;
    const signedIn = !!(auth && auth.email !== undefined && auth.token);
    $("signInCard").hidden = !configured || signedIn || !tokenClient;
    $("formCard").hidden = !configured || !signedIn;
    $("contactsCard").hidden = !configured;
    $("account").hidden = !signedIn;
    $("accountEmail").textContent = signedIn ? auth.email : "";
    renderHistory();
  }

  function showError(msg) {
    $("formError").textContent = msg;
    $("formError").hidden = !msg;
  }

  async function copyText(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove();
    }
    const old = btn.textContent;
    btn.textContent = "اتنسخ ✓";
    setTimeout(() => { btn.textContent = old; }, 1500);
  }

  function addHistory(item) {
    const list = loadJSON(localStorage, "history") || [];
    list.unshift(item);
    saveJSON(localStorage, "history", list.slice(0, 20));
  }

  function renderHistory() {
    const list = loadJSON(localStorage, "history") || [];
    $("historyCard").hidden = list.length === 0;
    const ul = $("history");
    ul.innerHTML = "";
    for (const item of list) {
      const li = document.createElement("li");
      const span = document.createElement("span");
      span.className = "h-name"; span.dir = "auto";
      span.textContent = `${item.name} · ${item.when}`;
      const btn = document.createElement("button");
      btn.className = "link-btn"; btn.type = "button"; btn.textContent = "نسخ";
      btn.addEventListener("click", () => copyText(item.message || buildMessage(item.name, item.link), btn));
      const wa = document.createElement("button");
      wa.className = "link-btn"; wa.type = "button"; wa.textContent = "واتساب";
      wa.addEventListener("click", () => sendWhatsApp(item.message || buildMessage(item.name, item.link)));
      const acts = document.createElement("span");
      acts.className = "h-actions";
      acts.append(btn, wa);
      li.append(span, acts);
      ul.appendChild(li);
    }
  }

  // ---------- WhatsApp contacts (stored only on this device) ----------

  let editingId = null;

  function getContacts() { return loadJSON(localStorage, "waContacts") || []; }
  function setContacts(list) { saveJSON(localStorage, "waContacts", list); renderContacts(); }

  function renderContacts() {
    const list = getContacts();
    const ul = $("contacts");
    ul.innerHTML = "";
    for (const c of list) {
      const li = document.createElement("li");
      const info = document.createElement("span");
      info.className = "c-info";
      const nm = document.createElement("span"); nm.dir = "auto"; nm.textContent = c.name;
      const ph = document.createElement("span"); ph.className = "h-phone"; ph.textContent = "+" + c.phone;
      info.append(nm, ph);
      const acts = document.createElement("span");
      acts.className = "h-actions";
      const ed = document.createElement("button");
      ed.className = "link-btn"; ed.type = "button"; ed.textContent = "تعديل";
      ed.addEventListener("click", () => startEdit(c));
      const del = document.createElement("button");
      del.className = "link-btn"; del.type = "button"; del.textContent = "مسح";
      del.addEventListener("click", () => {
        if (confirm(`تمسح ${c.name}؟`)) setContacts(getContacts().filter((x) => x.id !== c.id));
      });
      acts.append(ed, del);
      li.append(info, acts);
      ul.appendChild(li);
    }
    // contact picker on the result card
    const sel = $("waContact");
    const last = loadJSON(localStorage, "waLast");
    sel.innerHTML = "";
    for (const c of list) {
      const o = document.createElement("option");
      o.value = c.id; o.textContent = c.name;
      sel.appendChild(o);
    }
    const any = document.createElement("option");
    any.value = ""; any.textContent = "أختار من واتساب نفسه";
    sel.appendChild(any);
    if (last !== null && [...sel.options].some((o) => o.value === last)) sel.value = last;
  }

  function startEdit(c) {
    editingId = c.id;
    $("contactName").value = c.name;
    $("contactPhone").value = "+" + c.phone;
    $("contactSave").textContent = "احفظ التعديل";
    $("contactCancel").hidden = false;
    $("contactName").focus();
  }

  function resetContactForm() {
    editingId = null;
    $("contactForm").reset();
    $("contactSave").textContent = "ضيف الرقم";
    $("contactCancel").hidden = true;
    $("contactError").hidden = true;
  }

  function onContactSubmit(e) {
    e.preventDefault();
    const name = $("contactName").value.trim();
    const phone = normalizePhone($("contactPhone").value);
    const err = !name ? "اكتب الاسم." : !phone ? "الرقم مش مظبوط. اكتبه زي 01012345678 أو +201012345678" : "";
    $("contactError").textContent = err;
    $("contactError").hidden = !err;
    if (err) return;
    const list = getContacts();
    if (editingId) {
      const c = list.find((x) => x.id === editingId);
      if (c) { c.name = name; c.phone = phone; }
    } else {
      const id = String(Date.now());
      list.push({ id, name, phone });
      saveJSON(localStorage, "waLast", id);
    }
    resetContactForm();
    setContacts(list);
  }

  function sendWhatsApp(text) {
    const id = $("waContact").value;
    saveJSON(localStorage, "waLast", id);
    const c = getContacts().find((x) => x.id === id);
    window.open(waLink(c ? c.phone : "", text), "_blank", "noopener");
  }

  function collectForm() {
    const name = $("name").value.trim();
    if (!name) throw new Error("اكتب اسم السيشن.");
    const type = document.querySelector('input[name="type"]:checked').value;
    if (type === "once") {
      const date = $("date").value;
      if (!date) throw new Error("اختار التاريخ.");
      const { h, m } = readTime($("onceTime"));
      return {
        name,
        series: [{ start: localDateTime(date, h, m), end: localDateTime(date, h, m, CFG.DURATION_MINUTES) }],
        details: sessionDetails({ type: "once", date, h, m }),
        when: fmtDate(date),
      };
    }
    const startDate = $("startDate").value;
    if (!startDate) throw new Error("اختار تاريخ البداية.");
    const weeks = parseInt($("weeks").value, 10);
    if (!(weeks >= 1 && weeks <= 52)) throw new Error("عدد الأسابيع لازم يكون من 1 لـ 52.");
    const slots = [];
    for (const row of $("days").children) {
      const cb = row.querySelector("input");
      if (!cb.checked) continue;
      const d = DAYS.find((x) => x.js === Number(cb.value));
      slots.push(Object.assign({}, d, readTime(row.querySelector(".time"))));
    }
    if (!slots.length) throw new Error("اختار يوم واحد على الأقل.");
    return {
      name,
      series: buildWeeklySeries(startDate, slots, weeks),
      details: sessionDetails({ type: "weekly", startDate, weeks, slots }),
      when: `أسبوعي · ${slots.map((s) => s.ar).join("، ")}`,
    };
  }

  async function onSubmit(e) {
    e.preventDefault();
    showError("");
    let form;
    try { form = collectForm(); } catch (err) { showError(err.message); return; }
    const tokenPromise = ensureToken(); // synchronous call keeps the popup allowed
    const btn = $("createBtn");
    btn.disabled = true; btn.textContent = "بيتعمل...";
    try {
      const token = await tokenPromise;
      const first = await insertEvent(token, form.name, form.series[0]);
      const cd = first.conferenceData;
      const shared = { conferenceId: cd.conferenceId, conferenceSolution: cd.conferenceSolution, entryPoints: cd.entryPoints };
      for (const s of form.series.slice(1)) await insertEvent(token, form.name, s, shared);
      const link = meetLink(first);
      const message = buildMessage(form.name, link, form.details);
      $("message").textContent = message;
      $("calendarLink").href = first.htmlLink;
      $("resultNote").textContent = form.series.length > 1
        ? `اتعمل ${form.series.length} مواعيد أسبوعية بنفس اللينك.`
        : (form.series[0].recurrence ? "اتعملت سلسلة أسبوعية بلينك ثابت." : "");
      $("resultCard").hidden = false;
      addHistory({ name: form.name, link, when: form.when, message });
      renderHistory();
      $("resultCard").scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      showError(err.message || String(err));
    } finally {
      btn.disabled = false; btn.textContent = "اعمل السيشن";
      render();
    }
  }

  function boot() {
    timePicker($("onceTime"), "once");
    buildDays();
    $("date").value = today();
    $("startDate").value = today();
    $("weeks").value = CFG.DEFAULT_WEEKS;
    for (const r of document.querySelectorAll('input[name="type"]')) {
      r.addEventListener("change", () => {
        const weekly = document.querySelector('input[name="type"]:checked').value === "weekly";
        $("onceFields").hidden = weekly;
        $("weeklyFields").hidden = !weekly;
      });
    }
    $("signInBtn").addEventListener("click", () => ensureToken().catch((err) => alert(err.message)));
    $("signOutBtn").addEventListener("click", signOut);
    $("sessionForm").addEventListener("submit", onSubmit);
    $("copyBtn").addEventListener("click", (e) => copyText($("message").textContent, e.target));
    $("waSendBtn").addEventListener("click", () => sendWhatsApp($("message").textContent));
    $("contactForm").addEventListener("submit", onContactSubmit);
    $("contactCancel").addEventListener("click", resetContactForm);
    renderContacts();
    render();
    if (location.protocol === "file:") {
      $("configWarning").hidden = false;
      $("configWarning").textContent = "الصفحة لازم تتفتح من ملف start مش دبل كليك على index.html.";
    }
    initAuth();
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
