"""图片数据仓库"""
from typing import List, Optional
import uuid
from sqlalchemy.orm import Session
from src.db.models.image import ImageDBModel, ImageType
from src.db.repositories.base import BaseRepository

class ImageRepository(BaseRepository[ImageDBModel]):
    """图片数据仓库"""
    
    def __init__(self, session: Session):
        super().__init__(ImageDBModel, session)
    
    def create(self, **kwargs) -> ImageDBModel:
        """创建新图片记录"""
        try:
            instance = ImageDBModel(**kwargs)
            self.session.add(instance)
            self.session.flush()
            return instance
        except Exception as e:
            self.session.rollback()
            raise e
    
    def get_by_id(self, id: str) -> Optional[ImageDBModel]:
        """根据UUID字符串获取图片记录"""
        try:
            uuid_id = uuid.UUID(id) if isinstance(id, str) else id
            return self.session.query(ImageDBModel).filter(ImageDBModel.id == uuid_id).first()
        except (ValueError, TypeError):
            return None
    
    def get_by_script_id(self, script_id: int) -> List[ImageDBModel]:
        """根据剧本ID获取图片列表"""
        return self.session.query(ImageDBModel).filter(
            ImageDBModel.script_id == script_id
        ).all()
    
    def get_by_author_id(self, author_id: int) -> List[ImageDBModel]:
        """根据作者ID获取图片列表"""
        return self.session.query(ImageDBModel).filter(
            ImageDBModel.author_id == author_id
        ).all()
    
    def get_by_author_and_script(self, author_id: int, script_id: Optional[int] = None) -> List[ImageDBModel]:
        """根据作者ID和剧本ID获取图片列表"""
        query = self.session.query(ImageDBModel).filter(
            ImageDBModel.author_id == author_id
        )
        
        if script_id is not None:
            query = query.filter(ImageDBModel.script_id == script_id)
            
        return query.all()
    
    def get_by_type(self, image_type: ImageType) -> List[ImageDBModel]:
        """根据图片类型获取图片列表"""
        return self.session.query(ImageDBModel).filter(
            ImageDBModel.image_type == image_type
        ).all()
    
    def get_by_script_and_type(self, script_id: int, image_type: ImageType) -> List[ImageDBModel]:
        """根据剧本ID和图片类型获取图片列表"""
        return self.session.query(ImageDBModel).filter(
            ImageDBModel.script_id == script_id,
            ImageDBModel.image_type == image_type
        ).all()
    
    def delete_by_script_id(self, script_id: int) -> bool:
        """删除剧本相关的所有图片"""
        try:
            deleted_count = self.session.query(ImageDBModel).filter(
                ImageDBModel.script_id == script_id
            ).delete()
            self.session.commit()
            return deleted_count > 0
        except Exception:
            self.session.rollback()
            return False
    
    def delete(self, id: str) -> bool:
        """删除指定ID的图片"""
        try:
            uuid_id = uuid.UUID(id) if isinstance(id, str) else id
            deleted_count = self.session.query(ImageDBModel).filter(
                ImageDBModel.id == uuid_id
            ).delete()
            self.session.commit()
            return deleted_count > 0
        except Exception:
            self.session.rollback()
            return False
