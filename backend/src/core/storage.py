"""存储管理器 - 支持MinIO和本地存储"""
import os
import uuid
from typing import BinaryIO
from minio import Minio
from minio.error import S3Error
from dotenv import load_dotenv
import mimetypes
from urllib.parse import urljoin
from pathlib import Path
import shutil

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
        self.storage_type: str = os.getenv("FILE_STORAGE", "minio")  # 添加存储类型配置

class StorageManager:
    """存储管理器 - 支持MinIO和本地存储"""
    
    def __init__(self):
        self.config: StorageConfig = StorageConfig()
        self.client: Minio | None = None
        self.is_available: bool = False
        # 根据存储类型设置本地存储路径
        if self.config.storage_type.lower() == "dir":
            self.local_storage_path: Path = Path(".")  # 项目根目录
        else:
            self.local_storage_path: Path = Path(".data")  # 本地存储路径
        
        # 根据存储类型初始化
        if self.config.storage_type.lower() in ["local", "dir"]:
            self._initialize_local_storage()
        else:
            self._initialize_minio_client()
    
    def _initialize_local_storage(self):
        """初始化本地存储"""
        try:
            # 确保本地存储目录存在
            self.local_storage_path.mkdir(parents=True, exist_ok=True)
            # 确保各类子目录存在
            for category in ["covers", "avatars", "evidence", "scenes", "tts", "general"]:
                (self.local_storage_path / category).mkdir(parents=True, exist_ok=True)
            
            self.is_available = True
            print(f"✅ 本地存储已初始化: {self.local_storage_path.absolute()}")
        except Exception as e:
            print(f"⚠️ 本地存储初始化失败: {e}")
            self.is_available = False

    def _initialize_minio_client(self):
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
        if not self.is_available:
            print(f"⚠️ 存储服务不可用，无法上传文件: {filename}")
            return None
            
        # 如果使用本地存储
        if self.config.storage_type.lower() in ["local", "dir"]:
            return self._upload_file_local(file_data, filename, category)
        # 如果使用MinIO存储
        elif self.client:
            return self._upload_file_minio(file_data, filename, category)
        else:
            print(f"⚠️ 存储服务不可用，无法上传文件: {filename}")
            return None
    
    def _upload_file_local(self, file_data: BinaryIO, filename: str, category: str) -> str | None:
        """本地文件上传"""
        try:
            object_name = self._generate_object_name(category, filename)
            local_file_path = self.local_storage_path / object_name
            
            # 确保目录存在
            local_file_path.parent.mkdir(parents=True, exist_ok=True)
            
            # 保存文件
            file_data.seek(0)
            with open(local_file_path, "wb") as f:
                shutil.copyfileobj(file_data, f)
            
            # 返回本地访问URL
            return self.get_public_url(object_name)
        except Exception as e:
            print(f"❌ 本地文件上传失败: {e}")
            return None

    def _upload_file_minio(self, file_data: BinaryIO, filename: str, category: str) -> str | None:
        """MinIO文件上传"""
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
        if not self.is_available:
            print(f"⚠️ 存储服务不可用，无法获取文件: {object_name}")
            return None
            
        # 如果使用本地存储
        if self.config.storage_type.lower() in ["local", "dir"]:
            return self._get_file_local(object_name)
        # 如果使用MinIO存储
        elif self.client:
            return self._get_file_minio(object_name)
        else:
            print(f"⚠️ 存储服务不可用，无法获取文件: {object_name}")
            return None

    def _get_file_local(self, object_name: str) -> tuple[bytes, str] | None:
        """从本地存储获取文件"""
        try:
            local_file_path = self.local_storage_path / object_name
            
            if not local_file_path.exists():
                print(f"❌ 本地文件不存在: {local_file_path}")
                return None
            
            # 读取文件内容
            with open(local_file_path, "rb") as f:
                file_content = f.read()
            
            # 获取内容类型
            content_type = self._get_content_type(object_name)
            
            return file_content, content_type
        except Exception as e:
            print(f"❌ 本地文件获取失败: {e}")
            return None
    
    def _get_file_minio(self, object_name: str) -> tuple[bytes, str] | None:
        """从MinIO获取文件"""
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
    
    def delete_file(self, object_name: str) -> bool:
        """删除文件"""
        if not self.is_available:
            print(f"⚠️ 存储服务不可用，无法删除文件: {object_name}")
            return False
            
        # 如果是URL，提取object_name
        if object_name.startswith("http"):
            if self.config.storage_type.lower() in ["local", "dir"]:
                # 本地存储URL处理
                if "/jubensha-assets/" in object_name:
                    object_name = object_name.split("/jubensha-assets/")[-1]
            else:
                # MinIO URL处理
                if f"/{self.config.bucket_name}/" in object_name:
                    object_name = object_name.split(f"/{self.config.bucket_name}/")[-1]
        
        # 根据存储类型删除文件
        if self.config.storage_type.lower() in ["local", "dir"]:
            return self._delete_file_local(object_name)
        elif self.client:
            return self._delete_file_minio(object_name)
        else:
            print(f"⚠️ 存储服务不可用，无法删除文件: {object_name}")
            return False
    
    def _delete_file_local(self, object_name: str) -> bool:
        """从本地存储删除文件"""
        try:
            local_file_path = self.local_storage_path / object_name
            
            if local_file_path.exists():
                local_file_path.unlink()
                return True
            else:
                print(f"❌ 本地文件不存在: {local_file_path}")
                return False
        except Exception as e:
            print(f"❌ 本地文件删除失败: {e}")
            return False
    
    def _delete_file_minio(self, object_name: str) -> bool:
        """从MinIO删除文件"""
        try:
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
        if self.config.storage_type.lower() in ["local", "dir"]:
            return self._list_files_local(category)
        elif self.client:
            return self._list_files_minio(category)
        else:
            return []

    def _list_files_local(self, category: str | None = None) -> list:
        """从本地存储列出文件"""
        try:
            files = []
            base_path = self.local_storage_path
            
            if category:
                base_path = base_path / category
                if not base_path.exists():
                    return []
                
                # 遍历目录中的文件
                for file_path in base_path.rglob("*"):
                    if file_path.is_file():
                        relative_path = file_path.relative_to(self.local_storage_path)
                        files.append({
                            "name": str(relative_path).replace("\\", "/"),  # 兼容Windows路径
                            "size": file_path.stat().st_size,
                            "last_modified": file_path.stat().st_mtime,
                            "url": self.get_public_url(str(relative_path).replace("\\", "/"))
                        })
            else:
                # 遍历所有类别目录
                for cat_dir in base_path.iterdir():
                    if cat_dir.is_dir():
                        for file_path in cat_dir.rglob("*"):
                            if file_path.is_file():
                                relative_path = file_path.relative_to(self.local_storage_path)
                                files.append({
                                    "name": str(relative_path).replace("\\", "/"),
                                    "size": file_path.stat().st_size,
                                    "last_modified": file_path.stat().st_mtime,
                                    "url": self.get_public_url(str(relative_path).replace("\\", "/"))
                                })
            
            return files
        except Exception as e:
            print(f"❌ 本地文件列表获取失败: {e}")
            return []
    
    def _list_files_minio(self, category: str | None = None) -> list:
        """从MinIO列出文件"""
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
    
    async def upload_tts_audio(
        self, 
        audio_data: bytes, 
        session_id: str, 
        character_name: str,
        filename_suffix: str = ""
    ) -> str | None:
        """上传TTS音频文件
        
        Args:
            audio_data: 音频二进制数据
            session_id: 游戏会话ID
            character_name: 角色名称
            filename_suffix: 文件名后缀
            
        Returns:
            文件的公开访问URL
        """
        if not self.is_available:
            print("⚠️ 存储服务不可用，无法上传TTS音频")
            return None
            
        try:
            # 生成文件路径: tts/{session_id}/{character_name}/{timestamp}_{uuid}.mp3
            from datetime import datetime
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            unique_id = uuid.uuid4().hex[:8]
            filename = f"{timestamp}_{unique_id}{filename_suffix}.mp3"
            object_name = f"tts/{session_id}/{character_name}/{filename}"
            
            # 根据存储类型上传文件
            if self.config.storage_type.lower() in ["local", "dir"]:
                return self._upload_tts_audio_local(audio_data, object_name)
            elif self.client:
                return self._upload_tts_audio_minio(audio_data, object_name)
            else:
                print("⚠️ 存储服务不可用，无法上传TTS音频")
                return None
                
        except Exception as e:
            print(f"❌ TTS音频上传失败: {e}")
            return None

    def _upload_tts_audio_local(self, audio_data: bytes, object_name: str) -> str | None:
        """上传TTS音频到本地存储"""
        try:
            local_file_path = self.local_storage_path / object_name
            
            # 确保目录存在
            local_file_path.parent.mkdir(parents=True, exist_ok=True)
            
            # 保存文件
            with open(local_file_path, "wb") as f:
                f.write(audio_data)
            
            # 返回本地访问URL
            return self.get_public_url(object_name)
        except Exception as e:
            print(f"❌ 本地TTS音频上传失败: {e}")
            return None

    def _upload_tts_audio_minio(self, audio_data: bytes, object_name: str) -> str | None:
        """上传TTS音频到MinIO"""
        try:
            from io import BytesIO
            audio_stream = BytesIO(audio_data)
            
            self.client.put_object(
                bucket_name=self.config.bucket_name,
                object_name=object_name,
                data=audio_stream,
                length=len(audio_data),
                content_type="audio/mpeg"
            )
            
            # 返回公开URL
            file_url = self.get_public_url(object_name)
            print(f"✅ TTS音频上传成功: {file_url}")
            return file_url
        except Exception as e:
            print(f"❌ TTS音频上传失败: {e}")
            return None

    def get_tts_audio(self, file_url: str) -> bytes | None:
        """获取TTS音频文件"""
        if not self.is_available:
            return None
            
        # 从URL解析object_name
        if self.config.storage_type.lower() in ["local", "dir"]:
            if "/jubensha-assets/" in file_url:
                object_name = file_url.split("/jubensha-assets/")[-1]
            else:
                object_name = file_url
            return self._get_tts_audio_local(object_name)
        elif self.client:
            object_name = file_url.split(f"/{self.config.bucket_name}/")[-1]
            return self._get_tts_audio_minio(object_name)
        else:
            return None
    
    def _get_tts_audio_local(self, object_name: str) -> bytes | None:
        """从本地存储获取TTS音频"""
        try:
            local_file_path = self.local_storage_path / object_name
            
            if not local_file_path.exists():
                return None
            
            with open(local_file_path, "rb") as f:
                return f.read()
        except Exception as e:
            print(f"❌ 获取本地TTS音频失败: {e}")
            return None
    
    def _get_tts_audio_minio(self, object_name: str) -> bytes | None:
        """从MinIO获取TTS音频文件"""
        if not self.is_available or not self.client:
            return None
            
        try:
            response = self.client.get_object(self.config.bucket_name, object_name)
            audio_data = response.read()
            response.close()
            response.release_conn()
            
            return audio_data
        except Exception as e:
            print(f"❌ 获取TTS音频失败: {e}")
            return None

    def get_storage_stats(self) -> dict:
        """获取存储统计信息"""
        try:
            stats = {
                "covers": len(self.list_files("covers")),  # type: ignore
                "avatars": len(self.list_files("avatars")),  # type: ignore
                "evidence": len(self.list_files("evidence")),  # type: ignore
                "scenes": len(self.list_files("scenes")),  # type: ignore
                "tts": len(self.list_files("tts")),  # type: ignore
                "total": len(self.list_files())  # type: ignore
            }
            return stats
        except Exception as e:
            print(f"❌ 存储统计获取失败: {e}")
            return {}

# 全局存储管理器实例
storage_manager = StorageManager()