from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.units import UNIT_CONVERSIONS

# ─── Auth Schemas ───────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    plan: str
    plan_expires_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Recipe Schemas ─────────────────────────────────────────────

class RecipeIngredientCreate(BaseModel):
    ingrediente: str = Field(max_length=255)
    quantidade: float = Field(gt=0)
    unidade: str = Field(max_length=20)
    # Preço por unidade de compra: R$/kg para g, R$/L para ml, R$/un para unidade
    preco_unitario: float = Field(ge=0, default=0)

    @field_validator("unidade")
    @classmethod
    def validate_unidade(cls, v: str) -> str:
        if v not in UNIT_CONVERSIONS:
            raise ValueError(f"Unidade não suportada: {v}. Use: {list(UNIT_CONVERSIONS)}")
        return v


class RecipeIngredientResponse(BaseModel):
    id: uuid.UUID
    ingrediente: str
    quantidade: float
    unidade: str
    preco_unitario: float
    unidade_base: str
    unidade_base_qtd: float

    model_config = {"from_attributes": True}


class RecipeCreate(BaseModel):
    nome: str = Field(max_length=255)
    rendimento_base: int = Field(gt=0)
    tipo: str | None = Field(default=None, max_length=50)
    ingredients: list[RecipeIngredientCreate]


class RecipeUpdate(BaseModel):
    nome: str | None = Field(default=None, max_length=255)
    rendimento_base: int | None = Field(default=None, gt=0)
    tipo: str | None = Field(default=None, max_length=50)
    ingredients: list[RecipeIngredientCreate] | None = None


class RecipeResponse(BaseModel):
    id: uuid.UUID
    nome: str
    rendimento_base: int
    tipo: str | None
    ingredients: list[RecipeIngredientResponse]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Recipe Import Schemas ──────────────────────────────────────

class RecipeImportRequest(BaseModel):
    url: str = Field(max_length=2048)


class RecipeImportIngredient(BaseModel):
    ingrediente: str
    quantidade: float
    unidade: str
    original: str


class RecipeImportResponse(BaseModel):
    nome: str
    rendimento_base: int
    tipo: str | None
    ingredients: list[RecipeImportIngredient]
    source_url: str


# ─── Production Schemas ─────────────────────────────────────────

class ProductionRecipeItem(BaseModel):
    recipe_id: uuid.UUID | None = None
    escala_fator: float = Field(gt=0)
    # For Fluxo B (avulso items)
    item_nome: str | None = Field(default=None, max_length=255)
    item_quantidade_base: float | None = Field(default=None, gt=0)
    item_unidade: str | None = Field(default=None, max_length=20)


class ProductionCreate(BaseModel):
    nome: str = Field(max_length=255)
    tipo: str = Field(max_length=50)
    data: date
    convidados: int | None = Field(default=None, gt=0)
    client_id: uuid.UUID | None = None
    recipes: list[ProductionRecipeItem] = Field(default_factory=list)


class ProductionUpdate(BaseModel):
    nome: str | None = Field(default=None, max_length=255)
    tipo: str | None = Field(default=None, max_length=50)
    data: date | None = None
    convidados: int | None = Field(default=None, gt=0)
    client_id: uuid.UUID | None = None
    status: str | None = None
    recipes: list[ProductionRecipeItem] | None = None


class ProductionResponse(BaseModel):
    id: uuid.UUID
    nome: str
    tipo: str
    data: date
    convidados: int | None
    client_id: uuid.UUID | None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProductionRecipeResponse(BaseModel):
    id: uuid.UUID
    recipe_id: uuid.UUID | None
    escala_fator: float
    item_nome: str | None

    model_config = {"from_attributes": True}


class ProductionDetailResponse(ProductionResponse):
    recipes: list[ProductionRecipeResponse] = Field(default_factory=list)
    shopping_list: list[ShoppingListItemResponse] = Field(default_factory=list)
    waste_records: list[WasteRecordResponse] = Field(default_factory=list)


# ─── Shopping List Schemas ──────────────────────────────────────

class ShoppingListItemResponse(BaseModel):
    id: uuid.UUID
    ingrediente: str
    quantidade_total: float
    unidade_base: str
    quantidade_estoque: float
    quantidade_a_comprar: float
    preco_unitario: float
    preco_estimado: float

    model_config = {"from_attributes": True}


class ShoppingListUpdateItem(BaseModel):
    """Ajuste manual da requisição (ex.: usuário sabe que tem mais em casa)."""

    quantidade_a_comprar: float = Field(ge=0)

# ─── Waste Record Schemas ───────────────────────────────────────


class WasteRecordCreate(BaseModel):
    item: str = Field(max_length=255)
    quantidade_produzida: float = Field(ge=0, default=0)
    quantidade_consumida: float = Field(ge=0, default=0)
    quantidade_descartada: float = Field(ge=0, default=0)
    quantidade_devolvida: float = Field(ge=0, default=0)
    unidade: str = Field(max_length=20)
    custo_desperdicio: float = Field(ge=0, default=0)

    @field_validator("unidade")
    @classmethod
    def validate_unidade(cls, v: str) -> str:
        if v not in UNIT_CONVERSIONS:
            raise ValueError(f"Unidade não suportada: {v}. Use: {list(UNIT_CONVERSIONS)}")
        return v


class WasteRecordUpdate(BaseModel):
    quantidade_produzida: float | None = Field(default=None, ge=0)
    quantidade_consumida: float | None = Field(default=None, ge=0)
    quantidade_descartada: float | None = Field(default=None, ge=0)
    quantidade_devolvida: float | None = Field(default=None, ge=0)
    custo_desperdicio: float | None = Field(default=None, ge=0)


class WasteRecordResponse(BaseModel):
    id: uuid.UUID
    item: str
    quantidade_produzida: float
    quantidade_consumida: float
    quantidade_descartada: float
    quantidade_devolvida: float
    unidade: str
    custo_desperdicio: float
    created_at: datetime

    model_config = {"from_attributes": True}

# ─── Client Schemas ─────────────────────────────────────────────

CLIENT_TIPOS = {"cliente", "buffet"}


class ClientCreate(BaseModel):
    nome: str = Field(max_length=255)
    tipo: str = "cliente"
    fator_producao: float = Field(ge=0, le=1, default=0.7)
    observacoes: str | None = Field(default=None, max_length=1000)

    @field_validator("tipo")
    @classmethod
    def validate_tipo(cls, v: str) -> str:
        if v not in CLIENT_TIPOS:
            raise ValueError(f"Tipo must be one of {CLIENT_TIPOS}")
        return v


class ClientUpdate(BaseModel):
    nome: str | None = Field(default=None, max_length=255)
    tipo: str | None = None
    fator_producao: float | None = Field(default=None, ge=0, le=1)
    observacoes: str | None = Field(default=None, max_length=1000)

    @field_validator("tipo")
    @classmethod
    def validate_tipo(cls, v: str | None) -> str | None:
        if v is not None and v not in CLIENT_TIPOS:
            raise ValueError(f"Tipo must be one of {CLIENT_TIPOS}")
        return v


class ClientResponse(BaseModel):
    id: uuid.UUID
    nome: str
    tipo: str
    fator_producao: float
    observacoes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ClientPatternItem(BaseModel):
    item: str
    unidade_base: str
    eventos: int
    media_produzida: float
    media_consumida: float
    media_descartada: float
    media_devolvida: float
    # consumo médio por convidado (unidade base); None quando eventos sem convidados
    consumo_por_convidado: float | None


class ClientPatternResponse(BaseModel):
    client_id: uuid.UUID
    nome: str
    fator_producao: float
    eventos_analisados: int
    itens: list[ClientPatternItem]


class SuggestionItem(BaseModel):
    item: str
    unidade_base: str
    quantidade_sugerida: float
    base_historica: float  # consumo médio que originou a sugestão


class ProductionSuggestionResponse(BaseModel):
    client_id: uuid.UUID
    convidados: int | None
    margem_aplicada: float
    itens: list[SuggestionItem]

# ─── Stock Schemas ──────────────────────────────────────────────


class StockItemResponse(BaseModel):
    id: uuid.UUID
    ingrediente: str
    unidade_base: str
    quantidade: float
    preco_unitario: float
    updated_at: datetime

    model_config = {"from_attributes": True}


class StockAdjustRequest(BaseModel):
    """Movimentação de estoque. Quantidade positiva = entrada, negativa = saída."""

    ingrediente: str = Field(max_length=255)
    unidade: str = Field(max_length=20)
    quantidade_delta: float
    preco_unitario: float = Field(ge=0, default=0)

    @field_validator("unidade")
    @classmethod
    def validate_unidade(cls, v: str) -> str:
        if v not in UNIT_CONVERSIONS:
            raise ValueError(f"Unidade não suportada: {v}. Use: {list(UNIT_CONVERSIONS)}")
        return v


class StockSetRequest(BaseModel):
    unidade: str = Field(max_length=20)
    quantidade: float = Field(ge=0)
    preco_unitario: float = Field(ge=0, default=0)

    @field_validator("unidade")
    @classmethod
    def validate_unidade(cls, v: str) -> str:
        if v not in UNIT_CONVERSIONS:
            raise ValueError(f"Unidade não suportada: {v}. Use: {list(UNIT_CONVERSIONS)}")
        return v


# ─── Dashboard Schemas ──────────────────────────────────────────

class DashboardMetrics(BaseModel):
    total_compras: float
    desperdicio_total: float
    taxa_desperdicio: float  # % do valor comprado que virou descarte
    eventos_realizados: int
    desperdicio_medio_por_evento: float
    periodo: str  # "mes_atual", "ultimos_30_dias"


class DashboardHistoryItem(BaseModel):
    id: uuid.UUID
    nome: str
    tipo: str
    data: date
    status: str
    cliente: str | None
    custo_compras: float
    custo_desperdicio: float
    consumo_total: float  # % consumido sobre o registrado no balanço
