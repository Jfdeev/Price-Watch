import { Bell, Search, Shield, TrendingUp, User, Heart, BarChart3 } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ProductCard, type ProductCardProps } from "../components/ProductCard";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  getShowcaseProducts,
  listCategories,
  lookupFavorites,
  mapProductToCard,
  searchProducts,
  type CategoryRecord,
  type Product
} from "../services/api";

const SEARCH_PAGE_SIZE = 8;

function buildPageButtons(page: number, totalPages?: number): number[] {
  if (!totalPages) {
    const buttons = new Set<number>();
    buttons.add(1);
    buttons.add(page);
    if (page > 1) buttons.add(page - 1);
    buttons.add(page + 1);
    buttons.add(page + 2);
    return Array.from(buttons)
      .filter((value) => value > 0)
      .sort((a, b) => a - b);
  }

  if (totalPages <= 8) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const buttons = new Set<number>();
  buttons.add(1);
  buttons.add(2);
  buttons.add(totalPages - 1);
  buttons.add(totalPages);

  for (let delta = -2; delta <= 2; delta += 1) {
    const candidate = page + delta;
    if (candidate > 2 && candidate < totalPages - 1) {
      buttons.add(candidate);
    }
  }

  return Array.from(buttons).sort((a, b) => a - b);
}

function buildFeedbackMessage(result: { products: Product[]; totalResults?: number }) {
  if (result.products.length === 0) {
    return "Nenhum produto encontrado para essa busca.";
  }
  if (result.totalResults) {
    return `Mostrando ${result.products.length} de ${result.totalResults} resultados.`;
  }
  return `Mostrando ${result.products.length} resultado(s) nesta página.`;
}

export function HomePage() {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [products, setProducts] = useState<ProductCardProps[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [feedback, setFeedback] = useState("Digite um produto para começar a busca.");
  const resultsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [pageButtons, setPageButtons] = useState<number[]>([]);
  const canPaginate =
    hasSearched && (hasNextPage || hasPreviousPage || products.length >= SEARCH_PAGE_SIZE);
  const categoryLabel = selectedCategory ? ` na categoria "${selectedCategory}"` : "";
  const searchResultsMessage = `Resultados${categoryLabel} para "${submittedQuery}" exibidos abaixo.`;
  const defaultResultsMessage = "Digite um termo para ver produtos reais da busca integrada.";
  const paginationTotalLabel = totalPages ? ` de ${String(totalPages)}` : "";
  const paginationMessage = `Página ${String(currentPage)}${paginationTotalLabel} para "${submittedQuery}"`;

  useEffect(() => {
    void listCategories()
      .then((records) => setCategories(records.filter((item) => item.isActive)))
      .catch(() => setCategories([]));
  }, []);

  async function fetchFavoritesByProduct(resultProducts: Product[]) {
    const pageProductIds = resultProducts.slice(0, SEARCH_PAGE_SIZE).map((product) => product.id);
    const favorites = await lookupFavorites(pageProductIds);
    return new Map(favorites.map((item) => [item.productId, item.id]));
  }

  function normalizeProducts(resultProducts: Product[], favoritesByProduct: Map<string, string>) {
    return resultProducts.slice(0, SEARCH_PAGE_SIZE).map((product) => ({
      ...mapProductToCard(product),
      isFavorite: favoritesByProduct.has(product.id),
      favoriteId: favoritesByProduct.get(product.id)
    }));
  }

  async function loadSearchResults(searchQuery: string, page: number) {
    setIsLoading(true);

    try {
      const result = await searchProducts(searchQuery, {
        page,
        limit: SEARCH_PAGE_SIZE,
        category: selectedCategory || undefined
      });
      let favoritesByProduct = new Map<string, string>();

      try {
        favoritesByProduct = await fetchFavoritesByProduct(result.products);
      } catch {
        favoritesByProduct = new Map();
      }

      setProducts(normalizeProducts(result.products, favoritesByProduct));
      setSubmittedQuery(searchQuery);
      setCurrentPage(result.page);
      const pageCount = result.totalPages ?? null;
      setTotalPages(pageCount);
      setPageButtons(buildPageButtons(result.page, pageCount ?? undefined));
      setHasNextPage(result.hasNextPage || result.products.length >= SEARCH_PAGE_SIZE);
      setHasPreviousPage(result.page > 1 || result.hasPreviousPage);
      setHasSearched(true);
      const feedbackMessage = result.message ?? buildFeedbackMessage(result);
      setFeedback(feedbackMessage);
    } catch {
      setProducts([]);
      setFeedback("Não foi possível consultar a API agora. Tente novamente em instantes.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery && !selectedCategory) {
      setFeedback("Digite um termo ou selecione uma categoria para pesquisar.");
      setProducts([]);
      setHasSearched(false);
      return;
    }
    setFeedback("Buscando preços reais na web...");
    await loadSearchResults(trimmedQuery, 1);

    globalThis.setTimeout(() => {
      resultsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 80);
  }

  async function loadShowcase() {
    setIsLoading(true);

    try {
      const result = await getShowcaseProducts({
        page: 1,
        limit: SEARCH_PAGE_SIZE
      });
      const favoritesByProduct = await fetchFavoritesByProduct(result.products);

      setProducts(normalizeProducts(result.products, favoritesByProduct));
      setSubmittedQuery("");
      setCurrentPage(result.page);
      const pageCount = result.totalPages ?? null;
      setTotalPages(pageCount);
      setPageButtons(buildPageButtons(result.page, pageCount ?? undefined));
      setHasNextPage(result.hasNextPage || result.products.length >= SEARCH_PAGE_SIZE);
      setHasPreviousPage(result.page > 1 || result.hasPreviousPage);
      setHasSearched(false);
      setFeedback(
        result.message ??
          (result.products.length > 0
            ? "Sugestões carregadas para você explorar."
            : "Nenhuma sugestão disponível no momento.")
      );
    } catch {
      setFeedback("Não foi possível carregar os resultados agora. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePageChange(nextPage: number) {
    if (!submittedQuery || isLoading) {
      return;
    }

    await loadSearchResults(submittedQuery, nextPage);
    globalThis.setTimeout(() => {
      resultsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 80);
  }

  function handleFavoriteRemoved(favoriteId: string) {
    setProducts((prev) =>
      prev.map((product) =>
        product.favoriteId === favoriteId
          ? { ...product, isFavorite: false, favoriteId: undefined }
          : product
      )
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <section className="container px-4 py-12 sm:py-16 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-3xl space-y-6 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-6xl">
            {"Monitore preços e "}
            <span className="block bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
              economize dinheiro
            </span>
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg lg:text-xl">
            Pesquise um produto, abra os detalhes e salve o que quiser acompanhar depois.
          </p>

          <form
            onSubmit={handleSearch}
            className="mx-auto mt-8 flex max-w-3xl flex-col gap-3 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Digite o nome do produto ou cole o link da loja"
                className="h-14 pl-12 text-base shadow-lg border-gray-200"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="h-14 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700"
              aria-label="Filtrar por categoria"
            >
              <option value="">Todas as categorias</option>
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
            <Button
              type="submit"
              size="lg"
              className="h-14 w-full bg-violet-600 hover:bg-violet-700 sm:w-auto sm:px-8"
              disabled={isLoading || (query.trim().length === 0 && !selectedCategory)}
            >
              {isLoading ? "Buscando" : "Pesquisar"}
            </Button>
          </form>
          <p className="text-sm text-muted-foreground">{feedback}</p>
        </div>

        <div
          ref={resultsRef}
          className="mx-auto mt-10 w-full max-w-6xl space-y-6 rounded-2xl border bg-white/80 p-4 shadow-sm backdrop-blur sm:p-6"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                {hasSearched ? "Resultados da busca" : "Comece sua busca"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasSearched ? searchResultsMessage : defaultResultsMessage}
              </p>
            </div>
            <Button
              className="w-full sm:w-auto"
              variant="outline"
              onClick={() => void loadShowcase()}
            >
              Ver sugestões
            </Button>
          </div>

          {products.length === 0 && hasSearched ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhum produto encontrado para essa busca.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  {...product}
                  onFavoriteRemoved={handleFavoriteRemoved}
                />
              ))}
            </div>
          )}

          {canPaginate && (
            <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:flex-row">
              <p className="text-sm text-muted-foreground">{paginationMessage}</p>
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
                <Button
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  onClick={() => void handlePageChange(currentPage - 1)}
                  disabled={(currentPage <= 1 && !hasPreviousPage) || isLoading}
                >
                  Anterior
                </Button>
                {pageButtons.length > 0
                  ? pageButtons.map((page) => (
                      <Button
                        key={page}
                        variant={page === currentPage ? "secondary" : "outline"}
                        className={page === currentPage ? "bg-violet-600 text-white" : ""}
                        onClick={() => void handlePageChange(page)}
                        disabled={isLoading || page === currentPage}
                      >
                        {page}
                      </Button>
                    ))
                  : null}
                <Button
                  className="flex-1 bg-violet-600 hover:bg-violet-700 sm:flex-none"
                  onClick={() => void handlePageChange(currentPage + 1)}
                  disabled={(products.length < SEARCH_PAGE_SIZE && !hasNextPage) || isLoading}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="container px-4 pb-8 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Link
            to="/dashboard"
            className="group rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Fluxo principal</p>
                <h3 className="mt-1 text-lg font-semibold">Painel</h3>
              </div>
              <BarChart3 className="h-5 w-5 text-violet-600" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Veja seus favoritos, histórico e alertas em um só lugar.
            </p>
          </Link>

          <Link
            to="/favorites"
            className="group rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Lista pessoal</p>
                <h3 className="mt-1 text-lg font-semibold">Favoritos</h3>
              </div>
              <Heart className="h-5 w-5 text-violet-600" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Revise os produtos que você quer acompanhar depois.
            </p>
          </Link>

          <Link
            to="/alerts"
            className="group rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Avisos</p>
                <h3 className="mt-1 text-lg font-semibold">Alertas</h3>
              </div>
              <Bell className="h-5 w-5 text-violet-600" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Crie e ajuste os limites de preço dos produtos monitorados.
            </p>
          </Link>

          <Link
            to="/profile"
            className="group rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Sua conta</p>
                <h3 className="mt-1 text-lg font-semibold">Perfil</h3>
              </div>
              <User className="h-5 w-5 text-violet-600" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Atualize seus dados e encontre os atalhos do app.
            </p>
          </Link>
        </div>
      </section>

      <section className="container border-y bg-white px-4 py-16 lg:px-8">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
          <div className="space-y-3 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-violet-100">
              <TrendingUp className="h-6 w-6 text-violet-600" />
            </div>
            <h3 className="font-semibold">Histórico</h3>
            <p className="text-sm text-muted-foreground">
              Veja como o preço mudou ao longo do tempo.
            </p>
          </div>
          <div className="space-y-3 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-violet-100">
              <Bell className="h-6 w-6 text-violet-600" />
            </div>
            <h3 className="font-semibold">Alertas</h3>
            <p className="text-sm text-muted-foreground">
              Receba um aviso quando o preço chegar ao valor que você definiu.
            </p>
          </div>
          <div className="space-y-3 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-violet-100">
              <Shield className="h-6 w-6 text-violet-600" />
            </div>
            <h3 className="font-semibold">100% Gratuito</h3>
            <p className="text-sm text-muted-foreground">
              Acompanhe quantos produtos quiser sem custo.
            </p>
          </div>
        </div>
      </section>

      <section className="container px-4 py-16 lg:px-8">
        <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 p-6 text-center text-white sm:p-8 lg:p-12">
          <h2 className="mb-4 text-2xl font-bold sm:text-3xl lg:text-4xl">
            Pronto para economizar?
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-base text-violet-100 sm:text-lg">
            Comece agora e acompanhe os produtos que mais importam para você.
          </p>
          <Button
            size="lg"
            variant="secondary"
            className="w-full bg-white text-violet-600 hover:bg-gray-100 sm:w-auto"
            onClick={() => navigate("/alerts")}
          >
            Criar meu alerta
          </Button>
        </div>
      </section>
    </div>
  );
}
