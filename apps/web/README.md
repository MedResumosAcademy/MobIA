# ImobIA — app web

App web do **ImobIA** (Next.js 16, App Router): catálogo/ficha/Sonhômetro para o cliente e CRM completo + assistente com IA para corretor/gestor. Em produção em https://mob-ia.vercel.app.

## Rodando no monorepo

```bash
# na raiz do repositório
pnpm install
pnpm --filter web dev   # sobe em localhost:3000
```

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha as chaves do Supabase (obrigatórias). `GROQ_API_KEY` e `RESEND_API_KEY` são opcionais — o app degrada graciosamente sem elas. Detalhes no [README raiz](../../README.md#setup-do-zero).

## Convenções

As regras do projeto (pt-BR, centavos, lint 0/0, RLS, migrações) estão em [AGENTS.md](AGENTS.md).
