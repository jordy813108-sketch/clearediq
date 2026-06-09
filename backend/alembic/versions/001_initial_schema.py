"""Initial schema

Revision ID: 001
Revises: 
Create Date: 2026-01-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('organizations',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(100), unique=True, nullable=False),
        sa.Column('plan', sa.String(50), default='starter'),
        sa.Column('receipts_limit', sa.Integer(), default=500),
        sa.Column('created_at', sa.DateTime()),
        sa.Column('updated_at', sa.DateTime()),
        sa.Column('is_active', sa.Boolean(), default=True),
    )

    op.create_table('users',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('organization_id', UUID(as_uuid=False), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(255)),
        sa.Column('role', sa.String(50), default='reviewer'),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime()),
        sa.Column('last_login', sa.DateTime()),
    )
    op.create_index('ix_users_email', 'users', ['email'])

    op.create_table('receipts',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('organization_id', UUID(as_uuid=False), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('submitted_by_id', UUID(as_uuid=False), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('reviewed_by_id', UUID(as_uuid=False), sa.ForeignKey('users.id')),
        sa.Column('original_filename', sa.String(500)),
        sa.Column('file_hash', sa.String(64)),
        sa.Column('file_size_bytes', sa.Integer()),
        sa.Column('mime_type', sa.String(100)),
        sa.Column('storage_key', sa.String(500)),
        sa.Column('storage_url', sa.Text()),
        sa.Column('status', sa.String(50), default='pending'),
        sa.Column('risk_level', sa.String(20)),
        sa.Column('risk_score', sa.Integer()),
        sa.Column('exif_data', sa.JSON()),
        sa.Column('upload_ip', sa.String(45)),
        sa.Column('created_at', sa.DateTime()),
        sa.Column('processed_at', sa.DateTime()),
        sa.Column('reviewed_at', sa.DateTime()),
        sa.Column('reviewer_notes', sa.Text()),
    )
    op.create_index('ix_receipts_file_hash', 'receipts', ['file_hash'])
    op.create_index('ix_receipts_org_status', 'receipts', ['organization_id', 'status'])
    op.create_index('ix_receipts_org_risk', 'receipts', ['organization_id', 'risk_level'])

    op.create_table('ocr_results',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('receipt_id', UUID(as_uuid=False), sa.ForeignKey('receipts.id'), unique=True, nullable=False),
        sa.Column('provider', sa.String(50)),
        sa.Column('confidence_score', sa.Float()),
        sa.Column('merchant_name', sa.String(500)),
        sa.Column('merchant_address', sa.Text()),
        sa.Column('merchant_phone', sa.String(50)),
        sa.Column('transaction_date', sa.String(50)),
        sa.Column('transaction_time', sa.String(50)),
        sa.Column('transaction_id', sa.String(200)),
        sa.Column('subtotal', sa.Float()),
        sa.Column('tax_amount', sa.Float()),
        sa.Column('tax_rate', sa.Float()),
        sa.Column('tip_amount', sa.Float()),
        sa.Column('total_amount', sa.Float()),
        sa.Column('payment_method', sa.String(100)),
        sa.Column('card_last_four', sa.String(4)),
        sa.Column('line_items', sa.JSON()),
        sa.Column('raw_text', sa.Text()),
        sa.Column('field_confidences', sa.JSON()),
        sa.Column('created_at', sa.DateTime()),
    )

    op.create_table('fraud_scores',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('receipt_id', UUID(as_uuid=False), sa.ForeignKey('receipts.id'), unique=True, nullable=False),
        sa.Column('overall_score', sa.Integer()),
        sa.Column('risk_level', sa.String(20)),
        sa.Column('math_validation_score', sa.Integer()),
        sa.Column('tax_validation_score', sa.Integer()),
        sa.Column('timestamp_score', sa.Integer()),
        sa.Column('duplicate_score', sa.Integer()),
        sa.Column('merchant_score', sa.Integer()),
        sa.Column('image_forensics_score', sa.Integer()),
        sa.Column('metadata_score', sa.Integer()),
        sa.Column('score_breakdown', sa.JSON()),
        sa.Column('created_at', sa.DateTime()),
    )

    op.create_table('fraud_flags',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('receipt_id', UUID(as_uuid=False), sa.ForeignKey('receipts.id'), nullable=False),
        sa.Column('flag_type', sa.String(100)),
        sa.Column('severity', sa.String(20)),
        sa.Column('title', sa.String(500)),
        sa.Column('description', sa.Text()),
        sa.Column('evidence', sa.JSON()),
        sa.Column('weight', sa.Float()),
        sa.Column('created_at', sa.DateTime()),
    )

    op.create_table('merchant_templates',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('organization_id', UUID(as_uuid=False), sa.ForeignKey('organizations.id')),
        sa.Column('merchant_name', sa.String(500), nullable=False),
        sa.Column('merchant_domain', sa.String(255)),
        sa.Column('expected_tax_rates', sa.JSON()),
        sa.Column('receipt_layout_signature', sa.JSON()),
        sa.Column('known_fonts', sa.JSON()),
        sa.Column('sample_count', sa.Integer(), default=0),
        sa.Column('is_global', sa.Boolean(), default=False),
        sa.Column('created_at', sa.DateTime()),
        sa.Column('updated_at', sa.DateTime()),
    )

    op.create_table('upload_logs',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('receipt_id', UUID(as_uuid=False), sa.ForeignKey('receipts.id'), unique=True, nullable=False),
        sa.Column('upload_method', sa.String(50)),
        sa.Column('ip_address', sa.String(45)),
        sa.Column('user_agent', sa.Text()),
        sa.Column('processing_time_ms', sa.Integer()),
        sa.Column('error_message', sa.Text()),
        sa.Column('created_at', sa.DateTime()),
    )

    op.create_table('audit_events',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('organization_id', UUID(as_uuid=False), sa.ForeignKey('organizations.id'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=False), sa.ForeignKey('users.id')),
        sa.Column('receipt_id', UUID(as_uuid=False), sa.ForeignKey('receipts.id')),
        sa.Column('event_type', sa.String(100)),
        sa.Column('event_data', sa.JSON()),
        sa.Column('ip_address', sa.String(45)),
        sa.Column('created_at', sa.DateTime()),
    )


def downgrade():
    for table in ['audit_events', 'upload_logs', 'merchant_templates',
                  'fraud_flags', 'fraud_scores', 'ocr_results',
                  'receipts', 'users', 'organizations']:
        op.drop_table(table)
