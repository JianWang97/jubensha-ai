"""角色数据访问层"""
from typing import List, Optional
from sqlalchemy.orm import Session
from ...schemas.script import ScriptCharacter
from ..models.character import CharacterDBModel
from .base import BaseRepository


class CharacterRepository(BaseRepository[CharacterDBModel]):
    """角色数据访问层"""
    
    def __init__(self, db_session: Session):
        super().__init__(CharacterDBModel, db_session)
        self.db = db_session
    
    def add_character(self, character: ScriptCharacter) -> ScriptCharacter:
        """添加角色"""
        db_data = character.to_db_dict()
        db_character = CharacterDBModel(**db_data)
        self.db.add(db_character)
        self.db.flush()
        return ScriptCharacter.model_validate(db_character, from_attributes=True)
    
    def update_character(self, character_id: int, character: ScriptCharacter) -> Optional[ScriptCharacter]:
        """更新角色"""
        db_character = self.db.query(CharacterDBModel).filter(CharacterDBModel.id == character_id).first()
        if not db_character:
            return None
        
        update_data = character.model_dump(exclude={'id', 'created_at', 'updated_at'}, exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_character, field, value)

        return ScriptCharacter.model_validate(db_character, from_attributes=True)
    
    def delete_character(self, character_id: int) -> bool:
        """删除角色"""
        db_character = self.db.query(CharacterDBModel).filter(CharacterDBModel.id == character_id).first()
        if not db_character:
            return False
        
        self.db.delete(db_character)

        return True
    
    def get_character_by_id(self, character_id: int) -> Optional[ScriptCharacter]:
        """根据ID获取角色"""
        db_character = self.db.query(CharacterDBModel).filter(CharacterDBModel.id == character_id).first()
        if not db_character:
            return None
        return ScriptCharacter.model_validate(db_character, from_attributes=True)
    
    def get_characters_by_script(self, script_id: int) -> List[ScriptCharacter]:
        """获取剧本的所有角色"""
        db_characters = self.db.query(CharacterDBModel).filter(CharacterDBModel.script_id == script_id).all()
        return [ScriptCharacter.model_validate(char, from_attributes=True) for char in db_characters]
    
    def get_murderer_by_script(self, script_id: int) -> Optional[ScriptCharacter]:
        """获取剧本的凶手角色"""
        db_character = self.db.query(CharacterDBModel).filter(
            CharacterDBModel.script_id == script_id,
            CharacterDBModel.is_murderer == True
        ).first()
        if not db_character:
            return None
        return ScriptCharacter.model_validate(db_character, from_attributes=True)
    
    def get_victim_by_script(self, script_id: int) -> Optional[ScriptCharacter]:
        """获取剧本的受害者角色"""
        db_character = self.db.query(CharacterDBModel).filter(
            CharacterDBModel.script_id == script_id,
            CharacterDBModel.is_victim == True
        ).first()
        if not db_character:
            return None
        return ScriptCharacter.model_validate(db_character, from_attributes=True)
    
    def get_characters_by_gender(self, script_id: int, gender: str) -> List[ScriptCharacter]:
        """根据性别获取角色列表"""
        db_characters = self.db.query(CharacterDBModel).filter(
            CharacterDBModel.script_id == script_id,
            CharacterDBModel.gender == gender
        ).all()
        return [ScriptCharacter.model_validate(char, from_attributes=True) for char in db_characters]
    
    def delete_characters_by_script(self, script_id: int) -> bool:
        """删除剧本的所有角色"""
        deleted_count = self.db.query(CharacterDBModel).filter(CharacterDBModel.script_id == script_id).delete()
        return deleted_count > 0

    def update_avatar_url(self, character_id: int, avatar_url: str) -> Optional[ScriptCharacter]:
        """更新角色的头像URL"""
        db_character = self.db.query(CharacterDBModel).filter(CharacterDBModel.id == character_id).first()
        if not db_character:
            return None
        db_character.avatar_url = avatar_url
        self.db.flush()
        return ScriptCharacter.model_validate(db_character, from_attributes=True)
