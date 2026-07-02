# ImobIA

**A plataforma que permite ao cliente montar a própria compra do imóvel — e ao corretor fechar com inteligência.**

ImobIA é um sistema imobiliário com duas faces:

- **Para o cliente:** uma experiência tipo "Netflix dos imóveis" — descobre, compara, monta o plano de pagamento, simula e favorita, tudo sozinho, sem burocracia.
- **Para o corretor:** um centro de comando que captura leads automaticamente a partir do comportamento do cliente, mede a "temperatura" de cada lead e oferece um motor de inteligência financeira (o **Coringa**) que monta estratégias de compra em segundos.

> O maior problema do mercado hoje não é falta de imóvel. É falta de clareza para o cliente entender **como comprar**. É isso que o ImobIA resolve.

## Documentação

- [Escopo do projeto](docs/ESCOPO.md) — visão, personas, funcionalidades, motor financeiro, dados, arquitetura e roadmap.
- [Glossário](docs/GLOSSARIO.md) — termos do mercado imobiliário e de financiamento usados no projeto.

## Status

🏗️ **Fase atual:** Fase 0 (Fundação) — monorepo e motor financeiro concluídos.

- ✅ Escopo e histórias do MVP ([docs/MVP-HISTORIAS.md](docs/MVP-HISTORIAS.md))
- ✅ Monorepo Turborepo: `packages/core`, `packages/domain`, `apps/web` (Next.js 16), `apps/mobile` (Expo 57)
- ✅ Motor financeiro (`@imobia/core`): Price/SAC, plano de pagamento, Sonhômetro, modalidades parametrizadas — 134 testes, ~96% de cobertura
- ✅ E0.2/E0.3: Supabase (projeto "ImobIA - Dev", sa-east-1) — 11 tabelas multi-tenant com RLS, isolamento provado com 2 orgs (matriz 22/22), auth web (Next 16 + @supabase/ssr) e mobile (Expo), parâmetros financeiros no banco (H-05: muda sem deploy)
- ✅ MVP E1/E2/E8: catálogo com filtros (`/imoveis`), ficha com simulação do plano calculada pelo motor (`/imoveis/[id]`), cadastro de imóveis pelo corretor com upload de fotos/plantas (`/corretor/imoveis`), Storage por org; catálogo + ficha também no mobile
- ✅ MVP E3/E4 — "Compre do seu jeito": slider de entrada recalculando o plano **em tempo real no cliente** (via `@imobia/core`, sem ida ao servidor), toggle de modalidade elegível e timeline visual reativa — web e mobile. Invariante do plano verificado em 51/51 posições do slider
- ✅ MVP E5/E6 — **Sonhômetro** (`/sonhometro`): quiz de capacidade → "você consegue comprar até R$ X" + detalhamento por modalidade, catálogo passa a filtrar por capacidade; **favoritos** (coração no card/ficha, `/favoritos`) e **comparação** de imóveis (`/comparar`) — web e mobile
- 🎉 **MVP da experiência do cliente completo** (E1–E8): descobrir → montar a compra → descobrir quanto pode → favoritar/comparar
- ✅ V1 (parte 1) — **Painel do corretor**: captura automática de leads (trigger materializa eventos → leads), **termômetro** 🔥 no `@imobia/core`, timeline de comportamento, painel `/corretor/leads`; **consentimento LGPD opt-in** com portão na RLS (corretor só vê clientes que consentiram) — web e mobile
- ✅ **Redesign visual (padrão portal)**: tema claro, atributos de imóvel (m²/quartos/banheiros/vagas), cards, catálogo, ficha (2 colunas) e landing no nível de um portal imobiliário; design system com tokens da marca + `components/ui` (lucide-react)
- ✅ **Overhaul visual (nível portal)**: paleta quente laranja/âmbar (`#DB6414`/`#F2A93B`), acabamento inspirado em Airbnb/Chaves na Mão — busca no hero, pílulas de categoria, cards foto-forward com preço em sans bold, ficha com galeria em mosaico + lightbox e card de preço sticky, aplicado em TODAS as telas (cliente, corretor, ferramentas, auth) e no mobile; design system com `components/ui` (Botao, Badge, Selo, Campo, PilulasCategoria)
- ✅ V1 — **Coringa** (motor de estratégias): dado o cenário do cliente (renda, FGTS, entrada, imóvel-alvo), o `@imobia/core` gera e ranqueia jogadas — aumentar entrada, usar FGTS, trocar modalidade/unidade, ajustar prazo, amortizar — com impacto exato (parcela antes→depois, economia total, prazo) e explicação em pt-BR; tela `/corretor/coringa`. Motor validado numericamente (20 testes)
- ✅ V1 — **Visão de Gestor/Imobiliária** (`/corretor/equipe`): dashboard consolidado da org (imóveis por status, leads consentidos, prontos para compra, corretores), distribuição de temperatura, desempenho por corretor, e **distribuição de leads** (gestor reatribui lead a outro corretor da org, via RLS — 7 vetores adversariais verdes)
- ⏭️ Próximo (V1): funil de negócios (Negócio/Deal) para conversão real + contato do lead

> Convites de corretor/gestor: signup público sempre nasce `cliente`; promoção só via `privado.convites` (server-side). Seed de dev: `supabase/seed-dev.sql` (usuários @teste.mobia, senha `MobIA!teste1`).

## Desenvolvimento

```bash
pnpm install        # instala tudo (workspace)
pnpm test           # testes (domain + core)
pnpm typecheck      # typecheck de todos os pacotes
pnpm --filter web dev      # web em localhost:3000
pnpm --filter mobile start # Expo dev server
```
