# perf: redução de complexidade assintótica em 8 funções do Price-Watch

## Resumo

Trabalho complementar de Análise de Algoritmos: oito funções do Price-Watch reescritas para reduzir a classe de complexidade (ou, em F6–F8, discutir por que ela não muda), mantendo a mesma saída para toda entrada válida.

- O custo dominante do sistema é **I/O de banco e transferência entre back e front**, não laço em memória. As maiores mudanças são de idas ao banco (N+1 → lote) e de linhas lidas (tabela inteira → consulta indexada da fração usada).
- **Meta B:** cinco funções mudam de classe (F1, F2, F3, F4, F5).
- **F6 e F7** são analisadas e documentadas como melhorias que **não** mudam a classe. **F8** muda a classe só no melhor caso da entrada do contrato.
- **Equivalência:** cada função tem um teste que roda a versão original (preservada em `bench/legacy/`) e a nova sobre as mesmas entradas com semente fixa. Nas funções de banco o teste roda em Postgres real e compara também o estado final.
- **Medição:** scripts versionados medem tempo × n, consultas × n e bytes × n. Os gráficos (linear e log-log) estão em `docs/complexidade/graficos/`.
- **Comentários:** o código não tem nenhum; restam só diretivas de ferramenta. Verificação automatizada: `node scripts/check-comments.mjs`.
- **Relatório completo:** [`docs/complexidade/relatorio.md`](relatorio.md).

## Tabela comparativa

| Função | Arquivo | O antes | O depois | Estratégia adotada |
|---|---|---|---|---|
| F1 `searchProducts` → upsert dos produtos | `backend/src/services/productService.ts`, `productBatchUpsert.ts` | Θ(n) idas ao banco | Θ(1) idas (≤ 6 comandos) | lote: 1 leitura com `= ANY($1)`, 1 INSERT, 1 UPDATE e 1 INSERT de histórico via `jsonb_to_recordset`, numa transação |
| F2 `searchProducts` → produtos excluídos | `backend/src/services/productService.ts` | Θ(D + n) tempo, Θ(D) espaço | O(n log N) tempo, Θ(n) espaço | coluna `normalizedProductUrl` preenchida na escrita + índice `(isDeleted, normalizedProductUrl)` + consulta só das URLs da página |
| F3 `createProduct` | `backend/src/services/productService.ts` | Θ(S) | O(log S) no caminho de sucesso; Θ(S) no pior caso (erro de dono) | índice funcional parcial `lower(name) WHERE isActive`; `LIMIT 1` por igualdade; ILIKE original só como fallback |
| F4 `loadProduct` (favorito) | `frontend/src/pages/ProductDetailPage.tsx`, `favoriteService.ts` | Θ(F) tempo e bytes | O(log F) tempo, Θ(1) bytes | `GET /favorites/product/:productId` no índice único `(userId, productId)` |
| F5 `loadSearchResults`/`loadShowcase` | `frontend/src/pages/HomePage.tsx`, `favoriteService.ts` | Θ(F + k) | O(k log F) tempo, Θ(k) bytes | `POST /favorites/lookup` com os ids da página |
| F6 `searchProducts` → produtos locais | `backend/src/services/productService.ts` | Θ(L) linhas na aplicação | Θ(k + n) linhas na aplicação (banco segue Θ(N)) | `take: limit` + `count` + contagem de sobreposição só quando necessária |
| F7 métricas do Dashboard | `frontend/src/lib/dashboardMetrics.ts` | Θ(h + a + f), 13 passadas | Θ(h + a + f), 1 passada por coleção | pré-computação em uma passada (só constante) |
| F8 `buildHistorySeries` | `frontend/src/lib/historySeries.ts` | O(h log h), Ω(h) | O(h log h), Ω(h); Θ(h) na entrada do contrato | detecção de ordem não crescente + inversão por grupos estáveis; `sort` como fallback |

## Responsáveis

| Aluno | Funções |
|---|---|
| João Felipe da Rocha Soares | F1, F7 |
| Vithor dos Santos | F2, F5, F8 |
| Paulo Ricardo | F3, F4, F6 |

## Mudanças de banco

- `20261014120000_add_normalized_product_url`: coluna `normalizedProductUrl` e índice `(isDeleted, normalizedProductUrl)`. **Depois de aplicar, rode `npm run db:backfill-normalized-url` uma vez** nos bancos já existentes.
- `20261014130000_add_store_active_lower_name_index`: índice funcional parcial `lower(name) WHERE isActive` em `Store`. É SQL manual; o `prisma migrate diff` confirma que o Prisma não o remove.

### Deploy no banco de produção (Neon)

As medições e os testes rodaram no Postgres local; nada foi aplicado no Neon. No deploy:

1. `npx prisma migrate deploy` com o `DATABASE_URL` do Neon (cria a coluna, o índice composto e o índice funcional parcial);
2. logo em seguida, `npm run db:backfill-normalized-url`. Sem isso, produtos excluídos antes da migration deixam de ser filtrados na busca;
3. recomendado antes de considerar a F3 equivalente em produção: confirmar o locale do banco no SQL Editor do Neon. A equivalência de `lower()` foi verificada só em `en_US.utf8`/libc (achado A3).

## API nova

- `GET /favorites/product/:productId` → `{ id, productId }` ou `null` (autenticado).
- `POST /favorites/lookup` com `{ productIds: string[] }` (até 100) → `[{ id, productId }]` (autenticado; lista inválida → 400).
- `GET /favorites` continua igual.

## Como testar

```bash
docker compose up -d postgres
```

O `npm run bench` da raiz já cria e migra `pricewatch_test`. Para rodar só os testes:

```bash
cd backend && npm run test && npm run test:equivalence && npm run lint && npm run typecheck && npm run build
```

```bash
cd frontend && npm run test && npm run lint && npm run format:check && npm run typecheck && npm run build
```

```bash
npm run check:comments
```

## Como medir

Com o Postgres do `docker-compose` no ar e as dependências instaladas, rode na raiz:

```bash
npm run bench
```

O comando (`scripts/bench-all.mjs`):
1. cria os bancos `pricewatch_test` e `pricewatch_bench` e aplica as migrations;
2. roda os testes de equivalência;
3. mede F1–F8;
4. gera os gráficos e as tabelas.

Os CSVs vão para `docs/complexidade/dados/` e os PNGs para `docs/complexidade/graficos/`.

## Pontos de atenção para a revisão

- **F1:** duplicados de `externalId` na mesma resposta passam a seguir a semântica sequencial; o original dependia de corrida. A falha passou a ser tudo ou nada para a busca (o original isolava por produto). Ambos estão documentados (achados A12–A14).
- **F5:** a falha de favoritos continua derrubando a vitrine, inclusive para visitantes sem login. Isso foi preservado de propósito e registrado como provável bug (A1).
- **F3:** a ressalva de Unicode (`İ` e sigma final) está no achado A3.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
