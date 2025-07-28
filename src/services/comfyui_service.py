"""ComfyUI图像生成服务"""
import json
import requests # type: ignore
import random
import uuid
import time
import os
import asyncio
from datetime import datetime
from websocket import create_connection
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from io import BytesIO
try:
    from ..core.config import config
except ImportError:
    # 如果配置模块不可用，使用默认配置
    config = None

@dataclass
class ImageGenerationRequest:
    """图像生成请求"""
    positive_prompt: str
    negative_prompt: str = ""
    width: int = 512
    height: int = 720
    steps: int = 20
    cfg: float = 8.0
    seed: Optional[int] = None
    model: str = "AWPainting_v1.5.safetensors"
    sampler_name: str = "euler"
    scheduler: str = "normal"

@dataclass
class ImageGenerationResponse:
    """图像生成响应"""
    success: bool
    image_data: Optional[bytes] = None
    filename: Optional[str] = None
    prompt_id: Optional[str] = None
    error_message: Optional[str] = None
    generation_time: Optional[float] = None

class ComfyUIService:
    """ComfyUI图像生成服务"""
    
    def __init__(self, server_address: str = "192.168.2.111:8188", workflow_file: str = "Epicrealismxl_Hades.json"):
        self.server_address = server_address
        self.workflow_file = workflow_file
        self.base_workflow = self._load_base_workflow()
    
    def _load_base_workflow(self) -> Dict[str, Any]:
        """加载基础工作流模板"""
        try:
            with open(self.workflow_file, 'r', encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            # 如果文件不存在，返回默认工作流
            return self._get_default_workflow()
    
    def _get_default_workflow(self) -> Dict[str, Any]:
        """获取默认工作流配置"""
        return {
            "3": {
                "inputs": {
                    "seed": 480446762880100,
                    "steps": 20,
                    "cfg": 8,
                    "sampler_name": "euler",
                    "scheduler": "normal",
                    "denoise": 1,
                    "model": ["4", 0],
                    "positive": ["6", 0],
                    "negative": ["7", 0],
                    "latent_image": ["5", 0]
                },
                "class_type": "KSampler"
            },
            "4": {
                "inputs": {
                    "ckpt_name": "AWPainting_v1.5.safetensors"
                },
                "class_type": "CheckpointLoaderSimple"
            },
            "5": {
                "inputs": {
                    "width": 512,
                    "height": 720,
                    "batch_size": 1
                },
                "class_type": "EmptyLatentImage"
            },
            "6": {
                "inputs": {
                    "text": "",
                    "speak_and_recognation": True,
                    "clip": ["4", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "7": {
                "inputs": {
                    "text": "",
                    "speak_and_recognation": True,
                    "clip": ["4", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "8": {
                "inputs": {
                    "samples": ["3", 0],
                    "vae": ["4", 2]
                },
                "class_type": "VAEDecode"
            },
            "9": {
                "inputs": {
                    "filename_prefix": "ComfyUI",
                    "images": ["8", 0]
                },
                "class_type": "SaveImage"
            }
        }
    
    def _check_server_connection(self) -> bool:
        """检查ComfyUI服务器连接"""
        try:
            response = requests.get(f"http://{self.server_address}", timeout=5)
            return response.status_code == 200
        except:
            return False
    
    def _clear_queue(self) -> bool:
        """清空任务队列"""
        try:
            requests.post(f"http://{self.server_address}/queue", json={"clear": True}, timeout=5)
            return True
        except:
            return False
    
    def _prepare_workflow(self, request: ImageGenerationRequest) -> Dict[str, Any]:
        """准备工作流配置"""
        workflow = json.loads(json.dumps(self.base_workflow))  # 深拷贝
        
        # 设置正向提示词
        if "6" in workflow:
            workflow["6"]["inputs"]["text"] = request.positive_prompt
        
        # 设置反向提示词
        if "7" in workflow:
            workflow["7"]["inputs"]["text"] = request.negative_prompt
        
        # 设置图像尺寸
        if "5" in workflow:
            workflow["5"]["inputs"]["width"] = request.width
            workflow["5"]["inputs"]["height"] = request.height
        
        # 设置采样参数
        if "3" in workflow:
            workflow["3"]["inputs"]["steps"] = request.steps
            workflow["3"]["inputs"]["cfg"] = request.cfg
            workflow["3"]["inputs"]["sampler_name"] = request.sampler_name
            workflow["3"]["inputs"]["scheduler"] = request.scheduler
            
            # 设置随机种子
            if request.seed is not None:
                workflow["3"]["inputs"]["seed"] = request.seed
            else:
                workflow["3"]["inputs"]["seed"] = random.randint(0, 2**32 - 1)
        
        # 设置模型
        if "4" in workflow:
            workflow["4"]["inputs"]["ckpt_name"] = request.model
        
        # 更新所有随机种子节点
        for node_id, node_data in workflow.items():
            if "inputs" in node_data and "seed" in node_data["inputs"]:
                if request.seed is not None:
                    workflow[node_id]["inputs"]["seed"] = request.seed
                else:
                    workflow[node_id]["inputs"]["seed"] = random.randint(0, 2**32 - 1)
        
        return workflow
    
    def _execute_workflow(self, workflow: Dict[str, Any]) -> Optional[str]:
        """执行工作流并监控进度"""
        client_id = str(uuid.uuid4())
        payload = {
            "prompt": workflow,
            "client_id": client_id
        }
        
        # 提交任务
        try:
            response = requests.post(f"http://{self.server_address}/prompt", json=payload, timeout=10)
            if response.status_code != 200:
                return None
            prompt_id = response.json()["prompt_id"]
        except Exception:
            return None
        
        # WebSocket监控进度
        try:
            ws = create_connection(f"ws://{self.server_address}/ws?clientId={client_id}", timeout=10)
        except Exception:
            return None
        
        try:
            while True:
                try:
                    raw_msg = ws.recv()
                except Exception:
                    break
                
                # 处理不同类型的WebSocket消息
                if isinstance(raw_msg, bytes):
                    # 检查是否为PNG图片数据
                    if raw_msg.startswith(b'\x89PNG'):
                        continue
                    # 检查是否为其他二进制格式
                    if len(raw_msg) > 0 and raw_msg[0] > 127:
                        continue
                    try:
                        raw_msg = raw_msg.decode('utf-8')
                    except UnicodeDecodeError:
                        continue
                
                # 跳过空消息
                if not raw_msg or raw_msg.strip() == "":
                    continue
                
                try:
                    msg = json.loads(raw_msg)
                except json.JSONDecodeError:
                    continue
                
                # 检查消息格式
                if not isinstance(msg, dict) or "type" not in msg:
                    continue
                
                msg_type = msg["type"]
                
                if msg_type == "executed" and msg.get("data", {}).get("prompt_id") == prompt_id:
                    break
                elif msg_type == "execution_error":
                    ws.close()
                    return None
        finally:
            ws.close()
        
        return prompt_id
    
    def _get_generated_image(self, prompt_id: str) -> Optional[bytes]:
        """获取生成的图像数据"""
        try:
            history = requests.get(f"http://{self.server_address}/history/{prompt_id}", timeout=10).json()
            outputs = history[prompt_id]["outputs"]
            
            for node_id, node_data in outputs.items():
                if "images" in node_data:
                    for img in node_data["images"]:
                        img_url = f"http://{self.server_address}/view?filename={img['filename']}&type=output"
                        img_response = requests.get(img_url, timeout=30)
                        if img_response.status_code == 200:
                            return img_response.content
            return None
        except Exception:
            return None
    
    async def generate_image(self, request: ImageGenerationRequest) -> ImageGenerationResponse:
        """生成图像"""
        start_time = time.time()
        
        # 检查服务器连接
        if not self._check_server_connection():
            return ImageGenerationResponse(
                success=False,
                error_message="无法连接到ComfyUI服务器"
            )
        
        # 清空队列
        self._clear_queue()
        
        # 准备工作流
        try:
            workflow = self._prepare_workflow(request)
        except Exception as e:
            return ImageGenerationResponse(
                success=False,
                error_message=f"准备工作流失败: {str(e)}"
            )
        
        # 执行工作流
        prompt_id = await asyncio.get_event_loop().run_in_executor(
            None, self._execute_workflow, workflow
        )
        
        if not prompt_id:
            return ImageGenerationResponse(
                success=False,
                error_message="工作流执行失败"
            )
        
        # 获取生成的图像
        image_data = await asyncio.get_event_loop().run_in_executor(
            None, self._get_generated_image, prompt_id
        )
        
        if not image_data:
            return ImageGenerationResponse(
                success=False,
                error_message="获取生成图像失败",
                prompt_id=prompt_id
            )
        
        generation_time = time.time() - start_time
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"generated_{timestamp}_{prompt_id[:8]}.png"
        
        return ImageGenerationResponse(
            success=True,
            image_data=image_data,
            filename=filename,
            prompt_id=prompt_id,
            generation_time=generation_time
        )

# 全局服务实例
comfyui_service = ComfyUIService()