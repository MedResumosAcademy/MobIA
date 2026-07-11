# ImobIA — Histórias de Usuário do MVP

> ✅ **Todas as 24 histórias (H-01..H-24) foram entregues** — o MVP está completo e em produção (ver [README §Status](../README.md#status)). Este documento é mantido como **registro histórico** do planejamento; os itens listados em "Fora do MVP" (painel do corretor, Coringa, funil) também já foram entregues nas fases V1/V2.

> Escopo: **Fase 0 (Fundação)** + **MVP (Experiência do Cliente)**, conforme [ESCOPO.md §9](ESCOPO.md). Foco em validar a tese central: *o cliente monta a própria compra*.

## Premissas adotadas (defaults — sobrescrevíveis)

Para destravar o detalhamento sem travar em decisões pendentes, adotei estes defaults. Qualquer um pode ser alterado:

1. **Origem dos imóveis:** cadastro manual pelo corretor no MVP (sem importação de portais/construtoras ainda).
2. **Parâmetros financeiros:** uma tabela `ParametrosFinanceiros` versionada, mantida por um admin interno, validada inicialmente contra as planilhas de simulação Caixa; revisada quando taxas/regras mudarem.
3. **Marca/IA:** o discurso do MVP enfatiza a **experiência do cliente** ("monte sua compra"); o Coringa (IA) é destaque da V1.
4. **Piloto:** começar com 1 cidade e 1–2 empreendimentos do corretor parceiro, para validar antes de escalar.

## Convenções

- Formato: *Como [persona], quero [ação], para [benefício]*.
- IDs: `H-NN`. Prioridade MoSCoW: **M** (Must), **S** (Should), **C** (Could).
- "DoD" = critérios de aceite (Definition of Done).
- Personas: **Cliente**, **Corretor**, **Gestor**, **Admin**.

---

## Fase 0 — Fundação

### Épico E0.1 — Monorepo e núcleo compartilhado

**H-01 (M)** — Como *time*, quero um monorepo Turborepo com `packages/core`, `packages/domain`, `apps/web` e `apps/mobile`, para compartilhar a lógica entre plataformas.
- **DoD:** `apps/web` (Next.js) e `apps/mobile` (Expo) sobem localmente; ambos importam de `packages/core`; build/cache do Turborepo funcionando; CI roda lint + testes.

**H-02 (M)** — Como *time*, quero o motor financeiro em `packages/core` (TS puro, sem UI), para que a mesma conta rode idêntica em web, mobile e servidor.
- **DoD:** funções de simulação expostas; cobertura de testes ≥ 80% no `core`; nenhuma dependência de React/plataforma; tipos exportados via `packages/domain`.

### Épico E0.2 — Multi-tenant, papéis e autenticação

**H-03 (M)** — Como *Admin*, quero o conceito de **organização** (tenant), onde um corretor autônomo é uma org de um assento e uma imobiliária é uma org de N assentos, para atender ambos os modelos.
- **DoD:** entidade `Organizacao`; todo dado de negócio carrega `org_id`; isolamento garantido (RLS ou escopo no acesso a dados); testado com 2 orgs sem vazamento.

**H-04 (M)** — Como *usuário*, quero me autenticar e receber um papel (`cliente` | `corretor` | `gestor`), para ver apenas o que me cabe.
- **DoD:** login/logout; papéis aplicados em rotas e na UI; cliente nunca acessa telas de gestão; corretor pertence a uma org.

### Épico E0.3 — Parâmetros e modalidades

**H-05 (M)** — Como *Admin*, quero uma tabela `ParametrosFinanceiros` versionada (taxas, índices, tetos, regras MCMV), para atualizar regras sem novo deploy.
- **DoD:** parâmetros lidos pelo `core`; versionamento com vigência por data; alterar parâmetro reflete nas próximas simulações sem build.

**H-06 (M)** — Como *time*, quero que cada modalidade (MCMV, SBPE, GERIC, novo, usado, terreno+construção) seja uma configuração de regras sobre o `core`, para suportar múltiplas modalidades sem código duplicado.
- **DoD:** ao menos MCMV e SBPE configuradas e testadas no MVP; arquitetura aceita novas modalidades por configuração; modalidade do imóvel determina regras aplicadas.

---

## MVP — Experiência do Cliente

### Épico E1 — Descoberta (catálogo + filtros)

**H-07 (M)** — Como *Cliente*, quero navegar por um catálogo de imóveis com fotos e preço, para descobrir opções rapidamente.
- **DoD:** lista com card (foto, título, cidade, valor, tipo); paginação/scroll infinito; web e mobile.

**H-08 (M)** — Como *Cliente*, quero filtrar por tipo (Casa, Apartamento, Terreno, Lançamento, Alto padrão, MCMV), para focar no que me interessa.
- **DoD:** os 6 filtros principais funcionam e são combináveis; filtros secundários (cidade, faixa de preço, quartos, vagas) disponíveis; resultado atualiza sem recarregar.

**H-09 (S)** — Como *Cliente*, quero buscar por cidade/bairro, para localizar imóveis na região desejada.
- **DoD:** busca textual por localização retorna resultados relevantes.

### Épico E2 — Ficha do imóvel

**H-10 (M)** — Como *Cliente*, quero abrir um imóvel e ver localização, fotos, planta e valor, para entender a oferta sem falar com ninguém.
- **DoD:** ficha mostra 📍 mapa, 📸 galeria de fotos, 📐 planta e 💰 valor; carrega em web e mobile.

**H-11 (M)** — Como *Cliente*, quero ver na ficha a simulação e o plano de pagamento padrão do imóvel, para já ter uma noção das condições.
- **DoD:** ficha exibe simulação inicial e plano de pagamento padrão calculados pelo `core` a partir da modalidade do imóvel.

### Épico E3 — Compre do seu jeito (simulador interativo)

**H-12 (M)** — Como *Cliente*, quero arrastar uma barra de entrada e ver o plano recalcular em tempo real, para montar a compra do meu jeito.
- **DoD:** slider de entrada (ex.: R$10k→R$50k) recalcula ato, parcelas, balões e financiamento na hora; recálculo < 200ms; usa `packages/core`; respeita limites do empreendimento.

**H-13 (S)** — Como *Cliente*, quero alternar a modalidade aplicável (ex.: MCMV vs SBPE) quando elegível, para comparar condições.
- **DoD:** quando o imóvel/cenário permite mais de uma modalidade, cliente alterna e os números mudam coerentemente.

**H-14 (S)** — Como *Cliente*, quero ver um aviso de que a simulação é uma estimativa, não proposta formal, para ter expectativa correta.
- **DoD:** disclaimer visível em toda simulação.

### Épico E4 — Plano de pagamento visual

**H-15 (M)** — Como *Cliente*, quero ver o plano como uma linha do tempo visual (Ato → Parcelas → Balões → Financiamento → Chaves), para entender em segundos.
- **DoD:** componente visual com as 5 etapas, valores e datas/marcos; reage às mudanças do slider (H-12); legível em telas pequenas.

### Épico E5 — Sonhômetro (capacidade de compra)

**H-16 (M)** — Como *Cliente*, quero informar renda, FGTS, idade, estado civil, filhos e cidade, para descobrir quanto consigo comprar.
- **DoD:** formulário guiado curto; valida entradas; salva no perfil do cliente.

**H-17 (M)** — Como *Cliente*, quero receber "Hoje você consegue comprar imóveis de até R$ X", para ter clareza imediata.
- **DoD:** `core` calcula capacidade considerando comprometimento de renda (~30%), FGTS na entrada, prazo por idade (idade+prazo ≤ 80a6m), composição de renda e enquadramento/subsídio MCMV por cidade; resultado exibido com explicação resumida.

**H-18 (M)** — Como *Cliente*, quero que o catálogo passe a mostrar só imóveis compatíveis com minha capacidade, para não perder tempo com o que não cabe.
- **DoD:** após o Sonhômetro, filtro de compatibilidade ativado por padrão (com opção de desligar); ordenação prioriza compatíveis.

### Épico E6 — Favoritos e comparação

**H-19 (M)** — Como *Cliente*, quero favoritar imóveis, para retomá-los depois.
- **DoD:** favoritar/desfavoritar; lista de favoritos por cliente; sincroniza entre web e mobile.

**H-20 (S)** — Como *Cliente*, quero comparar imóveis favoritados lado a lado (preço, parcela, localização), para decidir melhor.
- **DoD:** comparação de 2–3 imóveis em tabela; usa simulações do `core`.

### Épico E7 — Captura automática de eventos → leads

**H-21 (M)** — Como *sistema*, quero registrar eventos de comportamento do cliente (clique, visita, simulação, favorito, retorno), para alimentar o corretor sem cadastro manual.
- **DoD:** eventos persistidos com cliente, imóvel, tipo e timestamp; capturados em web e mobile; base para timeline e scoring.

**H-22 (M)** — Como *sistema*, quero criar/enriquecer um **Lead** automaticamente a partir dos eventos, para que nenhum interesse se perca.
- **DoD:** regras: clicou/simulou/favoritou cria ou enriquece lead; "voltou 3× ao mesmo imóvel" sinaliza o lead; lead associado ao corretor responsável pelo imóvel e à org.

> O *consumo* desses leads pela UI do corretor (lista, timeline, termômetro) é V1 (§9). No MVP garantimos a **captura** e o **registro** corretos.

### Épico E8 — Abastecimento do catálogo (mínimo do corretor)

**H-23 (M)** — Como *Corretor*, quero cadastrar um imóvel com tipo, localização, fotos, planta, valor e condições de pagamento, para abastecer o catálogo do cliente.
- **DoD:** CRUD de imóvel dentro da org; upload de fotos/planta; define modalidade e plano de pagamento padrão; status (disponível/reservado/vendido).

**H-24 (S)** — Como *Corretor*, quero cadastrar unidades de um empreendimento (ex.: 905 vs 705) com preços/condições próprios, para refletir a realidade do lançamento.
- **DoD:** imóvel pode ter N unidades; cada unidade com andar/posição, preço e condições; cliente vê a unidade na ficha.

---

## Fora do MVP (referência rápida)

Vai para V1+: painel do corretor (lista de leads, timeline, **termômetro** 🔥), **Coringa**, funil/CAC/conversão, controle financeiro de pagamentos, visão de Gestor, integrações, push. Ver [ESCOPO.md §9](ESCOPO.md).

---

## Dependências e ordem sugerida

```
E0.1 ─┬─▶ E0.2 ─┬─▶ E8 (cadastro) ─▶ E1 ─▶ E2 ─▶ E3 ─▶ E4
      └─▶ E0.3 ─┘                                  └─▶ E5 ─▶ E6
                                          E7 (eventos) corre em paralelo, a partir de E1
```

1. **Fundação** (E0.1–E0.3) primeiro — sem ela nada do resto compila.
2. **E8** (cadastro mínimo) para existir conteúdo no catálogo.
3. **E1→E2** (ver imóveis), depois **E3→E4** (simular e visualizar) — o coração da tese.
4. **E5** (Sonhômetro) e **E6** (favoritos) reforçam a experiência.
5. **E7** (eventos/leads) integrado desde E1, para já capturar sinais.

*Documento encerrado: todas as histórias foram entregues (E0–E8). O status atual do produto está no [README](../README.md) e no [ESCOPO.md §9](ESCOPO.md).*
