const API = (typeof browser !== "undefined") ? browser : chrome;

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
    title: "IZW Settings",
    notificationsEnabled: "Notifications enabled",
    notifyMinutesBefore: "Notify minutes before prayer",
    badgeEnabled: "Badge enabled",
    hijriCorrectionDays: "Hijri correction days",
    language: "Language",
    auto: "Auto",
    english: "English",
    arabic: "Arabic",
    ramadanThemeAlwaysOn: "Ramadan theme always on (debug)",
    storageHint: "All settings are stored locally in browser extension storage.",
    friday: "Friday",
    jumuahBadge: "Jumu'ah"
  },
  ar: {
    title: "إعدادات IZW",
    notificationsEnabled: "تفعيل الإشعارات",
    notifyMinutesBefore: "الإشعار قبل الصلاة (دقائق)",
    badgeEnabled: "تفعيل الشارة",
    hijriCorrectionDays: "تصحيح التاريخ الهجري",
    language: "اللغة",
    auto: "تلقائي",
    english: "الإنجليزية",
    arabic: "العربية",
    ramadanThemeAlwaysOn: "تفعيل سمة رمضان دائمًا (اختبار)",
    storageHint: "تُخزَّن جميع الإعدادات محليًا في تخزين الإضافة داخل المتصفح.",
    friday: "الجمعة",
    jumuahBadge: "صلاة الجمعة"
  }
};

let settings = { ...DEFAULT_SETTINGS };
let currentLang = "en";

function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function tr(key) { return T[currentLang]?.[key] || T.en[key] || key; }

function resolveLanguage() {
  const choice = settings?.language || "auto";
  if (choice === "ar" || choice === "en") return choice;
  const ui = ((API.i18n?.getUILanguage?.() || navigator.language || "en").toLowerCase());
  return ui.startsWith("ar") ? "ar" : "en";
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

function applyLanguageAndMeta() {
  currentLang = resolveLanguage();
  document.documentElement.dir = currentLang === "ar" ? "rtl" : "ltr";

  setText("title", tr("title"));
  setText("lbl-notifications-enabled", tr("notificationsEnabled"));
  setText("lbl-notify-minutes-before", tr("notifyMinutesBefore"));
  setText("lbl-badge-enabled", tr("badgeEnabled"));
  setText("lbl-hijri-correction-days", tr("hijriCorrectionDays"));
  setText("lbl-language", tr("language"));
  setText("lbl-ramadan-theme-always-on", tr("ramadanThemeAlwaysOn"));
  setText("storage-hint", tr("storageHint"));

  const lang = document.getElementById("set-language");
  lang.options[0].text = tr("auto");
  lang.options[1].text = tr("english");
  lang.options[2].text = tr("arabic");

  const hijri = formatHijriForToday(settings.hijriCorrectionDays || 0);
  setText("hijri-meta", `Hijri: ${hijri.text}`);
  document.body.classList.toggle("ramadan", hijri.month === 9 || settings.ramadanThemeAlwaysOn);

  const isFriday = new Date().getDay() === 5;
  const weekday = document.getElementById("weekday-meta");
  const weekdayLabel = new Date().toLocaleDateString(currentLang === "ar" ? "ar" : undefined, { weekday: "long" });

  weekday.textContent = "";
  if (isFriday) {
    weekday.append(document.createTextNode(`${tr("friday")} `));
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = tr("jumuahBadge");
    weekday.appendChild(badge);
  } else {
    weekday.textContent = weekdayLabel;
  }
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
  settings = {
    notificationsEnabled: document.getElementById("set-notifications-enabled").checked,
    notifyMinutesBefore: clamp(parseInt(document.getElementById("set-notify-minutes-before").value || "15", 10) || 15, 0, 120),
    badgeEnabled: document.getElementById("set-badge-enabled").checked,
    hijriCorrectionDays: clamp(parseInt(document.getElementById("set-hijri-correction-days").value || "0", 10) || 0, -2, 2),
    language: document.getElementById("set-language").value,
    ramadanThemeAlwaysOn: document.getElementById("set-ramadan-theme-always-on").checked
  };
  await API.storage.local.set({ settings });
  applyLanguageAndMeta();
  await API.runtime.sendMessage({ type: "FORCE_REFRESH" });
}

async function init() {
  const state = await API.runtime.sendMessage({ type: "GET_STATE" });
  settings = { ...DEFAULT_SETTINGS, ...(state?.settings || {}) };
  applySettingsToForm();
  applyLanguageAndMeta();

  for (const id of [
    "set-notifications-enabled",
    "set-notify-minutes-before",
    "set-badge-enabled",
    "set-hijri-correction-days",
    "set-language",
    "set-ramadan-theme-always-on"
  ]) {
    document.getElementById(id).addEventListener("change", saveSettingsFromForm);
  }
}

init();
