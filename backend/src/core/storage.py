"""MinIO对象存储管理器"""
import os
import uuid
from typing import BinaryIO
from minio import Minio
from minio.error import S3Error
from dotenv import load_dotenv
import mimetypes
from urllib.parse import urljoin

load_dotenv()

class StorageConfig:
    """存储配置"""
    
    def __init__(self):
        self.endpoint: str = os.getenv("MINIO_ENDPOINT", "localhost:9000")
        self.access_key: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
        self.secret_key: str = os.getenv("MINIO_SECRET_KEY", "minioadmin")
        self.secure: bool = os.getenv("MINIO_SECURE", "false").lower() == "true"
        self.bucket_name: str = os.getenv("MINIO_BUCKET", "jubensha-assets")
        self.public_url: str = os.getenv("MINIO_PUBLIC_URL", f"http://{self.endpoint}")
        
class StorageManager:
    """MinIO存储管理器"""
    
    def __init__(self):
        self.config: StorageConfig = StorageConfig()
        self.client: Minio | None = None
        self.is_available: bool = False
        self._initialize_client()
    
    def _initialize_client(self):
        """初始化MinIO客户端"""
        try:
            self.client = Minio(
                self.config.endpoint,
                access_key=self.config.access_key,
                secret_key=self.config.secret_key,
                secure=self.config.secure
            )
            self._ensure_bucket_exists()
            self.is_available = True
            print(f"✅ MinIO存储服务已连接: {self.config.endpoint}")
        except Exception as e:
            print(f"⚠️ MinIO存储服务不可用: {e}")
            print("📝 存储功能将被禁用，但不影响其他功能")
            self.client = None
            self.is_available = False
    
    def _ensure_bucket_exists(self):
        """确保存储桶存在"""
        try:
            if self.client and not self.client.bucket_exists(self.config.bucket_name):
                self.client.make_bucket(self.config.bucket_name)
                print(f"✅ 创建存储桶: {self.config.bucket_name}")
            elif self.client:
                print(f"✅ 存储桶已存在: {self.config.bucket_name}")
        except S3Error as e:
            print(f"❌ 存储桶操作失败: {e}")
            raise
    
    def _get_content_type(self, filename: str) -> str:
        """根据文件名获取MIME类型"""
        content_type, _ = mimetypes.guess_type(filename)
        return content_type or "application/octet-stream"
    
    def _generate_object_name(self, category: str, filename: str) -> str:
        """生成对象存储路径"""
        # 生成唯一文件名
        file_ext = os.path.splitext(filename)[1]
        unique_name = f"{uuid.uuid4().hex}{file_ext}"
        return f"{category}/{unique_name}"
    
    async def upload_file(self, file_data: BinaryIO, filename: str, category: str = "general") -> str | None:
        """上传文件
        
        Args:
            file_data: 文件数据流
            filename: 原始文件名
            category: 文件分类 (covers/avatars/evidence/scenes/general)
            
        Returns:
            文件的公开访问URL
        """
        if not self.is_available or not self.client:
            print(f"⚠️ 存储服务不可用，无法上传文件: {filename}")
            return None
            
        try:
            object_name = self._generate_object_name(category, filename)
            content_type = self._get_content_type(filename)
            
            # 获取文件大小
            file_data.seek(0, 2)  # 移动到文件末尾
            file_size = file_data.tell()
            file_data.seek(0)  # 重置到文件开头
            
            # 上传文件
            self.client.put_object(
                bucket_name=self.config.bucket_name,
                object_name=object_name,
                data=file_data,
                length=file_size,
                content_type=content_type
            )
            
            # 返回公开访问URL
            return self.get_public_url(object_name)
            
        except S3Error as e:
            print(f"❌ 文件上传失败: {e}")
            return None
    
    def get_public_url(self, object_name: str) -> str:
        """获取文件的公开访问URL"""
        return urljoin(self.config.public_url, f"/{self.config.bucket_name}/{object_name}")
    
    async def get_file(self, object_name: str) -> tuple[bytes, str] | None:
        """获取文件内容
        
        Args:
            object_name: 文件在存储中的路径
            
        Returns:
            (文件内容, 内容类型) 或 None
        """
        if not self.is_available or not self.client:
            print(f"⚠️ 存储服务不可用，无法获取文件: {object_name}")
            return None
            
        try:
            # 获取文件对象
            response = self.client.get_object(self.config.bucket_name, object_name)
            
            # 读取文件内容
            file_content = response.read()
            
            # 获取内容类型
            content_type = self._get_content_type(object_name)
            
            return file_content, content_type  # type: ignore
            
        except S3Error as e:
            print(f"❌ 文件获取失败: {e}")
            return None
        finally:
            # 使用局部变量确保response已定义
            local_response = locals().get('response')
            if local_response:
                local_response.close()
                local_response.release_conn()
    
    async def delete_file(self, object_name: str) -> bool:
        """删除文件"""
        if not self.is_available or not self.client:
            print(f"⚠️ 存储服务不可用，无法删除文件: {object_name}")
            return False
            
        try:
            # 从URL中提取object_name
            if object_name.startswith("http"):
                object_name = object_name.split(f"/{self.config.bucket_name}/")[-1]
            
            self.client.remove_object(self.config.bucket_name, object_name)
            return True
        except S3Error as e:
            print(f"❌ 文件删除失败: {e}")
            return False
    
    async def upload_cover_image(self, file_data: BinaryIO, filename: str) -> str | None:
        """上传剧本封面图片"""
        return await self.upload_file(file_data, filename, "covers")
    
    async def upload_avatar_image(self, file_data: BinaryIO, filename: str) -> str | None:
        """上传角色头像图片"""
        return await self.upload_file(file_data, filename, "avatars")
    
    async def upload_evidence_image(self, file_data: BinaryIO, filename: str) -> str | None:
        """上传证据图片"""
        return await self.upload_file(file_data, filename, "evidence")
    
    async def upload_scene_image(self, file_data: BinaryIO, filename: str) -> str | None:
        """上传场景背景图片"""
        return await self.upload_file(file_data, filename, "scenes")
    
    def list_files(self, category: str | None = None) -> list:
        """列出文件"""
        if not self.client:
            return []
            
        try:
            prefix = f"{category}/" if category else None
            objects = self.client.list_objects(
                self.config.bucket_name,
                prefix=prefix,
                recursive=True
            )
            
            files = []
            for obj in objects:
                if obj.object_name is not None:
                    files.append({
                        "name": obj.object_name,
                        "size": obj.size,
                        "last_modified": obj.last_modified,
                        "url": self.get_public_url(obj.object_name)
                    })
            
            return files
        except S3Error as e:
            print(f"❌ 文件列表获取失败: {e}")
            return []
    
    def get_storage_stats(self) -> dict:
        """获取存储统计信息"""
        try:
            stats = {
                "covers": len(self.list_files("covers")),  # type: ignore
                "avatars": len(self.list_files("avatars")),  # type: ignore
                "evidence": len(self.list_files("evidence")),  # type: ignore
                "scenes": len(self.list_files("scenes")),  # type: ignore
                "total": len(self.list_files())  # type: ignore
            }
            return stats
        except Exception as e:
            print(f"❌ 存储统计获取失败: {e}")
            return {}

# 全局存储管理器实例
storage_manager = StorageManager()