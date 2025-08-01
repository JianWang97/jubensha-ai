"""背景故事数据访问层"""

from sqlalchemy.orm import Session
from sqlalchemy import or_
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
        self.session.add(db_background)
        self.session.commit()
        self.session.refresh(db_background)
        return BackgroundStory.model_validate(db_background, from_attributes=True)
    
    def update_background_story(self, story_id: int, background_story: BackgroundStory) -> BackgroundStory | None:
        """更新背景故事"""
        db_background = self.session.query(BackgroundStoryDBModel).filter(BackgroundStoryDBModel.id == story_id).first()
        if not db_background:
            return None
        
        update_data = background_story.model_dump(exclude={'id', 'created_at', 'updated_at'}, exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_background, field, value)
        
        self.session.commit()
        self.session.refresh(db_background)
        return BackgroundStory.model_validate(db_background, from_attributes=True)
    
    def delete_background_story(self, story_id: int) -> bool:
        """删除背景故事"""
        db_background = self.session.query(BackgroundStoryDBModel).filter(BackgroundStoryDBModel.id == story_id).first()
        if not db_background:
            return False
        
        self.session.delete(db_background)
        self.session.commit()
        return True
    
    def get_background_story_by_id(self, story_id: int) -> BackgroundStory | None:
        """根据ID获取背景故事"""
        db_background = self.session.query(BackgroundStoryDBModel).filter(BackgroundStoryDBModel.id == story_id).first()
        if not db_background:
            return None
        return BackgroundStory.model_validate(db_background, from_attributes=True)
    
    def get_background_story_by_script(self, script_id: int) -> BackgroundStory | None:
        """根据剧本ID获取背景故事"""
        db_background = self.session.query(BackgroundStoryDBModel).filter(BackgroundStoryDBModel.script_id == script_id).first()
        if not db_background:
            return None
        return BackgroundStory.model_validate(db_background, from_attributes=True)
    
    def get_background_stories_by_script(self, script_id: int) -> list[BackgroundStory]:
        """根据剧本ID获取所有背景故事"""
        db_backgrounds = self.session.query(BackgroundStoryDBModel).filter(BackgroundStoryDBModel.script_id == script_id).all()
        return [BackgroundStory.model_validate(bg, from_attributes=True) for bg in db_backgrounds]
    
    def search_background_stories(self, script_id: int, keyword: str) -> list[BackgroundStory]:
        """搜索背景故事"""
        query = self.session.query(BackgroundStoryDBModel)
        query = query.filter(BackgroundStoryDBModel.script_id == script_id)
        if keyword:
            query = query.filter(
                or_(
                    BackgroundStoryDBModel.role_name.contains(keyword),
                    BackgroundStoryDBModel.content.contains(keyword)
                )
            )
        db_backgrounds = query.all()
        return [BackgroundStory.model_validate(bg, from_attributes=True) for bg in db_backgrounds]
    
    def update_background_story_by_script(self, script_id: int, background_story: BackgroundStory) -> BackgroundStory | None:
        """根据剧本ID更新背景故事"""
        db_background = self.session.query(BackgroundStoryDBModel).filter(BackgroundStoryDBModel.script_id == script_id).first()
        if not db_background:
            # 如果不存在，则创建新的背景故事
            background_story.script_id = script_id
            return self.add_background_story(background_story)
        
        update_data = background_story.model_dump(exclude={'id', 'created_at', 'updated_at'}, exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_background, field, value)
        
        self.session.commit()
        self.session.refresh(db_background)
        return BackgroundStory.model_validate(db_background, from_attributes=True)
    
    def delete_background_story_by_script(self, script_id: int) -> bool:
        """根据剧本ID删除背景故事"""
        deleted_count = self.session.query(BackgroundStoryDBModel).filter(BackgroundStoryDBModel.script_id == script_id).delete()
        self.session.commit()
        return deleted_count > 0
    
    def has_background_story(self, script_id: int) -> bool:
        """检查剧本是否有背景故事"""
        count = self.session.query(BackgroundStoryDBModel).filter(BackgroundStoryDBModel.script_id == script_id).count()
        return count > 0