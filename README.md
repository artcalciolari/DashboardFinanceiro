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
# Edite o .env com valores locais antes de subir os serviços.

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

Configure `DASHBOARD_BIND_ADDRESS` no `.env` (por exemplo `0.0.0.0`) e restrinja
a porta no firewall. Não há login na aplicação — proteja o acesso na rede ou no
proxy, se necessário.

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

Cada execução cria e valida um backup custom-format em
`/home/arthur/dashboard-financeiro/backups`, executa o preflight, compila as
imagens antes da parada, aplica migrações com Prisma, compara contagens de linhas
e verifica a prontidão da API. Se a migração falhar, os containers antigos são
reiniciados. Se uma falha ocorrer depois da migração, restaure o backup antes de
voltar para imagens antigas, pois colunas renomeadas não são compatíveis com o
backend anterior.

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
