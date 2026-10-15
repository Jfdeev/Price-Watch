import { ArrowLeft, Bell, ExternalLink, Heart, TrendingDown } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { PriceBadge } from "../components/PriceBadge";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import {
  createAlert,
  deleteFavorite,
  deleteProduct,
  favoriteProduct,
  getFavoriteForProduct,
  getProduct,
  listProductOffers,
  listProductPriceHistory,
  updateProduct,
  type ComparableOffer,
  type Product
} from "../services/api";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { buildHistorySeries } from "../lib/historySeries";

type ProductDetailsView = {
  id: string;
  name: string;
  image: string;
  currentPrice: number;
  originalPrice: number;
  store: string;
  category: string;
  description: string;
  productUrl?: string;
  priceChange: number;
  priceHistory: { date: string; price: number }[];
  stores: { name: string; price: number; url: string }[];
};

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function mapApiProduct(
  product: Product,
  history: Array<{ oldPrice: number; newPrice: number; capturedAt: string }> = [],
  offers: ComparableOffer[] = []
): ProductDetailsView {
  const price = Number(product.price);
  const mappedHistory = buildHistorySeries(price, history);
  const derivedOriginalPrice =
    mappedHistory.length > 0 ? Number(mappedHistory[0]?.price ?? price) : price;
  const originalPrice =
    typeof product.originalPrice === "number" && product.originalPrice > 0
      ? Number(product.originalPrice)
      : derivedOriginalPrice;
  let priceChange = 0;
  if (typeof product.priceChange === "number") {
    priceChange = Number(product.priceChange);
  } else if (originalPrice > 0) {
    priceChange = roundToOneDecimal(((price - originalPrice) / originalPrice) * 100);
  }

  const mappedOffers = offers.length
    ? offers.map((offer) => ({
        name: offer.storeName ?? "Loja parceira",
        price: Number(offer.price),
        url: offer.productUrl ?? "#"
      }))
    : [
        {
          name: product.storeName ?? "Loja parceira",
          price,
          url: product.productUrl ?? "#"
        }
      ];

  return {
    id: product.id,
    name: product.name,
    image: product.imageUrl ?? "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600",
    currentPrice: price,
    originalPrice,
    store: product.storeName ?? "Loja parceira",
    category: product.category ?? "Produto",
    description: "Produto encontrado pela integração do PriceWatch com a busca em tempo real.",
    productUrl: product.productUrl,
    priceChange,
    priceHistory: mappedHistory,
    stores: mappedOffers
  };
}

export function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState<ProductDetailsView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [targetPriceInput, setTargetPriceInput] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [formValues, setFormValues] = useState({
    name: "",
    price: "",
    category: "",
    storeName: "",
    productUrl: "",
    imageUrl: ""
  });

  useEffect(() => {
    async function loadProduct() {
      if (!id) {
        setProduct(null);
        setIsLoading(false);
        return;
      }
      try {
        const apiProduct = await getProduct(id);
        if (!apiProduct) {
          setProduct(null);
          return;
        }

        const [history, offers] = await Promise.all([
          listProductPriceHistory(apiProduct.id).catch(() => []),
          listProductOffers(apiProduct.id).catch(() => [])
        ]);

        setProduct(mapApiProduct(apiProduct, history, offers));
        if (apiProduct) {
          try {
            const match = await getFavoriteForProduct(apiProduct.id);
            setIsFavorite(Boolean(match));
            setFavoriteId(match?.id ?? null);
          } catch {
            setIsFavorite(false);
            setFavoriteId(null);
          }
        }
      } catch {
        setProduct(null);
      } finally {
        setIsLoading(false);
      }
    }

    void loadProduct();
  }, [id, user?.id]);

  useEffect(() => {
    if (!product) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormValues({
      name: product.name ?? "",
      price: String(product.currentPrice ?? ""),
      category: product.category ?? "",
      storeName: product.store ?? "",
      productUrl: product.productUrl ?? "",
      imageUrl: product.image ?? ""
    });
    setTargetPriceInput(String(product.currentPrice ?? ""));
  }, [product]);

  if (isLoading) {
    return (
      <div className="container px-4 lg:px-8 py-16 text-center">
        <h1 className="text-2xl font-bold">Carregando produto...</h1>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container px-4 lg:px-8 py-16 text-center">
        <h1 className="text-2xl font-bold">Produto não encontrado</h1>
        <Link to="/">
          <Button className="mt-4">Voltar para home</Button>
        </Link>
      </div>
    );
  }

  const lowestPrice = Math.min(...product.priceHistory.map((history) => history.price));
  const highestPrice = Math.max(...product.priceHistory.map((history) => history.price));
  const productName = product.name;

  async function handleCreateAlert() {
    if (!user) {
      toast.error("Faça login para criar alertas.");
      navigate("/login");
      return;
    }

    if (!product) {
      return;
    }

    const parsedTargetPrice = Number(targetPriceInput.replace(",", "."));
    if (!Number.isFinite(parsedTargetPrice) || parsedTargetPrice <= 0) {
      toast.error("Informe um preco alvo valido.");
      return;
    }

    try {
      await createAlert(product.id, parsedTargetPrice, user.email);
      toast.success("Alerta criado com sucesso!", {
        description: `Você será notificado quando ${productName} atingir R$ ${parsedTargetPrice.toLocaleString("pt-BR")}.`
      });
      setAlertDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar o alerta.");
    }
  }

  function handleOpenAlertDialog() {
    if (!user) {
      toast.error("Faça login para criar alertas.");
      navigate("/login");
      return;
    }

    if (!product) {
      return;
    }

    setTargetPriceInput(String(product.currentPrice));
    setAlertDialogOpen(true);
  }

  function handleFormChange(field: keyof typeof formValues, value: string) {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleUpdateProduct() {
    if (!product) {
      return;
    }

    const priceValue = Number(formValues.price);

    if (!Number.isFinite(priceValue) || priceValue <= 0) {
      toast.error("Informe um preco valido.");
      return;
    }

    try {
      const updated = await updateProduct(product.id, {
        name: formValues.name.trim(),
        price: priceValue,
        category: formValues.category.trim() || null,
        storeName: formValues.storeName.trim() || null,
        productUrl: formValues.productUrl.trim() || null,
        imageUrl: formValues.imageUrl.trim() || null
      });

      const [history, offers] = await Promise.all([
        listProductPriceHistory(updated.id).catch(() => []),
        listProductOffers(updated.id).catch(() => [])
      ]);

      setProduct(mapApiProduct(updated, history, offers));
      setEditOpen(false);
      toast.success("Produto atualizado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nao foi possivel atualizar o produto.");
    }
  }

  async function handleDeleteProduct() {
    if (!product) {
      return;
    }

    try {
      await deleteProduct(product.id);
      toast.success("Produto removido.");
      navigate("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nao foi possivel remover o produto.");
    }
  }

  async function handleToggleFavorite() {
    if (!user) {
      toast.error("Faça login para salvar favoritos.");
      navigate("/login");
      return;
    }

    if (!product) {
      return;
    }

    try {
      if (favoriteId) {
        await deleteFavorite(favoriteId);
        setFavoriteId(null);
        setIsFavorite(false);
        toast.success("Removido dos favoritos", {
          description: "O produto foi removido da sua lista de favoritos."
        });
      } else {
        const favorite = await favoriteProduct(product.id);
        setFavoriteId(favorite.id);
        setIsFavorite(true);
        toast.success("Adicionado aos favoritos!", {
          description: "O produto foi adicionado à sua lista de favoritos."
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar o favorito.");
    }
  }

  return (
    <div className="container px-4 lg:px-8 py-8 max-w-7xl">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-12">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="aspect-square bg-gray-50">
              <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <Badge variant="secondary">{product.category}</Badge>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">
              {product.name}
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">{product.description}</p>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-3xl md:text-4xl lg:text-5xl font-bold">
                R$ {product.currentPrice.toLocaleString("pt-BR")}
              </span>
              {product.originalPrice > product.currentPrice && (
                <span className="text-lg md:text-xl text-muted-foreground line-through">
                  R$ {product.originalPrice.toLocaleString("pt-BR")}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <PriceBadge change={product.priceChange} size="lg" />
              <span className="text-xs md:text-sm text-muted-foreground">variacao recente</span>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Vendido por</span>
              <span className="font-medium text-foreground">{product.store}</span>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col sm:flex-row gap-3">
            <Dialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
              <Button
                className="flex-1 bg-violet-600 hover:bg-violet-700"
                size="lg"
                onClick={handleOpenAlertDialog}
              >
                <Bell className="h-5 w-5 mr-2" />
                Criar alerta de preço
              </Button>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Definir preço alvo</DialogTitle>
                </DialogHeader>
                <div className="space-y-2 py-2">
                  <Label htmlFor="target-price">Preço que você quer pagar</Label>
                  <Input
                    id="target-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={targetPriceInput}
                    onChange={(event) => setTargetPriceInput(event.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button className="bg-violet-600 hover:bg-violet-700" onClick={handleCreateAlert}>
                    Salvar alerta
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              size="lg"
              className="sm:w-auto"
              onClick={handleToggleFavorite}
            >
              <Heart
                className={`h-5 w-5 sm:mr-0 ${isFavorite ? "fill-current text-red-500" : ""}`}
              />
              <span className="sm:hidden ml-2">{isFavorite ? "Favoritado" : "Favoritar"}</span>
            </Button>
          </div>

          {user?.role === "ADMIN" ? (
            <div className="flex flex-col gap-2 rounded-lg border border-dashed p-4">
              <p className="text-sm font-medium">Acoes administrativas</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">Editar produto</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Editar produto</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="space-y-2">
                        <Label htmlFor="product-name">Nome</Label>
                        <Input
                          id="product-name"
                          value={formValues.name}
                          onChange={(event) => handleFormChange("name", event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="product-price">Preco</Label>
                        <Input
                          id="product-price"
                          type="number"
                          value={formValues.price}
                          onChange={(event) => handleFormChange("price", event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="product-category">Categoria</Label>
                        <Input
                          id="product-category"
                          value={formValues.category}
                          onChange={(event) => handleFormChange("category", event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="product-store">Loja</Label>
                        <Input
                          id="product-store"
                          value={formValues.storeName}
                          onChange={(event) => handleFormChange("storeName", event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="product-url">URL do produto</Label>
                        <Input
                          id="product-url"
                          value={formValues.productUrl}
                          onChange={(event) => handleFormChange("productUrl", event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="product-image">URL da imagem</Label>
                        <Input
                          id="product-image"
                          value={formValues.imageUrl}
                          onChange={(event) => handleFormChange("imageUrl", event.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        className="bg-violet-600 hover:bg-violet-700"
                        onClick={handleUpdateProduct}
                      >
                        Salvar alteracoes
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button variant="destructive" onClick={handleDeleteProduct}>
                  Excluir produto
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <Card className="mt-12 p-4 sm:p-6">
        <div className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">Histórico de Preços</h2>
              <p className="text-sm text-muted-foreground mt-1">Últimos 30 dias</p>
            </div>
            <div className="flex flex-wrap gap-4 text-sm sm:gap-6">
              <div>
                <p className="text-muted-foreground">Menor preço</p>
                <p className="font-bold text-green-600">R$ {lowestPrice.toLocaleString("pt-BR")}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Maior preço</p>
                <p className="font-bold text-red-600">R$ {highestPrice.toLocaleString("pt-BR")}</p>
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={product.priceHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getDate()}/${date.getMonth() + 1}`;
                }}
                stroke="#888"
                fontSize={12}
              />
              <YAxis stroke="#888" fontSize={12} tickFormatter={(value) => `R$ ${value}`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px"
                }}
                formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR")}`, "Preço"]}
                labelFormatter={(label) => new Date(label).toLocaleDateString("pt-BR")}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#7c3aed"
                strokeWidth={3}
                dot={{ fill: "#7c3aed", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="mt-8 p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-6">Comparar entre lojas</h2>
        <div className="space-y-3">
          {product.stores.map((store, index) => (
            <div
              key={`${store.name}-${index}`}
              className="flex flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex w-full items-center gap-3 sm:w-auto">
                {index === 0 && (
                  <Badge className="bg-green-600 whitespace-nowrap">
                    <TrendingDown className="h-3 w-3 mr-1" />
                    Melhor preço
                  </Badge>
                )}
                <span className="font-medium truncate">{store.name}</span>
              </div>
              <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-end">
                <span className="text-xl md:text-2xl font-bold whitespace-nowrap">
                  R$ {store.price.toLocaleString("pt-BR")}
                </span>
                <a href={store.url} target="_blank" rel="noreferrer">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full whitespace-nowrap sm:w-auto"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Visitar
                  </Button>
                </a>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
