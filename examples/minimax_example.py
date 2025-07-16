"""MiniMax API使用示例"""
import asyncio
import os
import sys
from pathlib import Path

# 添加项目根目录到Python路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from src.services.minimax_service import (
    MiniMaxClient, 
    MiniMaxTTSRequest, 
    MiniMaxImageRequest,
    MiniMaxVoiceCloneRequest
)
from src.services.tts_service import TTSService, TTSRequest


async def test_minimax_tts():
    """测试MiniMax TTS功能"""
    print("=== 测试MiniMax TTS功能 ===")
    
    # 配置信息（请替换为实际的API密钥和Group ID）
    api_key = "your-api-key-here"
    group_id = "your-group-id-here"
    
    if api_key == "your-api-key-here":
        print("请先配置API密钥和Group ID")
        return
    
    async with MiniMaxClient(api_key, group_id) as client:
        # 1. 获取可用声音列表
        print("\n1. 获取可用声音列表...")
        voice_response = await client.get_voice_list()
        if voice_response.success:
            print(f"可用声音数量: {len(voice_response.data.get('voices', []))}")
            # 显示前几个声音
            voices = voice_response.data.get('voices', [])
            for i, voice in enumerate(voices[:5]):
                print(f"  - {voice.get('voice_id', 'unknown')}: {voice.get('name', 'unknown')}")
        else:
            print(f"获取声音列表失败: {voice_response.error}")
        
        # 2. 文本转语音
        print("\n2. 测试文本转语音...")
        tts_request = MiniMaxTTSRequest(
            text="你好，这是一个MiniMax语音合成的测试。今天天气很好，适合出去走走。",
            voice_id="male-qn-qingse",  # 青涩男声
            speed=1.0,
            volume=1.0,
            pitch=0
        )
        
        tts_response = await client.text_to_speech(tts_request)
        if tts_response.success:
            audio_data = tts_response.data["audio_data"]
            print(f"语音合成成功，音频数据长度: {len(audio_data)} 字符")
            
            # 保存音频文件（可选）
            import base64
            audio_bytes = base64.b64decode(audio_data)
            with open("test_output.mp3", "wb") as f:
                f.write(audio_bytes)
            print("音频已保存为 test_output.mp3")
        else:
            print(f"语音合成失败: {tts_response.error}")
        
        # 3. 流式语音合成
        print("\n3. 测试流式语音合成...")
        stream_request = MiniMaxTTSRequest(
            text="这是一个流式语音合成的测试，可以实时获取音频数据块。",
            voice_id="female-shaonv",  # 少女音
            speed=1.2
        )
        
        audio_chunks = []
        async for chunk in client.text_to_speech_stream(stream_request):
            if "error" in chunk:
                print(f"流式合成错误: {chunk['error']}")
                break
            elif "end" in chunk:
                print("流式合成完成")
                break
            elif "audio" in chunk:
                audio_chunks.append(chunk["audio"])
                print(f"收到音频块，长度: {len(chunk['audio'])}")
        
        if audio_chunks:
            print(f"总共收到 {len(audio_chunks)} 个音频块")


async def test_minimax_image_generation():
    """测试MiniMax图片生成功能"""
    print("\n=== 测试MiniMax图片生成功能 ===")
    
    # 配置信息（请替换为实际的API密钥和Group ID）
    api_key = "your-api-key-here"
    group_id = "your-group-id-here"
    
    if api_key == "your-api-key-here":
        print("请先配置API密钥和Group ID")
        return
    
    async with MiniMaxClient(api_key, group_id) as client:
        # 图片生成测试
        print("\n1. 测试图片生成...")
        image_request = MiniMaxImageRequest(
            prompt="一只可爱的橘色小猫坐在樱花树下，春天的阳光透过花瓣洒在小猫身上，画面温馨美好，高清摄影风格",
            aspect_ratio="1:1",
            guidance_scale=7.5
        )
        
        image_response = await client.generate_image(image_request)
        if image_response.success:
            images = image_response.data["images"]
            print(f"图片生成成功，生成了 {len(images)} 张图片")
            
            # 保存图片（可选）
            import base64
            for i, image_data in enumerate(images):
                if "url" in image_data:
                    print(f"图片 {i+1} URL: {image_data['url']}")
                elif "base64" in image_data:
                    image_bytes = base64.b64decode(image_data["base64"])
                    filename = f"generated_image_{i+1}.png"
                    with open(filename, "wb") as f:
                        f.write(image_bytes)
                    print(f"图片 {i+1} 已保存为 {filename}")
        else:
            print(f"图片生成失败: {image_response.error}")
        
        # 不同比例的图片生成
        print("\n2. 测试不同比例的图片生成...")
        aspect_ratios = ["16:9", "9:16", "4:3"]
        
        for ratio in aspect_ratios:
            print(f"\n生成 {ratio} 比例的图片...")
            request = MiniMaxImageRequest(
                prompt="现代城市夜景，霓虹灯闪烁，车流如织，高楼大厦林立",
                aspect_ratio=ratio
            )
            
            response = await client.generate_image(request)
            if response.success:
                print(f"  {ratio} 比例图片生成成功")
            else:
                print(f"  {ratio} 比例图片生成失败: {response.error}")


async def test_voice_cloning():
    """测试声音克隆功能"""
    print("\n=== 测试声音克隆功能 ===")
    
    # 配置信息（请替换为实际的API密钥和Group ID）
    api_key = "your-api-key-here"
    group_id = "your-group-id-here"
    
    if api_key == "your-api-key-here":
        print("请先配置API密钥和Group ID")
        return
    
    # 注意：这个示例需要一个音频文件来进行声音克隆
    audio_file_path = "sample_voice.wav"  # 请替换为实际的音频文件路径
    
    if not os.path.exists(audio_file_path):
        print(f"音频文件 {audio_file_path} 不存在，跳过声音克隆测试")
        print("提示：请准备一个10-60秒的音频文件用于声音克隆")
        return
    
    async with MiniMaxClient(api_key, group_id) as client:
        # 1. 上传音频文件
        print("\n1. 上传音频文件...")
        upload_response = await client.upload_file(audio_file_path, "voice_clone")
        
        if not upload_response.success:
            print(f"文件上传失败: {upload_response.error}")
            return
        
        file_id = upload_response.data.get("file_id")
        print(f"文件上传成功，file_id: {file_id}")
        
        # 2. 克隆声音
        print("\n2. 克隆声音...")
        clone_request = MiniMaxVoiceCloneRequest(
            file_id=file_id,
            voice_id="my_cloned_voice_001"  # 自定义声音ID
        )
        
        clone_response = await client.clone_voice(clone_request)
        if clone_response.success:
            print("声音克隆成功")
            
            # 3. 使用克隆的声音进行语音合成
            print("\n3. 使用克隆的声音进行语音合成...")
            tts_request = MiniMaxTTSRequest(
                text="这是使用克隆声音合成的语音，听起来应该和原始声音很相似。",
                voice_id="my_cloned_voice_001"
            )
            
            tts_response = await client.text_to_speech(tts_request)
            if tts_response.success:
                print("使用克隆声音合成成功")
                
                # 保存合成的音频
                import base64
                audio_data = tts_response.data["audio_data"]
                audio_bytes = base64.b64decode(audio_data)
                with open("cloned_voice_output.mp3", "wb") as f:
                    f.write(audio_bytes)
                print("克隆声音合成的音频已保存为 cloned_voice_output.mp3")
            else:
                print(f"使用克隆声音合成失败: {tts_response.error}")
        else:
            print(f"声音克隆失败: {clone_response.error}")


async def test_tts_service_integration():
    """测试与现有TTS服务的集成"""
    print("\n=== 测试TTS服务集成 ===")
    
    # 配置信息
    config = {
        "api_key": "your-api-key-here",
        "group_id": "your-group-id-here",
        "model": "speech-01"
    }
    
    if config["api_key"] == "your-api-key-here":
        print("请先配置API密钥和Group ID")
        return
    
    # 使用TTS服务工厂创建MiniMax服务
    tts_service = TTSService.create_service("minimax", **config)
    
    # 创建TTS请求
    request = TTSRequest(
        text="这是通过TTS服务工厂创建的MiniMax语音合成测试。",
        voice="female-yujie",  # 御姐音
        speed=0.9
    )
    
    try:
        # 合成语音
        response = await tts_service.synthesize(request)
        print(f"TTS服务集成测试成功，音频数据长度: {len(response.audio_data)}")
        
        # 流式合成
        print("\n测试流式合成...")
        chunk_count = 0
        async for chunk in tts_service.synthesize_stream(request):
            if "error" in chunk:
                print(f"流式合成错误: {chunk['error']}")
                break
            elif "end" in chunk:
                print(f"流式合成完成，总共收到 {chunk_count} 个音频块")
                break
            elif "audio" in chunk:
                chunk_count += 1
        
    except Exception as e:
        print(f"TTS服务集成测试失败: {e}")


async def main():
    """主函数"""
    print("MiniMax API客户端代理测试")
    print("=" * 50)
    
    # 检查依赖
    try:
        import aiohttp
        print("✓ aiohttp 已安装")
    except ImportError:
        print("✗ 需要安装 aiohttp: pip install aiohttp")
        return
    
    print("\n注意：请在代码中配置正确的API密钥和Group ID")
    print("API密钥获取地址: https://www.minimaxi.com/")
    
    # 运行测试
    await test_minimax_tts()
    await test_minimax_image_generation()
    await test_voice_cloning()
    await test_tts_service_integration()
    
    print("\n=== 测试完成 ===")
    print("\n可用的MiniMax功能:")
    print("1. 文本转语音 (TTS)")
    print("2. 流式语音合成")
    print("3. 图片生成")
    print("4. 声音克隆")
    print("5. 获取声音列表")
    print("6. 与现有TTS服务框架集成")


if __name__ == "__main__":
    asyncio.run(main())