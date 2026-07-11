<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Regras do projeto (ImobIA)

1. **pt-BR em tudo:** nomes de código, UI e commits em português do Brasil.
2. **Dinheiro em CENTAVOS:** valores monetários são sempre inteiros em centavos (tipo `Centavos` no `@imobia/core`); converter para reais só na exibição.
3. **Lint 0/0:** o lint do web deve ficar em **0 erros e 0 avisos**. `setState` síncrono dentro de `useEffect` é proibido.
4. **RLS nunca afrouxa:** mudanças de acesso a dados só via migração nova e revisada — jamais relaxar uma policy existente.
5. **Migrações são imutáveis:** nunca editar arquivo já aplicado em `supabase/migrations/`; criar novo arquivo com a próxima numeração.
6. **Fuso nas bordas:** banco guarda `timestamptz` (instantes reais); `America/Sao_Paulo` só na exibição/interpretação de datas na UI.
7. **Porta 3000 é do usuário:** o dev server do usuário roda em `localhost:3000` e não pode cair. Para validar ao vivo, use `build` + `start` em outra porta e mate **só o seu PID** (jamais `pkill` de next).

Ver também [docs/DECISOES.md](../../docs/DECISOES.md) e [docs/DEPLOY.md](../../docs/DEPLOY.md).
