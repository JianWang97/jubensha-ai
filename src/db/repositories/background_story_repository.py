"""背景故事数据访问层"""
from typing import Optional
from sqlalchemy.orm import Session
from ...schemas.script import BackgroundStory
from ..models.background_story import BackgroundStoryDBModel
from .base import BaseRepository


class BackgroundStoryRepository(BaseRepository[BackgroundStoryDBModel]):
    """背景故事数据访问层"""
    
    def __init__(self, db_session: Session):
        super().__init__(BackgroundStoryDBModel, db_session)
    
    def add_background_story(self, background_story: BackgroundStory) -> BackgroundStory:
        """添加背景故事"""
        db_data = background_story.to_db_dict()
        db_background = BackgroundStoryDBModel(**db_data)
        self.db.add(db_background)
        self.db.commit()
        self.db.refresh(db_background)
        return BackgroundStory.model_validate(db_background, from_attributes=True)
    
    def update_background_story(self, story_id: int, background_story: BackgroundStory) -> Optional[BackgroundStory]:
        """更新背景故事"""
        db_background = self.db.query(BackgroundStoryDBModel).filter(BackgroundStoryDBModel.id == story_id).first()
        if not db_background:
            return None
        
        update_data = background_story.model_dump(exclude={'id', 'created_at', 'updated_at'}, exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_background, field, value)
        
        self.db.commit()
        self.db.refresh(db_background)
        return BackgroundStory.model_validate(db_background, from_attributes=True)
    
    def delete_background_story(self, story_id: int) -> bool:
        """删除背景故事"""
        db_background = self.db.query(BackgroundStoryDBModel).filter(BackgroundStoryDBModel.id == story_id).first()
        if not db_background:
            return False
        
        self.db.delete(db_background)
        self.db.commit()
        return True
    
    def get_background_story_by_id(self, story_id: int) -> Optional[BackgroundStory]:
        """根据ID获取背景故事"""
        db_background = self.db.query(BackgroundStoryDBModel).filter(BackgroundStoryDBModel.id == story_id).first()
        if not db_background:
            return None
        return BackgroundStory.model_validate(db_background, from_attributes=True)
    
    def get_background_story_by_script(self, script_id: int) -> Optional[BackgroundStory]:
        """根据剧本ID获取背景故事"""
        db_background = self.db.query(BackgroundStoryDBModel).filter(BackgroundStoryDBModel.script_id == script_id).first()
        if not db_background:
            return None
        return BackgroundStory.model_validate(db_background, from_attributes=True)
    
    def update_background_story_by_script(self, script_id: int, background_story: BackgroundStory) -> Optional[BackgroundStory]:
        """根据剧本ID更新背景故事"""
        db_background = self.db.query(BackgroundStoryDBModel).filter(BackgroundStoryDBModel.script_id == script_id).first()
        if not db_background:
            # 如果不存在，则创建新的背景故事
            background_story.script_id = script_id
            return self.add_background_story(background_story)
        
        update_data = background_story.model_dump(exclude={'id', 'created_at', 'updated_at'}, exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_background, field, value)
        
        self.db.commit()
        self.db.refresh(db_background)
        return BackgroundStory.model_validate(db_background, from_attributes=True)
    
    def delete_background_story_by_script(self, script_id: int) -> bool:
        """根据剧本ID删除背景故事"""
        deleted_count = self.db.query(BackgroundStoryDBModel).filter(BackgroundStoryDBModel.script_id == script_id).delete()
        self.db.commit()
        return deleted_count > 0
    
    def has_background_story(self, script_id: int) -> bool:
        """检查剧本是否有背景故事"""
        count = self.db.query(BackgroundStoryDBModel).filter(BackgroundStoryDBModel.script_id == script_id).count()
        return count > 0