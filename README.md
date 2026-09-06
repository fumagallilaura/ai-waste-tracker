# Desperdício Zero 🌱

Controle de produção e estoque para quem faz comida sob encomenda (buffets, confeitarias,
eventos). Receitas, eventos, lista de requisição de ingredientes, balanço de desperdício
e padrão de consumo por cliente.

**Stack:** Next.js 15 + FastAPI + PostgreSQL + AWS (Terraform)

---

## Como funciona

### 1. Evento → ingredientes (requisição)

- Cadastre **receitas** com rendimento e ingredientes (preço por kg/L/unidade).
- Crie uma **produção** para o evento e informe **quantas vezes cada receita será feita**
  (ex.: o evento precisa de 10 receitas do bolo → escala 10x), ou informe itens avulsos
  com a quantidade total.
- O app gera a **lista de requisição**: necessário − em estoque = pedir. O que você já
  tem em estoque é descontado automaticamente (com ajuste manual se precisar).

### 2. Balanço do evento (desperdício)

No fim do evento, registre para cada item:

| Destino | Significado |
|---------|-------------|
| **Consumido** | foi servido e comido |
| **Descartado** | sobrou exposto e foi jogado fora |
| **Devolvido** | voltou sem ser exposto → **volta para o estoque** |

O primeiro balanço finaliza a produção e o custo do descartado alimenta o dashboard.

### 3. Análises e inteligência

A área **Análises** (menu do app) tem duas visões:

- **Eventos**: cada evento finalizado comparado com a média dos eventos parecidos
  (consumo e descarte, barras e desvio vs. média), com sugestões de ajuste.
- **Dia a dia (comércio)**: para produções do tipo *Turno diário* (padaria, lanchonete...),
  o app aprende o padrão **por item × dia da semana**, marca quando o item esgotou
  (sinal de venda perdida) e sugere quanto produzir em cada dia.

As sugestões são determinísticas e explicáveis; cada resposta de insights traz um
`ai_context` estruturado, pronto para alimentar uma IA conversacional depois.

### 4. Padrão de consumo por cliente

- Cadastre **clientes/buffets** com um **fator de produção** (ex.: 0.7 = regra dos 70% —
  fazer 1 por pessoa sempre sobra).
- Com o histórico de balanços dos eventos finalizados, o app calcula o **padrão de
  consumo** de cada cliente (média consumida por evento e por convidado).
- Ao criar a próxima produção, use a **sugestão**: consumo médio por convidado ×
  convidados + margem de segurança de 10%.

---

## Rodar Local

### Pré-requisitos

- Docker + Docker Compose

### 1. Clone e configure o `.env`

```bash
cp .env.example .env
```

### 2. (Opcional) Ative o login com Google

1. No [Google Cloud Console](https://console.cloud.google.com/apis/credentials), crie
   credenciais **OAuth 2.0 → Aplicação da Web**.
2. Em **URIs de redirecionamento autorizados**, adicione:
   `http://localhost:8000/api/auth/google/callback`
3. Preencha `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no `.env` da raiz e recrie o
   backend para eles valerem: `docker compose up -d backend`.

Sem isso o app funciona normalmente com email/senha — só o botão do Google avisa que falta configurar.

### 3. Suba tudo

```bash
docker compose up --build
```

Isso sobe 3 containers (as migrações do banco rodam automaticamente no startup do backend):

| Serviço | URL | Descrição |
|---------|-----|-----------|
| Frontend | http://localhost:3000 | Next.js (app) |
| Backend | http://localhost:8000 | FastAPI API + docs em `/docs` |
| PostgreSQL | localhost:5432 | Banco de dados |

### 3. Acesse

- **App:** http://localhost:3000
- **API docs (Swagger):** http://localhost:8000/docs
- **Health check:** http://localhost:8000/api/health
- **Importar receita:** `/recipes` → botão "Importar da internet" (cola a URL de uma receita pública; ingredientes são extraídos de dados estruturados JSON-LD do site e revisados antes de salvar)

### 4. Rode as migrações do banco (se necessário)

O backend já aplica as migrações no startup. Para rodar manualmente:

```bash
docker compose exec backend alembic upgrade head
```

---

## Testes

### Backend — testes unitários + API

Rodem em SQLite in-memory (não precisa de Postgres):

```bash
docker compose run --rm backend pytest
```

172 testes: unidades/conversões, security (JWT RS256 + argon2), schemas, receitas,
produções, requisição com estoque, balanço 3-vias com devolução ao estoque, clientes,
estoque, dashboard, insights (comparações e padrão semanal), rate limit global e
métricas administrativas.

### Frontend — E2E com Playwright

Com o stack rodando (`docker compose up -d`), no host:

```bash
cd frontend
npm install
npx playwright install chromium   # primeira vez
npm run test:e2e
```

21 cenários: landing, registro/login/logout, Google, fluxo visitante (trial + claim),
sessão expirada, receita → produção (escala direta) → requisição → balanço → dashboard,
estoque, clientes, rascunhos (retomar/descartar/limpar) e análises.

Configure os alvos com `E2E_BASE_URL` (padrão `http://localhost:3000`).

---

## Variáveis de Ambiente

| Variável | Obrigatório? | Padrão (dev) | Descrição |
|----------|:---:|---|---|
| `DB_PASSWORD` | ✅ | `devpassword` | Senha do PostgreSQL |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ❌ | vazio | Ativa o login/cadastro com Google |
| `APP_ADMIN_TOKEN` | ❌ | vazio | Habilita `GET /api/metrics` e `/api/metrics/business` (header `X-Admin-Token`) |
| `APP_RATE_LIMIT_DEFAULT_PER_MINUTE` | ❌ | `240` | Teto global de requisições por IP (anti-abuso) |

**Sem `.env?** O `docker-compose.yml` usa valores padrão — funciona sem configurar nada para desenvolvimento.

---

## Tema e Aparência

O app suporta **3 modos de tema** (salvos em `localStorage`):

| Modo | Descrição |
|------|-----------|
| **Claro** | Fundo branco, superfícies quentes (cream tint) |
| **Escuro** | Fundo navy-black, superfícies slate |
| **Sistema** | Segue preferência do OS (padrão) |

**Paleta otimizada para app de cozinha:**
- **Emerald** (`#059669`) — cor primária (economia, sucesso, CTAs)
- **Amber** (`#F59E0B`) — desperdício, alerta
- **Red** (`#EF4444`) — erro, desperdício crítico

**Configurações:** Acesse `/settings` para trocar o tema e gerenciar dados (LGPD).

---

## Estrutura

```
├── backend/          # FastAPI (Python 3.12)
│   ├── app/
│   │   ├── routers/  # auth, recipes, clients, stock, productions, waste, dashboard
│   │   ├── models/   # User, Recipe, Client, IngredientStock, Production, WasteRecord
│   │   ├── schemas/  # Pydantic schemas
│   │   ├── core/     # security, units, rate limit
│   │   └── db/       # DB session + Alembic migrations
│   └── tests/
├── frontend/         # Next.js 15 (PWA)
│   ├── app/
│   │   ├── (public)/ # Landing
│   │   ├── (auth)/   # Login e registro
│   │   └── (app)/    # Dashboard, receitas, produções, clientes, estoque
│   └── lib/          # API client, auth, units, theme
├── infra/            # Terraform (AWS)
└── docker-compose.yml
```

---

## Comandos Úteis

```bash
# Parar tudo
docker compose down

# Ver logs
docker compose logs -f backend

# Rodar testes do backend
docker compose exec backend pytest

# Rodar linter
docker compose exec backend ruff check app/

# Rodar typecheck do frontend
docker compose exec frontend npm run typecheck

# Reset do banco (destrói dados!)
docker compose down -v && docker compose up --build
```

---

## Métricas de produto (opcional, grátis)

Para saber quem acessou, quais páginas, quantas vezes e onde o pessoal trava, o app
suporta duas ferramentas — ative uma ou ambas colando as chaves no `.env` (ou nas env
vars da Vercel) e reiniciando o frontend. Sem chaves, nada é carregado.

| Ferramenta | Custo | O que mostra | Como ativar |
|---|---|---|---|
| **PostHog** | Grátis até 1M eventos/mês | Quem acessou, páginas, funil, retenção; usuários identificados pelo id da conta | Crie o projeto em posthog.com → cole `NEXT_PUBLIC_POSTHOG_KEY` (e `NEXT_PUBLIC_POSTHOG_HOST` se usar a UE) |
| **Microsoft Clarity** | Grátis, ilimitado | Gravações de sessão, heatmaps, **rage clicks** (onde o usuário trava/trava de raiva) | clarity.microsoft.com → cole `NEXT_PUBLIC_CLARITY_ID` |

Recomendação: os dois juntos — PostHog responde "quem usa e onde para", Clarity mostra
em vídeo "por que trava". Para métricas de negócio do SEU banco (funil de cadastro,
trials, conversão), use `GET /api/metrics/business` com `APP_ADMIN_TOKEN`.

---

## Deploy (AWS)

```bash
cd infra
terraform init
terraform apply -var="db_password=$(openssl rand -hex 16)"
```

Veja `infra/` para detalhes da infraestrutura (EC2, ALB, S3, SSM).
