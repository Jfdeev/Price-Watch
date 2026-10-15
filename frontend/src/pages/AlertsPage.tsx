import { Bell, Plus, Trash2, Search, PencilLine } from "lucide-react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "../components/ui/table";
import {
  createAlert,
  deleteAlert,
  listAlerts,
  searchProducts,
  updateAlert,
  type Product
} from "../services/api";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface AlertRecord {
  id: string;
  isActive?: boolean;
  targetPrice?: number;
  createdAt?: string;
  product?: {
    id?: string;
    name?: string;
    productName?: string;
    price?: number;
    currentPrice?: number;
  };
}

function isAlertTriggered(alert: AlertRecord) {
  return (alert.isActive ?? true) && getProductPrice(alert) <= getTargetPrice(alert);
}

function getProductName(alert: AlertRecord) {
  return alert.product?.name ?? alert.product?.productName ?? "Produto sem nome";
}

function getProductPrice(alert: AlertRecord) {
  return Number(alert.product?.price ?? alert.product?.currentPrice ?? 0);
}

function getTargetPrice(alert: AlertRecord) {
  return Number(alert.targetPrice ?? 0);
}

function getAlertCreatedAtLabel(alert: AlertRecord) {
  if (!alert.createdAt) {
    return "-";
  }

  return new Date(alert.createdAt).toLocaleDateString("pt-BR");
}

export function AlertsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [newAlertProductQuery, setNewAlertProductQuery] = useState("");
  const [newAlertPrice, setNewAlertPrice] = useState("");
  const [newAlertCandidates, setNewAlertCandidates] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isSearchingProduct, setIsSearchingProduct] = useState(false);
  const [editAlertOpen, setEditAlertOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<AlertRecord | null>(null);
  const [editingTargetPrice, setEditingTargetPrice] = useState("");

  useEffect(() => {
    void refreshAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function refreshAlerts() {
    if (!user) {
      setAlerts([]);
      return;
    }

    try {
      const res = await listAlerts();
      setAlerts(res);

      const triggered = res.filter(isAlertTriggered);
      if (triggered.length > 0) {
        const names = triggered
          .slice(0, 3)
          .map((item) => getProductName(item))
          .join(", ");
        const suffix = triggered.length > 3 ? "..." : "";
        toast.success("Preco alvo atingido em alerta ativo.", {
          description: `${names}${suffix}`
        });
      }
    } catch (err) {
      console.error("Failed to load alerts", err);
      setAlerts([]);
    }
  }

  async function handleToggleAlert(alertId: string, isActive: boolean) {
    try {
      const updated = await updateAlert(alertId, { isActive });
      setAlerts((prev) => prev.map((alert) => (alert.id === alertId ? updated : alert)));
      toast.success(isActive ? "Alerta ativado" : "Alerta desativado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar o alerta.");
    }
  }

  async function handleDeleteAlert(alertId: string) {
    try {
      await deleteAlert(alertId);
      setAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
      toast.success("Alerta removido");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível remover o alerta.");
    }
  }

  function openEditAlertDialog(alert: AlertRecord) {
    setEditingAlert(alert);
    setEditingTargetPrice(String(getTargetPrice(alert)));
    setEditAlertOpen(true);
  }

  async function handleUpdateAlertPrice() {
    if (!editingAlert) {
      return;
    }

    const parsedTargetPrice = Number(editingTargetPrice.replace(",", "."));
    if (!Number.isFinite(parsedTargetPrice) || parsedTargetPrice <= 0) {
      toast.error("Informe um preço alvo válido.");
      return;
    }

    try {
      const updated = await updateAlert(editingAlert.id, { targetPrice: parsedTargetPrice });
      setAlerts((prev) => prev.map((alert) => (alert.id === updated.id ? updated : alert)));
      setEditAlertOpen(false);
      setEditingAlert(null);
      toast.success("Preço do alerta atualizado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar o alerta.");
    }
  }

  async function handleSearchAlertProduct() {
    const query = newAlertProductQuery.trim();
    if (!query) {
      setNewAlertCandidates([]);
      setSelectedProduct(null);
      return;
    }

    setIsSearchingProduct(true);
    try {
      const result = await searchProducts(query, { page: 1, limit: 6 });
      setNewAlertCandidates(result.products);
      setSelectedProduct(null);
    } catch {
      setNewAlertCandidates([]);
      setSelectedProduct(null);
      toast.error("Não foi possível buscar produtos agora.");
    } finally {
      setIsSearchingProduct(false);
    }
  }

  async function handleCreateAlert() {
    if (!user) {
      toast.error("Faça login para criar alertas.");
      navigate("/login");
      return;
    }

    if (!selectedProduct) {
      toast.error("Selecione um produto da lista para criar o alerta.");
      return;
    }

    const priceInput = Number(newAlertPrice);
    if (!Number.isFinite(priceInput) || priceInput <= 0) {
      toast.error("Informe um preço alvo válido.");
      return;
    }

    try {
      await createAlert(selectedProduct.id, priceInput, user.email);
      toast.success("Alerta criado com sucesso!", {
        description: "Você será notificado quando o preço atingir o valor desejado."
      });
      setNewAlertProductQuery("");
      setNewAlertPrice("");
      setNewAlertCandidates([]);
      setSelectedProduct(null);
      await refreshAlerts();
    } catch (err) {
      console.error("Failed to create alert", err);
      toast.error(err instanceof Error ? err.message : "Erro ao criar alerta");
    }
  }

  const filteredAlerts = alerts.filter((alert) =>
    getProductName(alert).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeAlerts = alerts.filter((a) => a.isActive ?? true).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Alertas</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-2">
            Crie avisos para saber quando um produto ficar mais barato.
          </p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-violet-600 hover:bg-violet-700 w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Novo alerta
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Criar alerta</DialogTitle>
              <DialogDescription>
                Defina o preço que você quer pagar e receba um aviso quando ele chegar lá.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="product">Produto ou link</Label>
                <div className="flex gap-2">
                  <Input
                    id="product"
                    value={newAlertProductQuery}
                    onChange={(event) => setNewAlertProductQuery(event.target.value)}
                    placeholder="Digite o nome do produto"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleSearchAlertProduct()}
                  >
                    Buscar
                  </Button>
                </div>
                {isSearchingProduct ? (
                  <p className="text-xs text-muted-foreground">Buscando produtos...</p>
                ) : null}
                {newAlertCandidates.length > 0 ? (
                  <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-2">
                    {newAlertCandidates.map((candidate) => (
                      <button
                        key={candidate.id}
                        type="button"
                        className={`w-full rounded-md border px-2 py-2 text-left text-sm ${
                          selectedProduct?.id === candidate.id
                            ? "border-violet-500 bg-violet-50"
                            : "border-transparent hover:bg-gray-50"
                        }`}
                        onClick={() => setSelectedProduct(candidate)}
                      >
                        <p className="font-medium">{candidate.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {candidate.storeName ?? "Loja parceira"} - R${" "}
                          {Number(candidate.price).toLocaleString("pt-BR")}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Preço que você quer pagar (R$)</Label>
                <Input
                  id="price"
                  type="number"
                  placeholder="0,00"
                  value={newAlertPrice}
                  onChange={(event) => setNewAlertPrice(event.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                className="bg-violet-600 hover:bg-violet-700"
                onClick={() => void handleCreateAlert()}
              >
                Salvar alerta
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total de alertas</p>
              <p className="text-3xl font-bold mt-2">{alerts.length}</p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-violet-50 flex items-center justify-center">
              <Bell className="h-6 w-6 text-violet-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Alertas ativos</p>
              <p className="text-3xl font-bold mt-2">{activeAlerts}</p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-green-50 flex items-center justify-center">
              <Bell className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Alertas enviados</p>
              <p className="text-3xl font-bold mt-2">12</p>
              <p className="text-xs text-green-600 mt-1">Este mês</p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-blue-50 flex items-center justify-center">
              <Bell className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por produto"
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {filteredAlerts.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Nenhum alerta encontrado</h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "Tente outra busca" : "Crie seu primeiro alerta para começar"}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Preço Alvo</TableHead>
                    <TableHead>Preço Atual</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAlerts.map((alert) => {
                    const productName = getProductName(alert);
                    const currentPrice = getProductPrice(alert);
                    const targetPrice = getTargetPrice(alert);
                    const difference = currentPrice - targetPrice;
                    const percentDiff = currentPrice > 0 ? (difference / currentPrice) * 100 : 0;
                    const triggered = isAlertTriggered(alert);

                    return (
                      <TableRow key={alert.id}>
                        <TableCell className="font-medium max-w-xs">
                          <span className="truncate block">{productName}</span>
                        </TableCell>
                        <TableCell className="font-bold text-green-600">
                          R$ {targetPrice.toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-semibold">
                              R$ {currentPrice.toLocaleString("pt-BR")}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {difference > 0 ? "+" : ""}
                              {percentDiff.toFixed(1)}% do alvo
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {triggered ? (
                            <Badge className="bg-emerald-600">Preco atingido</Badge>
                          ) : (
                            <Badge
                              variant={alert.isActive ? "default" : "secondary"}
                              className={alert.isActive ? "bg-green-600" : ""}
                            >
                              {alert.isActive ? "Ativo" : "Inativo"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {getAlertCreatedAtLabel(alert)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-3">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => openEditAlertDialog(alert)}
                              title="Editar preço alvo"
                              aria-label="Editar preço alvo"
                            >
                              <PencilLine className="h-4 w-4" />
                            </Button>
                            <Switch
                              checked={alert.isActive ?? true}
                              onCheckedChange={(checked) =>
                                void handleToggleAlert(alert.id, checked)
                              }
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => void handleDeleteAlert(alert.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="md:hidden space-y-3">
              {filteredAlerts.map((alert) => {
                const productName = getProductName(alert);
                const currentPrice = getProductPrice(alert);
                const targetPrice = getTargetPrice(alert);
                const difference = currentPrice - targetPrice;
                const percentDiff = currentPrice > 0 ? (difference / currentPrice) * 100 : 0;
                const triggered = isAlertTriggered(alert);
                const isActive = alert.isActive ?? true;

                let badgeVariant: "default" | "secondary" = "secondary";
                let badgeClassName = "";
                let badgeLabel = "Inativo";

                if (triggered) {
                  badgeVariant = "default";
                  badgeClassName = "bg-emerald-600";
                  badgeLabel = "Preco atingido";
                } else if (isActive) {
                  badgeVariant = "default";
                  badgeClassName = "bg-green-600";
                  badgeLabel = "Ativo";
                }

                return (
                  <Card key={alert.id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium text-sm line-clamp-2 flex-1">{productName}</h3>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => openEditAlertDialog(alert)}
                            title="Editar preço alvo"
                            aria-label="Editar preço alvo"
                          >
                            <PencilLine className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => void handleDeleteAlert(alert.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Preço Alvo</p>
                          <p className="font-bold text-green-600">
                            R$ {targetPrice.toLocaleString("pt-BR")}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Preço Atual</p>
                          <p className="font-semibold">R$ {currentPrice.toLocaleString("pt-BR")}</p>
                          <p className="text-xs text-muted-foreground">
                            {difference > 0 ? "+" : ""}
                            {percentDiff.toFixed(1)}% do alvo
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={isActive}
                            onCheckedChange={(checked) => void handleToggleAlert(alert.id, checked)}
                          />
                          <Badge variant={badgeVariant} className={badgeClassName}>
                            {badgeLabel}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {getAlertCreatedAtLabel(alert)}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </Card>

      <Dialog open={editAlertOpen} onOpenChange={setEditAlertOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Atualizar preço alvo</DialogTitle>
            <DialogDescription>
              Defina o novo preço para o alerta do produto selecionado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="edit-target-price">Novo preço alvo (R$)</Label>
            <Input
              id="edit-target-price"
              type="number"
              min="0"
              step="0.01"
              value={editingTargetPrice}
              onChange={(event) => setEditingTargetPrice(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              className="bg-violet-600 hover:bg-violet-700"
              onClick={() => void handleUpdateAlertPrice()}
            >
              Salvar alteração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="p-6 bg-gradient-to-br from-violet-50 to-indigo-50 border-violet-200">
        <h3 className="font-semibold mb-3">Como os alertas funcionam</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span className="text-violet-600">•</span>
            <span>Você define o preço e o sistema acompanha para você.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-violet-600">•</span>
            <span>Quando o preço baixar, você recebe um aviso por email.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-violet-600">•</span>
            <span>Você pode ver e ajustar seus alertas sempre que quiser.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-violet-600">•</span>
            <span>Crie quantos alertas precisar.</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
