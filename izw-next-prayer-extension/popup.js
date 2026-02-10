const API = (typeof browser !== "undefined") ? browser : chrome;

let lastState = null;
let tickTimer = null;
let hijriMonth = null;

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setChip(textOrNull) {
  const chip = document.getElementById("next-special");
  if (!chip) return;
  if (!textOrNull) {
    chip.style.display = "none";
    chip.textContent = "";
  } else {
    chip.style.display = "inline-flex";
    chip.textContent = textOrNull;
  }
}

function pad(n) { return String(n).padStart(2, "0"); }

function formatHMS(totalSeconds) {
  if (totalSeconds < 0) totalSeconds = 0;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

function parseHHMM(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return { h, m };
}

function dateAtLocal(dayOffset, h, m) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d;
}

function clearHighlights() {
  for (const k of ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"]) {
    document.getElementById(`row-${k}`)?.classList.remove("next-row");
  }
}

function highlightNext(nextKey) {
  clearHighlights();
  if (!nextKey) return;
  document.getElementById(`row-${nextKey}`)?.classList.add("next-row");
}

function clearRamadanStyles() {
  document.body.classList.remove("ramadan");
  document.getElementById("row-fajr")?.classList.remove("suhoor");
  document.getElementById("row-maghrib")?.classList.remove("iftar");

  const tf = document.getElementById("tag-fajr");
  const tm = document.getElementById("tag-maghrib");
  if (tf) tf.style.display = "none";
  if (tm) tm.style.display = "none";
}

function applyRamadanStyles() {
  document.body.classList.add("ramadan");
  document.getElementById("row-fajr")?.classList.add("suhoor");
  document.getElementById("row-maghrib")?.classList.add("iftar");

  const tf = document.getElementById("tag-fajr");
  const tm = document.getElementById("tag-maghrib");
  if (tf) tf.style.display = "inline-flex";
  if (tm) tm.style.display = "inline-flex";
}

function clearHijriAccent() {
  document.body.classList.remove("hijri-accent");
  document.body.style.removeProperty("--accent-1");
  document.body.style.removeProperty("--accent-2");
}

function applyHijriAccent(month) {
  // Subtle, tasteful palette (Ramadan handled separately)
  const HIJRI_ACCENTS = {
    1: ["rgba(59,130,246,0.20)", "rgba(59,130,246,0.10)"],    // Muharram
    2: ["rgba(100,116,139,0.18)", "rgba(100,116,139,0.08)"],  // Safar
    3: ["rgba(34,197,94,0.18)", "rgba(34,197,94,0.08)"],      // Rabi I
    4: ["rgba(34,197,94,0.12)", "rgba(34,197,94,0.06)"],      // Rabi II
    5: ["rgba(148,163,184,0.14)", "rgba(148,163,184,0.07)"],  // Jumada I
    6: ["rgba(148,163,184,0.10)", "rgba(148,163,184,0.05)"],  // Jumada II
    7: ["rgba(168,85,247,0.18)", "rgba(168,85,247,0.08)"],    // Rajab
    8: ["rgba(20,184,166,0.18)", "rgba(20,184,166,0.08)"],    // Sha'ban
    10:["rgba(34,197,94,0.20)", "rgba(34,197,94,0.10)"],      // Shawwal
    11:["rgba(245,158,11,0.14)", "rgba(245,158,11,0.07)"],    // Dhu al-Qa'dah
    12:["rgba(245,158,11,0.20)", "rgba(245,158,11,0.10)"],    // Dhu al-Hijjah
  };

  const accents = HIJRI_ACCENTS[month];
  if (!accents) return;

  document.body.style.setProperty("--accent-1", accents[0]);
  document.body.style.setProperty("--accent-2", accents[1]);
  document.body.classList.add("hijri-accent");
}

async function getState() {
  return await API.runtime.sendMessage({ type: "GET_STATE" });
}

async function forceRefresh() {
  return await API.runtime.sendMessage({ type: "FORCE_REFRESH" });
}

function fillTimes(timesToday) {
  const keys = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
  for (const k of keys) setText(k, timesToday?.[k] ?? "–");
}

/** Hijri (civil) conversion (approx) */
function gregorianToJDN(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;
  return d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
}
function islamicToJDN(year, month, day) {
  const islamicEpoch = 1948439;
  return day + Math.ceil(29.5 * (month - 1)) + (year - 1) * 354 + Math.floor((3 + 11 * year) / 30) + islamicEpoch;
}
function islamicFromJDN(jdn) {
  const islamicEpoch = 1948439;
  const days = jdn - islamicEpoch;
  const year = Math.floor((30 * days + 10646) / 10631);
  const yearStart = islamicToJDN(year, 1, 1);

  let month = Math.ceil((jdn - 29 - yearStart) / 29.5) + 1;
  if (month < 1) month = 1;
  if (month > 12) month = 12;

  const monthStart = islamicToJDN(year, month, 1);
  const day = jdn - monthStart + 1;
  return { year, month, day };
}
const HIJRI_MONTHS = [
  "Muharram", "Safar", "Rabiʿ al-Awwal", "Rabiʿ al-Thani",
  "Jumada al-Ula", "Jumada al-Akhirah", "Rajab", "Shaʿban",
  "Ramadan", "Shawwal", "Dhu al-Qaʿdah", "Dhu al-Hijjah"
];
function formatHijriForToday() {
  const now = new Date();
  const jdn = gregorianToJDN(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const h = islamicFromJDN(jdn);
  return { text: `${h.day} ${HIJRI_MONTHS[h.month - 1]} ${h.year} AH`, month: h.month };
}

function formatGregorianPill() {
  const now = new Date();
  const opts = { weekday: "short", year: "numeric", month: "short", day: "2-digit" };
  return now.toLocaleDateString(undefined, opts);
}

// Optional: special chip (Iftar/Suhoor) if your background.js includes timesTomorrow.
// If not available, chip may remain hidden when needed (safe).
function computeSpecialChipText(state) {
  const isRamadan = hijriMonth === 9;
  if (!state?.timesToday) return null;

  const next = state?.next;
  if (!next?.whenTs) return null;

  const secs = Math.ceil((next.whenTs - Date.now()) / 1000);
  const remaining = secs <= 0 ? "Now" : formatHMS(secs);

  // Keep it simple: show only when next is Fajr,
  // or show Iftar when next is Maghrib during Ramadan.
  if (next.key === "fajr") return isRamadan ? `Suhoor ends in ${remaining}` : `Fajr in ${remaining}`;
  if (isRamadan && next.key === "maghrib") return `Iftar in ${remaining}`;
  return null;
}

function updateCountdownTick() {
  const next = lastState?.next;

  if (!next?.whenTs) {
    setText("countdown", "");
    setChip(null);
    return;
  }

  const secsLeft = Math.ceil((next.whenTs - Date.now()) / 1000);
  setText("countdown", secsLeft <= 0 ? "Now" : `In ${formatHMS(secsLeft)}`);

  setChip(computeSpecialChipText(lastState));
}

async function render() {
  const state = await getState();
  lastState = state;

  // Dates
  setText("greg-date", formatGregorianPill());
  const hijri = formatHijriForToday();
  hijriMonth = hijri.month;
  setText("hijri-date", `Hijri: ${hijri.text}`);

  // Apply themes:
  // - Ramadan gets special treatment
  // - Other months get subtle ambient accent
  clearRamadanStyles();
  clearHijriAccent();

  if (hijriMonth === 9) {
    applyRamadanStyles();
  } else {
    applyHijriAccent(hijriMonth);
  }

  if (!state || state.error) {
    setText("next", state?.error || "Failed to load timings");
    setText("countdown", "");
    setChip(null);
    highlightNext(null);
    fillTimes(null);
    return;
  }

  fillTimes(state.timesToday);

  const next = state.next;
  setText("next", next ? `Next: ${next.name} at ${next.at}` : "No next prayer found");
  highlightNext(next?.key);

  if (tickTimer) clearInterval(tickTimer);
  updateCountdownTick();
  tickTimer = setInterval(updateCountdownTick, 1000);
}

document.getElementById("refresh")?.addEventListener("click", async () => {
  await forceRefresh();
  await render();
});

render();

