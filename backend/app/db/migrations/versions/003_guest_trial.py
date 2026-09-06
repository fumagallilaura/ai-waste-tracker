"""Guest trial: productions can exist without a user, keyed by a pseudonymous identifier

Revision ID: 003_guest_trial
Revises: 002_clients_stock
Create Date: 2026-09-06

Visitantes sem conta podem criar 1 produção + 1 balanço. A produção fica com
user_id NULL e é associada ao usuário no login (claim), via guest_identifier_hash.
IP é armazenado apenas como hash (LGPD: minimização de dados).
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "003_guest_trial"
down_revision: str | None = "002_clients_stock"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("productions", "user_id", existing_type=sa.Uuid(), nullable=True)
    op.add_column("productions", sa.Column("guest_identifier_hash", sa.String(64), nullable=True))
    op.add_column("productions", sa.Column("ip_hash", sa.String(64), nullable=True))
    op.create_index("idx_productions_guest", "productions", ["guest_identifier_hash"])


def downgrade() -> None:
    op.drop_index("idx_productions_guest", table_name="productions")
    op.drop_column("productions", "ip_hash")
    op.drop_column("productions", "guest_identifier_hash")
    # só é seguro se não houver produções de visitante pendentes
    op.alter_column("productions", "user_id", existing_type=sa.Uuid(), nullable=False)
