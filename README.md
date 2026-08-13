# Trimos Food

Plataforma multi-restaurante para pedidos, cozinha, entregas, estafetas, reservas, clientes, catálogo e relatórios em tempo real.

## Módulos disponíveis

- Painel operacional e pesquisa global
- Pedidos com alarme contínuo, aceitação e acompanhamento de estado
- Ecrã de cozinha
- Produtos, categorias, imagens, variações e complementos reutilizáveis
- Quantidade por complemento, limites mínimos e máximos
- Ordenação e disponibilidade rápida do menu
- Menu público, carrinho e acompanhamento do pedido
- Taxa automática por distância e bloqueio fora do raio
- Reservas com capacidade, sobreposição, duração e confirmação
- CRM de clientes
- Convites e aplicação móvel dos estafetas
- Distribuição automática de entregas e notificações push
- Frota privada, rede partilhada opcional e modo híbrido
- Ganho do estafeta por base + quilómetro e acertos financeiros
- Dinheiro com troco, terminal na entrega e MB WAY online por restaurante
- Relatórios operacionais
- Identidade, capa, logótipo, serviços e horários partidos
- Onboarding isolado por restaurante

## Ambiente local

Crie `.env.local` com:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
STRIPE_SECRET_KEY=
STRIPE_PLATFORM_WEBHOOK_SECRET=
STRIPE_CONNECT_WEBHOOK_SECRET=
SUPABASE_SERVICE_ROLE_KEY=
```

Depois execute:

```bash
npm install
npm run dev
```

## Base de dados

As alterações estão versionadas em `supabase/migrations`.

```bash
npx supabase db push --dry-run
npx supabase db push
npx supabase db lint --linked
```

A função `send-driver-push` necessita dos segredos `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` no Supabase.

## Pagamentos

Cada restaurante liga a sua própria conta Stripe em **Configurações > Pagamentos**. O MB WAY só fica disponível depois de a Stripe confirmar a conta e a capacidade `mb_way_payments`.

Na Stripe, configure dois destinos de webhook independentes.

Eventos da conta da plataforma (assinaturas Trimos):

```text
https://SEU-DOMINIO/api/billing/webhook
```

Escute:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.paused`
- `customer.subscription.resumed`

Guarde o respetivo segredo em `STRIPE_PLATFORM_WEBHOOK_SECRET`.

Eventos das contas conectadas (pedidos dos restaurantes):

```text
https://SEU-DOMINIO/api/payments/stripe/webhook
```

O webhook deve receber eventos das contas conectadas e escutar:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

Guarde o respetivo segredo em `STRIPE_CONNECT_WEBHOOK_SECRET`. Durante a transição, `STRIPE_WEBHOOK_SECRET` continua aceite apenas em modo de teste. O `SUPABASE_SERVICE_ROLE_KEY` é usado apenas no servidor para confirmar os pagamentos; nunca deve ser exposto com prefixo `NEXT_PUBLIC_`.

## Qualidade

```bash
npm run lint
npm run build
npm run test:e2e
```

Os testes E2E executam os fluxos públicos em Chromium e WebKit móvel. Para testar uma publicação externa:

```bash
E2E_BASE_URL=https://trimos-food.vercel.app npm run test:e2e
```

O GitHub Actions repete a compilação e os testes de produção em cada envio para `main`.

## Operação

- Saúde: `/api/health`
- Menu público: `/r/[slug]`
- Painel do restaurante: `/restaurant/dashboard`
- Aplicação do estafeta: `/driver/dashboard`

Antes de divulgar um novo restaurante, complete o cartão de prontidão em **Configurações**: identidade, contacto, NIF, morada, localização das entregas e horário semanal.

Em **Configurações > Pagamentos**, o proprietário escolhe dinheiro, terminal ou MB WAY e define se usa apenas estafetas convidados, apenas a rede Trimos ou o modo híbrido. O estafeta também precisa aderir à rede no próprio perfil; sem consentimento dos dois lados, ele permanece privado.
