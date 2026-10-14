import type { SeedProduct } from "./database";
import type { SerpItem, SerpResponse } from "./fakeSerpApi";
import { createRandom, pick, randomInt, randomPrice, type Random } from "./random";

export const SEARCH_QUERY = "notebook";
export const BASE_TIME = Date.UTC(2026, 0, 1);

export type SearchScenarioOptions = {
  matchingLocals: number;
  otherLocals: number;
  deletedProducts: number;
  serpItems: number;
  overlapRate: number;
  deletedHitRate: number;
  manualRate: number;
  duplicateRate: number;
  newMatchingItems: number;
  totalResults?: number;
  nextLink: boolean;
};

export type SearchScenario = {
  products: SeedProduct[];
  serp: SerpResponse;
};

function productUrl(random: Random, id: string): string {
  return `https://loja${randomInt(random, 1, 5)}.com.br/produto/${id}?ref=${randomInt(random, 1, 3)}`;
}

function urlVariant(random: Random, url: string): string {
  const variants = [url, url.toUpperCase().replace("HTTPS://", "https://"), `${url}#detalhes`];
  return pick(random, variants);
}

function seedHistory(random: Random, price: number, createdAt: number) {
  const count = randomInt(random, 0, 2);
  return Array.from({ length: count }, (_, index) => ({
    oldPrice: randomPrice(random),
    newPrice: index === count - 1 ? price : randomPrice(random),
    capturedAt: new Date(createdAt + (index + 1) * 60_000)
  }));
}

export function generateSearchScenario(
  seed: number,
  options: SearchScenarioOptions
): SearchScenario {
  const random = createRandom(seed);
  const products: SeedProduct[] = [];
  let clock = BASE_TIME;
  const nextCreatedAt = () => {
    clock -= randomInt(random, 1, 5) * 1_000;
    return clock;
  };

  for (let index = 0; index < options.matchingLocals; index += 1) {
    const externalId = `local-match-${index}`;
    const price = randomPrice(random);
    const createdAt = nextCreatedAt();
    const byCategory = random() < 0.2;
    products.push({
      externalId,
      name: byCategory ? `Computador ${index}` : `Notebook Modelo ${index}`,
      category: byCategory ? "Notebook gamer" : pick(random, [null, "Informatica"]),
      price,
      productUrl: random() < 0.8 ? productUrl(random, externalId) : null,
      imageUrl: random() < 0.5 ? `https://img.test/${externalId}.jpg` : null,
      storeName: pick(random, ["Loja A", "Loja B", null]),
      isManual: random() < options.manualRate,
      createdAt: new Date(createdAt),
      history: seedHistory(random, price, createdAt)
    });
  }

  for (let index = 0; index < options.otherLocals; index += 1) {
    const externalId = `local-other-${index}`;
    const price = randomPrice(random);
    const createdAt = nextCreatedAt();
    products.push({
      externalId,
      name: `Mouse ${index}`,
      price,
      productUrl: productUrl(random, externalId),
      isManual: random() < options.manualRate,
      createdAt: new Date(createdAt)
    });
  }

  for (let index = 0; index < options.deletedProducts; index += 1) {
    const externalId = `deleted-${index}`;
    products.push({
      externalId,
      name: pick(random, [`Notebook Removido ${index}`, `Teclado ${index}`]),
      price: randomPrice(random),
      productUrl: random() < 0.9 ? productUrl(random, externalId) : "",
      isDeleted: true,
      createdAt: new Date(nextCreatedAt())
    });
  }

  const deleted = products.filter((product) => product.isDeleted && product.productUrl);
  const available = products.filter((product) => !product.isDeleted);
  const items: SerpItem[] = [];

  for (let index = 0; index < options.serpItems; index += 1) {
    const roll = random();
    let externalId = `serp-${index}`;
    let link: string | undefined = productUrl(random, externalId);
    let title = `Acessorio ${index}`;
    let overlaps = false;

    if (roll < options.overlapRate && available.length > 0) {
      overlaps = true;
      const target = available.splice(randomInt(random, 0, available.length - 1), 1)[0];
      externalId = target.externalId;
      title = random() < 0.5 ? target.name : `Notebook Atualizado ${index}`;
      link = target.productUrl ?? undefined;
    } else if (roll < options.overlapRate + options.deletedHitRate && deleted.length > 0) {
      link = urlVariant(random, pick(random, deleted).productUrl as string);
    } else if (index < options.newMatchingItems) {
      title = `Notebook Novo ${index}`;
    }

    const price = randomPrice(random);
    const item: SerpItem = {
      title,
      product_id: random() < 0.95 ? externalId : undefined,
      source: pick(random, ["Loja A", "Loja C", undefined]),
      extracted_price: price,
      thumbnail: random() < 0.7 ? `https://img.test/${externalId}.png` : undefined
    };
    if (random() < 0.85) {
      item.link = link;
    } else if (random() < 0.5) {
      item.product_link = link;
    }
    if (random() < 0.3) {
      item.extracted_old_price = Math.round(price * 1.2 * 100) / 100;
    }
    if (item.product_id === undefined) {
      item.title = `${title} sem id ${index}`;
    }
    items.push(item);
    if (!overlaps && random() < options.duplicateRate) {
      items.push({ ...item });
    }
  }

  return {
    products,
    serp: {
      shopping_results: items,
      serpapi_pagination: options.nextLink ? { next_link: "https://serpapi.test/next" } : undefined,
      search_information:
        options.totalResults === undefined ? undefined : { total_results: options.totalResults }
    }
  };
}

export type UpsertProductInput = {
  id: string;
  externalId: string;
  name: string;
  price: number;
  originalPrice?: number;
  priceChange?: number;
  imageUrl?: string;
  productUrl?: string;
  storeName?: string;
  category?: string;
};

export type UpsertScenario = {
  products: SeedProduct[];
  input: UpsertProductInput[];
};

export type UpsertScenarioOptions = {
  existing: number;
  incoming: number;
  existingRate: number;
  duplicateRate: number;
  samePriceRate: number;
};

export function generateUpsertScenario(
  seed: number,
  options: UpsertScenarioOptions
): UpsertScenario {
  const random = createRandom(seed);
  const products: SeedProduct[] = Array.from({ length: options.existing }, (_, index) => {
    const roll = random();
    const externalId = `existing-${index}`;
    return {
      externalId,
      name: `Produto existente ${index}`,
      price: randomPrice(random),
      imageUrl: random() < 0.5 ? `https://img.test/${externalId}.jpg` : null,
      productUrl: random() < 0.7 ? `https://loja.test/${externalId}` : null,
      storeName: pick(random, ["Loja A", null]),
      category: pick(random, ["Informatica", null]),
      isManual: roll < 0.15,
      isDeleted: roll >= 0.15 && roll < 0.3,
      createdAt: new Date(BASE_TIME - (index + 1) * 1_000)
    };
  });

  const input: UpsertProductInput[] = [];
  const lastPrice = new Map(products.map((product) => [product.externalId, product.price]));
  for (let index = 0; index < options.incoming; index += 1) {
    let externalId = `incoming-${index}`;
    if (input.length > 0 && random() < options.duplicateRate) {
      externalId = pick(random, input).externalId;
    } else if (products.length > 0 && random() < options.existingRate) {
      externalId = pick(random, products).externalId;
    }
    const previous = lastPrice.get(externalId);
    const price =
      previous !== undefined && random() < options.samePriceRate ? previous : randomPrice(random);
    lastPrice.set(externalId, price);
    input.push({
      id: externalId,
      externalId,
      name: `Produto ${externalId} v${index}`,
      price,
      imageUrl: random() < 0.6 ? `https://img.test/${externalId}-${index}.png` : undefined,
      productUrl: random() < 0.7 ? `https://Loja.test/${externalId}/${index}#frag` : undefined,
      storeName: pick(random, ["Loja A", "Loja C", "SerpApi"]),
      category: random() < 0.2 ? "Eletronicos" : undefined
    });
  }
  return { products, input };
}
