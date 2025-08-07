import sys
import os
from decimal import Decimal
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# 加载环境变量
load_dotenv()

# 将项目根目录添加到Python路径
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.db.models.script_model import ScriptDBModel, ScriptStatus
from src.db.models.character import CharacterDBModel
from src.db.models.background_story import BackgroundStoryDBModel
from src.db.models.evidence import EvidenceDBModel, EvidenceType
from src.db.models.location import LocationDBModel
from src.db.models.game_phase import GamePhaseDBModel
from src.schemas.game_phase import GamePhaseEnum

def get_database_url():
    """从环境变量获取数据库URL"""
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME", "jubensha")
    db_user = os.getenv("DB_USER", "postgres")
    db_password = os.getenv("DB_PASSWORD", "")
    return f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

def seed_data():
    """填充种子数据"""
    database_url = get_database_url()
    engine = create_engine(database_url)
    SessionFactory = sessionmaker(bind=engine)
    session = SessionFactory()

    try:
        # 检查是否已有数据
        existing_script = session.query(ScriptDBModel).filter_by(id=1).first()
        if existing_script:
            print("数据库中已有数据，跳过填充。")
            return

        # 创建剧本
        script = ScriptDBModel(
            id=1,
            title="商业谋杀案",
            description="一场发生在繁华都市中心的商业谋杀案，背后隐藏着巨大的阴谋。",
            author="w415895535",
            player_count=6,
            duration_minutes=240,
            difficulty="PHYSICAL",
            tags=["现代", "商战", "悬疑"],
            status=ScriptStatus.PUBLISHED,
            cover_image_url="/static/images/business_murder_cover.jpg",
            is_public=True,
            price=Decimal("99.99")
        )

        # 创建背景故事
        background_story = BackgroundStoryDBModel(
            script_id=1,
            title="故事背景",
            setting_description="故事发生在一座名为“金辉”的摩天大楼顶层，这里是商业巨头“环球集团”的总部。",
            incident_description="集团创始人兼CEO李先生被发现死在自己的办公室里，死因不明。",
            victim_background="李先生白手起家，建立了庞大的商业帝国，但为人强势，树敌众多。",
            investigation_scope="调查范围包括所有在案发当晚出现在顶层的人员。",
            rules_reminder="请各位玩家仔细阅读自己的剧本，不要泄露自己的秘密。",
            murder_method="毒杀",
            murder_location="CEO办公室",
            discovery_time="晚上10点",
            victory_conditions="凶手需要隐藏自己，并嫁祸给其他人；好人需要找出真凶。"
        )
        script.background_stories.append(background_story)

        # 创建角色
        characters_data = [
            {"name": "张助理", "age": 28, "profession": "CEO助理", "gender": "女", "is_murderer": False},
            {"name": "王副总", "age": 45, "profession": "副总裁", "gender": "男", "is_murderer": False},
            {"name": "赵技术总监", "age": 35, "profession": "技术总监", "gender": "男", "is_murderer": True},
            {"name": "钱财务总监", "age": 50, "profession": "财务总监", "gender": "男", "is_murderer": False},
            {"name": "孙市场总监", "age": 38, "profession": "市场总监", "gender": "女", "is_murderer": False},
            {"name": "周律师", "age": 42, "profession": "集团法律顾问", "gender": "男", "is_murderer": False}
        ]
        for char_data in characters_data:
            character = CharacterDBModel(
                script_id=1,
                **char_data,
                background="背景故事...",
                secret="秘密...",
                objective="目标..."
            )
            script.characters.append(character)

        # 创建地点
        locations_data = [
            {"name": "CEO办公室", "description": "案发现场，奢华而凌乱。", "is_crime_scene": True},
            {"name": "会议室", "description": "用于高层会议的地方。"},
            {"name": "休息区", "description": "员工放松的地方。"},
            {"name": "茶水间", "description": "提供茶水和咖啡。"}
        ]
        for loc_data in locations_data:
            location = LocationDBModel(script_id=1, **loc_data)
            script.locations.append(location)

        # 创建证据
        evidence_data = [
            {"name": "毒药瓶", "location": "CEO办公室", "description": "一个空的毒药瓶，上面有赵技术总监的指纹。", "evidence_type": EvidenceType.PHYSICAL, "importance": "关键"},
            {"name": "遗嘱", "location": "CEO办公室", "description": "一份修改过的遗嘱，将所有财产留给了张助理。", "evidence_type": EvidenceType.DOCUMENT, "importance": "重要"},
            {"name": "邮件记录", "location": "王副总的电脑", "description": "王副总与竞争对手公司的邮件往来。", "evidence_type": EvidenceType.DOCUMENT, "importance": "一般"}
        ]
        for ev_data in evidence_data:
            evidence = EvidenceDBModel(script_id=1, **ev_data)
            script.evidence.append(evidence)

        # 创建游戏阶段
        phases_data = [
            {"phase": GamePhaseEnum.BACKGROUND.value, "name": "第一幕：背景介绍", "description": "游戏主持人介绍案件背景。"},
            {"phase": GamePhaseEnum.INTRODUCTION.value, "name": "第二幕：自我介绍", "description": "玩家轮流介绍自己的角色。"},
            {"phase": GamePhaseEnum.EVIDENCE_COLLECTION.value, "name": "第三幕：搜证", "description": "玩家搜查现场，寻找线索。"},
            {"phase": GamePhaseEnum.INVESTIGATION.value, "name": "第四幕：调查取证", "description": "玩家互相询问，收集信息。"},
            {"phase": GamePhaseEnum.DISCUSSION.value, "name": "第五幕：自由讨论", "description": "玩家分享线索，进行推理。"},
            {"phase": GamePhaseEnum.VOTING.value, "name": "第六幕：投票表决", "description": "玩家投票选出凶手。"},
            {"phase": GamePhaseEnum.REVELATION.value, "name": "第七幕：真相揭晓", "description": "揭示真相，解释案件始末。"},
            {"phase": GamePhaseEnum.ENDED.value, "name": "第八幕：游戏结束", "description": "总结游戏，分享感受。"}
        ]
        for i, phase_data in enumerate(phases_data):
            game_phase = GamePhaseDBModel(script_id=1, order_index=i, **phase_data)
            script.game_phases.append(game_phase)

        session.add(script)
        session.commit()
        print("种子数据填充成功！")
    except Exception as e:
        print(f"数据填充失败: {e}")
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    seed_data()