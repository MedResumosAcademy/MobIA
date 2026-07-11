# Deploy e produção — ImobIA

Runbook do deploy do app web. O produto está **em produção** em https://mob-ia.vercel.app.

## 1. Pipeline

- **Repositório:** GitHub `MedResumosAcademy/MobIA`.
- **Hospedagem:** Vercel, projeto `mob-ia.vercel.app`, **root directory `apps/web`**.
- **Gatilho:** todo **push na `main` = deploy automático**. Não há ambiente de staging — cuidado redobrado antes do push.
- **Mobile:** Expo/EAS (builds nativos separados; não participa do pipeline da Vercel).

## 2. Variáveis de ambiente na Vercel

| Variável | Obrigatória? | Sem ela |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Sim | O app não sobe |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ Sim | O app não sobe |
| `GROQ_API_KEY` | Opcional | Assistente segue com o motor determinístico, sem fallback LLM nem transcrição Whisper |
| `RESEND_API_KEY` | Opcional | Newsletter segue funcional; gestor copia o HTML em vez do envio automático |
| `GROQ_PULAR_70B` | Opcional (debug) | Cascata IA usa a ordem padrão (70B → scout) |

## 3. Supabase (banco de produção)

- O repositório referencia o projeto de desenvolvimento **"ImobIA - Dev"** (`yxddovprxdquitqtdwbh`, sa-east-1).
- **Projeto que serve a produção:** `PREENCHER` — se produção usa um projeto Supabase separado, registrar aqui o ref; se usa o mesmo projeto de dev, registrar isso como decisão consciente (e planejar a separação).

### Processo de migração

1. Nova mudança de schema/RLS = **novo arquivo** `supabase/migrations/00NN_*.sql` (próximo número da sequência).
2. **Nunca editar migração já aplicada** — sempre criar uma nova.
3. Aplicar a migração no banco de produção **antes ou junto** do push que depende dela (o deploy é automático; código novo não pode chegar antes do schema).
4. RLS nunca é afrouxada — mudanças de acesso só via migração nova, revisada.

## 4. Checklist pós-deploy

Após cada deploy relevante, verificar em https://mob-ia.vercel.app:

- [ ] Login com o usuário seed `corretor.alfa@teste.mobia` (senha `MobIA!teste1`) funciona.
- [ ] Catálogo (`/imoveis`) carrega com imóveis e fotos.
- [ ] Ficha de imóvel (`/imoveis/[id]`) abre com a simulação do plano.
- [ ] Assistente (`/corretor/assistente`) responde a um comando (ex.: "minha agenda de hoje").

## 5. Rollback

Pela dashboard da Vercel: *Deployments → deploy anterior → Promote to Production*. Migrações de banco não têm rollback automático — se uma migração causou o problema, criar uma migração corretiva nova (nunca editar a aplicada).
