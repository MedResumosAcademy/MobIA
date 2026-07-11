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
| `META_WHATSAPP_TOKEN` | Opcional | Envio real de WhatsApp desligado; CRM segue no modo assistido (wa.me) |
| `META_WHATSAPP_PHONE_NUMBER_ID` | Opcional | Idem — sem o id do número não há envio pela Cloud API |
| `META_WEBHOOK_VERIFY_TOKEN` | Opcional | A Meta não consegue verificar o webhook (GET responde 403) |
| `META_APP_SECRET` | Opcional | Webhook responde 503 (não valida assinatura ⇒ não processa eventos) |
| `META_ORG_ID` | Opcional | Webhook atribui as mensagens à org do primeiro admin (fase single-tenant) |
| `SUPABASE_SERVICE_ROLE_KEY` | Opcional | Webhook responde 503 (não grava mensagens sem sessão). **Server-only — jamais expor no client** |

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

## 6. Conectar WhatsApp (Meta BM)

Passo a passo para ligar o envio real e o recebimento de mensagens do CRM à WhatsApp Cloud API. Sem esses passos **nada quebra**: o app avisa que a Meta não está conectada e o envio assistido (wa.me) continua.

1. **Business Manager:** crie/acesse sua BM em https://business.facebook.com e confirme a verificação do negócio.
2. **App Meta:** em https://developers.facebook.com → *My Apps → Create App* (tipo **Business**), vinculado à sua BM.
3. **Produto WhatsApp:** no painel do app, adicione o produto **WhatsApp** e cadastre (ou migre) o **número de telefone** comercial. Anote o **Phone number ID** (aba *API Setup*).
4. **Token permanente:** em *Business Settings → Users → System users*, crie um system user (papel admin), conceda a ele o app e o WhatsApp account, e gere um **token permanente** com os escopos `whatsapp_business_messaging` e `whatsapp_business_management` (o token temporário da aba API Setup expira em 24h — não use em produção).
5. **App secret:** em *App Settings → Basic*, copie o **App Secret**.
6. **Envs na Vercel** (projeto `mob-ia`, ambiente Production): `META_WHATSAPP_TOKEN` (token permanente), `META_WHATSAPP_PHONE_NUMBER_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` (invente uma string longa e aleatória — é sua), `SUPABASE_SERVICE_ROLE_KEY` (Supabase → *Settings → API keys*; **server-only**) e, opcionalmente, `META_ORG_ID` (uuid da org dona do número — sem ela o webhook usa a org do primeiro admin). Redeploy após salvar.
7. **Webhook:** no produto WhatsApp do app → *Configuration → Webhook*: **Callback URL** `https://mob-ia.vercel.app/api/meta/webhook`, **Verify token** = o mesmo valor de `META_WEBHOOK_VERIFY_TOKEN`, clique em *Verify and save* (a rota GET ecoa o challenge).
8. **Assinar campo:** ainda em *Webhook fields*, assine (subscribe) o campo **`messages`** — é ele que entrega mensagens recebidas e status de envio (`sent`/`delivered`/`read`/`failed`).
9. **Templates:** para INICIAR conversa (fora da janela de 24h) crie e submeta templates em *WhatsApp Manager → Message templates*; só template **aprovado** pode ser disparado (`enviarTemplateWhatsApp`). Texto livre vale apenas nas 24h após a última mensagem recebida do cliente.
10. **Teste:** mande um WhatsApp para o número conectado e confira a mensagem gravada em `mensagens` (direção `entrada`) e o contato criado/achado pelo telefone.

> Limitação da fase atual (documentada em `apps/web/app/api/meta/webhook/route.ts`): o webhook é da conta Meta, então todos os eventos vão para UMA org (`META_ORG_ID` ou a do primeiro admin). Multi-tenant real exigirá mapear `phone_number_id → org` em tabela própria.
