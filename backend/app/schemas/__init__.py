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
    recipes: list[ProductionRecipeItem] = Field(default_factory=list)


class ProductionUpdate(BaseModel):
    nome: str | None = Field(default=None, max_length=255)
    tipo: str | None = Field(default=None, max_length=50)
    data: date | None = None
    convidados: int | None = Field(default=None, gt=0)
    status: str | None = None
    recipes: list[ProductionRecipeItem] | None = None


class ProductionResponse(BaseModel):
    id: uuid.UUID
    nome: str
    tipo: str
    data: date
    convidados: int | None
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
    preco_estimado: float
    ja_tem_estoque: bool

    model_config = {"from_attributes": True}


class ShoppingListUpdateItem(BaseModel):
    ja_tem_estoque: bool


# ─── Waste Record Schemas ───────────────────────────────────────

WASTE_MOTIVOS = {
    "produzi_demais",
    "venceu",
    "errei_receita",
    "cliente_nao_comeu",
    "outro",
}


class WasteRecordCreate(BaseModel):
    ingrediente_ou_prato: str = Field(max_length=255)
    quantidade_sobrou: float = Field(gt=0)
    unidade: str = Field(max_length=20)
    motivo: str
    custo_desperdicio: float = Field(ge=0, default=0)

    @field_validator("motivo")
    @classmethod
    def validate_motivo(cls, v: str) -> str:
        if v not in WASTE_MOTIVOS:
            raise ValueError(f"Motivo must be one of {WASTE_MOTIVOS}")
        return v


class WasteRecordUpdate(BaseModel):
    quantidade_sobrou: float | None = Field(default=None, gt=0)
    custo_desperdicio: float | None = Field(default=None, ge=0)


class WasteRecordResponse(BaseModel):
    id: uuid.UUID
    ingrediente_ou_prato: str
    quantidade_sobrou: float
    unidade: str
    motivo: str
    custo_desperdicio: float
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Dashboard Schemas ──────────────────────────────────────────

class DashboardMetrics(BaseModel):
    economia_total: float
    desperdicio_total: float
    eventos_realizados: int
    desperdicio_medio_por_evento: float
    economia_medio_por_evento: float
    periodo: str  # "mes_atual", "ultimos_30_dias", etc.


class DashboardHistoryItem(BaseModel):
    id: uuid.UUID
    nome: str
    tipo: str
    data: date
    status: str
    custo_compras: float
    custo_desperdicio: float
    economia: float


# ─── Payment Schemas ────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    plan: str  # "pro_mensal" or "pro_anual"


class CheckoutResponse(BaseModel):
    preference_id: str
    init_point: str  # URL for checkout


class WebhookEvent(BaseModel):
    type: str
    data: dict
