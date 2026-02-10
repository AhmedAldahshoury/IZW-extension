const API = (typeof browser !== "undefined") ? browser : chrome;

let lastState = null;
let tickTimer = null;
let hijriMonth = null;
let settings = null;
let currentLang = "en";

const DEFAULT_SETTINGS = {
  notificationsEnabled: true,
  notifyMinutesBefore: 15,
  badgeEnabled: true,
  hijriCorrectionDays: 0,
  language: "auto",
  ramadanThemeAlwaysOn: false
};

const T = {
  en: {
    loading: "Loading…",
    failed: "Failed to load timings",
    noNext: "No next prayer found",
    now: "Now",
    inPrefix: "In",
    nextPrefix: "Next:",
    at: "at",
    hijri: "Hijri",
    fajr: "Fajr",
    sunrise: "Sunrise",
    dhuhr: "Dhuhr",
    jumuah: "Jumu’ah",
    asr: "Asr",
    maghrib: "Maghrib",
    isha: "Isha",
    suhoorEnds: "Suhoor ends",
    iftar: "Iftar",
    refresh: "Refresh",
    footer: "IZW Vienna • Offline • No data tracking",
    settings: "Settings",
    notificationsEnabled: "Notifications enabled",
    notifyMinutesBefore: "Notify minutes before prayer",
    badgeEnabled: "Badge enabled",
    hijriCorrectionDays: "Hijri correction days",
    language: "Language",
    auto: "Auto",
    english: "English",
    arabic: "Arabic",
    ramadanThemeAlwaysOn: "Ramadan theme always on",
    prayerReminder: "Prayer reminder",
    prayerTime: "Prayer time"
  },
  ar: {
    loading: "جاري التحميل…",
    failed: "تعذّر تحميل المواقيت",
    noNext: "لا توجد صلاة قادمة",
    now: "الآن",
    inPrefix: "بعد",
    nextPrefix: "الصلاة القادمة:",
    at: "الساعة",
    hijri: "هجري",
    fajr: "الفجر",
    sunrise: "الشروق",
    dhuhr: "الظهر",
    jumuah: "الجمعة",
    asr: "العصر",
    maghrib: "المغرب",
    isha: "العشاء",
    suhoorEnds: "انتهاء السحور",
    iftar: "الإفطار",
    refresh: "تحديث",
    footer: "مركز فيينا الإسلامي • بدون إنترنت • بدون تتبّع",
    settings: "الإعدادات",
    notificationsEnabled: "تفعيل الإشعارات",
    notifyMinutesBefore: "الإشعار قبل الصلاة (دقائق)",
    badgeEnabled: "تفعيل الشارة",
    hijriCorrectionDays: "تصحيح التاريخ الهجري",
    language: "اللغة",
    auto: "تلقائي",
    english: "الإنجليزية",
    arabic: "العربية",
    ramadanThemeAlwaysOn: "تفعيل سمة رمضان دائمًا",
    prayerReminder: "تذكير بالصلاة",
    prayerTime: "حان وقت الصلاة"
  }
};

function tr(key) { return T[currentLang]?.[key] || T.en[key] || key; }
function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
function pad(n) { return String(n).padStart(2, "0"); }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function resolveLanguage() {
  const choice = settings?.language || "auto";
  if (choice === "ar" || choice === "en") return choice;
  const ui = ((API.i18n?.getUILanguage?.() || navigator.language || "en").toLowerCase());
  return ui.startsWith("ar") ? "ar" : "en";
}

function applyLanguage() {
  currentLang = resolveLanguage();
  document.documentElement.dir = currentLang === "ar" ? "rtl" : "ltr";

  setText("next", tr("loading"));
  setText("hijri-date", `${tr("hijri")}: —`);
  setText("label-fajr", tr("fajr"));
  setText("label-sunrise", tr("sunrise"));
  setText("label-dhuhr", tr("dhuhr"));
  setText("label-asr", tr("asr"));
  setText("label-maghrib", tr("maghrib"));
  setText("label-isha", tr("isha"));
  setText("tag-fajr", tr("suhoorEnds"));
  setText("tag-maghrib", tr("iftar"));
  setText("tag-jumuah", tr("jumuah"));
  setText("refresh", tr("refresh"));
  setText("footer", tr("footer"));
  document.getElementById("settings-toggle")?.setAttribute("aria-label", tr("settings"));

  setText("lbl-notifications-enabled", tr("notificationsEnabled"));
  setText("lbl-notify-minutes-before", tr("notifyMinutesBefore"));
  setText("lbl-badge-enabled", tr("badgeEnabled"));
  setText("lbl-hijri-correction-days", tr("hijriCorrectionDays"));
  setText("lbl-language", tr("language"));
  setText("lbl-ramadan-theme-always-on", tr("ramadanThemeAlwaysOn"));

  const lang = document.getElementById("set-language");
  if (lang?.options?.length >= 3) {
    lang.options[0].text = tr("auto");
    lang.options[1].text = tr("english");
    lang.options[2].text = tr("arabic");
  }
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

function formatHMS(totalSeconds) {
  if (totalSeconds < 0) totalSeconds = 0;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
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

function applyJumuahStyle(isFriday) {
  const row = document.getElementById("row-dhuhr");
  const label = document.getElementById("label-dhuhr");
  const tag = document.getElementById("tag-jumuah");
  if (!row || !label || !tag) return;
  row.classList.toggle("jumuah", isFriday);
  label.textContent = isFriday ? tr("jumuah") : tr("dhuhr");
  tag.style.display = isFriday ? "inline-flex" : "none";
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
  const HIJRI_ACCENTS = {
    1: ["rgba(59,130,246,0.20)", "rgba(59,130,246,0.10)"],
    2: ["rgba(100,116,139,0.18)", "rgba(100,116,139,0.08)"],
    3: ["rgba(34,197,94,0.18)", "rgba(34,197,94,0.08)"],
    4: ["rgba(34,197,94,0.12)", "rgba(34,197,94,0.06)"],
    5: ["rgba(148,163,184,0.14)", "rgba(148,163,184,0.07)"],
    6: ["rgba(148,163,184,0.10)", "rgba(148,163,184,0.05)"],
    7: ["rgba(168,85,247,0.18)", "rgba(168,85,247,0.08)"],
    8: ["rgba(20,184,166,0.18)", "rgba(20,184,166,0.08)"],
    10:["rgba(34,197,94,0.20)", "rgba(34,197,94,0.10)"],
    11:["rgba(245,158,11,0.14)", "rgba(245,158,11,0.07)"],
    12:["rgba(245,158,11,0.20)", "rgba(245,158,11,0.10)"]
  };

  const accents = HIJRI_ACCENTS[month];
  if (!accents) return;
  document.body.style.setProperty("--accent-1", accents[0]);
  document.body.style.setProperty("--accent-2", accents[1]);
  document.body.classList.add("hijri-accent");
}

async function getState() { return await API.runtime.sendMessage({ type: "GET_STATE" }); }
async function forceRefresh() { return await API.runtime.sendMessage({ type: "FORCE_REFRESH" }); }

function fillTimes(timesToday) {
  const keys = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
  for (const k of keys) setText(k, timesToday?.[k] ?? "–");
}

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

const HIJRI_MONTHS = {
  en: ["Muharram", "Safar", "Rabiʿ al-Awwal", "Rabiʿ al-Thani", "Jumada al-Ula", "Jumada al-Akhirah", "Rajab", "Shaʿban", "Ramadan", "Shawwal", "Dhu al-Qaʿdah", "Dhu al-Hijjah"],
  ar: ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"]
};

function formatHijriForToday(correctionDays) {
  const now = new Date();
  now.setDate(now.getDate() + correctionDays);
  const jdn = gregorianToJDN(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const h = islamicFromJDN(jdn);
  const months = HIJRI_MONTHS[currentLang] || HIJRI_MONTHS.en;
  return { text: `${h.day} ${months[h.month - 1]} ${h.year} AH`, month: h.month };
}

function formatGregorianPill() {
  const now = new Date();
  const locale = currentLang === "ar" ? "ar" : undefined;
  const opts = { weekday: "short", year: "numeric", month: "short", day: "2-digit" };
  return now.toLocaleDateString(locale, opts);
}

function computeSpecialChipText(state) {
  const isRamadan = hijriMonth === 9 || settings?.ramadanThemeAlwaysOn;
  if (!state?.timesToday) return null;
  const next = state?.next;
  if (!next?.whenTs) return null;

  const secs = Math.ceil((next.whenTs - Date.now()) / 1000);
  const remaining = secs <= 0 ? tr("now") : formatHMS(secs);

  if (next.key === "fajr") return isRamadan ? `${tr("suhoorEnds")} ${tr("inPrefix")} ${remaining}` : `${tr("fajr")} ${tr("inPrefix")} ${remaining}`;
  if (isRamadan && next.key === "maghrib") return `${tr("iftar")} ${tr("inPrefix")} ${remaining}`;
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
  setText("countdown", secsLeft <= 0 ? tr("now") : `${tr("inPrefix")} ${formatHMS(secsLeft)}`);
  setChip(computeSpecialChipText(lastState));
}

function applySettingsToForm() {
  document.getElementById("set-notifications-enabled").checked = !!settings.notificationsEnabled;
  document.getElementById("set-notify-minutes-before").value = settings.notifyMinutesBefore;
  document.getElementById("set-badge-enabled").checked = !!settings.badgeEnabled;
  document.getElementById("set-hijri-correction-days").value = settings.hijriCorrectionDays;
  document.getElementById("set-language").value = settings.language;
  document.getElementById("set-ramadan-theme-always-on").checked = !!settings.ramadanThemeAlwaysOn;
}

async function saveSettingsFromForm() {
  const nextSettings = {
    notificationsEnabled: document.getElementById("set-notifications-enabled").checked,
    notifyMinutesBefore: clamp(parseInt(document.getElementById("set-notify-minutes-before").value || "15", 10) || 15, 0, 120),
    badgeEnabled: document.getElementById("set-badge-enabled").checked,
    hijriCorrectionDays: clamp(parseInt(document.getElementById("set-hijri-correction-days").value || "0", 10) || 0, -2, 2),
    language: document.getElementById("set-language").value,
    ramadanThemeAlwaysOn: document.getElementById("set-ramadan-theme-always-on").checked
  };
  settings = { ...DEFAULT_SETTINGS, ...nextSettings };
  await API.storage.local.set({ settings });
  applyLanguage();
  await forceRefresh();
  await render();
}

async function setupSettingsUI() {
  const panel = document.getElementById("settings-panel");
  document.getElementById("settings-toggle")?.addEventListener("click", () => {
    panel.classList.toggle("open");
  });

  const ids = [
    "set-notifications-enabled",
    "set-notify-minutes-before",
    "set-badge-enabled",
    "set-hijri-correction-days",
    "set-language",
    "set-ramadan-theme-always-on"
  ];
  for (const id of ids) {
    document.getElementById(id)?.addEventListener("change", saveSettingsFromForm);
  }
}

async function render() {
  const state = await getState();
  lastState = state;
  settings = { ...DEFAULT_SETTINGS, ...(state?.settings || {}) };
  applyLanguage();
  applySettingsToForm();

  setText("greg-date", formatGregorianPill());
  const hijri = formatHijriForToday(settings.hijriCorrectionDays || 0);
  hijriMonth = hijri.month;
  setText("hijri-date", `${tr("hijri")}: ${hijri.text}`);

  clearRamadanStyles();
  clearHijriAccent();
  const ramadanOn = hijriMonth === 9 || settings.ramadanThemeAlwaysOn;
  if (ramadanOn) applyRamadanStyles();
  else applyHijriAccent(hijriMonth);

  const isFriday = new Date().getDay() === 5;
  applyJumuahStyle(isFriday);

  if (!state || state.error) {
    setText("next", state?.error || tr("failed"));
    setText("countdown", "");
    setChip(null);
    highlightNext(null);
    fillTimes(null);
    return;
  }

  fillTimes(state.timesToday);

  const next = state.next;
  const nextName = next ? (next.key === "dhuhr" && isFriday ? tr("jumuah") : tr(next.key)) : "";
  setText("next", next ? `${tr("nextPrefix")} ${nextName} ${tr("at")} ${next.at}` : tr("noNext"));
  highlightNext(next?.key);

  if (tickTimer) clearInterval(tickTimer);
  updateCountdownTick();
  tickTimer = setInterval(updateCountdownTick, 1000);
}

document.getElementById("refresh")?.addEventListener("click", async () => {
  await forceRefresh();
  await render();
});

setupSettingsUI();
render();
