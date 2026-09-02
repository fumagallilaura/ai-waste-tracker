# Desperdício Zero 🌱

Gestão de desperdício alimentar para pequenos negócios. Receitas, eventos, lista de compras e controle de desperdício em 30 segundos.

**Stack:** Next.js 15 + FastAPI + PostgreSQL + AWS (Terraform)

---

## Rodar Local

### Pré-requisitos

- Docker + Docker Compose

### 1. Clone e configure o `.env`

```bash
cp .env.example .env
```

### 2. Suba tudo

```bash
docker compose up --build
```

Isso sobe 3 containers:
| Serviço | URL | Descrição |
|---------|-----|-----------|
| Frontend | http://localhost:3000 | Next.js (calculadora pública + app) |
| Backend | http://localhost:8000 | FastAPI API + docs em `/docs` |
| PostgreSQL | localhost:5432 | Banco de dados |

### 3. Acesse

- **Calculadora pública:** http://localhost:3000
- **API docs (Swagger):** http://localhost:8000/docs
- **Health check:** http://localhost:8000/api/health

### 4. Rode as migrações do banco

```bash
docker compose exec backend alembic upgrade head
```

---

## Variáveis de Ambiente

| Variável | Obrigatório? | Padrão (dev) | Descrição |
|----------|:---:|---|---|
| `DB_PASSWORD` | ✅ | `devpassword` | Senha do PostgreSQL |
| `MERCADO_PAGO_ACCESS_TOKEN` | ❌ | `TEST-placeholder` | Token sandbox do Mercado Pago |
| `RESEND_API_KEY` | ❌ | `re_placeholder` | API key do Resend (emails) |

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
- **Superfícies quentes** no light mode — faz a comida "saltar" na tela
- **Dark mode com warm undertone** — evita sensação clínica

**Configurações:** Acesse `/settings` para trocar o tema, ver seu plano, e gerenciar dados (LGPD).

---

## Estrutura

```
├── backend/          # FastAPI (Python 3.12)
│   ├── app/
│   │   ├── routers/  # Endpoints da API
│   │   ├── models/   # SQLAlchemy models
│   │   ├── schemas/  # Pydantic schemas
│   │   ├── core/     # Security, units, benchmarks
│   │   └── db/       # DB session + Alembic migrations
│   └── tests/
├── frontend/         # Next.js 15 (PWA)
│   ├── app/
│   │   ├── (public)/ # Calculadora pública (SEO)
│   │   └── (app)/    # App autenticado
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

## Deploy (AWS)

```bash
cd infra
terraform init
terraform apply -var="db_password=$(openssl rand -hex 16)"
```

Veja `infra/` para detalhes da infraestrutura (EC2, ALB, S3, SSM).
