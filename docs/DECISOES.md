# Decisões de arquitetura (ADRs) — ImobIA

Registros curtos das decisões estruturais que qualquer mudança futura precisa respeitar.

## ADR-1 — Dinheiro em CENTAVOS (inteiros) em todo o stack

Todos os valores monetários são **inteiros em centavos**: o tipo `Centavos` no `@imobia/core`, as colunas do banco e os payloads entre camadas. A conversão para reais acontece **só na exibição** (UI formata com `Intl.NumberFormat`). Motivo: eliminar erros de ponto flutuante em cálculo financeiro (juros, parcelas, somas de funil). Nunca armazenar nem trafegar `float` de dinheiro.

## ADR-2 — Fuso America/Sao_Paulo só nas bordas; instantes reais no banco

O banco guarda **`timestamptz` (instantes reais, UTC)**. A conversão para o fuso `America/Sao_Paulo` acontece apenas **nas bordas de UI** (exibição e interpretação de entradas como "amanhã às 15h" no assistente/agenda — migração 0020). Motivo: datas relativas e comparações ("hoje", "atrasada") ficam corretas independentemente do servidor, e o banco nunca guarda horário ambíguo.

## ADR-3 — Comunidade cross-org via denormalização por trigger

O feed da comunidade (`/comunidade`) é **nacional (cross-org)**, mas as tabelas `perfis`/`corretor_profiles` têm RLS **por org**. Solução (migração 0018): a identidade do autor (nome, handle, avatar) é **denormalizada por trigger** nas linhas de post, e o ranking usa uma **view `security definer` (owner)**. Motivo: abrir o feed sem afrouxar a RLS por-org dos perfis. Clientes não acessam a comunidade.

## ADR-4 — Modelo LGPD

- **Consentimento opt-in como portão na RLS de leads:** o corretor só vê clientes que consentiram (migração 0006) — a regra vive no banco, não na UI.
- **CPF é server-only:** validado no `@imobia/core` (dígitos verificadores), nunca exposto em página (migração 0019).
- **Foto do corretor com consentimento de exibição:** sem permissão ⇒ iniciais no perfil e nos posts.
- **Newsletter com double opt-in:** inscrição só ativa após confirmação por e-mail (migração 0023); e-mails de inscritos visíveis só a admin.

## ADR-5 — Papéis: signup público nasce cliente; promoção só via convites

Todo cadastro público cria um usuário com papel `cliente`. A promoção para `corretor`/`gestor` acontece **exclusivamente via `privado.convites`**, processado server-side. Motivo: impedir auto-promoção de papel por manipulação do client. Seed de dev: `supabase/seed-dev.sql`.
