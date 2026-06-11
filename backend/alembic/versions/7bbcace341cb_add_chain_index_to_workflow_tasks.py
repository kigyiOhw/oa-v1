"""add chain_index to workflow_tasks

Revision ID: 7bbcace341cb
Revises: 990e5f6a7b8c
Create Date: 2026-06-10 23:29:47.761051

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7bbcace341cb'
down_revision: Union[str, None] = '990e5f6a7b8c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('workflow_tasks', sa.Column('chain_index', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('workflow_tasks', 'chain_index')
