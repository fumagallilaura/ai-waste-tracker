"""Initial schema - users, recipes, productions, waste

Revision ID: 001_initial
Revises:
Create Date: 2026-09-01
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Users
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("plan", sa.String(10), nullable=False, server_default="free"),
        sa.Column("plan_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Refresh tokens
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.Uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("token_hash", sa.String(255), nullable=False, index=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Recipes
    op.create_table(
        "recipes",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.Uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("nome", sa.String(255), nullable=False),
        sa.Column("rendimento_base", sa.Integer, nullable=False),
        sa.Column("tipo", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Recipe ingredients
    op.create_table(
        "recipe_ingredients",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("recipe_id", sa.Uuid, sa.ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("ingrediente", sa.String(255), nullable=False),
        sa.Column("quantidade", sa.Numeric(10, 3), nullable=False),
        sa.Column("unidade", sa.String(20), nullable=False),
        sa.Column("preco_unitario", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("unidade_base", sa.String(10), nullable=False),
        sa.Column("unidade_base_qtd", sa.Numeric(10, 3), nullable=False),
    )

    # Productions
    op.create_table(
        "productions",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.Uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("nome", sa.String(255), nullable=False),
        sa.Column("tipo", sa.String(50), nullable=False),
        sa.Column("data", sa.DateTime, nullable=False),
        sa.Column("convidados", sa.Integer, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="planejado"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Production recipes
    op.create_table(
        "production_recipes",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("production_id", sa.Uuid, sa.ForeignKey("productions.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("recipe_id", sa.Uuid, sa.ForeignKey("recipes.id", ondelete="SET NULL"), nullable=True),
        sa.Column("escala_fator", sa.Numeric(10, 3), nullable=False),
        sa.Column("item_nome", sa.String(255), nullable=True),
        sa.Column("item_quantidade_base", sa.Numeric(10, 3), nullable=True),
        sa.Column("item_unidade", sa.String(20), nullable=True),
    )

    # Shopping list items
    op.create_table(
        "shopping_list_items",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("production_id", sa.Uuid, sa.ForeignKey("productions.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("ingrediente", sa.String(255), nullable=False),
        sa.Column("quantidade_total", sa.Numeric(10, 3), nullable=False),
        sa.Column("unidade_base", sa.String(10), nullable=False),
        sa.Column("preco_estimado", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("ja_tem_estoque", sa.Boolean, nullable=False, server_default="false"),
    )

    # Waste records
    op.create_table(
        "waste_records",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("production_id", sa.Uuid, sa.ForeignKey("productions.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("ingrediente_ou_prato", sa.String(255), nullable=False),
        sa.Column("quantidade_sobrou", sa.Numeric(10, 3), nullable=False),
        sa.Column("unidade", sa.String(20), nullable=False),
        sa.Column("motivo", sa.String(50), nullable=False),
        sa.Column("custo_desperdicio", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # Indexes
    op.create_index("idx_productions_data", "productions", ["data"])
    op.create_index("idx_productions_status", "productions", ["status"])
    op.create_index("idx_waste_motivo", "waste_records", ["motivo"])


def downgrade() -> None:
    op.drop_table("waste_records")
    op.drop_table("shopping_list_items")
    op.drop_table("production_recipes")
    op.drop_table("productions")
    op.drop_table("recipe_ingredients")
    op.drop_table("recipes")
    op.drop_table("refresh_tokens")
    op.drop_table("users")
