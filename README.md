# DashboardFinanceiro

Dashboard financeiro pessoal criado para organizar a minha rotina de acompanhamento de receitas, despesas, categorias, recorrências, parcelamentos, alertas e exportação de dados.

Este projeto tem foco em portfólio e uso pessoal. A proposta é demonstrar uma aplicação full stack funcional, com interface limpa, API REST, conteinerização e uma experiência prática para consulta e manutenção dos meus próprios dados financeiros.

## Destaques

- Visão mensal com saldo, entradas, saídas e evolução do período.
- Gráficos para acompanhar variação mensal e distribuição por categoria.
- Cadastro de categorias com cores, ícones e limites de alerta.
- Registro de despesas, receitas, recorrências e parcelamentos.
- Alertas configuráveis para acompanhar limites definidos.
- Exportação de informações financeiras em CSV e PDF.
- Interface responsiva em React, com componentes reutilizáveis e estados de carregamento.
- API em Node.js com TypeScript, validação de entrada e rotas organizadas por domínio.
- Ambiente conteinerizado para execução local consistente.

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
# Edite o .env com valores locais antes de subir os serviços.

docker compose up -d
```

Aplicação: http://localhost:3000
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

Frontend disponível em desenvolvimento: http://localhost:5173

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
