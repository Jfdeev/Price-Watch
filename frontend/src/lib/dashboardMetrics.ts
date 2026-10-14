export type MetricsHistoryEntry = {
  productName: string;
  oldPrice: number;
  newPrice: number;
  capturedAt: string;
};
export type MetricsAlert = { isActive: boolean; createdAt: string };
export type MetricsFavorite = { createdAt: string };

type MonthWindows = { previousStart: number; currentStart: number; nextStart: number };

const OUTSIDE = 0;
const CURRENT = 1;
const PREVIOUS = 2;

function buildMonthWindows(now: Date): MonthWindows {
  const year = now.getFullYear();
  const month = now.getMonth();
  return {
    previousStart: new Date(year, month - 1, 1).getTime(),
    currentStart: new Date(year, month, 1).getTime(),
    nextStart: new Date(year, month + 1, 1).getTime()
  };
}

function classify(dateValue: string, windows: MonthWindows): number {
  const time = new Date(dateValue).getTime();
  if (time >= windows.currentStart && time < windows.nextStart) {
    return CURRENT;
  }
  if (time >= windows.previousStart && time < windows.currentStart) {
    return PREVIOUS;
  }
  return OUTSIDE;
}

export function computeDashboardMetrics(
  priceHistory: MetricsHistoryEntry[],
  alerts: MetricsAlert[],
  favorites: MetricsFavorite[],
  now: Date
) {
  const windows = buildMonthWindows(now);

  const allNames = new Set<string>();
  const currentNames = new Set<string>();
  const previousNames = new Set<string>();
  let savingsTotal = 0;
  let savingsCurrent = 0;
  let savingsPrevious = 0;

  for (const entry of priceHistory) {
    const saving = Math.max(0, Number(entry.oldPrice) - Number(entry.newPrice));
    const window = classify(entry.capturedAt, windows);
    allNames.add(entry.productName);
    savingsTotal = savingsTotal + saving;
    if (window === CURRENT) {
      currentNames.add(entry.productName);
      savingsCurrent = savingsCurrent + saving;
    } else if (window === PREVIOUS) {
      previousNames.add(entry.productName);
      savingsPrevious = savingsPrevious + saving;
    }
  }

  let activeAlertsTotal = 0;
  let activeAlertsCurrent = 0;
  let activeAlertsPrevious = 0;

  for (const alert of alerts) {
    if (!alert.isActive) {
      continue;
    }
    activeAlertsTotal += 1;
    const window = classify(alert.createdAt, windows);
    if (window === CURRENT) {
      activeAlertsCurrent += 1;
    } else if (window === PREVIOUS) {
      activeAlertsPrevious += 1;
    }
  }

  let favoritesCurrent = 0;
  let favoritesPrevious = 0;

  for (const favorite of favorites) {
    const window = classify(favorite.createdAt, windows);
    if (window === CURRENT) {
      favoritesCurrent += 1;
    } else if (window === PREVIOUS) {
      favoritesPrevious += 1;
    }
  }

  return {
    trackedItemsTotal: allNames.size,
    trackedItemsCurrent: currentNames.size,
    trackedItemsPrevious: previousNames.size,
    activeAlertsTotal,
    activeAlertsCurrent,
    activeAlertsPrevious,
    favoritesTotal: favorites.length,
    favoritesCurrent,
    favoritesPrevious,
    savingsTotal,
    savingsCurrent,
    savingsPrevious
  };
}
