"""用户相关API路由"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from src.core.auth_dependencies import get_current_active_user
from src.core.container_integration import get_db_session_depends
from src.schemas.user_schemas import (
    GameSessionCreate, GameSessionResponse, GameHistoryResponse,
    GameParticipantResponse, UserBrief
)
from src.db.models.user import User
from src.db.models.game_session import GameSession, GameParticipant
import uuid

router = APIRouter(prefix="/api/users", tags=["用户管理"])

@router.post("/game-sessions", response_model=GameSessionResponse, summary="创建游戏会话")
async def create_game_session(
    session_data: GameSessionCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = get_db_session_depends()
):
    """创建游戏会话"""
    try:
        # 生成唯一的会话ID
        session_id = str(uuid.uuid4())[:8].upper()
        
        # 创建游戏会话
        game_session = GameSession(
            session_id=session_id,
            script_id=session_data.script_id,
            host_user_id=current_user.id,  # 修复：将Column[int]转换为int
            max_players=session_data.max_players,
            current_players=1,  # 房主自动加入
            status="waiting"
        )
        
        db.add(game_session)
        db.flush()  # 获取ID但不提交
        
        # 房主自动加入游戏
        participant = GameParticipant(
            session_id=game_session.id,
            user_id=current_user.id,  # 修复：将Column[int]转换为int
            role="host",
            status="joined"
        )
        
        db.add(participant)
        db.commit()
        db.refresh(game_session)
        
        return GameSessionResponse.from_orm(game_session)
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建游戏会话失败: {str(e)}"
        )

@router.post("/game-sessions/{session_id}/join", summary="加入游戏会话")
async def join_game_session(
    session_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = get_db_session_depends()
):
    """加入游戏会话"""
    # 查找游戏会话
    game_session = db.query(GameSession).filter(
        GameSession.session_id == session_id
    ).first()
    
    if not game_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="游戏会话不存在"
        )
    
    # 检查游戏状态
    if game_session.status != "waiting":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="游戏已开始或已结束，无法加入"
        )
    
    # 检查是否已加入
    existing_participant = db.query(GameParticipant).filter(
        GameParticipant.session_id == game_session.id,
        GameParticipant.user_id == current_user.id
    ).first()
    
    if existing_participant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="您已加入此游戏会话"
        )
    
    # 检查人数限制
    if game_session.current_players >= game_session.max_players:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="游戏会话已满"
        )
    
    try:
        # 加入游戏
        participant = GameParticipant(
            session_id=game_session.id,
            user_id=current_user.id,
            role="player",
            status="joined"
        )
        
        db.add(participant)
        
        # 更新当前玩家数
        game_session.current_players += 1
        
        db.commit()
        
        return {"message": "成功加入游戏会话"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"加入游戏会话失败: {str(e)}"
        )

@router.post("/game-sessions/{session_id}/leave", summary="离开游戏会话")
async def leave_game_session(
    session_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = get_db_session_depends()
):
    """离开游戏会话"""
    # 查找游戏会话
    game_session = db.query(GameSession).filter(
        GameSession.session_id == session_id
    ).first()
    
    if not game_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="游戏会话不存在"
        )
    
    # 查找参与记录
    participant = db.query(GameParticipant).filter(
        GameParticipant.session_id == game_session.id,
        GameParticipant.user_id == current_user.id
    ).first()
    
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="您未加入此游戏会话"
        )
    
    try:
        # 如果是房主离开，需要特殊处理
        if participant.role == "host":
            # 如果游戏还未开始，可以取消游戏
            if game_session.status == "waiting":
                game_session.status = "cancelled"
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="游戏已开始，房主无法离开"
                )
        
        # 更新参与状态
        participant.status = "left"
        from datetime import datetime
        participant.left_at = datetime.utcnow()
        
        # 更新当前玩家数
        if participant.status != "left":
            game_session.current_players -= 1
        
        db.commit()
        
        return {"message": "成功离开游戏会话"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"离开游戏会话失败: {str(e)}"
        )

@router.get("/game-history", response_model=list[GameHistoryResponse], summary="获取游戏历史")
async def get_game_history(
    skip: int = Query(0, ge=0, description="跳过的记录数"),
    limit: int = Query(20, ge=1, le=100, description="返回的记录数"),
    current_user: User = Depends(get_current_active_user),
    db: Session = get_db_session_depends()
):
    """获取用户游戏历史"""
    # 查询用户参与的游戏
    participations = db.query(GameParticipant).join(GameSession).filter(
        GameParticipant.user_id == current_user.id
    ).order_by(desc(GameParticipant.created_at)).offset(skip).limit(limit).all()
    
    # 获取所有相关的剧本ID
    script_ids = [p.session.script_id for p in participations]
    script_titles = {}
    
    # 如果有剧本ID，则查询剧本标题
    if script_ids:
        from src.db.repositories.script_repository import ScriptRepository
        script_repo = ScriptRepository(db)
        for script_id in script_ids:
            script_info = script_repo.get_script_info_by_id(script_id)
            if script_info:
                script_titles[script_id] = script_info.title
            else:
                script_titles[script_id] = "未知剧本"
    
    result = []
    for participation in participations:
        game_session = participation.session
        
        # 获取参与者列表
        participants = db.query(GameParticipant).filter(
            GameParticipant.session_id == game_session.id
        ).all()
        
        # 构建参与者简要信息列表
        participant_briefs = [
            UserBrief.from_orm(p.user) for p in participants
        ]
        
        result.append(GameHistoryResponse(
            id=getattr(game_session, 'id'),
            session_id=getattr(game_session, 'session_id'),
            script_id=getattr(game_session, 'script_id'),
            script_title=script_titles.get(getattr(game_session, 'script_id'), "未知剧本"),
            host_user_id=getattr(game_session, 'host_user_id'),
            status=getattr(game_session, 'status'),
            created_at=getattr(game_session, 'created_at'),
            started_at=getattr(game_session, 'started_at'),
            ended_at=getattr(game_session, 'finished_at'),
            participants=participant_briefs
        ))
    
    return result

@router.get("/game-sessions/{session_id}", response_model=GameSessionResponse, summary="获取游戏会话详情")
async def get_game_session(
    session_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = get_db_session_depends()
):
    """获取游戏会话详情"""
    game_session = db.query(GameSession).filter(
        GameSession.session_id == session_id
    ).first()
    
    if not game_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="游戏会话不存在"
        )
    
    return GameSessionResponse.from_orm(game_session)

@router.get("/game-sessions/{session_id}/participants", response_model=list[GameParticipantResponse], summary="获取游戏参与者")
async def get_game_participants(
    session_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = get_db_session_depends()
):
    """获取游戏参与者列表"""
    # 查找游戏会话
    game_session = db.query(GameSession).filter(
        GameSession.session_id == session_id
    ).first()
    
    if not game_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="游戏会话不存在"
        )
    
    # 查询参与者
    participants = db.query(GameParticipant).filter(
        GameParticipant.session_id == game_session.id
    ).all()
    
    result = []
    for participant in participants:
        # 使用模型字段直接创建GameParticipantResponse对象，而不是通过to_dict()
        result.append(GameParticipantResponse(
            id=getattr(participant, 'id'),
            session_id=getattr(participant, 'session_id'),
            user_id=getattr(participant, 'user_id'),
            user=UserBrief.from_orm(participant.user),
            role=getattr(participant, 'role'),
            status=getattr(participant, 'status'),
            joined_at=getattr(participant, 'joined_at')
        ))
    
    return result

@router.get("/stats", summary="获取用户统计信息")
async def get_user_stats(
    current_user: User = Depends(get_current_active_user),
    db: Session = get_db_session_depends()
):
    """获取用户统计信息"""
    # 总游戏数
    total_games = db.query(GameParticipant).filter(
        GameParticipant.user_id == current_user.id
    ).count()
    
    # 完成的游戏数
    finished_games = db.query(GameParticipant).join(GameSession).filter(
        GameParticipant.user_id == current_user.id,
        GameSession.status == "finished"
    ).count()
    
    # 获胜次数
    wins = db.query(GameParticipant).filter(
        GameParticipant.user_id == current_user.id,
        GameParticipant.is_winner == True
    ).count()
    
    # 主持的游戏数
    hosted_games = db.query(GameSession).filter(
        GameSession.host_user_id == current_user.id
    ).count()
    
    return {
        "total_games": total_games,
        "finished_games": finished_games,
        "wins": wins,
        "hosted_games": hosted_games,
        "win_rate": round(wins / finished_games * 100, 2) if finished_games > 0 else 0
    }