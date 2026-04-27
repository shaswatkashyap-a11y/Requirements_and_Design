"""seed_service_lines_and_methodologies

Revision ID: 0eccb27da7f4
Revises: cfda7f76a367
Create Date: 2026-04-03 16:51:39.850352

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0eccb27da7f4'
down_revision: Union[str, Sequence[str], None] = 'cfda7f76a367'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # --- Categories ---
    categories_table = sa.table(
        "service_line_categories",
        sa.column("id", sa.Integer),
        sa.column("name", sa.String),
        sa.column("code", sa.String),
        sa.column("sort_order", sa.Integer),
    )

    op.bulk_insert(categories_table, [
        {"id": 1, "name": "CRM & ERP Platforms", "code": "crm_erp", "sort_order": 1},
        {"id": 2, "name": "ITSM & Workflow", "code": "itsm_workflow", "sort_order": 2},
        {"id": 3, "name": "Custom Development", "code": "custom_dev", "sort_order": 3},
        {"id": 4, "name": "Frontend Frameworks", "code": "frontend", "sort_order": 4},
        {"id": 5, "name": "AI & Intelligence", "code": "ai_intelligence", "sort_order": 5},
        {"id": 6, "name": "Cloud Platforms", "code": "cloud", "sort_order": 6},
    ])

    # --- Service Lines ---
    service_lines_table = sa.table(
        "service_lines",
        sa.column("id", sa.Integer),
        sa.column("category_id", sa.Integer),
        sa.column("name", sa.String),
        sa.column("code", sa.String),
        sa.column("icon", sa.String),
    )

    op.bulk_insert(service_lines_table, [
        # CRM & ERP
        {"id": 1, "category_id": 1, "name": "Salesforce", "code": "salesforce", "icon": "cloud"},
        {"id": 2, "category_id": 1, "name": "NetSuite", "code": "netsuite", "icon": "database"},
        {"id": 3, "category_id": 1, "name": "SAP", "code": "sap", "icon": "database"},
        {"id": 4, "category_id": 1, "name": "Oracle Applications", "code": "oracle_applications", "icon": "database"},
        # ITSM & Workflow
        {"id": 5, "category_id": 2, "name": "ServiceNow", "code": "servicenow", "icon": "settings"},
        # Custom Development
        {"id": 6, "category_id": 3, "name": ".NET", "code": "dotnet", "icon": "code"},
        {"id": 7, "category_id": 3, "name": "Python", "code": "python_dev", "icon": "code"},
        {"id": 8, "category_id": 3, "name": "Java", "code": "java", "icon": "code"},
        # Frontend Frameworks
        {"id": 9, "category_id": 4, "name": "React", "code": "react", "icon": "monitor"},
        {"id": 10, "category_id": 4, "name": "Angular", "code": "angular", "icon": "monitor"},
        # AI & Intelligence
        {"id": 11, "category_id": 5, "name": "Agentic AI", "code": "agentic_ai", "icon": "brain"},
        {"id": 12, "category_id": 5, "name": "AI/ML", "code": "ai_ml", "icon": "brain"},
        {"id": 13, "category_id": 5, "name": "Data & AI", "code": "data_ai", "icon": "database"},
        # Cloud Platforms
        {"id": 14, "category_id": 6, "name": "Azure", "code": "azure", "icon": "cloud"},
        {"id": 15, "category_id": 6, "name": "AWS", "code": "aws", "icon": "cloud"},
        {"id": 16, "category_id": 6, "name": "GCP", "code": "gcp", "icon": "cloud"},
    ])

    # --- Methodologies ---
    methodologies_table = sa.table(
        "methodologies",
        sa.column("id", sa.Integer),
        sa.column("name", sa.String),
        sa.column("code", sa.String),
        sa.column("description", sa.String),
    )

    op.bulk_insert(methodologies_table, [
        {"id": 1, "name": "Scrum", "code": "scrum", "description": "Iterative sprints with user stories and ceremonies"},
        {"id": 2, "name": "Agile", "code": "agile", "description": "Flexible iterative development"},
        {"id": 3, "name": "Waterfall", "code": "waterfall", "description": "Sequential phases with formal gate reviews"},
    ])


def downgrade():
    op.execute("DELETE FROM service_lines")
    op.execute("DELETE FROM service_line_categories")
    op.execute("DELETE FROM methodologies")