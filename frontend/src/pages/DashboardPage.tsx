import { Package, Bell, TrendingDown, Eye } from "lucide-react";
import { StatsCard } from "../components/StatsCard";
import { ProductCard } from "../components/ProductCard";
import { Card } from "../components/ui/card";
import { PriceBadge } from "../components/PriceBadge";
import {
  listAlerts,
  listFavorites,
  listPriceHistory,
  mapProductToCard,
  type Favorite,
  type PriceAlert,
  type PriceHistoryRecord
} from "../services/api";
import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "../components/ui/table";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { computeDashboardMetrics } from "../lib/dashboardMetrics";

type DashboardPriceHistoryEntry = PriceHistoryRecord & {
  imageUrl?: string;
  storeName?: string;
};

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function calculateChangePercent(current: number, previous: number): number {
  if (!Number.isFinite(previous) || previous <= 0) {
    return current > 0 ? 100 : 0;
  }

  return roundToOneDecimal(((current - previous) / previous) * 100);
}

function getPriceChange(oldPrice: number, newPrice: number): number {
  if (!Number.isFinite(oldPrice) || oldPrice <= 0) {
    return 0;
  }

  return Math.round(((newPrice - oldPrice) / oldPrice) * 100 * 10) / 10;
}

export function DashboardPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [priceHistory, setPriceHistory] = useState<DashboardPriceHistoryEntry[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [favs, history, activeAlerts] = await Promise.all([
          listFavorites(),
          listPriceHistory(),
          listAlerts()
        ]);

        setFavorites(favs);
        setPriceHistory(history);
        setAlerts(activeAlerts);
      } catch (err) {
        console.error("Failed to load dashboard", err);
        setFavorites([]);
        setAlerts([]);
        setPriceHistory([]);
      }
    }

    void load();
  }, []);

  const {
    trackedItemsTotal,
    trackedItemsCurrent,
    trackedItemsPrevious,
    activeAlertsTotal,
    activeAlertsCurrent,
    activeAlertsPrevious,
    favoritesTotal,
    favoritesCurrent,
    favoritesPrevious,
    savingsTotal,
    savingsCurrent,
    savingsPrevious
  } = computeDashboardMetrics(priceHistory, alerts, favorites, new Date());

  const favoriteCards = favorites.map((favorite) => mapProductToCard(favorite.product));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Painel</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-2">
          Resumo rápido dos produtos que você acompanha.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Itens acompanhados"
          value={trackedItemsTotal}
          icon={Eye}
          change={calculateChangePercent(trackedItemsCurrent, trackedItemsPrevious)}
          changeLabel="vs. mês passado"
        />
        <StatsCard
          title="Alertas ativos"
          value={activeAlertsTotal}
          icon={Bell}
          change={calculateChangePercent(activeAlertsCurrent, activeAlertsPrevious)}
          changeLabel="vs. mês passado"
        />
        <StatsCard
          title="Favoritos"
          value={favoritesTotal}
          icon={Package}
          change={calculateChangePercent(favoritesCurrent, favoritesPrevious)}
          changeLabel="vs. mês passado"
        />
        <StatsCard
          title="Economia estimada"
          value={savingsTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          icon={TrendingDown}
          change={calculateChangePercent(savingsCurrent, savingsPrevious)}
          changeLabel="vs. mês passado"
        />
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">Maiores quedas</h2>
            <p className="text-sm text-muted-foreground">
              Atualizado com os últimos registros salvos
            </p>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Loja</TableHead>
              <TableHead>Preço Atual</TableHead>
              <TableHead>Variação</TableHead>
              <TableHead className="text-right">Tendência</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {priceHistory.slice(0, 5).map((entry, idx) => (
              <TableRow key={`${entry.id}-${idx}`}>
                <TableCell className="font-medium max-w-xs">
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        entry.imageUrl ??
                        "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600"
                      }
                      alt={entry.productName}
                      className="h-10 w-10 rounded object-cover"
                    />
                    <span className="truncate">{entry.productName}</span>
                  </div>
                </TableCell>
                <TableCell>{entry.storeName ?? "-"}</TableCell>
                <TableCell className="font-bold">
                  R$ {entry.newPrice.toLocaleString("pt-BR")}
                </TableCell>
                <TableCell>
                  <PriceBadge change={getPriceChange(entry.oldPrice, entry.newPrice)} />
                </TableCell>
                <TableCell className="text-right">
                  <ResponsiveContainer width={80} height={30}>
                    <LineChart data={[{ value: entry.oldPrice }, { value: entry.newPrice }]}>
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={entry.newPrice <= entry.oldPrice ? "#10b981" : "#ef4444"}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Favoritos</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Itens salvos para você voltar quando quiser.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {favoriteCards.map((product) => (
            <ProductCard key={product.id} {...product} isFavorite={true} />
          ))}
        </div>
      </div>
    </div>
  );
}
