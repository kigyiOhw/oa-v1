"""add_role_type_and_admin_scope

Revision ID: 5e80f3e8af1a
Revises: 52769097cf87
Create Date: 2026-05-24 00:01:25.662171

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5e80f3e8af1a'
down_revision: Union[str, None] = '52769097cf87'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('roles', sa.Column('role_type', sa.String(length=20), nullable=True))
    op.add_column('roles', sa.Column('admin_scope', sa.String(length=20), nullable=True))
    # backfill: admin role → super_admin, everything else → user
    op.execute("UPDATE roles SET role_type = 'super_admin' WHERE name = 'admin'")
    op.execute("UPDATE roles SET role_type = 'user' WHERE role_type IS NULL")
    op.alter_column('roles', 'role_type', nullable=False)


def downgrade() -> None:
    op.drop_column('roles', 'admin_scope')
    op.drop_column('roles', 'role_type')
