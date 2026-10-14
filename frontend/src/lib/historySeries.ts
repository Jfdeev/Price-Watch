export type HistoryEntry = { oldPrice: number; newPrice: number; capturedAt: string };
export type HistoryPoint = { date: string; price: number };

function isNonIncreasing(timestamps: number[]): boolean {
  for (let index = 1; index < timestamps.length; index += 1) {
    if (!(timestamps[index - 1] >= timestamps[index])) {
      return false;
    }
  }
  return true;
}

function reverseKeepingTies(timestamps: number[]): number[] {
  const order: number[] = [];
  let groupEnd = timestamps.length - 1;
  while (groupEnd >= 0) {
    let groupStart = groupEnd;
    while (groupStart > 0 && timestamps[groupStart - 1] === timestamps[groupEnd]) {
      groupStart -= 1;
    }
    for (let index = groupStart; index <= groupEnd; index += 1) {
      order.push(index);
    }
    groupEnd = groupStart - 1;
  }
  return order;
}

function ascendingOrder(timestamps: number[]): number[] {
  if (isNonIncreasing(timestamps)) {
    return reverseKeepingTies(timestamps);
  }
  return timestamps
    .map((_, index) => index)
    .sort((left, right) => timestamps[left] - timestamps[right]);
}

export function buildHistorySeries(price: number, history: HistoryEntry[]): HistoryPoint[] {
  if (!history.length) {
    return [{ date: new Date().toISOString(), price }];
  }

  const timestamps = history.map((entry) => new Date(entry.capturedAt).getTime());
  const points: HistoryPoint[] = [];
  let lastKnownPrice: number | null = null;

  for (const index of ascendingOrder(timestamps)) {
    const timestamp = timestamps[index];
    const oldPrice = Number(history[index].oldPrice);
    const newPrice = Number(history[index].newPrice);

    if (points.length === 0 || lastKnownPrice !== oldPrice) {
      points.push({ date: new Date(timestamp - 60_000).toISOString(), price: oldPrice });
    }

    points.push({ date: new Date(timestamp).toISOString(), price: newPrice });
    lastKnownPrice = newPrice;
  }

  return points;
}
