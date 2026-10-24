/* 站点运行时间与周年进度：按“本地日历日”计算，避免时区/夏令时让天数漂移。
   起始日当天记为第 0 天，进度条按当前周年周期已过去的比例取值。 */

const DAY_MS = 86_400_000;

export interface SiteCycle {
  /** 站点已完整运行的天数（起始当天为 0） */
  daysOnline: number;
  /** 当前周年周期内已过去的天数（起始当天为 0） */
  cycleDay: number;
  /** 当前周年周期的总天数（365 或 366） */
  cycleDays: number;
  /** 距下一个周年还剩的天数 */
  daysLeft: number;
  /** 已过去的比例（0–1），用于进度条 */
  progress: number;
}

function parseIsoDate(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

function localDay(now: Date): number {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

export function getSiteCycle(startDate: string, now = new Date()): SiteCycle {
  const start = parseIsoDate(startDate);
  const today = localDay(now);
  const startStamp = Date.UTC(start.year, start.month - 1, start.day);
  const daysOnline = Math.max(0, Math.floor((today - startStamp) / DAY_MS));

  let cycleYear = now.getFullYear();
  let cycleStart = Date.UTC(cycleYear, start.month - 1, start.day);
  if (cycleStart > today) {
    cycleYear -= 1;
    cycleStart = Date.UTC(cycleYear, start.month - 1, start.day);
  }
  const nextCycle = Date.UTC(cycleYear + 1, start.month - 1, start.day);
  const cycleDays = Math.round((nextCycle - cycleStart) / DAY_MS);
  const cycleDay = Math.floor((today - cycleStart) / DAY_MS);
  const progress = cycleDays > 0 ? Math.min(1, cycleDay / cycleDays) : 0;

  return { daysOnline, cycleDay, cycleDays, daysLeft: cycleDays - cycleDay, progress };
}

export function formatMonthDay(iso: string): string {
  const { month, day } = parseIsoDate(iso);
  return `${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
}
