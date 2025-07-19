"""证据数据访问层"""
from typing import List, Optional
from sqlalchemy.orm import Session
from ...schemas.script import ScriptEvidence
from ..models.evidence import EvidenceDBModel
from .base import BaseRepository


class EvidenceRepository(BaseRepository[EvidenceDBModel]):
    """证据数据访问层"""
    
    def __init__(self, db_session: Session):
        super().__init__(EvidenceDBModel, db_session)
        self.db = db_session
    def update_evidence_image_url(self, evidence_id: int, image_url: str) -> bool:
        """更新证据的图片URL"""
        db_evidence = self.db.query(EvidenceDBModel).filter(EvidenceDBModel.id == evidence_id).first()
        if not db_evidence:
            return False
        
        setattr(db_evidence, 'image_url', image_url)
        self.db.flush()
        return True
    
    def add_evidence(self, evidence: ScriptEvidence) -> ScriptEvidence:
        """添加证据"""
        db_data = evidence.to_db_dict()
        db_evidence = EvidenceDBModel(**db_data)
        self.db.add(db_evidence)
        self.db.flush()
        return ScriptEvidence.model_validate(db_evidence, from_attributes=True)
    
    def update_evidence(self, evidence_id: int, evidence: ScriptEvidence) -> Optional[ScriptEvidence]:
        """更新证据"""
        db_evidence = self.db.query(EvidenceDBModel).filter(EvidenceDBModel.id == evidence_id).first()
        if not db_evidence:
            return None
        
        update_data = evidence.model_dump(exclude={'id', 'created_at', 'updated_at'}, exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_evidence, field, value)

        return ScriptEvidence.model_validate(db_evidence, from_attributes=True)
    
    def update_evidence_fields(self, evidence_id: int, update_data: dict) -> Optional[ScriptEvidence]:
        """更新证据的指定字段"""
        db_evidence = self.db.query(EvidenceDBModel).filter(EvidenceDBModel.id == evidence_id).first()
        if not db_evidence:
            return None
        
        # 直接更新指定字段
        for field, value in update_data.items():
            if hasattr(db_evidence, field):
                setattr(db_evidence, field, value)
        
        self.db.flush()
        return ScriptEvidence.model_validate(db_evidence, from_attributes=True)
    
    def delete_evidence(self, evidence_id: int) -> bool:
        """删除证据"""
        db_evidence = self.db.query(EvidenceDBModel).filter(EvidenceDBModel.id == evidence_id).first()
        if not db_evidence:
            return False
        
        self.db.delete(db_evidence)
        return True
    
    def get_evidence_by_id(self, evidence_id: int) -> Optional[ScriptEvidence]:
        """根据ID获取证据"""
        db_evidence = self.db.query(EvidenceDBModel).filter(EvidenceDBModel.id == evidence_id).first()
        if not db_evidence:
            return None
        return ScriptEvidence.model_validate(db_evidence, from_attributes=True)
    
    def get_evidence_by_script(self, script_id: int) -> List[ScriptEvidence]:
        """获取剧本的所有证据"""
        db_evidence = self.db.query(EvidenceDBModel).filter(EvidenceDBModel.script_id == script_id).all()
        return [ScriptEvidence.model_validate(ev, from_attributes=True) for ev in db_evidence]
    
    def get_evidence_by_location(self, script_id: int, location: str) -> List[ScriptEvidence]:
        """根据地点获取证据"""
        db_evidence = self.db.query(EvidenceDBModel).filter(
            EvidenceDBModel.script_id == script_id,
            EvidenceDBModel.location == location
        ).all()
        return [ScriptEvidence.model_validate(ev, from_attributes=True) for ev in db_evidence]
    
    def get_evidence_by_type(self, script_id: int, evidence_type: str) -> List[ScriptEvidence]:
        """根据类型获取证据"""
        db_evidence = self.db.query(EvidenceDBModel).filter(
            EvidenceDBModel.script_id == script_id,
            EvidenceDBModel.evidence_type == evidence_type
        ).all()
        return [ScriptEvidence.model_validate(ev, from_attributes=True) for ev in db_evidence]
    
    def get_evidence_by_character(self, script_id: int, character_name: str) -> List[ScriptEvidence]:
        """根据关联角色获取证据"""
        db_evidence = self.db.query(EvidenceDBModel).filter(
            EvidenceDBModel.script_id == script_id,
            EvidenceDBModel.related_to == character_name
        ).all()
        return [ScriptEvidence.model_validate(ev, from_attributes=True) for ev in db_evidence]
    
    def get_hidden_evidence(self, script_id: int) -> List[ScriptEvidence]:
        """获取隐藏证据"""
        db_evidence = self.db.query(EvidenceDBModel).filter(
            EvidenceDBModel.script_id == script_id,
            EvidenceDBModel.is_hidden == True
        ).all()
        return [ScriptEvidence.model_validate(ev, from_attributes=True) for ev in db_evidence]
    
    def get_visible_evidence(self, script_id: int) -> List[ScriptEvidence]:
        """获取可见证据"""
        db_evidence = self.db.query(EvidenceDBModel).filter(
            EvidenceDBModel.script_id == script_id,
            EvidenceDBModel.is_hidden == False
        ).all()
        return [ScriptEvidence.model_validate(ev, from_attributes=True) for ev in db_evidence]
    
    def delete_evidence_by_script(self, script_id: int) -> bool:
        """删除剧本的所有证据"""
        deleted_count = self.db.query(EvidenceDBModel).filter(EvidenceDBModel.script_id == script_id).delete()
        return deleted_count > 0