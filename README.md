# DashboardFinanceiro

Dashboard financeiro pessoal criado para organizar a minha rotina de acompanhamento de receitas, despesas, categorias, recorrências, parcelamentos, alertas e exportação de dados.

Este projeto tem foco em portfólio e uso pessoal. A proposta é demonstrar uma aplicação full stack funcional, com interface limpa, API REST, conteinerização e uma experiência prática para consulta e manutenção dos meus próprios dados financeiros.

## Destaques

- Visão mensal com saldo, entradas, saídas e evolução do período.
- Gráficos para acompanhar variação mensal e distribuição por categoria.
- Cadastro de categorias com cores, ícones e limites de alerta.
- Registro de despesas, receitas, recorrências e parcelamentos.
- Alertas configuráveis para acompanhar limites definidos.
- Exportação de informações financeiras em CSV.
- Interface responsiva em React, com componentes reutilizáveis e estados de carregamento.
- API em Node.js com TypeScript, validação de entrada e rotas organizadas por domínio.
- Ambiente conteinerizado para execução local consistente.

## Stack

**Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Query, Recharts  
**Backend:** Node.js, Express, TypeScript, Prisma, Zod  
**Infra:** Docker, Docker Compose, Nginx

Valores monetários são representados em centavos inteiros em toda a API (por
exemplo, `amountCents: 1990` representa R$ 19,90). Isso evita erros de precisão
em somas, parcelamentos e alertas.

## Como Rodar

### Com Docker

```bash
git clone https://github.com/artcalciolari/DashboardFinanceiro.git
cd DashboardFinanceiro

cp .env.example .env
# Edite DB_* e configure DASHBOARD_AUTH_USER e DASHBOARD_AUTH_PASSWORD
# (senha exclusiva com pelo menos 16 caracteres).

docker compose up -d
```

Aplicação: http://localhost:3000
API: acessível pelo proxy da aplicação em http://localhost:3000/api

Por padrão, apenas o frontend é publicado no host e somente em `127.0.0.1`.
O backend permanece na rede interna do Compose.

### Desenvolvimento Local

Backend:

```bash
# Instale o pnpm 11.9.0 e inicie somente o banco com Docker:
docker compose up -d postgres

cd backend
pnpm install
pnpm exec prisma migrate deploy
pnpm run dev
```

Frontend:

```bash
cd frontend
pnpm install
pnpm run dev
```

Frontend disponível em desenvolvimento: http://localhost:5173

O backend usa as variáveis `DB_USER`, `DB_PASSWORD` e `DB_NAME` do `.env` na raiz para montar a conexão local. Se preferir, defina `DATABASE_URL` diretamente. A regra de datas usa `BUSINESS_TIME_ZONE=America/Sao_Paulo` por padrão.

## Acesso remoto (opcional)

Por padrão o Compose publica o frontend só em `127.0.0.1`. Para expor na LAN ou
atrás de um proxy TLS externo, use o override remoto (porta 80 no host):

```bash
docker compose -f docker-compose.yml -f docker-compose.remote.yml up -d
```

Configure `DASHBOARD_BIND_ADDRESS` no `.env` e restrinja a porta no firewall.
A API exige autenticação HTTP Basic em produção: o navegador solicita o usuário
e a senha definidos em `DASHBOARD_AUTH_USER` e `DASHBOARD_AUTH_PASSWORD`.
Use HTTPS no proxy para qualquer acesso remoto; autenticação Basic depende do
TLS para proteger as credenciais em trânsito. O proxy deve sobrescrever
`X-Forwarded-Proto` e restringir o acesso direto à porta interna.
Sem credenciais válidas o backend recusa inicialização em produção. Em desenvolvimento,
sem ambas as variáveis, acesso local continua disponível sem autenticação.
As rotas de saúde não expõem dados financeiros e permanecem públicas na rede interna.

## Deploy automatizado

O workflow `Deploy production` roda no runner self-hosted Linux depois que o
workflow `CI` passa na branch `main`. O deploy usa o projeto Compose
`dashboard-financeiro` e o diretório permanente
`/home/arthur/dashboard-financeiro`, preservando o volume PostgreSQL existente.

Antes do primeiro deploy, o servidor precisa ter:

- runner GitHub Actions registrado para este repositório e executado pelo
  usuário com acesso ao Docker;
- `/home/arthur/dashboard-financeiro/.env`;
- stack atual com o banco `financeiro_db` disponível.

Cada execução executa o preflight e compila as imagens antes da parada.
Após interromper as escritas, cria um backup custom-format em
`/home/arthur/dashboard-financeiro/backups` e o restaura em um banco temporário
para verificar sua integridade. Aplica migrações com Prisma, compara contagens de linhas
e verifica a prontidão da API. Se a migração falhar, os containers antigos são
reiniciados. Se uma falha ocorrer depois da migração, restaure o backup antes de
voltar para imagens antigas, pois colunas renomeadas não são compatíveis com o
backend anterior.

### Backup periódico e cópia externa

`deploy/backup.sh` cria e restaura um backup de teste a cada execução. Precisa
de espaço para uma cópia adicional do banco e permissão para criar/remover bancos
temporários. A restauração de verificação nunca substitui o banco original.

Configure no `.env` de produção:

```dotenv
BACKUP_RETENTION_DAYS=30
BACKUP_OFFSITE_DEST=backup-user@backup-host:/srv/backups/dashboard-financeiro/
```

Prepare a chave SSH e o host conhecido para o usuário do serviço. O destino deve
ser outro servidor, com acesso restrito. Sem `BACKUP_OFFSITE_DEST`, somente a cópia
local será criada. A retenção de 30 dias aplica-se às cópias locais; configure
a retenção do destino remoto separadamente. Falhas de transferência fazem o job falhar.

Para instalar o agendamento diário no servidor Linux:

```bash
sudo cp deploy/dashboard-backup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now dashboard-backup.timer
sudo systemctl start dashboard-backup.service
sudo journalctl -u dashboard-backup.service -n 30
```

O serviço usa `/home/arthur/dashboard-financeiro/.env` e roda como `arthur`.
A inclusão dos arquivos no repositório não instala o serviço no servidor.

### Pagamentos e reembolsos

Vencimento e pagamento são independentes. `paidAt` registra a baixa real;
registros anteriores à migração permanecem sem baixa até confirmação do usuário.
`PATCH /api/transactions/:id/settlement` recebe `{ "paidAt": "ISO-8601" }`;
use `null` para estornar. Datas futuras são rejeitadas.

`PATCH /api/transactions/:id/reimbursement` recebe o **total já recebido**, em
`reimbursedAmountCents`, e a data em `reimbursedAt`. O valor deve ficar entre zero
e o valor da despesa. Zero e data nula estornam o reembolso. A operação é idempotente
e aceita ocorrências de assinaturas e parcelamentos, sem liberar a edição de sua origem.
Reembolsos integrais antigos são preservados com data desconhecida (`null`).
Ocorrências pagas ou reembolsadas não são apagadas pelo cancelamento de parcelas
futuras nem recalculadas por edições da assinatura. A exclusão explícita de todo o
histórico continua disponível e destrutiva.

Edições de conta e recálculos são atômicos. Categorias em uso não podem mudar de
tipo; a restrição também é validada pelo PostgreSQL. Conflitos de transações
serializáveis são repetidos de forma limitada antes de retornar erro.

## Migrações de dados

A migração para centavos inteiros é estrita. Antes de aplicá-la a um banco com
dados existentes:

1. Faça um backup restaurável do PostgreSQL.
2. Execute `backend/prisma/preflight-money-occurrences.sql`.
3. Resolva valores com mais de duas casas decimais e ocorrências duplicadas.
4. Execute `pnpm exec prisma migrate deploy` no diretório `backend`.

A migração falha intencionalmente caso encontre valores fora do intervalo
suportado ou ocorrências duplicadas; ela não apaga dados automaticamente.

## Testes e saúde

Gates de cobertura: **100%** statements / branches / functions / lines no
backend (`src/**/*.ts`, exceto `src/index.ts`) e no frontend
(`src/**/*.{ts,tsx}`, exceto `main.tsx`, tipos e helpers de teste). Os limiares
ficam em `backend/vitest.config.ts` e `frontend/vite.config.ts` — `pnpm run
test:coverage` falha se qualquer métrica cair. O Vitest usa
`os.availableParallelism()` para paralelizar workers.

```bash
# Na raiz: unitários FE + BE
pnpm test

# Com gates de cobertura (obrigatório no CI)
pnpm run test:coverage

# Backend: unitários / cobertura / integração
cd backend
pnpm test
pnpm run test:coverage
# Requer TEST_DATABASE_URL apontando exclusivamente para um banco de testes.
pnpm run test:integration
pnpm run build

# Frontend
cd ../frontend
pnpm test
pnpm run test:coverage
pnpm run build
```

CI (`CI` workflow) em estágios paralelos: cobertura backend, cobertura frontend e
integração backend; o job `Build` só roda depois que os três passam.

- `GET /health/live`: processo HTTP ativo.
- `GET /health/ready`: processo ativo e banco respondendo.

As listagens de transações usam cursor; parcelamentos e assinaturas usam páginas
limitadas. A exportação CSV continua aceitando o histórico completo, mas grava a
resposta em lotes para manter o uso de memória limitado.

## Estrutura

```text
DashboardFinanceiro/
  backend/
    prisma/
    src/
      controllers/
      lib/
      middleware/
      routes/
      services/
      utils/
  frontend/
    src/
      components/
      context/
      pages/
      services/
      types/
      utils/
```
