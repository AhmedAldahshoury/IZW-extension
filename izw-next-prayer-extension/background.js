// background.js (Firefox MV2)
// - Loads bundled JSON: data/izw_prayer_times_2026.json
// - Computes next prayer + minutes remaining
// - Updates badge every minute
// - Notifications: 15 minutes before + at azan time
// - Also exposes tomorrow timings to popup (needed for Suhoor/Fajr counter after Maghrib)

const API = (typeof browser !== "undefined") ? browser : chrome;

let DATA = null;
let STATE = { error: null };
let LAST_SCHEDULED_WHEN_TS = null;

const PRAYERS_ORDER = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
const KEY_MAP = { Fajr: "fajr", Dhuhr: "dhuhr", Asr: "asr", Maghrib: "maghrib", Isha: "isha" };

const ALARM_PRE = "PRAYER_PRE_15";
const ALARM_AT  = "PRAYER_AT_TIME";

function pad(n) {
  return String(n).padStart(2, "0");
}

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

function badgeAPI() {
  return API.action || API.browserAction;
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

  for (const prayer of PRAYERS_ORDER) {
    const key = KEY_MAP[prayer];
    const t = timesToday?.[key];
    if (!t) continue;

    const { h, m } = parseHHMM(t);
    const when = dateAtLocal(0, h, m);
    if (when > now) {
      return {
        name: prayer,
        key,
        at: t,
        whenTs: when.getTime(),
        minutesLeft: Math.ceil((when - now) / 60000),
      };
    }
  }

  // fallback: tomorrow Fajr
  const tomorrowKey = addDays(todayKey, 1);
  const timesTomorrow = DATA?.[tomorrowKey];
  const t = timesTomorrow?.["fajr"];
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
    };
  }

  return null;
}

function computeBadgeText(next) {
  if (!next) return "";
  const mins = next.minutesLeft;
  if (mins <= 0) return "NOW";
  if (mins <= 90) return `${mins}m`;
  return next.name.slice(0, 3).toUpperCase();
}

async function updateBadge(next) {
  const api = badgeAPI();
  if (!api?.setBadgeText) return;
  await setBadgeStyle();
  await api.setBadgeText({ text: computeBadgeText(next) });
}

async function schedulePrayerNotifications(next) {
  await API.alarms.clear(ALARM_PRE);
  await API.alarms.clear(ALARM_AT);

  if (!next?.whenTs) return;

  const now = Date.now();
  const at = next.whenTs;
  const pre = at - 15 * 60 * 1000;

  if (LAST_SCHEDULED_WHEN_TS === at) return;
  LAST_SCHEDULED_WHEN_TS = at;

  if (pre > now) await API.alarms.create(ALARM_PRE, { when: pre });
  if (at > now)  await API.alarms.create(ALARM_AT,  { when: at });
}

function notify(title, message) {
  API.notifications.create({
    type: "basic",
    iconUrl: "icon128.png",
    title,
    message,
  });
}

API.alarms.onAlarm.addListener(async (alarm) => {
  await refreshState();
  const next = STATE?.next;
  if (!next) return;

  if (alarm.name === ALARM_PRE) notify("Prayer reminder", `${next.name} in 15 minutes (${next.at})`);
  if (alarm.name === ALARM_AT)  notify("Prayer time", `${next.name} (${next.at})`);
});

async function refreshState() {
  try {
    await loadDataOnce();

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
      next
    };

    await updateBadge(next);
    await schedulePrayerNotifications(next);
  } catch (e) {
    STATE = { error: String(e?.message || e) };

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

refreshState();
setInterval(refreshState, 20 * 1000);

