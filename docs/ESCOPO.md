# ImobIA — Escopo do Projeto

> Documento vivo. O produto está **em produção** em https://mob-ia.vercel.app — as seções de visão/funcionalidades seguem válidas; a arquitetura implementada está no início do §8 e o status real de cada fase no §9. Ver também o [README](../README.md) (status atual) e [DECISOES.md](DECISOES.md) (decisões de arquitetura).

## Decisões tomadas

| # | Decisão | Escolha | Impacto |
|---|---|---|---|
| 1 | Plataforma | **Web/PWA + App nativo em paralelo** | Monorepo com motor financeiro compartilhado (§8) |
| 2 | Cliente pagante | **Corretor autônomo + Imobiliária desde o início** | Papéis e permissões multi-tenant no MVP (§3) |
| 3 | Foco do MVP | **Experiência do cliente** | Catálogo, simulador, plano visual e Sonhômetro primeiro (§9) |
| 4 | Modalidades | **Múltiplas desde o início** | Motor financeiro genérico e parametrizável (§6) |
| 5 | Unidade reservada na ficha | **Esconder** (só disponíveis) | RLS pública de unidades mantida como está (§5.5) |
| 6 | Visibilidade do lead p/ corretor (V1) | **Cliente identificado** (nome/contato + comportamento) | Painel de leads mostra quem é o cliente; **exige fluxo de consentimento LGPD** (ver §12) |

> ⚠️ **Nota de escopo:** as escolhas 1, 2 e 4 são abrangentes e ampliam significativamente o MVP. A arquitetura abaixo foi desenhada para suportar essa amplitude sem retrabalho — concentrando a complexidade no **motor financeiro compartilhado** e em uma **base multi-tenant** desde o dia 1. Mesmo assim, recomenda-se lançar primeiro para um conjunto reduzido de cidades/empreendimentos para validar antes de escalar.

> ⚖️ **Consequência da decisão 6 (LGPD):** expor identidade + intenção de compra do cliente ao corretor é dado pessoal sensível de comportamento. Antes de ligar o painel de leads em produção, é obrigatório: (a) consentimento explícito do cliente no cadastro/onboarding; (b) política de privacidade cobrindo o compartilhamento com corretores/imobiliárias; (c) base legal e finalidade registradas. A RLS atual já permite o corretor/gestor ver favoritos/eventos da própria org — falta a camada de consentimento.

---

## 1. Visão geral

O **ImobIA** é uma plataforma de inteligência imobiliária que centraliza, em um único ponto, toda a jornada de compra de um imóvel — da descoberta ao fechamento — e toda a gestão comercial e financeira do corretor.

Para o **cliente**, é uma experiência de autoatendimento: ele descobre imóveis, compara, **monta o próprio plano de pagamento** com uma barra interativa, simula financiamento e descobe quanto pode comprar — tudo sem precisar falar com ninguém.

Para o **corretor**, é um centro de comando que transforma cada interação do cliente em **lead qualificado automaticamente**, classifica a "temperatura" do lead e oferece um motor de estratégias financeiras (o **Coringa**) que resolve em segundos o que hoje nenhum corretor faz rápido.

### Posicionamento

Não vendemos como CRM. Não vendemos como portal. Não vendemos como simulador.

> **"O primeiro aplicativo que permite ao cliente montar a própria compra."**
> O "Netflix dos imóveis": o cliente entra, escolhe, compara, monta, simula e favorita — e o corretor entra apenas para fechar.

---

## 2. Problema e oportunidade

| Dor | Quem sente | Como o ImobIA resolve |
|---|---|---|
| Cliente não entende **como** comprar (ato, balões, financiamento, FGTS) | Cliente | Plano de pagamento visual + simulador interativo |
| Cliente não sabe **quanto** pode comprar | Cliente | Sonhômetro (capacidade de compra) |
| Corretor perde tempo cadastrando lead e adivinhando interesse | Corretor | Captura automática de leads por comportamento |
| Corretor não sabe quem está pronto para comprar | Corretor | Lead scoring por "temperatura" |
| Montar estratégia de compra é lento e exige expertise | Corretor | Coringa (motor de estratégias) |
| Gestão (imóveis, pagamentos, funil, CAC) espalhada em planilhas | Corretor/Imobiliária | Gestão centralizada |

**Tese central:** aumentar a taxa de conversão do corretor entregando **clareza** ao cliente e **inteligência** ao corretor.

---

## 3. Usuários

### 3.1 Cliente (comprador)
Pessoa interessada em adquirir um imóvel. **Não vê** CRM, gestão ou burocracia. Vê apenas descoberta, simulação e plano de pagamento.

### 3.2 Corretor
Profissional que gere uma carteira de imóveis e clientes. Recebe leads automaticamente, acompanha o funil, usa o Coringa e gere finanças e pagamentos.

### 3.3 Imobiliária / Gestor
Administra uma equipe de corretores: distribuição de leads, metas, relatórios consolidados de CAC e conversão. **Faz parte do MVP** — o produto é vendido tanto para o corretor autônomo quanto para a imobiliária, então a base é **multi-tenant** desde o início:

- Um corretor autônomo é, na prática, uma "imobiliária de um assento".
- Uma imobiliária tem N corretores, carteira compartilhada e visão consolidada.
- Permissões e isolamento de dados por organização (tenant) já no dia 1.

---

## 4. Área do Cliente

A experiência do cliente é deliberadamente simples. Quatro pilares:

### 4.1 Encontre seu imóvel (descoberta)

Filtros principais:
- Casa
- Apartamento
- Terreno
- Lançamento
- Alto padrão
- Minha Casa Minha Vida (MCMV)

Filtros secundários: cidade/bairro, faixa de preço, quartos, vagas, área.

### 4.2 Ficha do imóvel

Ao abrir um imóvel, o cliente já vê tudo:

- 📍 **Localização** (mapa)
- 📸 **Fotos**
- 📐 **Planta**
- 💰 **Valor**
- 🏦 **Simulação** de financiamento
- 📊 **Plano de pagamento**

### 4.3 Compre do seu jeito (o "ouro")

Simulador interativo. Exemplo: Apartamento de **R$ 320.000**.

O cliente arrasta uma **barra de entrada** (ex.: R$ 10.000 → R$ 20.000 → R$ 30.000 → R$ 50.000) e o sistema **recalcula tudo na frente dele, em tempo real**, sem precisar falar com corretor.

> Cada interação alimenta o motor de leads do corretor (ver §5).

### 4.4 Plano de pagamento visual

Em vez de texto, um **gráfico/timeline** que o cliente entende em segundos:

```
  Ato  ──▶  Parcelas  ──▶  Balões  ──▶  Financiamento  ──▶  Chaves
```

- **Ato:** entrada inicial (sinal)
- **Parcelas:** mensais durante a obra
- **Balões:** reforços periódicos (semestrais/anuais)
- **Financiamento:** saldo financiado pelo banco na entrega
- **Chaves:** entrega do imóvel

### 4.5 Sonhômetro (capacidade de compra)

Diferencial que "ninguém faz". O cliente responde:
- Renda
- FGTS
- Idade
- Estado civil
- Filhos / dependentes
- Cidade

O sistema responde, por exemplo:

> **"Hoje você consegue comprar imóveis de até R$ 420.000."**

E a partir daí passa a mostrar **apenas imóveis compatíveis**. Transforma o catálogo inteiro em uma vitrine personalizada e realista.

### 4.6 Favoritos e comparação
O cliente favorita imóveis e compara lado a lado (preço, parcela, localização). Cada favorito é sinal de interesse (lead).

---

## 5. Área do Corretor

> Aqui muda tudo: **o corretor não cadastra cliente — o sistema faz isso.**

### 5.1 Captura automática de leads

Todo comportamento relevante do cliente vira lead/evento:

| Gatilho | Resultado |
|---|---|
| Cliente clicou no imóvel | Lead criado |
| Cliente simulou | Lead criado / enriquecido |
| Cliente favoritou | Lead criado / enriquecido |
| Cliente voltou 3× ao mesmo imóvel | Lead sinalizado |

### 5.2 Timeline de comportamento

O corretor recebe sinais legíveis e acionáveis, não dados crus:

- *"João visitou 7 vezes o apartamento 905."*
- *"João simulou entrada de R$ 35.000."*
- *"João clicou em financiamento."*

### 5.3 Lead scoring (termômetro)

Classificação automática por intenção de compra:

- 🔥 **Cliente quente**
- 🔥🔥 **Cliente muito quente**
- 🔥🔥🔥 **Cliente pronto para compra**

O score combina frequência de visitas, profundidade de simulação, favoritos, e ações de alto valor (clicar em financiamento, completar Sonhômetro).

### 5.4 CORINGA — inteligência imobiliária (o coração do negócio)

> "Não é CRM. Não é portal. É inteligência imobiliária."

O corretor informa o cenário do cliente:
- Renda: R$ 6.500
- FGTS: R$ 22.000
- Entrada: R$ 15.000
- Imóvel: R$ 390.000

O Coringa responde com **múltiplas estratégias** (A, B, C, D), por exemplo:

- *"Se acrescentar R$ 18.000 no valor financiado e usar FGTS na entrada, a parcela cai para R$ X."*
- *"Troque da unidade 905 para a 705 e economize R$ Y."*
- *"Antecipe R$ 20.000 em fevereiro e reduza R$ Z do financiamento."*

É o que **corretor nenhum sabe fazer rápido**. Detalhamento do motor em §6.

### 5.5 Gestão de imóveis
Cadastro e gestão da carteira de imóveis sob responsabilidade do corretor: status (disponível/reservado/vendido), unidades, fotos, plantas, tabela de preços e condições de pagamento.

### 5.6 Controle financeiro e de pagamentos
Acompanhamento dos planos de pagamento dos clientes que fecharam:
- Entrada conforme % do imóvel
- Parcelas mensais
- Reforços semestrais / intervalados / balões
- Etapa de financiamento bancário
- Alertas de vencimento e inadimplência

### 5.7 Dashboard comercial (CRM + métricas)
Funil de vendas (lead → visita → simulação → proposta → fechamento) e indicadores:
- **CAC** (custo de aquisição de cliente)
- **Taxa de conversão** por etapa
- Leads por temperatura
- Tempo médio de fechamento

---

## 6. Motor financeiro (núcleo técnico)

O coração do produto. Três capacidades distintas sobre uma mesma base de cálculo.

### 6.1 Modalidades suportadas
**Decisão: suportar múltiplas modalidades desde o início.** Para que isso seja viável sem multiplicar o esforço, o motor é construído como um **núcleo de cálculo genérico** (fluxo de caixa, capacidade, financiamento) sobre o qual cada modalidade é uma **configuração de regras parametrizada** — não um código separado.

Modalidades, conforme planilhas de simulação habitacional Caixa:
- Imóvel novo
- Imóvel usado
- Minha Casa Minha Vida (faixas de renda + subsídio)
- SBPE (Sistema Brasileiro de Poupança e Empréstimo)
- Crédito Associativo / Apoio à Produção (GERIC)
- Aquisição de terreno + construção

> Cada modalidade declara: tetos de valor, regras de subsídio, taxas/índices aplicáveis, prazos e exigências de enquadramento — tudo em `ParametrosFinanceiros` versionado (§7), atualizável sem deploy.

### 6.2 Estrutura de um plano de pagamento (imóvel na planta)
```
Valor do imóvel
 ├── Ato (sinal / entrada)
 ├── Parcelas mensais (durante a obra)
 ├── Reforços / balões (semestrais, anuais ou intervalados)
 └── Saldo → Financiamento bancário (na entrega das chaves)
```
O simulador "Compre do seu jeito" varia a entrada e redistribui o restante respeitando regras do empreendimento.

### 6.3 Sonhômetro — cálculo de capacidade
Entradas: renda, FGTS, idade, estado civil, dependentes, cidade.

Fatores de cálculo (parametrizáveis):
- Comprometimento máximo de renda na parcela (regra usual ~30%)
- FGTS como composição de entrada
- Prazo máximo limitado pela idade (regra Caixa: idade + prazo ≤ 80 anos e 6 meses)
- Composição de renda (cônjuge)
- Enquadramento e subsídio MCMV por faixa de renda e por cidade/região
- Teto de valor do imóvel por programa/região

Saída: **valor máximo de imóvel financiável** + filtro automático do catálogo.

### 6.4 Coringa — motor de otimização
Dado um cenário (renda, FGTS, entrada, imóvel-alvo), gera e ranqueia estratégias variando alavancas:
- Uso de FGTS (entrada vs. amortização)
- Valor financiado vs. entrada
- Troca de unidade (mesma planta, andar/posição diferente)
- Antecipações / amortizações pontuais
- Mudança de prazo
- Mudança de modalidade

Cada estratégia retorna impacto em **parcela, total pago, prazo e viabilidade de aprovação**. Implementação: regras determinísticas + camada de IA para explicação em linguagem natural e geração de cenários.

> ⚠️ **Premissa crítica:** as fórmulas e parâmetros (taxas, índices, regras Caixa/MCMV) precisam ser validados com fonte oficial e atualizáveis sem deploy (tabela de parâmetros versionada). Simulações devem ser marcadas como estimativas, não proposta formal.

---

## 7. Modelo de dados (entidades principais)

- **User** — base, com papel (`cliente` | `corretor` | `gestor`).
- **ClienteProfile** — renda, FGTS, idade, estado civil, dependentes, cidade, capacidade calculada.
- **CorretorProfile** — CRECI, imobiliária, carteira.
- **Imovel** — tipo, status, localização, valor, fotos, plantas, empreendimento, corretor responsável.
- **Unidade** — quando aplicável (apto 905 vs 705): andar, posição, preço, condições.
- **PlanoPagamento** — ato, parcelas, balões, financiamento, modalidade.
- **Simulacao** — snapshot de uma simulação feita pelo cliente (entrada escolhida, resultado).
- **Lead** — cliente + imóvel + score/temperatura + origem.
- **Evento** — log de comportamento (clique, visita, favorito, simulação) — base do scoring e da timeline.
- **Favorito** — cliente ↔ imóvel.
- **Negocio/Deal** — etapa do funil, valores, datas.
- **Pagamento** — parcela de um negócio fechado (valor, vencimento, status).
- **ParametrosFinanceiros** — taxas, índices, regras (versionado).

---

## 8. Arquitetura técnica

### Como ficou de verdade (implementado)

A stack real do produto em produção difere da proposta original abaixo:

- **Supabase** — Postgres multi-tenant com **RLS por `org_id`**, Auth (papéis cliente/corretor/gestor/admin) e Storage (fotos/plantas por org). Migrações versionadas em `supabase/migrations/`.
- **Backend** — Server Actions e Route Handlers do **Next.js 16** (`apps/web`); nenhum serviço separado (`services/api` nunca foi criado).
- **Monorepo** — apenas `packages/core` (motor financeiro/inteligência, TS puro) e `packages/domain` (zod + tipos do banco). `packages/api-client` e `packages/ui` foram **descartados por simplicidade** — cada app fala com o Supabase diretamente e tem seus próprios componentes.
- **IA** — Groq (cascata llama-70B → scout como fallback do motor determinístico; Whisper para transcrição de voz). Sem chave, tudo degrada graciosamente.
- **Deploy** — Vercel (web, deploy automático a cada push na `main`) + EAS/Expo (mobile). Ver [DEPLOY.md](DEPLOY.md).

As seções 8.1 e 8.2 abaixo são a **proposta original (superada — mantida como histórico)**.

**Restrição de partida:** web **e** app nativo em paralelo, multi-tenant (autônomo + imobiliária), múltiplas modalidades. A chave para isso não virar dois produtos é **um motor financeiro único compartilhado** por todas as faces.

### 8.1 Monorepo com núcleo compartilhado — proposta original (superada)

```
mobia/ (Turborepo)
├── packages/
│   ├── core/          ← MOTOR FINANCEIRO (TS puro): simulação, Sonhômetro,
│   │                    Coringa, plano de pagamento, modalidades. SEM UI.
│   ├── domain/        ← tipos, schemas (zod), regras de negócio compartilhadas
│   ├── api-client/    ← cliente de dados tipado, usado por web e mobile
│   └── ui/            ← design tokens + componentes (web via shadcn; mobile próprio)
├── apps/
│   ├── web/           ← Next.js (App Router) — SEO do catálogo + área do corretor
│   └── mobile/        ← Expo (React Native) — iOS/Android
└── services/
    └── api/           ← backend (pode ser as próprias rotas do Next no início)
```

O **`packages/core`** é a joia da coroa: TypeScript puro, sem dependência de plataforma, com cobertura de testes alta. A mesma simulação roda idêntica no web, no app e no servidor. Isso é o que torna "web + nativo em paralelo" viável sem duplicar a lógica mais crítica e arriscada.

### 8.2 Stack por camada — proposta original (superada; o banco/auth reais são Supabase, ver acima)

| Camada | Escolha | Por quê |
|---|---|---|
| Monorepo | **Turborepo** | Build/cache compartilhado entre web e mobile |
| Web | **Next.js (App Router)** | SSR para SEO do catálogo + painel do corretor |
| Mobile | **Expo (React Native)** | iOS/Android com reuso máximo de `core`/`domain` |
| Núcleo financeiro | **TypeScript puro (`packages/core`)** | Compartilhado e testável; mesma conta em todo lugar |
| UI web | React + Tailwind + shadcn/ui | Velocidade e consistência |
| Backend | Next Route Handlers / Server Actions (depois extrair serviço se preciso) | Monólito modular para começar |
| Banco | **PostgreSQL** (Marketplace, ex. Neon) | Relacional + multi-tenant por organização |
| Multi-tenancy | Coluna `org_id` + RLS / escopo por organização | Isola dados de autônomos e imobiliárias |
| Auth | Provedor gerenciado (ex. Clerk) | Papéis cliente/corretor/gestor + organizações |
| Mídia | Blob storage | Fotos e plantas |
| IA (Coringa/explicações) | AI SDK + AI Gateway | Geração de cenários e linguagem natural |
| Eventos/scoring | Tabela de eventos + job de scoring | Base do termômetro |
| Deploy | Vercel (web) + EAS (mobile) | Preview por PR no web; builds nativos via Expo |

> Embora o foco do MVP seja a **experiência do cliente** (§9), a base multi-tenant e o `packages/core` são fundação obrigatória já na primeira entrega, porque sustentam tudo que vem depois.

---

## 9. Roadmap por fases

### Fase 0 — Fundação (habilita tudo)
- Monorepo Turborepo + `packages/core`, `packages/domain`
- Modelo de dados **multi-tenant** (organização = autônomo ou imobiliária)
- Auth com papéis (cliente / corretor / gestor) e organizações
- `ParametrosFinanceiros` versionado + esqueleto das múltiplas modalidades
- Apps `web` (Next.js) e `mobile` (Expo) consumindo o mesmo `core`

### MVP — Experiência do cliente (validar a tese: cliente monta a própria compra)
1. Catálogo + filtros + ficha do imóvel (web e mobile)
2. **Compre do seu jeito** (slider de entrada + recálculo em tempo real) — usa `core`
3. **Plano de pagamento visual**
4. **Sonhômetro** (capacidade de compra) — usa `core`
5. Favoritos e comparação
6. Captura automática de eventos → leads (alimenta o corretor desde já)
7. Cadastro de imóveis pelo corretor (mínimo para abastecer o catálogo)

### V1 — Inteligência e gestão do corretor
8. ✅ Painel do corretor: leads + timeline + **termômetro** 🔥
9. ✅ **Coringa** (motor de estratégias) — usa `core`
10. ✅ Visão de **Imobiliária/Gestor**: dashboard consolidado + distribuição de leads
11. ✅ **Ferramenta comercial completa / CRM** (ver §9.1) — funil de negócios (Kanban/lista), conversão, atividades, tarefas, dashboard gerencial
12. ⏳ **pendente** — Controle financeiro e de pagamentos (entrada %, semestrais, intervalados, balões)

### 9.1 Ferramenta comercial completa (CRM) — prioridade da V1
O produto precisa ser uma **ferramenta comercial completa**, não só captura de leads. Núcleo:
- **Funil / pipeline de negócios** (Negócio/Deal): etapas (novo → contato → visita → proposta → fechamento; ganho/perdido), valor do negócio, ligado a cliente/imóvel/lead.
- **Atividades e follow-up**: notas, ligações, e-mails, visitas, mudanças de etapa — timeline por negócio; tarefas/lembretes.
- **Métricas de conversão** por etapa e por corretor; **CAC** quando houver dados de custo.
- **Contato do lead/cliente** (nome, telefone, e-mail) para o corretor atuar (ver §12 — decisão 6 / LGPD).
- Conversão de **lead → negócio** com um clique.

### V2 — Escala e crescimento
13. ✅ **Chatbot → Assistente virtual com voz/IA** (rota `/corretor/assistente`): comandos em português que executam de verdade (agenda, CRM por voz, lembretes), motor determinístico + fallback LLM (Groq) e transcrição Whisper.
14. ✅ **Comunidade / feed social** (rota `/comunidade`): feed nacional cross-org, publicar/curtir/seguir, streak e faixas.
15. ✅ **Ranking de corretores** (gamificação; exibido na comunidade e na visão de equipe).
16. ✅ **Newsletter** (rota `/corretor/newsletter`): captura com LGPD/double opt-in, edições do gestor, envio pluggável.
17. ⏳ **pendente** — Integrações (portais, bancos/Caixa, CRMs externos), relatórios avançados / BI, push.

> **Status:** os itens 12 e 17 são as **únicas pendências** do escopo original; todo o resto está em produção.

> Multi-tenant e suporte às múltiplas modalidades nascem na Fase 0; o que evolui por fase é a **profundidade** de cada uma, não a sua existência. A arquitetura (monorepo + `core` compartilhado + base multi-tenant) já suporta as fases V2 sem retrabalho.

---

## 10. Métricas de sucesso

- **Norte:** taxa de conversão do corretor (lead → fechamento).
- Ativação do cliente: % que completa o Sonhômetro / faz ≥1 simulação.
- Qualidade do lead: % de leads 🔥🔥🔥 que viram negócio.
- Engajamento: simulações por cliente, retornos ao mesmo imóvel.
- Eficiência: tempo do corretor por lead; tempo médio de fechamento.

---

## 11. Modelo de negócio (hipóteses)

- **SaaS por corretor/imobiliária** (assinatura mensal por assento).
- Possível tier por volume de imóveis/leads.
- Add-ons: Coringa avançado, relatórios, integrações.
- *A validar — não é decisão de produto ainda.*

---

## 12. Premissas e questões em aberto

**Premissas:**
- Fórmulas financeiras precisam de validação oficial e parametrização versionada.
- Simulações são estimativas, não propostas formais (aviso legal necessário).

**Resolvidas (ver "Decisões tomadas" no topo):**
- ✅ **Plataforma:** web/PWA + app nativo em paralelo (monorepo, §8).
- ✅ **Cliente do produto:** corretor autônomo + imobiliária desde o início (multi-tenant, §3.3).
- ✅ **Foco do MVP:** experiência do cliente (§9).
- ✅ **Modalidades:** múltiplas desde o início (motor parametrizável, §6.1).

**Ainda em aberto:**
1. **Origem dos imóveis:** cadastro manual pelo corretor, importação de portais, ou integração com construtoras? *(MVP assume cadastro manual.)*
2. **Fonte das taxas/regras:** quem mantém os parâmetros (Caixa, índices, regras MCMV) atualizados e com que frequência?
3. **Marca/escopo do nome:** "ImobIA" sugere forte componente de IA — o Coringa (IA) entra na V1; confirmar se o discurso de venda do MVP já deve enfatizar IA ou só a experiência do cliente.
4. **Cidades/empreendimentos do piloto:** por onde começar para validar antes de escalar.

---

*O MVP, a V1 e a V2 foram entregues e estão em produção (ver §9 e o [README](../README.md)). As pendências do escopo original são os itens 12 (controle financeiro de pagamentos) e 17 (integrações/BI/push); as questões em aberto acima seguem relevantes para a evolução do produto.*
