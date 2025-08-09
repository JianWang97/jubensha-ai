"""add game history participants, indexes, statistics view

Revision ID: a1b2c3d4e5f6
Revises: cb328c7b28b4
Create Date: 2025-08-09 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'cb328c7b28b4'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. user_game_participants table
    op.create_table(
        'user_game_participants',
        sa.Column('id', sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column('session_id', sa.String(length=100), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('character_name', sa.String(length=100), nullable=True),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.Column('left_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('TRUE'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['session_id'], ['game_sessions.session_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('session_id', 'user_id', name='uq_user_game_participant_session_user')
    )
    op.create_index('idx_user_game_participants_user', 'user_game_participants', ['user_id', 'joined_at'])
    op.create_index('idx_user_game_participants_session', 'user_game_participants', ['session_id', 'is_active'])

    # 2. Additional indexes for game_sessions
    op.create_index('idx_game_sessions_user_status_time', 'game_sessions', ['host_user_id', 'status', sa.text('created_at DESC')])
    op.create_index('idx_game_sessions_script_time', 'game_sessions', ['script_id', sa.text('created_at DESC')])
    op.create_index('idx_game_sessions_status_time', 'game_sessions', ['status', sa.text('created_at DESC')])

    # 3. Additional indexes for game_events
    op.create_index('idx_game_events_session_timestamp', 'game_events', ['session_id', sa.text('timestamp DESC')])
    op.create_index('idx_game_events_session_type', 'game_events', ['session_id', 'event_type', sa.text('timestamp DESC')])
    op.create_index('idx_game_events_session_character', 'game_events', ['session_id', 'character_name', sa.text('timestamp DESC')])
    op.create_index('idx_game_events_public', 'game_events', ['session_id', 'is_public', sa.text('timestamp DESC')])
    op.create_index('idx_game_events_tts_status', 'game_events', ['session_id', 'tts_status'])

    # 4. Statistics view
    op.execute("""
    CREATE OR REPLACE VIEW game_session_statistics AS
    SELECT 
        gs.id,
        gs.session_id,
        gs.script_id,
        gs.host_user_id,
        gs.status,
        gs.created_at,
        gs.started_at,
        gs.finished_at,
        EXTRACT(EPOCH FROM (COALESCE(gs.finished_at, NOW()) - gs.started_at))/60 as duration_minutes,
        COUNT(DISTINCT ugp.user_id) as player_count,
        COUNT(ge.id) as total_events,
        COUNT(CASE WHEN ge.event_type = 'chat' THEN 1 END) as chat_messages,
        COUNT(CASE WHEN ge.event_type = 'system' THEN 1 END) as system_events,
        COUNT(CASE WHEN ge.tts_status = 'COMPLETED' THEN 1 END) as tts_generated
    FROM game_sessions gs
    LEFT JOIN user_game_participants ugp ON gs.session_id = ugp.session_id
    LEFT JOIN game_events ge ON gs.session_id = ge.session_id
    GROUP BY gs.id, gs.session_id, gs.script_id, gs.host_user_id, gs.status, 
             gs.created_at, gs.started_at, gs.finished_at;
    """)


def downgrade() -> None:
    # Drop view
    op.execute('DROP VIEW IF EXISTS game_session_statistics')

    # Drop added indexes on game_events
    for idx in [
        'idx_game_events_tts_status',
        'idx_game_events_public',
        'idx_game_events_session_character',
        'idx_game_events_session_type',
        'idx_game_events_session_timestamp'
    ]:
        op.drop_index(idx, table_name='game_events')

    # Drop added indexes on game_sessions
    for idx in [
        'idx_game_sessions_status_time',
        'idx_game_sessions_script_time',
        'idx_game_sessions_user_status_time'
    ]:
        op.drop_index(idx, table_name='game_sessions')

    # Drop participant indexes & table
    op.drop_index('idx_user_game_participants_session', table_name='user_game_participants')
    op.drop_index('idx_user_game_participants_user', table_name='user_game_participants')
    op.drop_table('user_game_participants')
