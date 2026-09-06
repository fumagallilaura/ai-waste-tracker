# Graph Report - orchestrated-squad  (2026-09-06)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1479 nodes · 2869 edges · 87 communities (64 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `252df5e9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- workbox-d72b399d.js
- auth.py
- var.app_name
- recipes.py
- scripts/squad.mjs
- properties
- workflow-state.mjs
- to_base_unit
- getAccessToken
- properties
- properties
- create_production
- clients.py
- conftest.py
- main.py
- productions/new/page.tsx
- workflow.schema.json
- guest.py
- schemas/__init__.py
- properties
- productions.py
- register_user
- stock.py
- waste.py
- auth.ts
- (app)/layout.tsx
- test_schemas.py
- test_auth_api.py
- api.ts
- package.json
- test_insights_api.py
- compilerOptions
- get_settings
- lucide-react
- Production
- create_client
- test_dashboard_api.py
- db.ts
- observability.py
- shopping.py
- test_recipes_api.py
- normalize_unit
- _finalized_with_balance
- frontend/package.json
- @playwright/test
- analises/page.tsx
- import/page.tsx
- context7
- render-codex.mjs
- get_dashboard_metrics
- dependencies
- manifest.json
- env.py
- delete_account
- next.config.ts
- devDependencies
- RecipeIngredientCreate
- scripts
- devin-target.test.mjs
- render-workflow-commands.mjs
- node/package.json
- clients/page.tsx
- check-drift.mjs
- polyglot/package.json
- git-pr.mjs
- health_check
- next-env.d.ts
- postcss.config.mjs
- install.sh script
- desperdicio-zero-api
- squad-greenfield-python
- squad-polyglot-fixture
- squad-python-fixture

## God Nodes (most connected - your core abstractions)
1. `register_user()` - 89 edges
2. `get_settings()` - 29 edges
3. `getAccessToken()` - 28 edges
4. `var.app_name` - 27 edges
5. `to_base_unit()` - 25 edges
6. `apiGet()` - 22 edges
7. `react` - 21 edges
8. `s` - 19 edges
9. `create_production()` - 19 edges
10. `a` - 18 edges

## Surprising Connections (you probably didn't know these)
- `User` --uses--> `UtcDateTime`  [INFERRED]
  backend/app/models/__init__.py → backend/app/db/types.py
- `IngredientStock` --uses--> `UtcDateTime`  [INFERRED]
  backend/app/models/__init__.py → backend/app/db/types.py
- `WasteRecord` --uses--> `UtcDateTime`  [INFERRED]
  backend/app/models/__init__.py → backend/app/db/types.py
- `_get_client()` --indirect_call--> `client()`  [INFERRED]
  backend/app/routers/clients.py → backend/tests/conftest.py
- `require_admin()` --calls--> `get_settings()`  [EXTRACTED]
  backend/app/routers/admin.py → backend/app/config.py

## Import Cycles
- None detected.

## Communities (87 total, 9 thin omitted)

### Community 0 - "workbox-d72b399d.js"
Cohesion: 0.05
Nodes (25): a, b(), constructor(), deleteCacheAndMetadata(), et, F, g(), get() (+17 more)

### Community 1 - "auth.py"
Cohesion: 0.05
Nodes (64): create_access_token(), create_refresh_token(), decode_token(), generate_rsa_key_pair(), hash_password(), _load_private_key(), _load_public_key(), datetime (+56 more)

### Community 2 - "var.app_name"
Cohesion: 0.05
Nodes (63): aws_acm_certificate.main, aws_acm_certificate_validation.main, aws_dlm_lifecycle_policy.ebs_snapshots, aws_dynamodb_table.terraform_lock, aws_iam_instance_profile.ec2, aws_iam_role.dlm, aws_iam_role.ec2, aws_iam_role_policy_attachment.ec2_ssm_managed (+55 more)

### Community 3 - "recipes.py"
Cohesion: 0.06
Nodes (53): RecipeIngredient, create_recipe(), delete_recipe(), duplicate_recipe(), generate_recipe_with_ai(), get_recipe(), import_recipe(), list_recipes() (+45 more)

### Community 4 - "scripts/squad.mjs"
Cohesion: 0.08
Nodes (53): detectGoCommands(), detectJavaCommands(), detectMakefileCommands(), detectNodeCommands(), detectPythonCommands(), detectRubyCommands(), detectRustCommands(), discoverProject() (+45 more)

### Community 5 - "properties"
Cohesion: 0.05
Nodes (41): additionalProperties, items, type, additionalProperties, type, minimum, type, $id (+33 more)

### Community 6 - "workflow-state.mjs"
Cohesion: 0.11
Nodes (23): executeCommand(), GATE_REGISTRY, runGate(), runGates(), files(), root, targetHash(), validate() (+15 more)

### Community 7 - "to_base_unit"
Cohesion: 0.09
Nodes (14): from_base_unit(), get_display_unit(), ingredient_cost(), Unit conversion for recipe ingredients. Unidades conhecidas (kg/g/L/ml/unidade)…, Convert a quantity to its base unit. Unidades conhecidas convertem (kg→g,…, Convert from base unit to a target unit., Get the most human-readable unit for a quantity. E.g., 1500g -> 1.5kg, 500ml ->…, Cost of a base quantity given the price per purchase unit (kg/L/unidade). E.g.,… (+6 more)

### Community 8 - "getAccessToken"
Cohesion: 0.13
Nodes (27): AnalisesPage(), ClientsPage(), DashboardPage(), HistoryItem, Metrics, EstoquePage(), StockItem, UNIDADES (+19 more)

### Community 9 - "properties"
Cohesion: 0.06
Nodes (33): additionalProperties, items, type, type, items, type, $id, type (+25 more)

### Community 10 - "properties"
Cohesion: 0.06
Nodes (32): additionalProperties, minLength, type, items, type, type, items, type (+24 more)

### Community 11 - "create_production"
Cohesion: 0.11
Nodes (14): create_production(), create_recipe(), API tests for productions, shopping list generation and waste records., Requisição = necessário - estoque (fluxo de requisição do cliente)., D002: usuário informa qtd por pessoa × convidados., Devolvido (não exposto) volta ao estoque; descartado não., PUT com recipes substitui a lista e invalida a requisição antiga., R2/D009: 500g farinha p/ 10 porções, servindo 30 → 1500g. (+6 more)

### Community 12 - "clients.py"
Cohesion: 0.15
Nodes (29): _build_pattern(), _client_history(), create_client(), delete_client(), _get_client(), get_client_pattern(), get_production_suggestion(), list_clients() (+21 more)

### Community 13 - "conftest.py"
Cohesion: 0.11
Nodes (15): AsyncClient, client(), db_engine(), db_session(), jwt_keys(), AsyncSession, Shared test fixtures. Backend tests run against an in-memory SQLite database…, Generate RSA keys for JWT once per test session. (+7 more)

### Community 14 - "main.py"
Cohesion: 0.13
Nodes (18): Settings, Shared rate limiter instance., get_db(), AsyncSession, FastAPI dependency for database session., get_current_user(), AsyncSession, User (+10 more)

### Community 15 - "productions/new/page.tsx"
Cohesion: 0.14
Nodes (24): ClientOption, draftHasContent(), FluxoMode, ManualItem, NewProductionPage(), ProductionDraft, Recipe, SuggestionItem (+16 more)

### Community 16 - "workflow.schema.json"
Cohesion: 0.07
Nodes (26): additionalProperties, items, minItems, type, $id, pattern, type, enum (+18 more)

### Community 17 - "guest.py"
Cohesion: 0.18
Nodes (25): ShoppingListItem, _client_ip(), create_guest_production(), create_guest_waste(), _detail(), _detail_shopping_item(), get_guest_production(), get_guest_shopping_list() (+17 more)

### Community 18 - "schemas/__init__.py"
Cohesion: 0.14
Nodes (21): ClientResponse, ClientUpdate, DashboardHistoryItem, DashboardMetrics, LoginRequest, ProductionRecipeResponse, Ajuste manual da requisição (ex.: usuário sabe que tem mais em casa)., RecipeAiResponse (+13 more)

### Community 19 - "properties"
Cohesion: 0.08
Nodes (24): additionalProperties, items, type, minLength, type, $id, type, enum (+16 more)

### Community 20 - "productions.py"
Cohesion: 0.19
Nodes (22): ProductionRecipe, create_production(), delete_production(), duplicate_production(), get_production(), list_productions(), AsyncSession, delete (+14 more)

### Community 21 - "register_user"
Cohesion: 0.13
Nodes (7): Register a user and return {tokens, headers}., register_user(), End-to-end within the API: import → create recipe → shopping list., TestImportEndpoint, API tests for ingredient stock control., TestStockAdjust, TestStockSetDelete

### Community 22 - "stock.py"
Cohesion: 0.19
Nodes (21): IngredientStock, Estoque atual de um ingrediente do usuário (em unidade base: g/ml/unidade)., adjust_stock(), _check_unit(), delete_stock_item(), _find_stock_item(), _get_stock_item(), list_stock() (+13 more)

### Community 23 - "waste.py"
Cohesion: 0.18
Nodes (21): Balanço pós-evento de um item produzido. Três destinos para o que foi…, WasteRecord, create_waste_record(), _credit_returned_to_stock(), delete_waste_record(), _finalize(), _load_production(), AsyncSession (+13 more)

### Community 24 - "auth.ts"
Cohesion: 0.19
Nodes (16): GoogleCallbackPage(), LoginPage(), RegisterPage(), LandingPage(), GoogleIcon(), clearTokens(), getRefreshToken(), login() (+8 more)

### Community 25 - "(app)/layout.tsx"
Cohesion: 0.15
Nodes (16): AppLayout(), inter, metadata, viewport, Analytics(), identifyUser(), PostHogClient, Window (+8 more)

### Community 26 - "test_schemas.py"
Cohesion: 0.15
Nodes (9): ProductionCreate, ProductionRecipeItem, Movimentação de estoque. Quantidade positiva = entrada, negativa = saída., StockAdjustRequest, WasteRecordCreate, Unit tests for Pydantic request/response schemas., TestProductionSchemas, TestStockSchemas (+1 more)

### Community 27 - "test_auth_api.py"
Cohesion: 0.10
Nodes (6): API tests for the auth flow (register, login, refresh rotation, logout)., TestLogin, TestLogout, TestMe, TestRefreshRotation, TestRegister

### Community 28 - "api.ts"
Cohesion: 0.18
Nodes (17): GuestItem, UNIDADES, apiPut(), clearAuth(), FetchOptions, fetchWithRetry(), getRefreshToken(), getToken() (+9 more)

### Community 29 - "package.json"
Cohesion: 0.10
Nodes (19): bin, squad, description, engines, node, files, name, publishConfig (+11 more)

### Community 30 - "test_insights_api.py"
Cohesion: 0.16
Nodes (11): create_guest_production(), create_production(), next_weekday(), date, API tests for insights (events comparison, daily pattern) and admin metrics., Próxima data com o weekday pedido (0=segunda ... 6=domingo)., turno_diario é o único tipo considerado no padrão diário., register_balance() (+3 more)

### Community 31 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 32 - "get_settings"
Cohesion: 0.14
Nodes (5): get_settings(), TestGoogleOAuth, TestAdminMetrics, TestGlobalRateLimit, TestAiGeneration

### Community 33 - "lucide-react"
Cohesion: 0.20
Nodes (14): SettingsPage(), THEMES, UserInfo, AuthLayout(), PublicLayout(), apiPost(), applyTheme(), getSystemTheme() (+6 more)

### Community 34 - "Production"
Cohesion: 0.21
Nodes (13): datetime, Portable timezone-aware datetime column. PostgreSQL returns tz-aware datetimes…, UtcDateTime, AnalyticsEvent, Base, Client, Production, Cliente ou buffet — alvo do mapeamento de padrão de consumo. (+5 more)

### Community 35 - "create_client"
Cohesion: 0.19
Nodes (6): create_client(), finalize_event_with_balance(), API tests for clients (buffets) — CRUD, ownership, consumption pattern,…, TestClientCRUD, TestClientPattern, TestClientSuggestion

### Community 36 - "test_dashboard_api.py"
Cohesion: 0.15
Nodes (6): make_finalized_production_with_waste(), API tests for dashboard metrics/history and health check., Taxa de desperdício usa o valor real da requisição., TestDashboardHistory, TestDashboardMetrics, TestHealth

### Community 38 - "observability.py"
Cohesion: 0.14
Nodes (14): _allow(), metrics_snapshot(), observe_request(), Observabilidade leve e proteção global da API. - Rate limit global por IP…, Janela deslizante de 60s por IP para o teto global da API., observability_and_limits(), Rate limit global por IP + métricas + log estruturado de request., get_business_metrics() (+6 more)

### Community 39 - "shopping.py"
Cohesion: 0.28
Nodes (14): _generate_shopping_list(), get_shopping_list(), _load_production(), AsyncSession, get, Production, put, User (+6 more)

### Community 40 - "test_recipes_api.py"
Cohesion: 0.21
Nodes (5): create_recipe(), API tests for recipe CRUD + duplicate (R8) with unit normalization (D009)., Medidas personalizadas (xícara, colher...) são aceitas sem conversão., TestCreateRecipe, TestRecipeCRUD

### Community 41 - "normalize_unit"
Cohesion: 0.22
Nodes (5): normalize_unit(), Normaliza o texto de uma unidade. Unidades conhecidas voltam na grafia canônica…, ClientCreate, TestClientSchemas, field_validator

### Community 42 - "_finalized_with_balance"
Cohesion: 0.22
Nodes (13): _balance_sums(), daily_insights(), event_insights(), _finalized_with_balance(), _period_start(), AsyncSession, date, get (+5 more)

### Community 43 - "frontend/package.json"
Cohesion: 0.15
Nodes (12): name, private, version, eslint, eslint-config-next, react-dom, tailwindcss, @tailwindcss/postcss (+4 more)

### Community 44 - "@playwright/test"
Cohesion: 0.15
Nodes (4): unique, IMPORTED, unique, @playwright/test

### Community 45 - "analises/page.tsx"
Cohesion: 0.18
Nodes (7): DailyDay, DailyItem, DailyResponse, EventInsight, EventosTab(), EventsResponse, PERIODOS

### Community 46 - "import/page.tsx"
Cohesion: 0.22
Nodes (9): ImportedIngredient, ImportRecipePage(), ImportResult, UNIDADES, PrefillIngredient, RECIPE_PREFILL_KEY, RecipePrefill, saveRecipePrefill() (+1 more)

### Community 47 - "context7"
Cohesion: 0.18
Nodes (10): command, enabled, type, mcp, context7, serena, $schema, command (+2 more)

### Community 48 - "render-codex.mjs"
Cohesion: 0.29
Nodes (7): instructions, models, quote(), renderCodexAgents(), root, root, validateCodexTarget()

### Community 49 - "get_dashboard_metrics"
Cohesion: 0.28
Nodes (9): get_dashboard_history(), get_dashboard_metrics(), _period_start(), AsyncSession, date, get, User, Real cost metrics: requisition value vs. discarded value. (+1 more)

### Community 50 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, idb-keyval, lucide-react, next, next-pwa, react, react-dom, tailwindcss (+1 more)

### Community 51 - "manifest.json"
Cohesion: 0.22
Nodes (8): background_color, description, display, icons, name, short_name, start_url, theme_color

### Community 52 - "env.py"
Cohesion: 0.32
Nodes (7): do_run_migrations(), Run migrations in 'offline' mode., Run migrations in 'online' mode with async engine., Run migrations in 'online' mode., run_async_migrations(), run_migrations_offline(), run_migrations_online()

### Community 53 - "delete_account"
Cohesion: 0.29
Nodes (8): delete_account(), export_user_data(), AsyncSession, get, post, User, Delete user account and all associated data (LGPD Article 18)., Export all user data (LGPD Article 18).

### Community 54 - "next.config.ts"
Cohesion: 0.25
Nodes (6): nextConfig, pwaConfig, next-pwa, PWAOptions, next, next-pwa

### Community 55 - "devDependencies"
Cohesion: 0.25
Nodes (8): devDependencies, eslint, eslint-config-next, @playwright/test, @types/node, @types/react, @types/react-dom, typescript

### Community 56 - "RecipeIngredientCreate"
Cohesion: 0.48
Nodes (3): RecipeCreate, RecipeIngredientCreate, TestRecipeSchemas

### Community 57 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test:e2e, typecheck

### Community 58 - "devin-target.test.mjs"
Cohesion: 0.43
Nodes (4): applyManagedInstructions(), mergeManagedInstructions(), root, validateDevinTarget()

### Community 59 - "render-workflow-commands.mjs"
Cohesion: 0.38
Nodes (6): bodyOf(), descriptionOf(), renderWorkflowCommands(), root, source, targets

### Community 60 - "node/package.json"
Cohesion: 0.33
Nodes (5): name, private, scripts, lint, test

### Community 61 - "clients/page.tsx"
Cohesion: 0.40
Nodes (4): Client, emptyForm, Pattern, PatternItem

### Community 62 - "check-drift.mjs"
Cohesion: 0.50
Nodes (3): root, renderAgentIndex(), root

### Community 63 - "polyglot/package.json"
Cohesion: 0.40
Nodes (4): name, private, scripts, test

### Community 69 - "health_check"
Cohesion: 0.67
Nodes (3): health_check(), get, Health check endpoint for ALB and monitoring.

## Knowledge Gaps
- **277 isolated node(s):** `ClientOption`, `FluxoMode`, `ManualItem`, `ProductionDraft`, `Recipe` (+272 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 530 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `register_user()` connect `register_user` to `get_settings`, `create_client`, `test_dashboard_api.py`, `recipes.py`, `test_recipes_api.py`, `create_production`, `conftest.py`, `test_auth_api.py`, `test_insights_api.py`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `to_base_unit()` connect `to_base_unit` to `recipes.py`, `normalize_unit`, `_finalized_with_balance`, `clients.py`, `main.py`, `guest.py`, `stock.py`, `waste.py`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `get_settings()` connect `get_settings` to `auth.py`, `recipes.py`, `observability.py`, `test_recipes_api.py`, `main.py`, `guest.py`, `env.py`, `test_auth_api.py`, `test_insights_api.py`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **What connects `ClientOption`, `FluxoMode`, `ManualItem` to the rest of the system?**
  _277 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `workbox-d72b399d.js` be split into smaller, more focused modules?**
  _Cohesion score 0.050436953807740326 - nodes in this community are weakly interconnected._
- **Should `auth.py` be split into smaller, more focused modules?**
  _Cohesion score 0.052531645569620256 - nodes in this community are weakly interconnected._
- **Should `var.app_name` be split into smaller, more focused modules?**
  _Cohesion score 0.05473684210526316 - nodes in this community are weakly interconnected._