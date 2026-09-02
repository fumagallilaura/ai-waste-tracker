from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Uuid, func
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
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
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
    user: Mapped[User] = relationship("User", back_populates="productions")
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
    preco_estimado: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    ja_tem_estoque: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationships
    production: Mapped[Production] = relationship("Production", back_populates="shopping_list")


class WasteRecord(Base):
    __tablename__ = "waste_records"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), primary_key=True, default=uuid.uuid4
    )
    production_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("productions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ingrediente_ou_prato: Mapped[str] = mapped_column(String(255), nullable=False)
    quantidade_sobrou: Mapped[float] = mapped_column(Numeric(10, 3), nullable=False)
    unidade: Mapped[str] = mapped_column(String(20), nullable=False)
    motivo: Mapped[str] = mapped_column(String(50), nullable=False)
    custo_desperdicio: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        UtcDateTime, nullable=False, server_default=func.now()
    )

    # Relationships
    production: Mapped[Production] = relationship("Production", back_populates="waste_records")
