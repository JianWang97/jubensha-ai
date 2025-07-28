"""文件管理相关的API路由"""
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import Response, RedirectResponse
from datetime import timedelta
import io
from urllib.parse import quote

from ...core.storage import storage_manager
from ...schemas.file_schemas import FileUploadResponse

router = APIRouter(prefix="/api/files", tags=["文件管理"])

def create_response(success: bool, message: str, data=None):
    """创建统一的响应格式"""
    return {
        "success": success,
        "message": message,
        "data": data
    }

@router.post("/upload")
async def upload_file(file: UploadFile = File(...), category: str = "general"):
    """文件上传API
    
    Args:
        file: 上传的文件
        category: 文件分类 (covers/avatars/evidence/scenes/general)
    
    Returns:
        上传结果和文件访问URL
    """
    try:
        # 检查存储服务是否可用
        if not storage_manager.is_available:
            raise HTTPException(status_code=503, detail="存储服务不可用")
        
        # 验证文件类型
        allowed_types = {
            "image/jpeg", "image/png", "image/gif", "image/webp",
            "audio/mpeg", "audio/wav", "audio/ogg",
            "video/mp4", "video/webm",
            "application/pdf", "text/plain"
        }
        
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail=f"不支持的文件类型: {file.content_type}")
        
        # 验证文件大小 (最大50MB)
        max_size = 50 * 1024 * 1024  # 50MB
        file_content = await file.read()
        if len(file_content) > max_size:
            raise HTTPException(status_code=400, detail="文件大小超过限制 (50MB)")
        
        # 创建文件流
        file_stream = io.BytesIO(file_content)
        
        # 上传文件
        minio_url = await storage_manager.upload_file(
            file_data=file_stream,
            filename=file.filename if file.filename else "untitled",
            category=category
        )
        
        if minio_url:
            # 从MinIO URL中提取object_name，构造API下载URL
            object_name = minio_url.split(f"/{storage_manager.config.bucket_name}/")[-1]
            # 对object_name进行URL编码
            encoded_object_name = quote(object_name, safe='')
            api_download_url = f"/api/files/download/{encoded_object_name}"
            
            return create_response(
                True,
                "文件上传成功",
                {
                    "file_url": api_download_url,
                    "file_name": file.filename,
                    "category": category,
                    "content_type": file.content_type,
                    "size": len(file_content)
                }
            )
        else:
            raise HTTPException(status_code=500, detail="文件上传失败")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")

@router.get("/list")
async def list_files(category: str | None = None):
    """获取文件列表API
    
    Args:
        category: 文件分类过滤 (可选)
    
    Returns:
        文件列表
    """
    try:
        # 检查存储服务是否可用
        if not storage_manager.is_available:
            raise HTTPException(status_code=503, detail="存储服务不可用")
        
        files = storage_manager.list_files(category)
        
        return create_response(
            True,
            "获取文件列表成功",
            {
                "files": files,
                "category": category,
                "total": len(files)
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取文件列表失败: {str(e)}")

@router.delete("/delete")
async def delete_file(file_url: str):
    """删除文件API
    
    Args:
        file_url: 要删除的文件URL
    
    Returns:
        删除结果
    """
    try:
        # 检查存储服务是否可用
        if not storage_manager.is_available:
            raise HTTPException(status_code=503, detail="存储服务不可用")
        
        # 删除文件
        success = await storage_manager.delete_file(file_url)
        
        if success:
            return create_response(True, "文件删除成功")
        else:
            raise HTTPException(status_code=500, detail="文件删除失败")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")

@router.get("/stats")
async def get_storage_stats():
    """获取存储统计信息API
    
    Returns:
        存储统计数据
    """
    try:
        # 检查存储服务是否可用
        if not storage_manager.is_available:
            return create_response(
                False,
                "存储服务不可用",
                {"available": False}
            )
        
        stats = storage_manager.get_storage_stats()
        
        return create_response(
            True,
            "获取存储统计成功",
            {
                "available": True,
                "stats": stats
            }
        )
        
    except Exception as e:
        return create_response(False, f"获取存储统计失败: {str(e)}")

@router.get("/download/{file_path:path}")
async def download_file(file_path: str):
    """文件下载API
    
    Args:
        file_path: 文件在MinIO中的路径
    
    Returns:
        文件流响应
    """
    try:
        # 检查存储服务是否可用
        if not storage_manager.is_available:
            raise HTTPException(status_code=503, detail="存储服务不可用")
        
        # 获取文件的预签名URL用于下载
        try:
            # 生成临时下载URL (有效期1小时)
            download_url = storage_manager.client.presigned_get_object(
                storage_manager.config.bucket_name,
                file_path,
                expires=timedelta(hours=1)  # 1小时
            ) if storage_manager.client else None
            
            # 重定向到预签名URL
            return RedirectResponse(url=download_url or "")
            
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"文件不存在或无法访问: {str(e)}")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"下载失败: {str(e)}")