"""剧本数据访问层"""
from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import desc, or_

from ...schemas.script import Script, ScriptInfo
from ...schemas.script_info import ScriptStatus
from ...schemas.base import PaginatedResponse
from ..models.script_model import ScriptDBModel
from ..models.character import CharacterDBModel
from ..models.evidence import EvidenceDBModel
from ..models.location import LocationDBModel
from ..models.background_story import BackgroundStoryDBModel
from ..models.game_phase import GamePhaseDBModel
from .base import BaseRepository


class ScriptRepository(BaseRepository[ScriptDBModel]):
    """剧本数据访问层"""
    
    def __init__(self, db_session: Session):
        super().__init__(ScriptDBModel, db_session)
        self.db: Session = db_session
    
    def create_script(self, script_data: ScriptInfo) -> ScriptInfo:
        """创建新剧本"""
        # 转换为数据库模型
        db_script = ScriptDBModel(
            title=script_data.title,
            description=script_data.description,
            author=script_data.author,
            player_count=script_data.player_count,
            duration_minutes=script_data.estimated_duration or 180,
            difficulty=script_data.difficulty_level or "medium",
            category=script_data.category or "推理",
            tags=script_data.tags or [],
            status=script_data.status or ScriptStatus.DRAFT,
            cover_image_url=script_data.cover_image_url,
            is_public=script_data.is_public,
            price=script_data.price,
            rating=script_data.rating,
        )
        self.db.add(db_script)
        self.db.flush()
        
        # 转换回Pydantic模型
        return ScriptInfo.model_validate(db_script, from_attributes=True)
    
    def create_complete_script(self, script: Script) -> Script:
        """创建完整剧本（包含所有关联数据）"""
        # 创建主剧本
        db_data = script.info.to_db_dict()
        db_script = ScriptDBModel(**db_data)
        self.db.add(db_script)
        self.db.flush()  # 获取script_id但不提交事务
        
        # 创建背景故事
        if script.background_story:
            story_data = script.background_story.to_db_dict()
            story_data['script_id'] = db_script.id
            db_background = BackgroundStoryDBModel(**story_data)
            self.db.add(db_background)
        
        # 创建角色
        for character in script.characters:
            char_data = character.to_db_dict()
            char_data['script_id'] = db_script.id
            db_character = CharacterDBModel(**char_data)
            self.db.add(db_character)
        
        # 创建证据
        for evidence in script.evidence:
            ev_data = evidence.to_db_dict()
            ev_data['script_id'] = db_script.id
            db_evidence = EvidenceDBModel(**ev_data)
            self.db.add(db_evidence)
        
        # 创建场景
        for location in script.locations:
            loc_data = location.to_db_dict()
            loc_data['script_id'] = db_script.id
            db_location = LocationDBModel(**loc_data)
            self.db.add(db_location)
        
        # 创建游戏阶段
        for i, phase in enumerate(script.game_phases):
            phase_data = phase.to_db_dict()
            phase_data['script_id'] = db_script.id
            phase_data['order_index'] = i
            db_phase = GamePhaseDBModel(**phase_data)
            self.db.add(db_phase)
        
        self.db.flush()
        
        # 重新查询完整数据
        return self.get_script_by_id(getattr(db_script, 'id'))
    
    def get_script_by_id(self, script_id: int) -> Optional[Script]:
        """根据ID获取完整剧本"""
        from ...schemas.script import ScriptCharacter, ScriptEvidence, ScriptLocation, BackgroundStory, GamePhase
        
        db_script = self.db.query(ScriptDBModel).options(
            selectinload(ScriptDBModel.characters),
            selectinload(ScriptDBModel.evidence),
            selectinload(ScriptDBModel.locations),
            selectinload(ScriptDBModel.background_stories),
            selectinload(ScriptDBModel.game_phases)
        ).filter(ScriptDBModel.id == script_id).first()
        
        if not db_script:
            return None
        
        # 转换为Pydantic模型
        script_info = ScriptInfo.model_validate(db_script, from_attributes=True)
        
        # 转换关联数据
        characters = [ScriptCharacter.model_validate(char, from_attributes=True) for char in db_script.characters]
        evidence = [ScriptEvidence.model_validate(ev, from_attributes=True) for ev in db_script.evidence]
        locations = [ScriptLocation.model_validate(loc, from_attributes=True) for loc in db_script.locations]
        game_phases = [GamePhase.model_validate(phase, from_attributes=True) for phase in db_script.game_phases]
        
        background_story = None
        if db_script.background_stories:
            background_story = BackgroundStory.model_validate(db_script.background_stories[0], from_attributes=True)
        
        return Script(
            info=script_info,
            background_story=background_story,
            characters=characters,
            evidence=evidence,
            locations=locations,
            game_phases=game_phases
        )
    
    def get_script_info_by_id(self, script_id: int) -> Optional[ScriptInfo]:
        """根据ID获取剧本基本信息"""
        db_script = self.db.query(ScriptDBModel).filter(ScriptDBModel.id == script_id).first()
        if not db_script:
            return None
        return ScriptInfo.model_validate(db_script, from_attributes=True)
    
    def get_scripts_list(self, 
                        status: Optional[ScriptStatus] = None,
                        author: Optional[str] = None,
                        page: int = 1,
                        size: int = 20) -> PaginatedResponse[ScriptInfo]:
        """获取剧本列表（分页）"""
        query = self.db.query(ScriptDBModel)
        
        # 添加过滤条件
        if status:
            # 使用枚举的值而不是枚举对象本身
            query = query.filter(ScriptDBModel.status == status.value)
        if author:
            query = query.filter(ScriptDBModel.author == author)
        
        # 计算总数
        total = query.count()
        
        # 分页查询
        offset = (page - 1) * size
        db_scripts = query.order_by(desc(ScriptDBModel.updated_at)).offset(offset).limit(size).all()
        
        # 转换为Pydantic模型
        scripts = [ScriptInfo.model_validate(script, from_attributes=True) for script in db_scripts]
        
        return PaginatedResponse.create(
            items=scripts,
            total=total,
            page=page,
            size=size
        )
    
    def search_scripts(self, keyword: str, page: int = 1, size: int = 20) -> PaginatedResponse[ScriptInfo]:
        """搜索剧本"""
        query = self.db.query(ScriptDBModel).filter(
            or_(
                ScriptDBModel.title.ilike(f"%{keyword}%"),
                ScriptDBModel.description.ilike(f"%{keyword}%"),
                ScriptDBModel.author.ilike(f"%{keyword}%")
            )
        )
        
        total = query.count()
        offset = (page - 1) * size
        db_scripts = query.order_by(desc(ScriptDBModel.updated_at)).offset(offset).limit(size).all()
        
        scripts = [ScriptInfo.model_validate(script, from_attributes=True) for script in db_scripts]
        
        return PaginatedResponse.create(
            items=scripts,
            total=total,
            page=page,
            size=size
        )
    
    def update_script_info(self, script_id: int, script_data: ScriptInfo) -> Optional[ScriptInfo]:
        """更新剧本基本信息"""
        db_script = self.db.query(ScriptDBModel).filter(ScriptDBModel.id == script_id).first()
        if not db_script:
            return None
        
        # 更新字段
        update_data = script_data.model_dump(exclude={'id', 'created_at', 'updated_at'}, exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_script, field, value)
        
        self.db.flush()
        
        return ScriptInfo.model_validate(db_script, from_attributes=True)
    
    def update_complete_script(self, script_id: int, script: Script) -> Optional[Script]:
        """更新完整剧本"""
        db_script = self.db.query(ScriptDBModel).filter(ScriptDBModel.id == script_id).first()
        if not db_script:
            return None
        
        # 更新基本信息
        script.info.id = script_id
        update_data = script.info.model_dump(exclude={'id', 'created_at', 'updated_at'}, exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_script, field, value)
        
        # 删除旧的关联数据
        self.db.query(CharacterDBModel).filter(CharacterDBModel.script_id == script_id).delete()
        self.db.query(EvidenceDBModel).filter(EvidenceDBModel.script_id == script_id).delete()
        self.db.query(LocationDBModel).filter(LocationDBModel.script_id == script_id).delete()
        self.db.query(BackgroundStoryDBModel).filter(BackgroundStoryDBModel.script_id == script_id).delete()
        self.db.query(GamePhaseDBModel).filter(GamePhaseDBModel.script_id == script_id).delete()
        
        # 添加新的关联数据
        if script.background_story:
            script.background_story.script_id = script_id
            db_data = script.background_story.to_db_dict()
            db_background = BackgroundStoryDBModel(**db_data)
            self.db.add(db_background)
        
        for character in script.characters:
            character.script_id = script_id
            db_data = character.to_db_dict()
            db_character = CharacterDBModel(**db_data)
            self.db.add(db_character)
        
        for evidence in script.evidence:
            evidence.script_id = script_id
            db_data = evidence.to_db_dict()
            db_evidence = EvidenceDBModel(**db_data)
            self.db.add(db_evidence)
        
        for location in script.locations:
            location.script_id = script_id
            db_data = location.to_db_dict()
            db_location = LocationDBModel(**db_data)
            self.db.add(db_location)
        
        for i, phase in enumerate(script.game_phases):
            phase.script_id = script_id
            phase.order_index = i
            db_data = phase.to_db_dict()
            db_phase = GamePhaseDBModel(**db_data)
            self.db.add(db_phase)
        
        self.db.flush()
        
        return self.get_script_by_id(script_id)
    
    def delete_script(self, script_id: int) -> bool:
        """删除剧本"""
        db_script = self.db.query(ScriptDBModel).filter(ScriptDBModel.id == script_id).first()
        if not db_script:
            return False
        
        self.db.delete(db_script)
        return True
    
    def get_scripts_by_status(self, status: ScriptStatus) -> List[ScriptInfo]:
        """根据状态获取剧本列表"""
        db_scripts = self.db.query(ScriptDBModel).filter(ScriptDBModel.status == status.value).all()
        return [ScriptInfo.model_validate(script, from_attributes=True) for script in db_scripts]
    
    def get_scripts_by_author(self, author: str) -> List[ScriptInfo]:
        """根据作者获取剧本列表"""
        db_scripts = self.db.query(ScriptDBModel).filter(ScriptDBModel.author == author).all()
        return [ScriptInfo.model_validate(script, from_attributes=True) for script in db_scripts]
    
    def update_script_status(self, script_id: int, status: ScriptStatus) -> bool:
        """更新剧本状态"""
        db_script = self.db.query(ScriptDBModel).filter(ScriptDBModel.id == script_id).first()
        if not db_script:
            return False
        
        setattr(db_script, 'status', status.value)
        return True
    
    def update_script_cover_image_url(self, script_id: int, cover_image_url: str) -> bool:
        """更新剧本封面图片URL"""
        db_script = self.db.query(ScriptDBModel).filter(ScriptDBModel.id == script_id).first()
        if not db_script:
            return False
        
        setattr(db_script, 'cover_image_url', cover_image_url)
        return True
