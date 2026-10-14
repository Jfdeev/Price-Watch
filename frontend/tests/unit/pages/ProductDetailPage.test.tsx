import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProductDetailPage } from "../../../src/pages/ProductDetailPage";

vi.mock("../../../src/services/api", () => ({
  getProduct: vi.fn(),
  listProductOffers: vi.fn().mockResolvedValue([]),
  listProductPriceHistory: vi.fn().mockResolvedValue([]),
  favoriteProduct: vi.fn(),
  deleteFavorite: vi.fn(),
  deleteProduct: vi.fn(),
  updateProduct: vi.fn(),
  getFavoriteForProduct: vi.fn().mockResolvedValue(null),
  createAlert: vi.fn(),
  setAuthToken: vi.fn(),
  getCurrentUser: vi.fn()
}));

vi.mock("../../../src/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "a@b.com", role: "ADMIN" },
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

import { getProduct, favoriteProduct } from "../../../src/services/api";
import {
  createAlert,
  deleteFavorite,
  deleteProduct,
  listProductPriceHistory,
  getFavoriteForProduct,
  updateProduct
} from "../../../src/services/api";

beforeEach(() => vi.clearAllMocks());

const mockProduct = {
  id: "p1",
  name: "Test Product",
  price: 99.9,
  imageUrl: "https://example.com/img.jpg",
  productUrl: "https://example.com/product",
  storeName: "Amazon",
  category: "Eletrônicos",
  priceHistory: []
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/product/p1"]}>
      <Routes>
        <Route path="/product/:id" element={<ProductDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProductDetailPage", () => {
  it("renders product details", async () => {
    vi.mocked(getProduct).mockResolvedValue(mockProduct);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Test Product")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Amazon").length).toBeGreaterThan(0);
  });

  it("shows loading state", () => {
    vi.mocked(getProduct).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/Carregando produto/i)).toBeInTheDocument();
  });

  it("shows not found when product is null", async () => {
    vi.mocked(getProduct).mockResolvedValue(null);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Produto não encontrado")).toBeInTheDocument();
    });
  });

  it("shows not found on error", async () => {
    vi.mocked(getProduct).mockRejectedValue(new Error("404"));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Produto não encontrado")).toBeInTheDocument();
    });
  });

  it("toggles favorite", async () => {
    vi.mocked(getProduct).mockResolvedValue(mockProduct);
    vi.mocked(favoriteProduct).mockResolvedValue({ id: "f1" });
    renderPage();

    await waitFor(() => expect(screen.getByText("Test Product")).toBeInTheDocument());

    const favBtn = screen.getByText(/Favoritar/i);
    if (favBtn) {
      fireEvent.click(favBtn);
      await waitFor(() => expect(favoriteProduct).toHaveBeenCalledWith("p1"));
    }
  });

  it("removes an existing favorite", async () => {
    vi.mocked(getProduct).mockResolvedValue(mockProduct);
    vi.mocked(getFavoriteForProduct).mockResolvedValue({ id: "fav-1", productId: "p1" });
    vi.mocked(deleteFavorite).mockResolvedValue(undefined as never);
    renderPage();

    await waitFor(() => expect(screen.getByText("Test Product")).toBeInTheDocument());

    fireEvent.click(screen.getByText(/Favoritado/i));

    await waitFor(() => expect(deleteFavorite).toHaveBeenCalledWith("fav-1"));
    expect(getFavoriteForProduct).toHaveBeenCalledWith("p1");
  });

  it("creates a price alert for the current user", async () => {
    vi.mocked(getProduct).mockResolvedValue(mockProduct);
    vi.mocked(createAlert).mockResolvedValue({ id: "alert-1" } as never);
    renderPage();

    await waitFor(() => expect(screen.getByText("Test Product")).toBeInTheDocument());

    fireEvent.click(screen.getByText(/Criar alerta de preço/i));

    await waitFor(() =>
      expect(screen.getByLabelText("Preço que você quer pagar")).toBeInTheDocument()
    );
    fireEvent.change(screen.getByLabelText("Preço que você quer pagar"), {
      target: { value: "99.9" }
    });
    fireEvent.click(screen.getByText("Salvar alerta"));

    await waitFor(() => expect(createAlert).toHaveBeenCalledWith("p1", 99.9, "a@b.com"));
  });

  it("rejects invalid update prices before sending the request", async () => {
    vi.mocked(getProduct).mockResolvedValue(mockProduct);
    renderPage();

    await waitFor(() => expect(screen.getByText("Test Product")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Editar produto"));
    fireEvent.change(screen.getByLabelText("Preco"), { target: { value: "0" } });
    fireEvent.click(screen.getByText("Salvar alteracoes"));

    expect(updateProduct).not.toHaveBeenCalled();
  });

  it("deletes the product and navigates away", async () => {
    vi.mocked(getProduct).mockResolvedValue(mockProduct);
    vi.mocked(deleteProduct).mockResolvedValue(undefined as never);
    renderPage();

    await waitFor(() => expect(screen.getByText("Test Product")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Excluir produto"));

    await waitFor(() => expect(deleteProduct).toHaveBeenCalledWith("p1"));
  });

  it("renders price history chart", async () => {
    vi.mocked(getProduct).mockResolvedValue(mockProduct);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Test Product")).toBeInTheDocument();
    });
    expect(screen.getByText(/Histórico/i)).toBeInTheDocument();
  });

  it("shows min and max from a single history change", async () => {
    vi.mocked(getProduct).mockResolvedValue({ ...mockProduct, price: 100 });
    vi.mocked(listProductPriceHistory).mockResolvedValue([
      {
        id: "h1",
        oldPrice: 120,
        newPrice: 100,
        capturedAt: "2026-06-02T10:00:00.000Z"
      }
    ] as never);

    renderPage();

    await waitFor(() => expect(screen.getByText("Test Product")).toBeInTheDocument());

    const lowestSummary = screen.getByText(/Menor preço/i).parentElement;
    const highestSummary = screen.getByText(/Maior preço/i).parentElement;

    expect(lowestSummary).toHaveTextContent("R$ 100");
    expect(highestSummary).toHaveTextContent("R$ 120");
  });
});
