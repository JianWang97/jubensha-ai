"""make user email optional

Revision ID: d1e2f3a4b5c6
Revises: cc0436694e36
Create Date: 2026-09-01 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd1e2f3a4b5c6'
down_revision = 'cc0436694e36'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 邮箱改为可选。唯一索引保留：PostgreSQL 允许多行 NULL 共存，
    # 因此未填写邮箱的账户不会互相冲突。
    op.alter_column(
        'users', 'email',
        existing_type=sa.String(length=100),
        nullable=True,
        comment='邮箱',
    )
    # 历史数据中的空串归一化为 NULL，否则第二个空串账户会触发唯一约束
    op.execute("UPDATE users SET email = NULL WHERE email = ''")


def downgrade() -> None:
    # 回滚前需要给缺失邮箱的账户补占位值，否则无法恢复 NOT NULL
    op.execute(
        "UPDATE users SET email = 'user' || id || '@placeholder.local' "
        "WHERE email IS NULL"
    )
    op.alter_column(
        'users', 'email',
        existing_type=sa.String(length=100),
        nullable=False,
        comment='邮箱',
    )
