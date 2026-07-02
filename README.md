# MobIA

**A plataforma que permite ao cliente montar a própria compra do imóvel — e ao corretor fechar com inteligência.**

MobIA é um sistema imobiliário com duas faces:

- **Para o cliente:** uma experiência tipo "Netflix dos imóveis" — descobre, compara, monta o plano de pagamento, simula e favorita, tudo sozinho, sem burocracia.
- **Para o corretor:** um centro de comando que captura leads automaticamente a partir do comportamento do cliente, mede a "temperatura" de cada lead e oferece um motor de inteligência financeira (o **Coringa**) que monta estratégias de compra em segundos.

> O maior problema do mercado hoje não é falta de imóvel. É falta de clareza para o cliente entender **como comprar**. É isso que o MobIA resolve.

## Documentação

- [Escopo do projeto](docs/ESCOPO.md) — visão, personas, funcionalidades, motor financeiro, dados, arquitetura e roadmap.
- [Glossário](docs/GLOSSARIO.md) — termos do mercado imobiliário e de financiamento usados no projeto.

## Status

🏗️ **Fase atual:** Fase 0 (Fundação) — monorepo e motor financeiro concluídos.

- ✅ Escopo e histórias do MVP ([docs/MVP-HISTORIAS.md](docs/MVP-HISTORIAS.md))
- ✅ Monorepo Turborepo: `packages/core`, `packages/domain`, `apps/web` (Next.js 16), `apps/mobile` (Expo 57)
- ✅ Motor financeiro (`@mobia/core`): Price/SAC, plano de pagamento, Sonhômetro, modalidades parametrizadas — 134 testes, ~96% de cobertura
- ✅ E0.2/E0.3: Supabase (projeto "MobIA - Dev", sa-east-1) — 11 tabelas multi-tenant com RLS, isolamento provado com 2 orgs (matriz 22/22), auth web (Next 16 + @supabase/ssr) e mobile (Expo), parâmetros financeiros no banco (H-05: muda sem deploy)
- ✅ MVP E1/E2/E8: catálogo com filtros (`/imoveis`), ficha com simulação do plano calculada pelo motor (`/imoveis/[id]`), cadastro de imóveis pelo corretor com upload de fotos/plantas (`/corretor/imoveis`), Storage por org; catálogo + ficha também no mobile
- ✅ MVP E3/E4 — "Compre do seu jeito": slider de entrada recalculando o plano **em tempo real no cliente** (via `@mobia/core`, sem ida ao servidor), toggle de modalidade elegível e timeline visual reativa — web e mobile. Invariante do plano verificado em 51/51 posições do slider
- ⏭️ Próximo: E5 (Sonhômetro — capacidade de compra) e E6 (favoritos/comparação)

> Convites de corretor/gestor: signup público sempre nasce `cliente`; promoção só via `privado.convites` (server-side). Seed de dev: `supabase/seed-dev.sql` (usuários @teste.mobia, senha `MobIA!teste1`).

## Desenvolvimento

```bash
pnpm install        # instala tudo (workspace)
pnpm test           # testes (domain + core)
pnpm typecheck      # typecheck de todos os pacotes
pnpm --filter web dev      # web em localhost:3000
pnpm --filter mobile start # Expo dev server
```
