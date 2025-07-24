"""add script fields

Revision ID: add_script_fields
Revises: d0d55c21dccb
Create Date: 2024-01-20 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_script_fields'
down_revision = 'd0d55c21dccb'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """添加剧本新字段"""
    # 添加rating字段
    op.add_column('scripts', sa.Column('rating', sa.Numeric(precision=3, scale=2), nullable=True, server_default='0.0'))
    
    # 添加category字段
    op.add_column('scripts', sa.Column('category', sa.String(length=50), nullable=True, server_default='推理'))
    
    # 添加play_count字段
    op.add_column('scripts', sa.Column('play_count', sa.Integer(), nullable=True, server_default='0'))
    
    # 为现有记录设置默认值
    op.execute("UPDATE scripts SET rating = 4.0 + (RANDOM() * 1.0) WHERE rating IS NULL")
    op.execute("UPDATE scripts SET category = '推理' WHERE category IS NULL")
    op.execute("UPDATE scripts SET play_count = FLOOR(RANDOM() * 500 + 50) WHERE play_count IS NULL")


def downgrade() -> None:
    """移除剧本新字段"""
    op.drop_column('scripts', 'play_count')
    op.drop_column('scripts', 'category')
    op.drop_column('scripts', 'rating')