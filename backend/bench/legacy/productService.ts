import { prisma } from "../../src/prisma/client";
import { randomUUID } from "node:crypto";

type SerpApiShoppingResult = {
  title: string;
  product_id?: string;
  link?: string;
  product_link?: string;
  source?: string;
  price?: string;
  extracted_price?: number;
  old_price?: string;
  extracted_old_price?: number;
  tag?: string;
  extensions?: string[];
  thumbnail?: string;
  serpapi_thumbnail?: string;
};

type SerpApiSearchResponse = {
  shopping_results?: SerpApiShoppingResult[];
  inline_shopping_results?: SerpApiShoppingResult[];
  categorized_shopping_results?: Array<{
    shopping_results?: SerpApiShoppingResult[];
  }>;
  serpapi_pagination?: {
    next_link?: string;
    previous_link?: string;
  };
  pagination?: {
    next?: string;
    previous?: string;
  };
  search_information?: {
    total_results?: number;
  };
  error?: string;
};

export type ProductDTO = {
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

export type ProductPriceHistoryDTO = {
  id: string;
  oldPrice: number;
  newPrice: number;
  capturedAt: string;
};

export type ComparableOfferDTO = {
  externalId: string;
  name: string;
  storeName?: string;
  price: number;
  productUrl?: string;
  imageUrl?: string;
};

export class SerpApiError extends Error {
  constructor(
    public status: number,
    public body: string
  ) {
    super(`SerpApiError ${status}`);
    this.name = "SerpApiError";
  }
}

export class ProductDeleteConflictError extends Error {
  constructor(public dependencySummary: string) {
    super("Produto possui dependências ativas.");
    this.name = "ProductDeleteConflictError";
  }
}

function getSerpApiBaseUrl() {
  return process.env.SERPAPI_API_URL ?? "https://serpapi.com/search.json";
}

function getSerpApiKey() {
  return process.env.SERPAPI_API_KEY ?? "";
}

function parsePrice(value?: string): number {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const cleaned = value.replace(/[^\d,.-]/g, "").trim();

  if (cleaned.length === 0) {
    return 0;
  }

  if (cleaned.includes(",") && cleaned.includes(".")) {
    const commaIndex = cleaned.lastIndexOf(",");
    const dotIndex = cleaned.lastIndexOf(".");

    if (commaIndex > dotIndex) {
      return Number(cleaned.replaceAll(".", "").replace(",", ".")) || 0;
    }

    return Number(cleaned.replaceAll(",", "")) || 0;
  }

  if (cleaned.includes(",")) {
    return Number(cleaned.replaceAll(".", "").replace(",", ".")) || 0;
  }

  return Number(cleaned) || 0;
}

function collectSerpApiResults(data: SerpApiSearchResponse): SerpApiShoppingResult[] {
  const results: SerpApiShoppingResult[] = [];

  if (Array.isArray(data.shopping_results)) {
    results.push(...data.shopping_results);
  }

  if (Array.isArray(data.inline_shopping_results)) {
    results.push(...data.inline_shopping_results);
  }

  if (Array.isArray(data.categorized_shopping_results)) {
    for (const category of data.categorized_shopping_results) {
      if (Array.isArray(category.shopping_results)) {
        results.push(...category.shopping_results);
      }
    }
  }

  return results;
}

function hasNextPage(data: SerpApiSearchResponse): boolean {
  return Boolean(data.serpapi_pagination?.next_link || data.pagination?.next);
}

function hasPreviousPage(data: SerpApiSearchResponse): boolean {
  return Boolean(data.serpapi_pagination?.previous_link || data.pagination?.previous);
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function calculatePriceChangePercent(current: number, previous: number): number | undefined {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) {
    return undefined;
  }

  if (current === previous) {
    return 0;
  }

  return roundToOneDecimal(((current - previous) / previous) * 100);
}

function isAsciiWhitespace(char: string): boolean {
  return char === " " || char === "\t" || char === "\n" || char === "\r";
}

function isDiscountNumberChar(char: string): boolean {
  return (char >= "0" && char <= "9") || char === "." || char === "," || char === "-";
}

function parseDiscountPercent(text?: string): number | undefined {
  if (text === undefined || text === null || text === "") {
    return undefined;
  }

  const percentIndex = text.indexOf("%");
  if (percentIndex <= 0) {
    return undefined;
  }

  let end = percentIndex - 1;
  while (end >= 0) {
    const char = text[end];
    if (char === undefined || !isAsciiWhitespace(char)) {
      break;
    }

    end -= 1;
  }

  if (end < 0) {
    return undefined;
  }

  let start = end;
  while (start >= 0) {
    const char = text[start];
    if (char === undefined || !isDiscountNumberChar(char)) {
      break;
    }

    start -= 1;
  }

  const candidate = text.slice(start + 1, end + 1);
  if (!candidate) {
    return undefined;
  }

  if (candidate.lastIndexOf("-") > 0) {
    return undefined;
  }

  const normalized = candidate.replace(",", ".");
  const value = Number(normalized);

  if (!Number.isFinite(value) || value <= 0 || value >= 100) {
    return undefined;
  }

  return value;
}

function extractDiscountPercent(item: SerpApiShoppingResult): number | undefined {
  const fromTag = parseDiscountPercent(item.tag);
  if (fromTag !== undefined) {
    return fromTag;
  }

  if (!Array.isArray(item.extensions)) {
    return undefined;
  }

  for (const extension of item.extensions) {
    const parsed = parseDiscountPercent(extension);
    if (parsed !== undefined) {
      return parsed;
    }
  }

  return undefined;
}

function mapSerpApiItem(item: SerpApiShoppingResult): ProductDTO {
  const externalId = item.product_id ?? item.product_link ?? item.link ?? item.title;
  const currentPrice = item.extracted_price ?? parsePrice(item.price);

  let originalPrice = item.extracted_old_price ?? parsePrice(item.old_price);
  const hasValidOriginalPrice = originalPrice !== undefined && originalPrice > 0;
  if (!hasValidOriginalPrice) {
    const discount = extractDiscountPercent(item);
    if (discount !== undefined && currentPrice > 0) {
      originalPrice = currentPrice / (1 - discount / 100);
    }
  }

  const normalizedOriginalPrice =
    originalPrice && originalPrice > currentPrice ? roundToOneDecimal(originalPrice) : undefined;
  let priceChange: number | undefined;
  if (normalizedOriginalPrice === undefined) {
    priceChange = undefined;
  } else {
    priceChange = calculatePriceChangePercent(currentPrice, normalizedOriginalPrice);
  }

  return {
    id: externalId,
    externalId,
    name: item.title,
    price: currentPrice,
    originalPrice: normalizedOriginalPrice,
    priceChange,
    imageUrl: item.thumbnail ?? item.serpapi_thumbnail,
    productUrl: item.link ?? item.product_link,
    storeName: item.source ?? "SerpApi",
    category: undefined
  };
}

function normalizeProductUrl(value?: string | null): string {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  try {
    const url = new URL(value);
    const normalized = `${url.origin}${url.pathname}${url.search}`;
    return normalized.toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

function mapSavedProduct(savedProduct: {
  id: string;
  externalId: string;
  name: string;
  price: { toNumber(): number } | number;
  imageUrl: string | null;
  productUrl: string | null;
  storeName: string | null;
  category: string | null;
  priceHistory?: Array<{
    oldPrice: { toNumber(): number } | number;
    newPrice: { toNumber(): number } | number;
  }>;
}): ProductDTO {
  const toNumber = (value: { toNumber(): number } | number): number =>
    typeof value === "number" ? value : value.toNumber();

  const currentPrice =
    typeof savedProduct.price === "number" ? savedProduct.price : savedProduct.price.toNumber();
  const latestHistory = savedProduct.priceHistory?.[0];
  const previousPrice = latestHistory ? toNumber(latestHistory.oldPrice) : undefined;
  const originalPrice =
    previousPrice !== undefined && previousPrice > currentPrice ? previousPrice : undefined;
  const priceChange =
    originalPrice === undefined
      ? undefined
      : calculatePriceChangePercent(currentPrice, originalPrice);

  return {
    id: savedProduct.id,
    externalId: savedProduct.externalId,
    name: savedProduct.name,
    price: currentPrice,
    originalPrice,
    priceChange,
    imageUrl: savedProduct.imageUrl ?? undefined,
    productUrl: savedProduct.productUrl ?? undefined,
    storeName: savedProduct.storeName ?? undefined,
    category: savedProduct.category ?? undefined
  };
}

async function recordProductPriceHistory(productId: string, oldPrice: number, newPrice: number) {
  if (oldPrice === newPrice) {
    return;
  }

  await prisma.priceHistory.create({
    data: {
      productId,
      oldPrice,
      newPrice
    }
  });
}

async function fetchSerpApiSearch(query: string, start: number): Promise<Response> {
  const apiKey = getSerpApiKey();

  if (!apiKey) {
    throw new SerpApiError(500, "SERPAPI_API_KEY não configurada.");
  }

  const url = new URL(getSerpApiBaseUrl());
  url.searchParams.set("engine", "google_shopping");
  url.searchParams.set("q", query);
  url.searchParams.set("gl", "br");
  url.searchParams.set("hl", "pt-BR");
  url.searchParams.set("api_key", apiKey);

  if (start > 0) {
    url.searchParams.set("start", String(start));
  }

  return fetch(url.toString(), {
    headers: {
      Accept: "application/json"
    }
  });
}

async function searchSerpApi(
  query: string,
  page: number,
  limit: number
): Promise<{
  products: ProductDTO[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalResults?: number;
}> {
  const start = Math.max(page - 1, 0) * limit;
  const response = await fetchSerpApiSearch(query, start);

  if (!response.ok) {
    const details = await response.text();
    const errorBody = details.trim() || `SerpApi retornou ${response.status}`;
    throw new SerpApiError(response.status, errorBody);
  }

  const data = (await response.json()) as SerpApiSearchResponse;

  if (data.error) {
    throw new SerpApiError(502, data.error);
  }

  return {
    products: collectSerpApiResults(data).slice(0, limit).map(mapSerpApiItem),
    hasNextPage: hasNextPage(data) || collectSerpApiResults(data).length >= limit,
    hasPreviousPage: hasPreviousPage(data),
    totalResults: data.search_information?.total_results
  };
}

type ProductSearchResult = {
  source: "serpapi" | "mock";
  products: ProductDTO[];
  page: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalResults?: number;
  totalPages?: number;
  message?: string;
};

export async function searchProducts(
  query: string,
  page = 1,
  limit = 8,
  category?: string
): Promise<ProductSearchResult> {
  const trimmedQuery = query.trim();
  const trimmedCategory = category?.trim();

  if (!trimmedQuery && !trimmedCategory) {
    return {
      source: "serpapi",
      products: [],
      page: 1,
      limit,
      hasNextPage: false,
      hasPreviousPage: false,
      message: "Informe um termo de busca para pesquisar produtos."
    };
  }

  const searchResult = trimmedQuery
    ? await searchSerpApi(trimmedQuery, page, limit)
    : {
        products: [] as ProductDTO[],
        hasNextPage: false,
        hasPreviousPage: page > 1,
        totalResults: undefined
      };

  await Promise.allSettled(searchResult.products.map((product) => upsertProduct(product)));

  const savedProducts = await prisma.product.findMany({
    where: {
      externalId: {
        in: searchResult.products.map((product) => product.externalId)
      }
    },
    select: {
      id: true,
      externalId: true,
      name: true,
      price: true,
      imageUrl: true,
      productUrl: true,
      storeName: true,
      category: true,
      isManual: true,
      isDeleted: true,
      priceHistory: {
        orderBy: {
          capturedAt: "desc"
        },
        take: 1,
        select: {
          oldPrice: true,
          newPrice: true
        }
      }
    }
  });

  const deletedProducts = await prisma.product.findMany({
    where: {
      isDeleted: true
    },
    select: {
      productUrl: true,
      name: true,
      storeName: true
    }
  });

  const deletedUrls = new Set(
    deletedProducts
      .map((product) => normalizeProductUrl(product.productUrl))
      .filter((value) => value.length > 0)
  );

  const savedByExternalId = new Map(savedProducts.map((product) => [product.externalId, product]));

  const productsToReturn = searchResult.products.map((product) => {
    const saved = savedByExternalId.get(product.externalId);
    const productUrl = normalizeProductUrl(product.productUrl);
    if (productUrl && deletedUrls.has(productUrl)) {
      return null;
    }

    if (saved?.isDeleted) {
      return null;
    }

    if (!saved?.isManual) {
      return product;
    }

    return {
      id: saved.id,
      externalId: saved.externalId,
      name: saved.name,
      price: Number(saved.price),
      originalPrice:
        saved.priceHistory?.[0] && Number(saved.priceHistory[0].oldPrice) > Number(saved.price)
          ? Number(saved.priceHistory[0].oldPrice)
          : undefined,
      priceChange:
        saved.priceHistory?.[0] && Number(saved.priceHistory[0].oldPrice) > Number(saved.price)
          ? calculatePriceChangePercent(Number(saved.price), Number(saved.priceHistory[0].oldPrice))
          : undefined,
      imageUrl: saved.imageUrl ?? undefined,
      productUrl: saved.productUrl ?? undefined,
      storeName: saved.storeName ?? undefined,
      category: saved.category ?? undefined
    };
  });

  const localWhere = {
    isDeleted: false,
    ...(trimmedCategory
      ? {
          category: {
            equals: trimmedCategory,
            mode: "insensitive" as const
          }
        }
      : {}),
    ...(trimmedQuery
      ? {
          OR: [
            {
              name: {
                contains: trimmedQuery,
                mode: "insensitive" as const
              }
            },
            {
              category: {
                contains: trimmedQuery,
                mode: "insensitive" as const
              }
            }
          ]
        }
      : {})
  };

  const localMatches = await prisma.product.findMany({
    where: localWhere,
    orderBy: {
      createdAt: "desc"
    },
    select: {
      id: true,
      externalId: true,
      name: true,
      price: true,
      imageUrl: true,
      productUrl: true,
      storeName: true,
      category: true,
      priceHistory: {
        orderBy: {
          capturedAt: "desc"
        },
        take: 1,
        select: {
          oldPrice: true,
          newPrice: true
        }
      }
    }
  });

  const localDtos = localMatches.map(mapSavedProduct);

  const mergedByExternalId = new Map<string, ProductDTO>();
  for (const local of localDtos) {
    mergedByExternalId.set(local.externalId, local);
  }
  for (const external of productsToReturn.filter(Boolean) as ProductDTO[]) {
    if (!mergedByExternalId.has(external.externalId)) {
      mergedByExternalId.set(external.externalId, external);
    }
  }

  const mergedProducts = Array.from(mergedByExternalId.values());
  const paginatedProducts = mergedProducts.slice(0, limit);

  const totalResults = searchResult.totalResults;

  return {
    source: "serpapi",
    products: paginatedProducts,
    page,
    limit,
    hasNextPage: searchResult.hasNextPage || mergedProducts.length > limit,
    hasPreviousPage: searchResult.hasPreviousPage,
    totalResults: totalResults ?? mergedProducts.length,
    totalPages: totalResults ? Math.max(1, Math.ceil(totalResults / limit)) : undefined
  };
}

export async function getShowcaseProducts(page = 1, limit = 8): Promise<ProductSearchResult> {
  const normalizedPage = Number.isFinite(page) && page > 0 ? page : 1;
  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? limit : 8;
  const skip = (normalizedPage - 1) * normalizedLimit;

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: "desc" },
      skip,
      take: normalizedLimit,
      select: {
        id: true,
        externalId: true,
        name: true,
        price: true,
        imageUrl: true,
        productUrl: true,
        storeName: true,
        category: true,
        priceHistory: {
          orderBy: {
            capturedAt: "desc"
          },
          take: 1,
          select: {
            oldPrice: true,
            newPrice: true
          }
        }
      }
    }),
    prisma.product.count({ where: { isDeleted: false } })
  ]);

  const totalPages = total ? Math.max(1, Math.ceil(total / normalizedLimit)) : undefined;

  return {
    source: "mock",
    products: items.map((product) => ({
      id: product.id,
      externalId: product.externalId,
      name: product.name,
      price: Number(product.price),
      imageUrl: product.imageUrl ?? undefined,
      productUrl: product.productUrl ?? undefined,
      storeName: product.storeName ?? undefined,
      category: product.category ?? undefined
    })),
    page: normalizedPage,
    limit: normalizedLimit,
    hasNextPage: skip + items.length < total,
    hasPreviousPage: normalizedPage > 1,
    totalResults: total || undefined,
    totalPages,
    message: items.length > 0 ? "Sugestoes carregadas para voce explorar." : undefined
  };
}

export async function getProductById(id: string): Promise<ProductDTO | null> {
  const savedProduct = await prisma.product.findFirst({
    where: {
      OR: [{ id }, { externalId: id }],
      isDeleted: false
    },
    include: {
      priceHistory: {
        orderBy: {
          capturedAt: "desc"
        },
        take: 1,
        select: {
          oldPrice: true,
          newPrice: true
        }
      }
    }
  });

  if (savedProduct) {
    return mapSavedProduct(savedProduct);
  }

  return null;
}

export async function upsertProduct(product: ProductDTO): Promise<string> {
  const existing = await prisma.product.findUnique({
    where: { externalId: product.externalId }
  });

  if (
    existing &&
    ((existing as { isManual?: boolean }).isManual ||
      (existing as { isDeleted?: boolean }).isDeleted)
  ) {
    return existing.id;
  }

  const previousPrice = existing ? Number(existing.price) : null;

  const savedProduct = await prisma.product.upsert({
    where: { externalId: product.externalId },
    update: {
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      productUrl: product.productUrl,
      storeName: product.storeName,
      category: product.category,
      isManual: false
    },
    create: {
      externalId: product.externalId,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      productUrl: product.productUrl,
      storeName: product.storeName,
      category: product.category,
      isManual: false
    }
  });

  if (existing && previousPrice !== null) {
    await recordProductPriceHistory(savedProduct.id, previousPrice, product.price);
  }

  return savedProduct.id;
}

export type CreateProductInput = {
  name: string;
  price: number;
  imageUrl?: string | null;
  productUrl?: string | null;
  storeName?: string | null;
  category?: string | null;
  ownerUserId: string;
};

export async function createProduct(input: CreateProductInput): Promise<ProductDTO> {
  const normalizedName = input.name.trim();

  if (!normalizedName) {
    throw new Error("Nome do produto é obrigatório.");
  }

  if (!Number.isFinite(input.price) || input.price <= 0) {
    throw new Error("Preço inválido.");
  }

  const activeStores = await prisma.store.findMany({
    where: { isActive: true },
    select: { name: true }
  });

  if (activeStores.length === 0) {
    throw new Error("Cadastre ao menos uma loja ativa antes de criar um produto.");
  }

  const normalizedStoreName = input.storeName?.trim() || "";
  if (!normalizedStoreName) {
    throw new Error("Selecione uma loja ativa para cadastrar o produto.");
  }

  const storeExists = activeStores.some(
    (store) => store.name.toLowerCase() === normalizedStoreName.toLowerCase()
  );
  if (!storeExists) {
    throw new Error("A loja selecionada não está ativa ou não existe.");
  }

  const ownedStore = await prisma.store.findFirst({
    where: {
      name: {
        equals: normalizedStoreName,
        mode: "insensitive"
      },
      userId: input.ownerUserId,
      isActive: true
    } as any,
    select: { id: true }
  });

  if (!ownedStore) {
    throw new Error("Selecione uma loja ativa criada por voce.");
  }

  const normalizedCategory = input.category?.trim() || null;
  if (normalizedCategory) {
    const categoryExists = await prisma.category.findFirst({
      where: {
        name: {
          equals: normalizedCategory,
          mode: "insensitive"
        },
        isActive: true
      },
      select: { id: true }
    });

    if (!categoryExists) {
      throw new Error("A categoria selecionada não está ativa ou não existe.");
    }
  }

  const normalizedProductUrl = input.productUrl?.trim() || null;

  if (normalizedProductUrl) {
    const existingByUrl = await prisma.product.findFirst({
      where: {
        productUrl: normalizedProductUrl,
        isDeleted: false
      }
    });

    if (existingByUrl) {
      throw new Error("Já existe um produto com a mesma URL.");
    }
  }

  const record = await prisma.product.create({
    data: {
      externalId: `manual-${randomUUID()}`,
      name: normalizedName,
      price: input.price,
      imageUrl: input.imageUrl?.trim() || null,
      productUrl: normalizedProductUrl,
      storeName: normalizedStoreName,
      category: normalizedCategory,
      isManual: true
    }
  });

  return mapSavedProduct(record);
}

export type UpdateProductInput = {
  name?: string;
  price?: number;
  imageUrl?: string | null;
  productUrl?: string | null;
  storeName?: string | null;
  category?: string | null;
};

export async function updateProduct(
  id: string,
  input: UpdateProductInput,
  ownerUserId: string
): Promise<ProductDTO | null> {
  const product = await prisma.product.findFirst({
    where: {
      OR: [{ id }, { externalId: id }],
      isDeleted: false
    }
  });

  if (!product) {
    return null;
  }

  const previousPrice = Number(product.price);
  const nextPrice = input.price ?? previousPrice;
  const nextStoreName = input.storeName === undefined ? product.storeName : input.storeName?.trim();
  const nextCategory = input.category === undefined ? product.category : input.category?.trim();

  if (nextStoreName) {
    const storeExists = await prisma.store.findFirst({
      where: {
        name: {
          equals: nextStoreName,
          mode: "insensitive"
        },
        userId: ownerUserId,
        isActive: true
      } as any,
      select: { id: true }
    });

    if (!storeExists) {
      throw new Error("A loja selecionada não está ativa ou não existe.");
    }
  }

  if (nextCategory) {
    const categoryExists = await prisma.category.findFirst({
      where: {
        name: {
          equals: nextCategory,
          mode: "insensitive"
        },
        isActive: true
      },
      select: { id: true }
    });

    if (!categoryExists) {
      throw new Error("A categoria selecionada não está ativa ou não existe.");
    }
  }

  const updated = await prisma.product.update({
    where: { id: product.id },
    data: {
      name: input.name ?? product.name,
      price: nextPrice,
      imageUrl: input.imageUrl === undefined ? product.imageUrl : input.imageUrl,
      productUrl: input.productUrl === undefined ? product.productUrl : input.productUrl,
      storeName: nextStoreName,
      category: nextCategory,
      isManual: true
    }
  });

  await recordProductPriceHistory(updated.id, previousPrice, nextPrice);

  return mapSavedProduct(updated);
}

export async function listProductPriceHistory(
  id: string
): Promise<ProductPriceHistoryDTO[] | null> {
  const product = await prisma.product.findFirst({
    where: {
      OR: [{ id }, { externalId: id }],
      isDeleted: false
    },
    select: {
      id: true
    }
  });

  if (!product) {
    return null;
  }

  const records = await prisma.priceHistory.findMany({
    where: {
      productId: product.id
    },
    orderBy: {
      capturedAt: "desc"
    },
    take: 30
  });

  return records.map((item) => ({
    id: item.id,
    oldPrice: Number(item.oldPrice),
    newPrice: Number(item.newPrice),
    capturedAt: item.capturedAt.toISOString()
  }));
}

export async function listProductComparableOffers(
  id: string,
  limit = 5
): Promise<ComparableOfferDTO[] | null> {
  const product = await getProductById(id);

  if (!product) {
    return null;
  }

  const fallbackOffer: ComparableOfferDTO = {
    externalId: product.externalId,
    name: product.name,
    storeName: product.storeName,
    price: product.price,
    productUrl: product.productUrl,
    imageUrl: product.imageUrl
  };

  try {
    const serpResult = await searchSerpApi(product.name, 1, Math.max(limit * 2, 8));
    const uniqueKeys = new Set<string>();
    const offers: ComparableOfferDTO[] = [fallbackOffer];
    uniqueKeys.add(
      `${fallbackOffer.storeName ?? ""}-${normalizeProductUrl(fallbackOffer.productUrl)}`
    );

    for (const item of serpResult.products) {
      const key = `${item.storeName ?? ""}-${normalizeProductUrl(item.productUrl)}`;
      if (uniqueKeys.has(key)) {
        continue;
      }

      uniqueKeys.add(key);
      offers.push({
        externalId: item.externalId,
        name: item.name,
        storeName: item.storeName,
        price: item.price,
        productUrl: item.productUrl,
        imageUrl: item.imageUrl
      });

      if (offers.length >= limit) {
        break;
      }
    }

    return offers;
  } catch {
    return [fallbackOffer];
  }
}

export async function deleteProduct(id: string): Promise<{ deleted: boolean } | null> {
  const product = await prisma.product.findFirst({
    where: {
      OR: [{ id }, { externalId: id }],
      isDeleted: false
    },
    select: {
      id: true
    }
  });

  if (!product) {
    return null;
  }

  const [favoritesCount, alertsCount, historyCount] = await Promise.all([
    prisma.favorite.count({ where: { productId: product.id } }),
    prisma.priceAlert.count({ where: { productId: product.id } }),
    prisma.priceHistory.count({ where: { productId: product.id } })
  ]);

  if (favoritesCount > 0 || alertsCount > 0 || historyCount > 0) {
    const summary = `favoritos=${favoritesCount}, alertas=${alertsCount}, historico=${historyCount}`;
    throw new ProductDeleteConflictError(summary);
  }

  await prisma.product.update({
    where: { id: product.id },
    data: {
      isDeleted: true
    }
  });

  return { deleted: true };
}
