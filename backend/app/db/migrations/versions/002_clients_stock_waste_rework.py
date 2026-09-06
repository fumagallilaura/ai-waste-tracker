"""Clients, ingredient stock, requisition shopping list and 3-way waste balance

Revision ID: 002_clients_stock
Revises: 001_initial
Create Date: 2026-09-05

Reestrutura o app para o fluxo real do cliente:
- clients: mapeamento de padrão de consumo por cliente/buffet
- ingredient_stock: controle de estoque para calcular a requisição
- shopping_list_items: quantidade_a_comprar = necessário - estoque
- waste_records: balanço consumido / descartado (exposto) / devolvido (não exposto)

Registros antigos de desperdício (motivo/quantidade_sobrou) são descartados:
o schema anterior não distingue os destinos do balanço.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "002_clients_stock"
down_revision: str | None = "001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "clients",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.Uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("nome", sa.String(255), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False, server_default="cliente"),
        sa.Column("fator_producao", sa.Numeric(5, 2), nullable=False, server_default="0.7"),
        sa.Column("observacoes", sa.String(1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "ingredient_stock",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", sa.Uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("ingrediente", sa.String(255), nullable=False),
        sa.Column("unidade_base", sa.String(10), nullable=False),
        sa.Column("quantidade", sa.Numeric(12, 3), nullable=False, server_default="0"),
        sa.Column("preco_unitario", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "uq_stock_user_ingrediente",
        "ingredient_stock",
        ["user_id", "ingrediente"],
        unique=True,
    )

    op.add_column("productions", sa.Column("client_id", sa.Uuid, sa.ForeignKey("clients.id", ondelete="SET NULL"), nullable=True))

    op.add_column("shopping_list_items", sa.Column("quantidade_estoque", sa.Numeric(10, 3), nullable=False, server_default="0"))
    op.add_column("shopping_list_items", sa.Column("quantidade_a_comprar", sa.Numeric(10, 3), nullable=False, server_default="0"))
    op.add_column("shopping_list_items", sa.Column("preco_unitario", sa.Numeric(10, 2), nullable=False, server_default="0"))
    op.drop_column("shopping_list_items", "ja_tem_estoque")

    op.add_column("waste_records", sa.Column("item", sa.String(255), nullable=False, server_default=""))
    op.add_column("waste_records", sa.Column("quantidade_produzida", sa.Numeric(10, 3), nullable=False, server_default="0"))
    op.add_column("waste_records", sa.Column("quantidade_consumida", sa.Numeric(10, 3), nullable=False, server_default="0"))
    op.add_column("waste_records", sa.Column("quantidade_descartada", sa.Numeric(10, 3), nullable=False, server_default="0"))
    op.add_column("waste_records", sa.Column("quantidade_devolvida", sa.Numeric(10, 3), nullable=False, server_default="0"))
    op.drop_column("waste_records", "ingrediente_ou_prato")
    op.drop_column("waste_records", "quantidade_sobrou")
    op.drop_column("waste_records", "motivo")
    # bancos criados via create_all (modo debug) não têm este índice da migration 001
    op.execute("DROP INDEX IF EXISTS idx_waste_motivo")


def downgrade() -> None:
    op.add_column("waste_records", sa.Column("motivo", sa.String(50), nullable=False, server_default="outro"))
    op.add_column("waste_records", sa.Column("quantidade_sobrou", sa.Numeric(10, 3), nullable=False, server_default="0"))
    op.add_column("waste_records", sa.Column("ingrediente_ou_prato", sa.String(255), nullable=False, server_default=""))
    op.drop_column("waste_records", "quantidade_devolvida")
    op.drop_column("waste_records", "quantidade_descartada")
    op.drop_column("waste_records", "quantidade_consumida")
    op.drop_column("waste_records", "quantidade_produzida")
    op.drop_column("waste_records", "item")
    op.create_index("idx_waste_motivo", "waste_records", ["motivo"])

    op.add_column("shopping_list_items", sa.Column("ja_tem_estoque", sa.Boolean, nullable=False, server_default="false"))
    op.drop_column("shopping_list_items", "preco_unitario")
    op.drop_column("shopping_list_items", "quantidade_a_comprar")
    op.drop_column("shopping_list_items", "quantidade_estoque")

    op.drop_column("productions", "client_id")
    op.drop_index("uq_stock_user_ingrediente", table_name="ingredient_stock")
    op.drop_table("ingredient_stock")
    op.drop_table("clients")
