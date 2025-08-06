"""测试依赖注入是否正常工作"""

def test_script_editor_service():
    try:
        from src.core.dependency_container import configure_services
        from src.services.script_editor_service import ScriptEditorService
        
        print("配置服务...")
        container = configure_services()
        
        print("创建作用域...")
        with container.create_scope() as scope:
            print("解析 ScriptEditorService...")
            service = scope.resolve(ScriptEditorService)
            print(f"成功创建 ScriptEditorService 实例: {type(service)}")
            print(f"script_repository 类型: {type(service.script_repository)}")
            return True
            
    except Exception as e:
        print(f"测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    test_script_editor_service()
