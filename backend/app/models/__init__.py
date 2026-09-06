from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, UniqueConstraint, Uuid, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.db.types import UtcDateTime


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    plan: Mapped[str] = mapped_column(String(10), nullable=False, default="free")
    plan_expires_at: Mapped[datetime | None] = mapped_column(UtcDateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        UtcDateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        UtcDateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    recipes: Mapped[list[Recipe]] = relationship(
        "Recipe", back_populates="user", cascade="all, delete-orphan"
    )
    productions: Mapped[list[Production]] = relationship(
        "Production", back_populates="user", cascade="all, delete-orphan"
    )
    clients: Mapped[list[Client]] = relationship(
        "Client", back_populates="user", cascade="all, delete-orphan"
    )
    stock_items: Mapped[list[IngredientStock]] = relationship(
        "IngredientStock", back_populates="user", cascade="all, delete-orphan"
    )
    refresh_tokens: Mapped[list[RefreshToken]] = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(UtcDateTime, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(UtcDateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        UtcDateTime, nullable=False, server_default=func.now()
    )

    # Relationships
    user: Mapped[User] = relationship("User", back_populates="refresh_tokens")


class Recipe(Base):
    __tablename__ = "recipes"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    rendimento_base: Mapped[int] = mapped_column(nullable=False)
    tipo: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        UtcDateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        UtcDateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped[User] = relationship("User", back_populates="recipes")
    ingredients: Mapped[list[RecipeIngredient]] = relationship(
        "RecipeIngredient", back_populates="recipe", cascade="all, delete-orphan"
    )


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), primary_key=True, default=uuid.uuid4
    )
    recipe_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ingrediente: Mapped[str] = mapped_column(String(255), nullable=False)
    quantidade: Mapped[float] = mapped_column(Numeric(10, 3), nullable=False)
    unidade: Mapped[str] = mapped_column(String(20), nullable=False)
    preco_unitario: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    unidade_base: Mapped[str] = mapped_column(String(10), nullable=False)
    unidade_base_qtd: Mapped[float] = mapped_column(Numeric(10, 3), nullable=False)

    # Relationships
    recipe: Mapped[Recipe] = relationship("Recipe", back_populates="ingredients")


class Production(Base):
    __tablename__ = "productions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), primary_key=True, default=uuid.uuid4
    )
    # NULL = produção criada por visitante (trial sem login)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    guest_identifier_hash: Mapped[str | None] = mapped_column(
        String(64), nullable=True, index=True
    )
    ip_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True, index=True
    )
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    tipo: Mapped[str] = mapped_column(String(50), nullable=False)
    data: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    convidados: Mapped[int | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="planejado")
    created_at: Mapped[datetime] = mapped_column(
        UtcDateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        UtcDateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped[User | None] = relationship("User", back_populates="productions")
    client: Mapped[Client | None] = relationship("Client", back_populates="productions")
    production_recipes: Mapped[list[ProductionRecipe]] = relationship(
        "ProductionRecipe", back_populates="production", cascade="all, delete-orphan"
    )
    shopping_list: Mapped[list[ShoppingListItem]] = relationship(
        "ShoppingListItem", back_populates="production", cascade="all, delete-orphan"
    )
    waste_records: Mapped[list[WasteRecord]] = relationship(
        "WasteRecord", back_populates="production", cascade="all, delete-orphan"
    )


class ProductionRecipe(Base):
    __tablename__ = "production_recipes"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), primary_key=True, default=uuid.uuid4
    )
    production_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("productions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    recipe_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(), ForeignKey("recipes.id", ondelete="SET NULL"), nullable=True
    )
    escala_fator: Mapped[float] = mapped_column(Numeric(10, 3), nullable=False)
    item_nome: Mapped[str | None] = mapped_column(String(255), nullable=True)
    item_quantidade_base: Mapped[float | None] = mapped_column(Numeric(10, 3), nullable=True)
    item_unidade: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Relationships
    production: Mapped[Production] = relationship("Production", back_populates="production_recipes")
    recipe: Mapped[Recipe | None] = relationship("Recipe")


class ShoppingListItem(Base):
    __tablename__ = "shopping_list_items"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), primary_key=True, default=uuid.uuid4
    )
    production_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("productions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ingrediente: Mapped[str] = mapped_column(String(255), nullable=False)
    quantidade_total: Mapped[float] = mapped_column(Numeric(10, 3), nullable=False)
    unidade_base: Mapped[str] = mapped_column(String(10), nullable=False)
    # Snapshot do estoque no momento da geração; o que falta é a requisição.
    quantidade_estoque: Mapped[float] = mapped_column(Numeric(10, 3), nullable=False, default=0)
    quantidade_a_comprar: Mapped[float] = mapped_column(Numeric(10, 3), nullable=False, default=0)
    preco_unitario: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    preco_estimado: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)

    # Relationships
    production: Mapped[Production] = relationship("Production", back_populates="shopping_list")


class WasteRecord(Base):
    """Balanço pós-evento de um item produzido.

    Três destinos para o que foi produzido, conforme o fluxo do cliente:
    - consumido: foi servido e comido
    - descartado: sobrou exposto no evento e foi jogado fora
    - devolvido: voltou sem ter sido exposto e retorna ao estoque
    """

    __tablename__ = "waste_records"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), primary_key=True, default=uuid.uuid4
    )
    production_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("productions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item: Mapped[str] = mapped_column(String(255), nullable=False)
    quantidade_produzida: Mapped[float] = mapped_column(Numeric(10, 3), nullable=False, default=0)
    quantidade_consumida: Mapped[float] = mapped_column(Numeric(10, 3), nullable=False, default=0)
    quantidade_descartada: Mapped[float] = mapped_column(Numeric(10, 3), nullable=False, default=0)
    quantidade_devolvida: Mapped[float] = mapped_column(Numeric(10, 3), nullable=False, default=0)
    unidade: Mapped[str] = mapped_column(String(20), nullable=False)
    custo_desperdicio: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        UtcDateTime, nullable=False, server_default=func.now()
    )

    # Relationships
    production: Mapped[Production] = relationship("Production", back_populates="waste_records")


class Client(Base):
    """Cliente ou buffet — alvo do mapeamento de padrão de consumo."""

    __tablename__ = "clients"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    # "buffet" (agencia/consumo proprio) ou "cliente" (evento pontual)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False, default="cliente")
    # Fração do total a produzir por opção (regra dos 70% do cliente)
    fator_producao: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0.7)
    observacoes: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        UtcDateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        UtcDateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped[User] = relationship("User", back_populates="clients")
    productions: Mapped[list[Production]] = relationship(
        "Production", back_populates="client"
    )


class IngredientStock(Base):
    """Estoque atual de um ingrediente do usuário (em unidade base: g/ml/unidade)."""

    __tablename__ = "ingredient_stock"
    __table_args__ = (UniqueConstraint("user_id", "ingrediente", name="uq_stock_user_ingrediente"),)

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ingrediente: Mapped[str] = mapped_column(String(255), nullable=False)
    unidade_base: Mapped[str] = mapped_column(String(10), nullable=False)
    quantidade: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False, default=0)
    preco_unitario: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        UtcDateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        UtcDateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped[User] = relationship("User", back_populates="stock_items")
