"""静态资源相关的API路由"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from ...core.storage import storage_manager

router = APIRouter(tags=["静态资源"])

@router.get("/jubensha-assets/{path:path}")
async def get_assets(path: str):
    """通过storage接口获取MinIO文件"""
    try:
        # 检查存储服务是否可用
        if not storage_manager.is_available:
            raise HTTPException(status_code=503, detail="存储服务不可用")
        
        # 通过storage接口获取文件
        result = await storage_manager.get_file(path)
        
        if result is None:
            raise HTTPException(status_code=404, detail="文件未找到")
        
        file_content, content_type = result
        
        # 返回文件内容
        return Response(
            content=file_content,
            media_type=content_type,
            headers={
                "Cache-Control": "public, max-age=3600",  # 缓存1小时
                "Content-Length": str(len(file_content))
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件访问失败: {str(e)}")