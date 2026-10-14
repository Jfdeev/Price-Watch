import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HomePage } from "../../../src/pages/HomePage";

vi.mock("../../../src/services/api", () => ({
  searchProducts: vi.fn(),
  getShowcaseProducts: vi.fn(),
  listCategories: vi.fn().mockResolvedValue([]),
  lookupFavorites: vi.fn().mockResolvedValue([]),
  mapProductToCard: vi.fn((p: Record<string, unknown>) => ({
    id: p.id,
    name: p.name,
    image: "",
    currentPrice: p.price ?? 0,
    store: (p.storeName as string) ?? ""
  })),
  setAuthToken: vi.fn(),
  getCurrentUser: vi.fn()
}));

vi.mock("../../../src/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, loading: false, logout: vi.fn(), loginWithToken: vi.fn() })
}));

import { getShowcaseProducts, lookupFavorites, searchProducts } from "../../../src/services/api";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(searchProducts).mockResolvedValue({
    products: [],
    totalPages: 0,
    page: 1,
    hasNextPage: false,
    hasPreviousPage: false
  });
});

describe("HomePage", () => {
  it("renders hero section", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );
    expect(screen.getByText(/economize dinheiro/i)).toBeInTheDocument();
  });

  it("renders search input and button", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );
    expect(screen.getByPlaceholderText(/nome do produto/i)).toBeInTheDocument();
    expect(screen.getByText("Pesquisar")).toBeInTheDocument();
  });

  it("shows feedback text", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );
    expect(screen.getByText(/Digite um produto/i)).toBeInTheDocument();
  });

  it("submits search and shows results", async () => {
    vi.mocked(searchProducts).mockResolvedValue({
      products: [{ id: "p1", name: "Notebook", price: 3000, storeName: "Amazon" }],
      totalPages: 1,
      page: 1,
      hasNextPage: false,
      hasPreviousPage: false,
      totalResults: 1
    });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText(/nome do produto/i), {
      target: { value: "notebook" }
    });
    fireEvent.submit(screen.getByPlaceholderText(/nome do produto/i).closest("form")!);

    await waitFor(() => {
      expect(searchProducts).toHaveBeenCalledWith("notebook", {
        page: 1,
        limit: 8,
        category: undefined
      });
    });
    await waitFor(() => {
      expect(screen.getByText("Notebook")).toBeInTheDocument();
    });
    expect(lookupFavorites).toHaveBeenCalledWith(["p1"]);
  });

  it("shows empty message when no results", async () => {
    vi.mocked(searchProducts).mockResolvedValue({
      products: [],
      totalPages: 0,
      page: 1,
      hasNextPage: false,
      hasPreviousPage: false
    });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText(/nome do produto/i), {
      target: { value: "xyz" }
    });
    fireEvent.submit(screen.getByPlaceholderText(/nome do produto/i).closest("form")!);

    await waitFor(() => {
      expect(screen.getAllByText(/Nenhum produto encontrado/i).length).toBeGreaterThan(0);
    });
  });

  it("handles search error", async () => {
    vi.mocked(searchProducts).mockRejectedValue(new Error("fail"));

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText(/nome do produto/i), {
      target: { value: "test" }
    });
    fireEvent.submit(screen.getByPlaceholderText(/nome do produto/i).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/Não foi possível consultar/i)).toBeInTheDocument();
    });
  });

  it("rejects blank searches without calling the API", async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    fireEvent.submit(screen.getByPlaceholderText(/nome do produto/i).closest("form")!);

    expect(searchProducts).not.toHaveBeenCalled();
    expect(screen.getByText(/Digite um termo ou selecione uma categoria/i)).toBeInTheDocument();
  });

  it("loads showcase suggestions when requested", async () => {
    vi.mocked(getShowcaseProducts).mockResolvedValue({
      products: [{ id: "p1", name: "Notebook", price: 3000, storeName: "Amazon" }],
      totalPages: 1,
      page: 1,
      hasNextPage: false,
      hasPreviousPage: false,
      source: "mock",
      message: "Sugestões carregadas para você explorar."
    });
    vi.mocked(lookupFavorites).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText("Ver sugestões"));

    await waitFor(() => expect(getShowcaseProducts).toHaveBeenCalledWith({ page: 1, limit: 8 }));
    await waitFor(() => {
      expect(screen.getByText("Notebook")).toBeInTheDocument();
    });
  });

  it("shows fallback feedback when search results have no total count", async () => {
    vi.mocked(searchProducts).mockResolvedValue({
      products: [{ id: "p1", name: "Notebook", price: 3000, storeName: "Amazon" }],
      totalPages: undefined,
      page: 1,
      hasNextPage: false,
      hasPreviousPage: false
    });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText(/nome do produto/i), {
      target: { value: "notebook" }
    });
    fireEvent.submit(screen.getByPlaceholderText(/nome do produto/i).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/resultado\(s\) nesta página/i)).toBeInTheDocument();
    });
  });
});
