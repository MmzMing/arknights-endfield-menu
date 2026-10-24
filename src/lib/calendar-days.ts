/** Days elapsed in the date's own year (Jan 1 = 1) and that year's total days.
    UTC arithmetic on the local calendar date, so a DST shift never moves the count by a day. */
export function yearDay(date: Date): { elapsed: number; total: number } {
  const year = date.getFullYear();
  const dayMs = 86_400_000;
  const start = Date.UTC(year, 0, 1);
  const today = Date.UTC(year, date.getMonth(), date.getDate());
  return {
    elapsed: Math.floor((today - start) / dayMs) + 1,
    total: Math.floor((Date.UTC(year + 1, 0, 1) - start) / dayMs),
  };
}
