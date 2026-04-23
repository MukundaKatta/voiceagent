/**
 * Appointment-slot recommender.
 *
 * The voice receptionist needs to propose 2-3 concrete slots mid-call
 * rather than reading a list. This module takes the business hours,
 * existing bookings, and caller preferences and returns ranked slot
 * offers the agent can speak naturally: "I have Thursday at 2, Friday
 * morning at 10, or next Monday afternoon at 3 — any of those work?"
 */

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sun..Sat

export type SlotHours = {
  dayOfWeek: DayOfWeek;
  openMin: number;           // minutes from local midnight
  closeMin: number;
};

export type Booking = { startMs: number; endMs: number };

export type CallerPrefs = {
  earliestMs?: number;          // don't offer before this
  latestMs?: number;
  preferredPartOfDay?: "morning" | "afternoon" | "evening";
  urgent?: boolean;             // weight same-day harder
};

export type SlotOffer = {
  startMs: number;
  endMs: number;
  score: number;
  partOfDay: "morning" | "afternoon" | "evening";
  spokenLabel: string;
};

export type RecommendConfig = {
  serviceDurationMin: number;
  bufferMin: number;
  maxOffers: number;
  horizonDays: number;
  slotStepMin: number;
  tzOffsetMin: number;          // local offset from UTC
  nowMs: number;
};

export const DEFAULT_RECOMMEND_CONFIG: RecommendConfig = {
  serviceDurationMin: 30,
  bufferMin: 5,
  maxOffers: 3,
  horizonDays: 14,
  slotStepMin: 15,
  tzOffsetMin: 0,
  nowMs: 0,
};

function partOfDay(mins: number): SlotOffer["partOfDay"] {
  if (mins < 12 * 60) return "morning";
  if (mins < 17 * 60) return "afternoon";
  return "evening";
}

function overlaps(a: Booking, b: Booking): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

function localMinutesOfDay(ms: number, tzOffsetMin: number): number {
  const local = ms + tzOffsetMin * 60_000;
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor(((local % dayMs) + dayMs) % dayMs / 60_000);
}

function localDayOfWeek(ms: number, tzOffsetMin: number): DayOfWeek {
  const local = ms + tzOffsetMin * 60_000;
  return (new Date(local).getUTCDay() as DayOfWeek);
}

/** Rank and return the top N offerable slots. */
export function recommendSlots(
  hours: SlotHours[],
  bookings: Booking[],
  prefs: CallerPrefs,
  cfg: RecommendConfig = DEFAULT_RECOMMEND_CONFIG,
): SlotOffer[] {
  const slotMs = cfg.slotStepMin * 60_000;
  const durMs = cfg.serviceDurationMin * 60_000;
  const bufMs = cfg.bufferMin * 60_000;
  const horizonMs = cfg.horizonDays * 24 * 60 * 60 * 1000;
  const start = Math.max(cfg.nowMs, prefs.earliestMs ?? cfg.nowMs);
  const end = Math.min(cfg.nowMs + horizonMs, prefs.latestMs ?? cfg.nowMs + horizonMs);

  const hoursByDow = new Map<DayOfWeek, SlotHours>();
  for (const h of hours) hoursByDow.set(h.dayOfWeek, h);

  const offers: SlotOffer[] = [];
  for (let t = start; t + durMs <= end; t += slotMs) {
    const dow = localDayOfWeek(t, cfg.tzOffsetMin);
    const h = hoursByDow.get(dow);
    if (!h) continue;
    const local = localMinutesOfDay(t, cfg.tzOffsetMin);
    if (local < h.openMin) continue;
    if (local + cfg.serviceDurationMin > h.closeMin) continue;
    const block: Booking = { startMs: t - bufMs, endMs: t + durMs + bufMs };
    if (bookings.some((b) => overlaps(block, b))) continue;

    const pod = partOfDay(local);
    const prefMatch = prefs.preferredPartOfDay === pod ? 1 : 0;
    const sameDay = Math.abs(t - cfg.nowMs) < 12 * 60 * 60 * 1000 ? 1 : 0;
    const distancePenalty = (t - cfg.nowMs) / horizonMs;
    const urgency = prefs.urgent ? 1.5 * sameDay : 0;
    const score = round(
      0.5 * prefMatch + 0.3 * (1 - distancePenalty) + urgency,
      3,
    );
    offers.push({
      startMs: t,
      endMs: t + durMs,
      score,
      partOfDay: pod,
      spokenLabel: speak(t, cfg.tzOffsetMin),
    });
  }
  offers.sort((a, b) => b.score - a.score || a.startMs - b.startMs);
  // keep offers spread across days so we don't propose 3 slots same afternoon
  const picked: SlotOffer[] = [];
  const daysUsed = new Set<number>();
  for (const o of offers) {
    const day = Math.floor((o.startMs + cfg.tzOffsetMin * 60_000) / (24 * 60 * 60 * 1000));
    if (daysUsed.has(day)) continue;
    daysUsed.add(day);
    picked.push(o);
    if (picked.length >= cfg.maxOffers) break;
  }
  return picked;
}

function speak(ms: number, tzOffsetMin: number): string {
  const d = new Date(ms + tzOffsetMin * 60_000);
  const day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getUTCDay()];
  const h24 = d.getUTCHours();
  const mins = d.getUTCMinutes();
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = ((h24 + 11) % 12) + 1;
  const mm = mins === 0 ? "" : `:${String(mins).padStart(2, "0")}`;
  return `${day} at ${h12}${mm} ${ampm}`;
}

function round(x: number, digits: number): number {
  const m = Math.pow(10, digits);
  return Math.round(x * m) / m;
}
