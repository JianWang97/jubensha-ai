import json
import requests
import random
import uuid
import time
import os
from datetime import datetime
from websocket import create_connection

# ===== 配置区 =====
SERVER_ADDRESS = "127.0.0.1:8188"  # ComfyUI服务器地址
WORKFLOW_FILE = "workflow_api.json"  # API格式工作流文件
OUTPUT_DIR = "comfyui_outputs"  # 输出目录
PROMPT_OVERRIDES = {  # 动态参数修改
    "6": {"text": "photorealistic cat swimming in ice pool"},  # 文本节点ID及内容
}
# ==================

def init_environment():
    """创建输出目录并检查服务连通性"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    try:
        requests.get(f"http://{SERVER_ADDRESS}", timeout=5)
        print("✅ ComfyUI服务连接正常")
        
        # 清空队列，避免缓存问题
        try:
            requests.post(f"http://{SERVER_ADDRESS}/queue", json={"clear": True})
            print("🧹 已清空任务队列")
        except:
            print("⚠️ 清空队列失败，继续执行...")
            
    except:
        print("❌ 无法连接ComfyUI服务，请检查：")
        print(f"1. 是否已启动服务：`python main.py --port 8188 --api`")
        print("2. 防火墙是否开放8188端口")
        exit(1)

def load_workflow():
    """加载并修改工作流参数"""
    with open(WORKFLOW_FILE, 'r', encoding="utf-8") as f:
        workflow = json.load(f)
    
    # for node_id, params in PROMPT_OVERRIDES.items():
    #     if node_id in workflow:
    #         for key, value in params.items():
    #             workflow[node_id]["inputs"][key] = value
    #             print(f"🔧 已修改节点 {node_id} 参数 [{key}] = {value[:30]}...")
    #     else:
    #         print(f"⚠️ 警告：节点ID {node_id} 不存在于工作流中")
    return workflow

def execute_workflow(workflow):
    """提交工作流并监控执行"""
    client_id = str(uuid.uuid4())
    
    # 为工作流中的随机种子节点设置新的随机值
    for node_id, node_data in workflow.items():
        if "inputs" in node_data and "seed" in node_data["inputs"]:
            workflow[node_id]["inputs"]["seed"] = random.randint(0, 2**32 - 1)
            print(f"🎲 已更新节点 {node_id} 的随机种子")
    
    payload = {
        "prompt": workflow,
        "client_id": client_id
    }
    
    # 提交任务
    response = requests.post(f"http://{SERVER_ADDRESS}/prompt", json=payload)
    if response.status_code != 200:
        print(f"❌ 提交失败: {response.text}")
        exit(1)
        
    prompt_id = response.json()["prompt_id"]
    print(f"🚀 任务已提交 | ID: {prompt_id}")
    
    # WebSocket监控进度
    try:
        ws = create_connection(f"ws://{SERVER_ADDRESS}/ws?clientId={client_id}", timeout=10)
    except Exception as e:
        print(f"❌ WebSocket连接失败: {e}")
        return None
        
    while True:
        try:
            raw_msg = ws.recv()
        except Exception as e:
            print(f"❌ WebSocket接收消息失败: {e}")
            break
            
        # 处理不同类型的WebSocket消息
        if isinstance(raw_msg, bytes):
            # 检查是否为PNG图片数据（以PNG魔数开头）
            if raw_msg.startswith(b'\x89PNG'):
                continue  # 静默跳过图片数据
            # 检查是否为其他二进制格式
            if len(raw_msg) > 0 and raw_msg[0] > 127:
                continue  # 静默跳过非文本二进制数据
            try:
                raw_msg = raw_msg.decode('utf-8')
            except UnicodeDecodeError:
                continue  # 静默跳过无法解码的数据
        # 跳过空消息
        if not raw_msg or raw_msg.strip() == "":
            continue
            
        try:
             msg = json.loads(raw_msg)
        except json.JSONDecodeError as e:
             # 只在调试模式下显示JSON解析错误
             if len(raw_msg) < 100:  # 只显示短消息的错误
                 print(f"⚠️ JSON解析失败: {raw_msg[:50]}...")
             continue
             
        # 检查消息格式
        if not isinstance(msg, dict) or "type" not in msg:
            continue
            
        msg_type = msg["type"]
        
        if msg_type == "status":
            if "data" in msg and "status" in msg["data"] and "exec_info" in msg["data"]["status"]:
                queue_remaining = msg["data"]["status"]["exec_info"].get("queue_remaining", 0)
                if queue_remaining > 0:
                    print(f"📊 队列状态: {queue_remaining}任务等待中")
        elif msg_type == "execution_start" and msg.get("data", {}).get("prompt_id") == prompt_id:
            print("⏳ 开始执行工作流...")
        elif msg_type == "executing":
            node_id = msg.get("data", {}).get("node")
            if node_id: 
                node_name = workflow.get(node_id, {}).get("class_type", "未知节点")
                print(f"⚙️ 正在执行: [{node_id}] {node_name}")
        elif msg_type == "executed" and msg.get("data", {}).get("prompt_id") == prompt_id:
            print("✅ 工作流执行完成！")
            break
        elif msg_type == "execution_error":
            print(f"❌ 执行错误: {msg.get('data', {})}")
            break
    ws.close()
    return prompt_id

def save_results(prompt_id, workflow):
    """获取并保存输出结果"""
    history = requests.get(f"http://{SERVER_ADDRESS}/history/{prompt_id}").json()
    outputs = history[prompt_id]["outputs"]
    
    saved_files = []
    for node_id, node_data in outputs.items():
        if "images" in node_data:
            for img in node_data["images"]:
                # 获取图片数据
                img_url = f"http://{SERVER_ADDRESS}/view?filename={img['filename']}&type=output"
                img_data = requests.get(img_url).content
                
                # 生成唯一文件名
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"{timestamp}_{node_id}_{img['filename']}"
                save_path = os.path.join(OUTPUT_DIR, filename)
                
                # 保存文件
                with open(save_path, "wb") as f:
                    f.write(img_data)
                saved_files.append(save_path)
                print(f"🖼️ 已保存图像: {filename}")
                
    return saved_files

if __name__ == "__main__":
    # === 主流程 ===
    print("\n" + "="*50)
    print("ComfyUI工作流自动化脚本 v1.0")
    print("="*50)
    
    init_environment()
    workflow = load_workflow()
    prompt_id = execute_workflow(workflow)
    
    if prompt_id is None:
        print("❌ 工作流执行失败，请检查ComfyUI服务状态")
        exit(1)
        
    result_files = save_results(prompt_id, workflow)
    
    print("\n🔥 任务完成！输出文件：")
    for path in result_files:
        print(f"• {os.path.basename(path)}")