"""some relationship resolved

Revision ID: 004_relationship_resolved
Revises: 003_seed_service_lines_and_methodologies
Create Date: 2026-04-06 13:38:44.066900

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '004_relationship_resolved'
down_revision: Union[str, Sequence[str], None] = '003_seed_service_lines_and_methodologies'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
