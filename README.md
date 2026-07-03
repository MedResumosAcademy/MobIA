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
- ✅ V1 — **CRM / Funil de negócios** (`/corretor/negocios`): pipeline por etapa (novo → contato → visita → proposta → fechamento; ganho/perdido), valor do negócio, timeline de atividades, **conversão de lead → negócio** com um clique
- ✅ V1 — **CRM completo + Dashboard gerencial**: contato do negócio (ligar/WhatsApp/e-mail), **tarefas/follow-up** com vencimento e atrasadas (`/corretor/tarefas`), **painel pessoal** do corretor (`/corretor`), e um **dashboard gerencial** (`/corretor/equipe`) com KPIs (em aberto, ganhos no mês, conversão, ticket médio, ciclo de venda, tarefas atrasadas), funil, **ranking de corretores** e tendência de 6 meses. Métricas no `@imobia/core` (`metricasGerenciais`, 11 testes)
- ✅ **CRM ao melhor nível**: pipeline com **Kanban ↔ Lista**, filtros (etapa, origem, responsável, busca), **arrastar-e-soltar** entre etapas (+ fallback acessível), indicador **"parado há X dias"** (atenção/parado, via `@imobia/core`), **editar negócio** (valor/contato/origem), e **contato do cliente** (telefone no `/conta`, com Ligar/WhatsApp no lead — gated por consentimento LGPD)
- ✅ **Central de Comando**: **Metas da empresa** (`/corretor/equipe`) com alvo × atual e barras de progresso (o gestor define; corretor lê), e **"Onde agir agora"** no painel do corretor (`/corretor`) — fila priorizada de ações (negócios parados, tarefas atrasadas, leads quentes sem negócio) com atalho direto. Progresso das metas no `@imobia/core`
- ✅ **Mapa de imóveis por região** (`/mapa`): choropleth do Brasil por UF (d3-geo), estados coloridos por densidade de imóveis disponíveis + ranking clicável de estados; clicar num estado filtra o catálogo (`/imoveis?uf=SP`) com chip removível
- ✅ **Perfil do corretor** (`/corretor/perfil`, `/corretor/perfil/[id]`): cabeçalho rico (capa, avatar, @handle, papel, org, CRECI, bio, "membro desde", WhatsApp/ligar/Instagram), **gamificação** (nível/XP, ranking, **conquistas/badges** — Primeira venda, Vendedor, Top closer, Milionário, Consistente), stats (ganhos, valor vendido, conversão, imóveis), **histórico de vendas** e **espaço para depoimentos** (nota em estrelas, adicionar/remover), e **visão pública** (`?visao=publica` — o dono vê a vitrine como os colegas veem, sem ações de dono). Gamificação no `@imobia/core` (`calcularGamificacao`, 14 testes). Referências: Afya (comunidade/gamificação) + Mapeamento MRA (ops/CRM)
- ✅ **Comunidade ImobIA** (`/comunidade`, profissional-only): feed nacional **cross-org** com **publicar** (geral/conquista/dica, até 2000 chars), **curtir** e **seguir** corretores de todo o Brasil; **"Seu placar"** (streak 🔥 de dias consecutivos com recorde, pontos e faixas Iniciante→Lenda) e **Ranking Nacional** (pontos por publicações/curtidas/seguidores). Motor puro no `@imobia/core` (`calcularStreak`/`calcularPontosComunidade`/`faixaComunidade`, 21 testes). Identidade do autor **denormalizada por trigger** e ranking via view owner — a RLS por-org de `perfis`/`corretor_profiles` fica intocada; clientes não acessam (migração 0018)
- ✅ **Navegação do profissional**: header com **Painel** (CRM/leads/métricas), **Comunidade** e **Meu perfil** para corretor/gestor/admin (antes o painel não tinha porta de entrada na UI)
- ✅ **Carteira de imóveis no perfil**: seção de gestão (só o dono) com CTAs **Adicionar imóvel**/**Gerenciar** e ranking dos **mais acessados** (visualizações de ficha, simulações, favoritos por imóvel — RLS mantém o portão LGPD)
- ✅ **Onboarding do corretor** (`/onboarding`): wizard de 4 etapas obrigatório no primeiro acesso (gate no painel) — nome, e-mail, **CPF validado** (dígitos verificadores no `@imobia/core`, 15 testes; dado sensível: nunca exposto em página), CRECI, cidade, telefone, **vendas na carreira (declarado)** exibidas no perfil, bio, foto com **consentimento LGPD de exibição** (sem permissão ⇒ iniciais no perfil e nos posts da comunidade). Action de uso único (não regrava após concluído); migração 0019
- ✅ **Assistente virtual + Agenda** (`/corretor/assistente`, `/corretor/agenda`): chat da assistente com **voz** (Web Speech pt-BR, transcrição em tempo real, fallback gracioso) e texto; comandos em português **executam de verdade**: "minha agenda de hoje", "agendar visita com Sofia amanhã às 15h" (vincula ao negócio), "novo negócio com Carlos de 450 mil", "me lembra de…", "anota no negócio da…", "avisos importantes" (fila do Onde agir agora). Motor de interpretação **determinístico e puro** no `@imobia/core` (intenções, datas relativas, valores por extenso — 59 testes); **agenda** com timeline de hoje + 7 dias, tarefas com vencimento inline, criar/excluir compromissos; fuso America/Sao_Paulo nas bordas, instantes reais no banco (migração 0020)
- ✅ **IA generativa no assistente (Groq)**: interpretação LLM como *fallback* do motor determinístico (frase coloquial → mesmo `ComandoInterpretado`, selo "IA" na resposta; sem chave, tudo segue funcionando) e **transcrição Whisper server-side** (`/api/transcrever`, autenticada) — o microfone funciona em qualquer navegador. `GROQ_API_KEY` só em `.env.local`
- ✅ **CRM total por voz + push-to-talk**: o corretor opera o funil falando — "passa a Sofia para visita" (move etapa + timeline), "fechei com a Camila por 780 mil" (ganho + valor + KPIs), "perdemos a Larissa", "muda o valor…", "o telefone da Sofia é…", "conclui a tarefa de ligar…" — busca de contato insensível a acento; confirmações naturais ("Venda registrada! 🎉"). Microfone **push-to-talk**: toque para gravar, fale com pausas (keep-alive no Web Speech; gravador só para no clique/60s), toque para enviar, X cancela. Motor: 107 testes de interpretação (348 no total)
- ✅ **WhatsApp assistido com IA**: na ficha do negócio, seção "Mensagem por WhatsApp" — pílulas de objetivo por estado (follow-up, marcar visita, avançar proposta, **reativar** em destaque quando parado, pós-venda no ganho), mensagem redigida pela IA com o contexto real (nome, imóvel, etapa, dias parado — **proibido inventar dados**), editável, com "Abrir no WhatsApp" (`wa.me` com o texto) e "Copiar"; fallback determinístico no `@imobia/core` sem chave (21 testes). Pela assistente: *"mensagem de follow-up para a Sofia"* → texto pronto + botão do WhatsApp (382 testes no total)
- ✅ **Newsletter** (V2 §16): captura pública com consentimento LGPD (landing + rodapé, idempotente), painel do gestor (`/corretor/newsletter`) com edições (título/assunto/introdução + até 6 imóveis **da própria org**), **preview de e-mail** HTML email-safe (tabelas 600px, paleta quente, links para produção, rodapé LGPD com cancelamento), marcar pronta/copiar HTML; envio automático pluggável via `RESEND_API_KEY`. Inscritos são **da plataforma**: e-mails visíveis só a admin; gestor vê o total (0021+0022)
- ✅ **Publicado na Vercel**: https://mob-ia.vercel.app (GitHub MedResumosAcademy/MobIA → deploy automático a cada push; root `apps/web`)
- 🎉 **Escopo V2 completo** — próximas frentes: melhorias contínuas (auditoria de qualidade, hero imersivo, cookies/privacidade), paridade mobile, WhatsApp Business API oficial

> Convites de corretor/gestor: signup público sempre nasce `cliente`; promoção só via `privado.convites` (server-side). Seed de dev: `supabase/seed-dev.sql` (usuários @teste.mobia, senha `MobIA!teste1`).

## Desenvolvimento

```bash
pnpm install        # instala tudo (workspace)
pnpm test           # testes (domain + core)
pnpm typecheck      # typecheck de todos os pacotes
pnpm --filter web dev      # web em localhost:3000
pnpm --filter mobile start # Expo dev server
```
