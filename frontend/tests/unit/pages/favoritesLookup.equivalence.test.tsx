import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HomePage } from "../../../src/pages/HomePage";
import { ProductDetailPage } from "../../../src/pages/ProductDetailPage";

type StoredFavorite = { id: string; product: { id: string } };

const backend = vi.hoisted(() => ({
  favorites: [] as StoredFavorite[],
  failure: null as Error | null
}));

function readFavorites() {
  if (backend.failure) {
    return Promise.reject(backend.failure);
  }
  return Promise.resolve(backend.favorites);
}

vi.mock("../../../src/services/api", () => ({
  searchProducts: vi.fn(),
  getShowcaseProducts: vi.fn(),
  listCategories: vi.fn().mockResolvedValue([]),
  getProduct: vi.fn(),
  listProductOffers: vi.fn().mockResolvedValue([]),
  listProductPriceHistory: vi.fn().mockResolvedValue([]),
  favoriteProduct: vi.fn(),
  deleteFavorite: vi.fn().mockResolvedValue(undefined),
  deleteProduct: vi.fn(),
  updateProduct: vi.fn(),
  createAlert: vi.fn(),
  setAuthToken: vi.fn(),
  getCurrentUser: vi.fn(),
  mapProductToCard: vi.fn((product: { id: string; name: string }) => ({
    id: product.id,
    name: product.name,
    image: "",
    currentPrice: 0,
    store: ""
  })),
  listFavorites: vi.fn(() => readFavorites()),
  lookupFavorites: vi.fn((productIds: string[]) =>
    readFavorites().then((favorites) =>
      favorites
        .filter((favorite) => productIds.includes(favorite.product.id))
        .map((favorite) => ({ id: favorite.id, productId: favorite.product.id }))
    )
  ),
  getFavoriteForProduct: vi.fn((productId: string) =>
    readFavorites().then((favorites) => {
      const match = favorites.find((favorite) => favorite.product.id === productId);
      return match ? { id: match.id, productId } : null;
    })
  )
}));

vi.mock("../../../src/components/ProductCard", () => ({
  ProductCard: (props: { id: string; isFavorite?: boolean; favoriteId?: string }) => (
    <div
      data-testid="card"
      data-id={props.id}
      data-favorite={String(Boolean(props.isFavorite))}
      data-favorite-id={props.favoriteId ?? ""}
    />
  )
}));

vi.mock("../../../src/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "a@b.com", role: "USER" },
    loading: false,
    logout: vi.fn(),
    loginWithToken: vi.fn()
  })
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />
}));

import {
  deleteFavorite,
  getProduct,
  getShowcaseProducts,
  searchProducts
} from "../../../src/services/api";

const pageProducts = Array.from({ length: 10 }, (_, index) => ({
  id: `p${index}`,
  externalId: `e${index}`,
  name: `Produto ${index}`,
  price: 10 + index
}));

const otherFavorites = Array.from({ length: 30 }, (_, index) => ({
  id: `fav-other-${index}`,
  product: { id: `other-${index}` }
}));

function pageResult() {
  return {
    source: "serpapi",
    products: pageProducts,
    page: 1,
    limit: 8,
    hasNextPage: true,
    hasPreviousPage: false,
    totalResults: 10,
    totalPages: 2
  };
}

function readCards() {
  return screen.getAllByTestId("card").map((card) => ({
    id: card.getAttribute("data-id"),
    favorite: card.getAttribute("data-favorite"),
    favoriteId: card.getAttribute("data-favorite-id")
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  backend.failure = null;
  backend.favorites = [
    ...otherFavorites,
    { id: "fav-p1", product: { id: "p1" } },
    { id: "fav-p6", product: { id: "p6" } },
    { id: "fav-p9", product: { id: "p9" } }
  ];
  vi.mocked(searchProducts).mockResolvedValue(pageResult() as never);
  vi.mocked(getShowcaseProducts).mockResolvedValue({ ...pageResult(), source: "mock" } as never);
});

function renderHome() {
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  );
}

async function submitSearch() {
  fireEvent.change(screen.getByPlaceholderText(/nome do produto/i), {
    target: { value: "notebook" }
  });
  fireEvent.submit(screen.getByPlaceholderText(/nome do produto/i).closest("form")!);
  await waitFor(() => expect(screen.getAllByTestId("card")).toHaveLength(8));
}

const expectedCards = pageProducts.slice(0, 8).map((product) => ({
  id: product.id,
  favorite: String(product.id === "p1" || product.id === "p6"),
  favoriteId: product.id === "p1" ? "fav-p1" : product.id === "p6" ? "fav-p6" : ""
}));

describe("favoritos da página de busca (F5)", () => {
  it("marca apenas os favoritos dos 8 primeiros produtos na busca", async () => {
    renderHome();
    await submitSearch();
    expect(readCards()).toEqual(expectedCards);
  });

  it("segue sem favoritos quando a consulta de favoritos falha na busca", async () => {
    backend.failure = new Error("Unauthorized");
    renderHome();
    await submitSearch();
    expect(readCards()).toEqual(
      expectedCards.map((card) => ({ ...card, favorite: "false", favoriteId: "" }))
    );
    expect(screen.getByText("Mostrando 10 de 10 resultados.")).toBeInTheDocument();
  });

  it("marca os favoritos da vitrine", async () => {
    renderHome();
    fireEvent.click(screen.getByText("Ver sugestões"));
    await waitFor(() => expect(screen.getAllByTestId("card")).toHaveLength(8));
    expect(readCards()).toEqual(expectedCards);
  });

  it("derruba a vitrine inteira quando a consulta de favoritos falha", async () => {
    backend.failure = new Error("Unauthorized");
    renderHome();
    fireEvent.click(screen.getByText("Ver sugestões"));
    await waitFor(() =>
      expect(
        screen.getByText("Não foi possível carregar os resultados agora. Tente novamente.")
      ).toBeInTheDocument()
    );
    expect(screen.queryAllByTestId("card")).toHaveLength(0);
  });

  it("derruba a vitrine mesmo quando ela vem vazia e a consulta falha", async () => {
    backend.failure = new Error("Unauthorized");
    vi.mocked(getShowcaseProducts).mockResolvedValue({
      ...pageResult(),
      products: [],
      source: "mock"
    } as never);
    renderHome();
    fireEvent.click(screen.getByText("Ver sugestões"));
    await waitFor(() =>
      expect(
        screen.getByText("Não foi possível carregar os resultados agora. Tente novamente.")
      ).toBeInTheDocument()
    );
  });
});

function renderDetail() {
  render(
    <MemoryRouter initialEntries={["/products/p6"]}>
      <Routes>
        <Route path="/products/:id" element={<ProductDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("favorito da página de detalhe (F4)", () => {
  beforeEach(() => {
    vi.mocked(getProduct).mockResolvedValue({
      id: "p6",
      externalId: "e6",
      name: "Produto 6",
      price: 16
    } as never);
  });

  it("mostra o produto como favoritado e remove pelo id correto", async () => {
    renderDetail();
    await waitFor(() => expect(screen.getByText("Favoritado")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Favoritado"));
    await waitFor(() => expect(deleteFavorite).toHaveBeenCalledWith("fav-p6"));
  });

  it("mostra o produto como não favoritado quando ele não está na lista", async () => {
    backend.favorites = otherFavorites;
    renderDetail();
    await waitFor(() => expect(screen.getByText("Produto 6")).toBeInTheDocument());
    expect(screen.getByText("Favoritar")).toBeInTheDocument();
  });

  it("mostra o produto como não favoritado quando a consulta falha", async () => {
    backend.failure = new Error("Unauthorized");
    renderDetail();
    await waitFor(() => expect(screen.getByText("Produto 6")).toBeInTheDocument());
    expect(screen.getByText("Favoritar")).toBeInTheDocument();
  });
});
