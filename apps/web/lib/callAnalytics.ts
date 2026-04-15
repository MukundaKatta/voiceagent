/**
 * Call analytics helpers — aggregates call records into the metrics
 * surfaced on the dashboard and drills into a single call's transcript.
 */

export type CallRecord = {
  id: string;
  startedAt: string; // ISO
  durationSec: number;
  /** Outcome bucket used across dashboards. */
  outcome: "booked" | "info" | "voicemail" | "missed" | "spam" | "other";
  /** 0..1 sentiment score, 0.5 = neutral. */
  sentiment?: number;
  transferredToHuman?: boolean;
  /** Cost in the agent's billing currency (usually USD). */
  costUsd?: number;
};

export type DashboardMetrics = {
  total: number;
  answeredRate: number;
  bookingRate: number;
  avgDurationSec: number;
  transferRate: number;
  totalCostUsd: number;
  sentimentAvg: number | null;
  byOutcome: Record<CallRecord["outcome"], number>;
  byHour: number[]; // 24 slots, local time
  byDay: number[]; // 7 slots, Sunday=0
};

function zeros(n: number): number[] {
  return Array.from({ length: n }, () => 0);
}

export function summarize(calls: CallRecord[]): DashboardMetrics {
  const byOutcome: Record<CallRecord["outcome"], number> = {
    booked: 0, info: 0, voicemail: 0, missed: 0, spam: 0, other: 0,
  };
  const byHour = zeros(24);
  const byDay = zeros(7);
  let totalDuration = 0;
  let answered = 0;
  let transfers = 0;
  let cost = 0;
  let sentimentSum = 0;
  let sentimentN = 0;

  for (const c of calls) {
    byOutcome[c.outcome]++;
    if (c.outcome !== "missed" && c.outcome !== "spam") answered++;
    if (c.transferredToHuman) transfers++;
    totalDuration += c.durationSec;
    cost += c.costUsd || 0;
    if (typeof c.sentiment === "number") {
      sentimentSum += c.sentiment;
      sentimentN++;
    }
    const d = new Date(c.startedAt);
    byHour[d.getHours()]++;
    byDay[d.getDay()]++;
  }

  const total = calls.length;
  return {
    total,
    answeredRate: total ? answered / total : 0,
    bookingRate: total ? byOutcome.booked / total : 0,
    avgDurationSec: total ? totalDuration / total : 0,
    transferRate: total ? transfers / total : 0,
    totalCostUsd: cost,
    sentimentAvg: sentimentN ? sentimentSum / sentimentN : null,
    byOutcome,
    byHour,
    byDay,
  };
}

export function formatDuration(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s ? `${m}m ${s}s` : `${m}m`;
}

export function peakHour(metrics: DashboardMetrics): number {
  let peak = 0;
  for (let i = 1; i < metrics.byHour.length; i++) {
    if (metrics.byHour[i] > metrics.byHour[peak]) peak = i;
  }
  return peak;
}

/**
 * Bucket calls into time windows for a sparkline (default: last 30 days,
 * daily). Returns counts aligned to `windowDays` starting from the
 * earliest midnight within range.
 */
export function dailyBuckets(
  calls: CallRecord[],
  windowDays = 30,
  now: Date = new Date(),
): number[] {
  const buckets = zeros(windowDays);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (windowDays - 1));
  const startMs = start.getTime();
  const dayMs = 86_400_000;
  for (const c of calls) {
    const idx = Math.floor((new Date(c.startedAt).getTime() - startMs) / dayMs);
    if (idx >= 0 && idx < windowDays) buckets[idx]++;
  }
  return buckets;
}
