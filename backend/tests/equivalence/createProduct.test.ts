import { describe, expect, it } from "vitest";
import { prisma } from "../../src/prisma/client";
import { createProduct, type CreateProductInput } from "../../src/services/productService";
import { createProduct as legacyCreateProduct } from "../../bench/legacy/productService";
import { resetDatabase, seedProducts, snapshotDatabase } from "../../bench/support/database";
import { setupFakeSerpApi } from "./support";

setupFakeSerpApi();

type StoreSeed = { name: string; owner: "u1" | "u2" | null; isActive: boolean };

type Scenario = {
  stores: StoreSeed[];
  categories?: Array<{ name: string; isActive: boolean }>;
  existingUrls?: string[];
  input: Omit<CreateProductInput, "ownerUserId"> & { ownerUserId?: string };
};

async function seed(scenario: Scenario) {
  await resetDatabase();
  await prisma.user.createMany({
    data: [
      { id: "u1", email: "u1@test.local", password: "x" },
      { id: "u2", email: "u2@test.local", password: "x" }
    ]
  });
  await prisma.store.createMany({
    data: scenario.stores.map((store, index) => ({
      name: store.name,
      website: `https://loja${index}.test`,
      contactEmail: `loja${index}@test.local`,
      userId: store.owner,
      isActive: store.isActive
    }))
  });
  await prisma.category.createMany({
    data: (scenario.categories ?? []).map((category) => ({ ...category, description: "d" }))
  });
  await seedProducts(
    (scenario.existingUrls ?? []).map((productUrl, index) => ({
      externalId: `existente-${index}`,
      name: "Existente",
      price: 1,
      productUrl,
      createdAt: new Date(Date.UTC(2026, 0, 1))
    }))
  );
}

async function run(scenario: Scenario, create: typeof createProduct) {
  await seed(scenario);
  let outcome: unknown;
  try {
    const product = await create({ ownerUserId: "u1", ...scenario.input });
    outcome = {
      ok: { ...product, id: "gerado", externalId: product.externalId.startsWith("manual-") }
    };
  } catch (error) {
    outcome = { error: (error as Error).message };
  }
  const snapshot = await snapshotDatabase();
  return {
    outcome,
    products: snapshot.products.map((product) => ({
      ...product,
      externalId: String(product.externalId).startsWith("manual-") ? "manual" : product.externalId
    }))
  };
}

const ACTIVE_U1: StoreSeed = { name: "Loja Azul", owner: "u1", isActive: true };

const SCENARIOS: Array<[string, Scenario]> = [
  [
    "nenhuma loja ativa",
    {
      stores: [{ ...ACTIVE_U1, isActive: false }],
      input: { name: "P", price: 1, storeName: "Loja Azul" }
    }
  ],
  ["sem lojas", { stores: [], input: { name: "P", price: 1, storeName: "Loja Azul" } }],
  ["loja vazia", { stores: [ACTIVE_U1], input: { name: "P", price: 1, storeName: "   " } }],
  ["loja ausente", { stores: [ACTIVE_U1], input: { name: "P", price: 1 } }],
  [
    "loja inexistente",
    { stores: [ACTIVE_U1], input: { name: "P", price: 1, storeName: "Loja Verde" } }
  ],
  [
    "loja inativa com o mesmo nome",
    {
      stores: [ACTIVE_U1, { name: "Loja Verde", owner: "u1", isActive: false }],
      input: { name: "P", price: 1, storeName: "Loja Verde" }
    }
  ],
  [
    "caixa diferente",
    { stores: [ACTIVE_U1], input: { name: "P", price: 1, storeName: "  lOJA aZUL " } }
  ],
  [
    "acentos pt-BR",
    {
      stores: [{ name: "Ótica São João", owner: "u1", isActive: true }],
      input: { name: "P", price: 1, storeName: "ótica são joão" }
    }
  ],
  [
    "acentos com caixa alta",
    {
      stores: [{ name: "ÇÃO ÊXITO", owner: "u1", isActive: true }],
      input: { name: "P", price: 1, storeName: "ção êxito" }
    }
  ],
  [
    "loja de outro usuário",
    {
      stores: [{ ...ACTIVE_U1, owner: "u2" }],
      input: { name: "P", price: 1, storeName: "Loja Azul" }
    }
  ],
  [
    "loja sem dono",
    {
      stores: [{ ...ACTIVE_U1, owner: null }],
      input: { name: "P", price: 1, storeName: "Loja Azul" }
    }
  ],
  [
    "mesmo nome em dois donos",
    {
      stores: [{ ...ACTIVE_U1, owner: "u2" }, ACTIVE_U1],
      input: { name: "P", price: 1, storeName: "loja azul" }
    }
  ],
  ["curinga do ILIKE", { stores: [ACTIVE_U1], input: { name: "P", price: 1, storeName: "%" } }],
  [
    "curinga que casa com outra loja do usuário",
    {
      stores: [
        { name: "Loja_1", owner: "u2", isActive: true },
        { name: "LojaX1", owner: "u1", isActive: true }
      ],
      input: { name: "P", price: 1, storeName: "Loja_1" }
    }
  ],
  [
    "curinga com loja exata do próprio usuário",
    {
      stores: [
        { name: "Loja_1", owner: "u1", isActive: true },
        { name: "LojaX1", owner: "u2", isActive: true }
      ],
      input: { name: "P", price: 1, storeName: "loja_1" }
    }
  ],
  [
    "barra invertida no nome sem loja casando pelo ILIKE",
    {
      stores: [{ name: String.raw`Loja\Azul`, owner: "u1", isActive: true }],
      input: { name: "P", price: 1, storeName: String.raw`loja\azul` }
    }
  ],
  [
    "barra invertida que escapa um curinga",
    {
      stores: [
        { name: String.raw`Loja\%`, owner: "u2", isActive: true },
        { name: "Loja%", owner: "u1", isActive: true }
      ],
      input: { name: "P", price: 1, storeName: String.raw`LOJA\%` }
    }
  ],
  [
    "nome armazenado com espaços",
    {
      stores: [{ name: " Loja Azul ", owner: "u1", isActive: true }],
      input: { name: "P", price: 1, storeName: "Loja Azul" }
    }
  ],
  [
    "categoria inativa",
    {
      stores: [ACTIVE_U1],
      categories: [{ name: "TV", isActive: false }],
      input: { name: "P", price: 1, storeName: "Loja Azul", category: "tv" }
    }
  ],
  [
    "categoria válida",
    {
      stores: [ACTIVE_U1],
      categories: [{ name: "TV", isActive: true }],
      input: { name: "P", price: 1, storeName: "Loja Azul", category: " tv " }
    }
  ],
  [
    "URL duplicada",
    {
      stores: [ACTIVE_U1],
      existingUrls: ["https://loja.test/p"],
      input: { name: "P", price: 1, storeName: "Loja Azul", productUrl: " https://loja.test/p " }
    }
  ],
  [
    "sucesso completo",
    {
      stores: [ACTIVE_U1, { name: "Outra", owner: "u2", isActive: true }],
      input: {
        name: "  Produto  ",
        price: 19.9,
        storeName: "Loja Azul",
        productUrl: "https://loja.test/novo",
        imageUrl: " https://img.test/a.png "
      }
    }
  ],
  ["nome vazio", { stores: [ACTIVE_U1], input: { name: "  ", price: 1, storeName: "Loja Azul" } }],
  [
    "preço inválido",
    { stores: [ACTIVE_U1], input: { name: "P", price: 0, storeName: "Loja Azul" } }
  ]
];

describe("createProduct equivale à versão original (F3)", () => {
  for (const [name, scenario] of SCENARIOS) {
    it(name, async () => {
      const before = await run(scenario, legacyCreateProduct);
      const after = await run(scenario, createProduct);
      expect(after).toEqual(before);
    });
  }

  it("aceita lojas com muitos homônimos inativos", async () => {
    const stores: StoreSeed[] = Array.from({ length: 300 }, (_, index) => ({
      name: index % 2 === 0 ? "Loja Azul" : `Loja ${index}`,
      owner: index % 3 === 0 ? "u2" : "u1",
      isActive: index === 299
    }));
    const scenario: Scenario = { stores, input: { name: "P", price: 1, storeName: "LOJA 299" } };
    expect(await run(scenario, createProduct)).toEqual(await run(scenario, legacyCreateProduct));
  });
});
