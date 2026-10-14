export type HistoryEntry = { oldPrice: number; newPrice: number; capturedAt: string };
export type HistoryPoint = { date: string; price: number };

export function buildHistorySeries(price: number, history: HistoryEntry[]): HistoryPoint[] {
  if (!history.length) {
    return [{ date: new Date().toISOString(), price }];
  }

  const sorted = history
    .slice()
    .sort(
      (left, right) => new Date(left.capturedAt).getTime() - new Date(right.capturedAt).getTime()
    );

  const points: Array<{ date: string; price: number }> = [];
  let lastKnownPrice: number | null = null;

  for (const entry of sorted) {
    const timestamp = new Date(entry.capturedAt).getTime();
    const oldPrice = Number(entry.oldPrice);
    const newPrice = Number(entry.newPrice);

    if (points.length === 0 || lastKnownPrice !== oldPrice) {
      points.push({ date: new Date(timestamp - 60_000).toISOString(), price: oldPrice });
    }

    points.push({ date: new Date(timestamp).toISOString(), price: newPrice });
    lastKnownPrice = newPrice;
  }

  return points;
}
