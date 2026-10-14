export type MetricsHistoryEntry = {
  productName: string;
  oldPrice: number;
  newPrice: number;
  capturedAt: string;
};
export type MetricsAlert = { isActive: boolean; createdAt: string };
export type MetricsFavorite = { createdAt: string };

function getMonthStart(baseDate: Date): Date {
  return new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
}

function isInRange(dateValue: string, start: Date, end: Date): boolean {
  const date = new Date(dateValue);
  return date >= start && date < end;
}

export function computeDashboardMetrics(
  priceHistory: MetricsHistoryEntry[],
  alerts: MetricsAlert[],
  favorites: MetricsFavorite[],
  now: Date
) {
  const currentMonthStart = getMonthStart(now);
  const nextMonthStart = new Date(
    currentMonthStart.getFullYear(),
    currentMonthStart.getMonth() + 1,
    1
  );
  const previousMonthStart = new Date(
    currentMonthStart.getFullYear(),
    currentMonthStart.getMonth() - 1,
    1
  );

  const currentMonthHistory = priceHistory.filter((entry) =>
    isInRange(entry.capturedAt, currentMonthStart, nextMonthStart)
  );
  const previousMonthHistory = priceHistory.filter((entry) =>
    isInRange(entry.capturedAt, previousMonthStart, currentMonthStart)
  );

  const trackedItemsCurrent = new Set(currentMonthHistory.map((entry) => entry.productName)).size;
  const trackedItemsPrevious = new Set(previousMonthHistory.map((entry) => entry.productName)).size;

  const activeAlertsTotal = alerts.filter((alert) => alert.isActive).length;
  const activeAlertsCurrent = alerts.filter(
    (alert) => alert.isActive && isInRange(alert.createdAt, currentMonthStart, nextMonthStart)
  ).length;
  const activeAlertsPrevious = alerts.filter(
    (alert) => alert.isActive && isInRange(alert.createdAt, previousMonthStart, currentMonthStart)
  ).length;

  const favoritesCurrent = favorites.filter((favorite) =>
    isInRange(favorite.createdAt, currentMonthStart, nextMonthStart)
  ).length;
  const favoritesPrevious = favorites.filter((favorite) =>
    isInRange(favorite.createdAt, previousMonthStart, currentMonthStart)
  ).length;

  const savingsTotal = priceHistory.reduce(
    (accumulator, entry) =>
      accumulator + Math.max(0, Number(entry.oldPrice) - Number(entry.newPrice)),
    0
  );
  const savingsCurrent = currentMonthHistory.reduce(
    (accumulator, entry) =>
      accumulator + Math.max(0, Number(entry.oldPrice) - Number(entry.newPrice)),
    0
  );
  const savingsPrevious = previousMonthHistory.reduce(
    (accumulator, entry) =>
      accumulator + Math.max(0, Number(entry.oldPrice) - Number(entry.newPrice)),
    0
  );

  const trackedItemsTotal = new Set(priceHistory.map((entry) => entry.productName)).size;

  return {
    trackedItemsTotal,
    trackedItemsCurrent,
    trackedItemsPrevious,
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
