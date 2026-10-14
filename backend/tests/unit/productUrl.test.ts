import { describe, expect, it } from "vitest";
import { normalizeProductUrl, toNormalizedProductUrlColumn } from "../../src/services/productUrl";

describe("normalizeProductUrl", () => {
  it.each([
    [undefined, ""],
    [null, ""],
    ["", ""],
    ["https://Loja.com/Produto/1?Cor=Azul#avaliacoes", "https://loja.com/produto/1?cor=azul"],
    ["HTTP://LOJA.COM:8080/x", "http://loja.com:8080/x"],
    ["  Sem Protocolo/Item  ", "sem protocolo/item"],
    ["   ", ""]
  ])("normaliza %j para %j", (input, expected) => {
    expect(normalizeProductUrl(input)).toBe(expected);
  });
});

describe("toNormalizedProductUrlColumn", () => {
  it("guarda null quando a URL normalizada fica vazia", () => {
    expect(toNormalizedProductUrlColumn(undefined)).toBeNull();
    expect(toNormalizedProductUrlColumn(null)).toBeNull();
    expect(toNormalizedProductUrlColumn("")).toBeNull();
    expect(toNormalizedProductUrlColumn("   ")).toBeNull();
  });

  it("guarda a URL normalizada quando ela existe", () => {
    expect(toNormalizedProductUrlColumn("https://Loja.com/A#x")).toBe("https://loja.com/a");
  });
});
