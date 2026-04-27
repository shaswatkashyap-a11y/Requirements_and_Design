"""some relationship resolved

Revision ID: 21c447f513e2
Revises: 0eccb27da7f4
Create Date: 2026-04-06 13:38:44.066900

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '21c447f513e2'
down_revision: Union[str, Sequence[str], None] = '0eccb27da7f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
