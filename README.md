# DashboardFinanceiro

Dashboard financeiro pessoal criado para organizar a minha rotina de acompanhamento de receitas, despesas, categorias, recorrencias, parcelamentos, alertas e exportacao de dados.

Este projeto tem foco em portfolio e uso pessoal. A proposta e demonstrar uma aplicacao full stack funcional, com interface limpa, API REST, conteinerizacao e uma experiencia pratica para consulta e manutencao dos meus proprios dados financeiros.

## Destaques

- Visao mensal com saldo, entradas, saidas e evolucao do periodo.
- Graficos para acompanhar variacao mensal e distribuicao por categoria.
- Cadastro de categorias com cores, icones e limites de alerta.
- Registro de despesas, receitas, recorrencias e parcelamentos.
- Alertas configuraveis para acompanhar limites definidos.
- Exportacao de informacoes financeiras em CSV e PDF.
- Interface responsiva em React, com componentes reutilizaveis e estados de carregamento.
- API em Node.js com TypeScript, validacao de entrada e rotas organizadas por dominio.
- Ambiente containerizado para execucao local consistente.

## Stack

**Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Query, Recharts  
**Backend:** Node.js, Express, TypeScript, Prisma, Zod  
**Infra:** Docker, Docker Compose, Nginx

## Como Rodar

### Com Docker

```bash
git clone https://github.com/artcalciolari/DashboardFinanceiro.git
cd DashboardFinanceiro

cp .env.example .env
# Edite o .env com valores locais antes de subir os servicos.

docker compose up -d
```

Aplicacao: http://localhost:3000  
API: http://localhost:3001

### Desenvolvimento Local

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Frontend em desenvolvimento: http://localhost:5173

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

## Observacoes

- O arquivo `.env` e local e nao deve ser versionado.
- Use `.env.example` apenas como referencia de variaveis necessarias.
- Os dados e configuracoes usados em desenvolvimento devem ser tratados como informacoes privadas.
