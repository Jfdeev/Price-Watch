import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export type SerpItem = {
  title: string;
  product_id?: string;
  link?: string;
  product_link?: string;
  source?: string;
  price?: string;
  extracted_price?: number;
  extracted_old_price?: number;
  tag?: string;
  thumbnail?: string;
};

export type SerpResponse = {
  shopping_results?: SerpItem[];
  serpapi_pagination?: { next_link?: string };
  search_information?: { total_results?: number };
};

export type FakeSerpApi = {
  url: string;
  setResponse(response: SerpResponse): void;
  requests(): number;
  close(): Promise<void>;
};

export async function startFakeSerpApi(): Promise<FakeSerpApi> {
  let body = JSON.stringify({ shopping_results: [] });
  let count = 0;
  const server: Server = createServer((_request, response) => {
    count += 1;
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/search.json`,
    setResponse(response) {
      body = JSON.stringify(response);
    },
    requests: () => count,
    close: () => new Promise<void>((resolve) => server.close(() => resolve()))
  };
}

const FAKE_SERPAPI_TOKEN = ["local", "bench"].join("-");

export function useFakeSerpApi(api: FakeSerpApi): void {
  process.env.SERPAPI_API_URL = api.url;
  process.env.SERPAPI_API_KEY = FAKE_SERPAPI_TOKEN;
}
