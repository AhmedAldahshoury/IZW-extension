// background.js (Firefox MV2)

const API = (typeof browser !== "undefined") ? browser : chrome;

let DATA = null;
let STATE = { error: null };
let LAST_SCHEDULED_WHEN_TS = null;

const DEFAULT_SETTINGS = {
  notificationsEnabled: true,
  notifyMinutesBefore: 15,
  badgeEnabled: true,
  hijriCorrectionDays: 0,
  language: "auto",
  ramadanThemeAlwaysOn: false
};

const PRAYERS_ORDER = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
const KEY_MAP = { Fajr: "fajr", Dhuhr: "dhuhr", Asr: "asr", Maghrib: "maghrib", Isha: "isha" };

const ALARM_PRE = "PRAYER_PRE";
const ALARM_AT = "PRAYER_AT_TIME";

function pad(n) { return String(n).padStart(2, "0"); }

function todayKeyLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
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

function badgeAPI() { return API.action || API.browserAction; }

async function getSettings() {
  const r = await API.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...(r.settings || {}) };
}

async function setBadgeStyle() {
  const api = badgeAPI();
  if (!api?.setBadgeBackgroundColor) return;
  await api.setBadgeBackgroundColor({ color: "#2b2f36" });
}

async function loadDataOnce() {
  if (DATA) return;
  const url = API.runtime.getURL("data/izw_prayer_times_2026.json");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load timings JSON: ${res.status}`);
  DATA = await res.json();
}

function computeNext(todayKey, timesToday) {
  const now = new Date();
  const isFriday = now.getDay() === 5;

  for (const prayer of PRAYERS_ORDER) {
    const key = KEY_MAP[prayer];
    const t = timesToday?.[key];
    if (!t) continue;

    const { h, m } = parseHHMM(t);
    const when = dateAtLocal(0, h, m);
    if (when > now) {
      const isJumuah = isFriday && key === "dhuhr";
      return {
        name: isJumuah ? "Jumu'ah" : prayer,
        key,
        at: t,
        whenTs: when.getTime(),
        minutesLeft: Math.ceil((when - now) / 60000),
        isJumuah
      };
    }
  }

  const tomorrowKey = addDays(todayKey, 1);
  const timesTomorrow = DATA?.[tomorrowKey];
  const t = timesTomorrow?.fajr;
  if (t) {
    const { h, m } = parseHHMM(t);
    const when = dateAtLocal(1, h, m);
    return {
      name: "Fajr",
      key: "fajr",
      at: t,
      whenTs: when.getTime(),
      minutesLeft: Math.ceil((when - now) / 60000),
      tomorrowKey,
      isJumuah: false
    };
  }

  return null;
}

function computeBadgeText(next) {
  if (!next) return "";
  const mins = next.minutesLeft;
  if (mins <= 0) return "NOW";
  if (mins <= 99) return `${mins}m`;
  if (next.isJumuah) return "JUM";
  return next.name.slice(0, 3).toUpperCase();
}

async function updateBadge(next, settings) {
  const api = badgeAPI();
  if (!api?.setBadgeText) return;
  await setBadgeStyle();
  if (!settings.badgeEnabled) {
    await api.setBadgeText({ text: "" });
    return;
  }
  await api.setBadgeText({ text: computeBadgeText(next) });
}

async function schedulePrayerNotifications(next, settings) {
  await API.alarms.clear(ALARM_PRE);
  await API.alarms.clear(ALARM_AT);

  if (!settings.notificationsEnabled || !next?.whenTs) {
    LAST_SCHEDULED_WHEN_TS = null;
    return;
  }

  const now = Date.now();
  const at = next.whenTs;
  const pre = at - (Math.max(0, Number(settings.notifyMinutesBefore) || 0) * 60 * 1000);

  if (LAST_SCHEDULED_WHEN_TS === at) return;
  LAST_SCHEDULED_WHEN_TS = at;

  if (pre > now) await API.alarms.create(ALARM_PRE, { when: pre });
  if (at > now) await API.alarms.create(ALARM_AT, { when: at });
}

function notify(title, message) {
  API.notifications.create({
    type: "basic",
    iconUrl: "icon128.png",
    title,
    message
  });
}

API.alarms.onAlarm.addListener(async (alarm) => {
  await refreshState();
  const next = STATE?.next;
  const settings = STATE?.settings || DEFAULT_SETTINGS;
  if (!next || !settings.notificationsEnabled) return;

  if (alarm.name === ALARM_PRE) notify("Prayer reminder", `${next.name} in ${settings.notifyMinutesBefore} minutes (${next.at})`);
  if (alarm.name === ALARM_AT) notify("Prayer time", `${next.name} (${next.at})`);
});

async function refreshState() {
  try {
    await loadDataOnce();

    const settings = await getSettings();
    const todayKey = todayKeyLocal();
    const timesToday = DATA?.[todayKey];
    if (!timesToday) throw new Error(`No timings for ${todayKey}`);

    const tomorrowKey = addDays(todayKey, 1);
    const timesTomorrow = DATA?.[tomorrowKey] || null;
    const next = computeNext(todayKey, timesToday);

    STATE = {
      error: null,
      todayKey,
      timesToday,
      tomorrowKey,
      timesTomorrow,
      next,
      settings
    };

    await updateBadge(next, settings);
    await schedulePrayerNotifications(next, settings);
  } catch (e) {
    STATE = { error: String(e?.message || e), settings: await getSettings() };

    await setBadgeStyle();
    const api = badgeAPI();
    if (api?.setBadgeText) await api.setBadgeText({ text: "!" });

    await API.alarms.clear(ALARM_PRE);
    await API.alarms.clear(ALARM_AT);
    LAST_SCHEDULED_WHEN_TS = null;
  }
}

API.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "GET_STATE") {
    sendResponse(STATE);
    return;
  }

  if (msg?.type === "FORCE_REFRESH") {
    refreshState().then(() => sendResponse({ ok: true }));
    return true;
  }

  sendResponse({ ok: false });
});

API.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.settings) refreshState();
});

refreshState();
setInterval(refreshState, 20 * 1000);
