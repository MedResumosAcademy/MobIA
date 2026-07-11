# Glossário — ImobIA

Termos do mercado imobiliário e de financiamento usados no projeto.

## Produto

- **Sonhômetro** — funcionalidade que calcula a capacidade de compra do cliente (valor máximo de imóvel financiável) a partir de renda, FGTS, idade, estado civil, dependentes e cidade.
- **Compre do seu jeito** — simulador interativo em que o cliente arrasta a entrada e o plano de pagamento se recalcula em tempo real.
- **Coringa** — motor de inteligência que gera estratégias de compra (A/B/C/D) para o corretor a partir do cenário financeiro do cliente.
- **Termômetro / temperatura** — classificação automática da intenção de compra do lead (🔥 quente, 🔥🔥 muito quente, 🔥🔥🔥 pronto para compra).
- **Lead** — interesse de um cliente em um imóvel, criado automaticamente a partir do comportamento.
- **Assistente** — chat com voz/texto do corretor (`/corretor/assistente`); comandos em português viram um `ComandoInterpretado` (intenção + parâmetros) pelo motor determinístico do `@imobia/core`, com fallback de IA (Groq) para frases coloquiais.
- **Intenção** — o que o corretor quis fazer num comando do assistente (ex.: `agendar`, `criar_negocio`, `mover_etapa`), extraída da frase.

## Comunidade e produtividade

- **Streak** — dias **consecutivos** com publicação na comunidade; exibido com 🔥 e recorde pessoal no "Seu placar".
- **Faixa** — nível do corretor na comunidade conforme os pontos: Iniciante → … → **Lenda**.
- **Pontos da comunidade** — pontuação por publicações, curtidas recebidas e seguidores; alimenta o Ranking Nacional.
- **Gamificação (perfil)** — nível/XP e **conquistas (badges)** do corretor no perfil (ex.: Primeira venda, Top closer, Milionário), calculados pelo `@imobia/core` a partir do funil.
- **Onde agir agora** — fila priorizada de ações no painel do corretor: negócios parados, tarefas atrasadas e leads quentes sem negócio, com atalho direto.
- **Negócio parado ("parado há X dias")** — negócio sem atividade há tempo demais; indicador de atenção/parado no Kanban, calculado no `@imobia/core`.
- **Double opt-in** — inscrição na newsletter só ativa após o inscrito confirmar por e-mail (exigência LGPD).

## Financiamento e pagamento

- **Ato** — pagamento inicial / sinal no ato da compra (entrada).
- **Parcelas** — pagamentos mensais, tipicamente durante a obra (imóvel na planta).
- **Balão / reforço / intermediária** — pagamentos periódicos maiores (semestrais, anuais ou intervalados) além das parcelas mensais.
- **Financiamento** — saldo devedor financiado por um banco, geralmente liberado na entrega das chaves.
- **Chaves** — entrega do imóvel ao comprador.
- **FGTS** — Fundo de Garantia do Tempo de Serviço; pode compor a entrada ou amortizar o saldo.
- **Comprometimento de renda** — percentual máximo da renda mensal que pode ir para a parcela (regra usual ~30%).
- **Centavos** — convenção do sistema: **todo valor monetário é um inteiro em centavos** (tipo `Centavos` no `@imobia/core`, colunas do banco); a conversão para reais acontece só na exibição.

## Modalidades

- **MCMV (Minha Casa Minha Vida)** — programa habitacional com faixas de renda, subsídios e tetos de valor por região.
- **SBPE** — Sistema Brasileiro de Poupança e Empréstimo; financiamento com recursos da poupança, para imóveis acima do teto MCMV.
- **Crédito Associativo / Apoio à Produção (GERIC)** — modalidade da Caixa para incorporações; financiamento durante a produção do empreendimento.

## Comercial

- **CAC** — Custo de Aquisição de Cliente.
- **Taxa de conversão** — proporção de leads que avançam entre etapas do funil (ex.: lead → fechamento).
- **Funil de vendas** — etapas: lead → visita → simulação → proposta → fechamento.
- **CRECI** — registro profissional do corretor de imóveis.
- **Unidade** — imóvel específico dentro de um empreendimento (ex.: apartamento 905 vs 705).
