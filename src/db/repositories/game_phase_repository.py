"""游戏阶段数据访问层"""
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import asc
from ...schemas.script import GamePhase
from ..models.game_phase import GamePhaseDBModel
from .base import BaseRepository


class GamePhaseRepository(BaseRepository[GamePhaseDBModel]):
    """游戏阶段数据访问层"""
    
    def __init__(self, db_session: Session):
        super().__init__(GamePhaseDBModel, db_session)
        self.db = db_session
    
    def add_game_phase(self, game_phase: GamePhase) -> GamePhase:
        """添加游戏阶段"""
        db_data = game_phase.to_db_dict()
        db_phase = GamePhaseDBModel(**db_data)
        self.db.add(db_phase)
        self.db.flush()
        return GamePhase.model_validate(db_phase, from_attributes=True)
    
    def update_game_phase(self, phase_id: int, game_phase: GamePhase) -> Optional[GamePhase]:
        """更新游戏阶段"""
        db_phase = self.db.query(GamePhaseDBModel).filter(GamePhaseDBModel.id == phase_id).first()
        if not db_phase:
            return None
        
        update_data = game_phase.model_dump(exclude={'id', 'created_at', 'updated_at'}, exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_phase, field, value)
        
        self.db.flush()
        return GamePhase.model_validate(db_phase, from_attributes=True)
    
    def delete_game_phase(self, phase_id: int) -> bool:
        """删除游戏阶段"""
        db_phase = self.db.query(GamePhaseDBModel).filter(GamePhaseDBModel.id == phase_id).first()
        if not db_phase:
            return False
        
        self.db.delete(db_phase)
        return True
    
    def get_game_phase_by_id(self, phase_id: int) -> Optional[GamePhase]:
        """根据ID获取游戏阶段"""
        db_phase = self.db.query(GamePhaseDBModel).filter(GamePhaseDBModel.id == phase_id).first()
        if not db_phase:
            return None
        return GamePhase.model_validate(db_phase, from_attributes=True)
    
    def get_game_phases_by_script(self, script_id: int) -> List[GamePhase]:
        """获取剧本的所有游戏阶段（按顺序）"""
        db_phases = self.db.query(GamePhaseDBModel).filter(
            GamePhaseDBModel.script_id == script_id
        ).order_by(asc(GamePhaseDBModel.order_index)).all()
        return [GamePhase.model_validate(phase, from_attributes=True) for phase in db_phases]
    
    def get_game_phase_by_name(self, script_id: int, phase_name: str) -> Optional[GamePhase]:
        """根据阶段名称获取游戏阶段"""
        db_phase = self.db.query(GamePhaseDBModel).filter(
            GamePhaseDBModel.script_id == script_id,
            GamePhaseDBModel.phase == phase_name
        ).first()
        if not db_phase:
            return None
        return GamePhase.model_validate(db_phase, from_attributes=True)
    
    def get_game_phase_by_order(self, script_id: int, order_index: int) -> Optional[GamePhase]:
        """根据顺序索引获取游戏阶段"""
        db_phase = self.db.query(GamePhaseDBModel).filter(
            GamePhaseDBModel.script_id == script_id,
            GamePhaseDBModel.order_index == order_index
        ).first()
        if not db_phase:
            return None
        return GamePhase.model_validate(db_phase, from_attributes=True)
    
    def get_first_phase(self, script_id: int) -> Optional[GamePhase]:
        """获取第一个游戏阶段"""
        db_phase = self.db.query(GamePhaseDBModel).filter(
            GamePhaseDBModel.script_id == script_id
        ).order_by(asc(GamePhaseDBModel.order_index)).first()
        if not db_phase:
            return None
        return GamePhase.model_validate(db_phase, from_attributes=True)
    
    def get_last_phase(self, script_id: int) -> Optional[GamePhase]:
        """获取最后一个游戏阶段"""
        db_phase = self.db.query(GamePhaseDBModel).filter(
            GamePhaseDBModel.script_id == script_id
        ).order_by(GamePhaseDBModel.order_index.desc()).first()
        if not db_phase:
            return None
        return GamePhase.model_validate(db_phase, from_attributes=True)
    
    def get_next_phase(self, script_id: int, current_order: int) -> Optional[GamePhase]:
        """获取下一个游戏阶段"""
        db_phase = self.db.query(GamePhaseDBModel).filter(
            GamePhaseDBModel.script_id == script_id,
            GamePhaseDBModel.order_index > current_order
        ).order_by(asc(GamePhaseDBModel.order_index)).first()
        if not db_phase:
            return None
        return GamePhase.model_validate(db_phase, from_attributes=True)
    
    def get_previous_phase(self, script_id: int, current_order: int) -> Optional[GamePhase]:
        """获取上一个游戏阶段"""
        db_phase = self.db.query(GamePhaseDBModel).filter(
            GamePhaseDBModel.script_id == script_id,
            GamePhaseDBModel.order_index < current_order
        ).order_by(GamePhaseDBModel.order_index.desc()).first()
        if not db_phase:
            return None
        return GamePhase.model_validate(db_phase, from_attributes=True)
    
    def reorder_phases(self, script_id: int, phase_orders: List[tuple[int, int]]) -> bool:
        """重新排序游戏阶段
        
        Args:
            script_id: 剧本ID
            phase_orders: [(phase_id, new_order_index), ...] 阶段ID和新顺序的元组列表
        """
        try:
            for phase_id, new_order in phase_orders:
                db_phase = self.db.query(GamePhaseDBModel).filter(
                    GamePhaseDBModel.id == phase_id,
                    GamePhaseDBModel.script_id == script_id
                ).first()
                if db_phase:
                    setattr(db_phase, 'order_index', new_order)
            
            self.db.flush()
            return True
        except Exception:
            self.db.rollback()
            return False
    
    def delete_game_phases_by_script(self, script_id: int) -> bool:
        """删除剧本的所有游戏阶段"""
        deleted_count = self.db.query(GamePhaseDBModel).filter(GamePhaseDBModel.script_id == script_id).delete()
        self.db.flush()
        return deleted_count > 0
    
    def get_phase_count(self, script_id: int) -> int:
        """获取剧本的游戏阶段数量"""
        return self.db.query(GamePhaseDBModel).filter(GamePhaseDBModel.script_id == script_id).count()