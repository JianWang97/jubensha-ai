"""剧本编辑增量落库与指令解析的单元测试

覆盖：
- ScriptRepository 增量方法（仅 flush 不 commit，子实体ID保持稳定）
- ScriptEditorService.execute_instruction 走增量落库、不再整本重建、game_phases 不被触碰
- parse_user_instruction 解析彻底失败时返回空指令列表（不再关键词兜底生成占位指令）
- 解析重试时格式提醒真正带入下一轮请求
"""
import asyncio
import os
import sys
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.db.base import SQLAlchemyBase
from src.db import models  # noqa: F401  # 确保全部ORM模型注册到metadata
from src.db.models.script_model import ScriptDBModel
from src.db.models.character import CharacterDBModel
from src.db.models.evidence import EvidenceDBModel
from src.db.models.location import LocationDBModel
from src.db.models.background_story import BackgroundStoryDBModel
from src.db.models.game_phase import GamePhaseDBModel
from src.db.repositories.script_repository import ScriptRepository
from src.schemas.evidence_type import EvidenceType
from src.schemas.game_phase import GamePhaseEnum
from src.schemas.script import ScriptCharacter, ScriptEvidence, ScriptLocation
from src.services.script_editor_service import ScriptEditorService, EditInstruction

pytestmark = pytest.mark.unit


@pytest.fixture
def db_session():
    """内存 SQLite 会话，用于验证真实 SQL 行为"""
    engine = create_engine("sqlite:///:memory:")
    SQLAlchemyBase.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)
    session = session_factory()
    yield session
    session.close()


@pytest.fixture
def repo(db_session):
    return ScriptRepository(db_session)


@pytest.fixture
def editor(repo):
    return ScriptEditorService(repo)


@pytest.fixture
def script_id(db_session):
    """创建带完整子实体的测试剧本"""
    db_script = ScriptDBModel(title="测试剧本", description="测试描述", player_count=4)
    db_session.add(db_script)
    db_session.flush()
    db_session.add_all([
        CharacterDBModel(
            script_id=db_script.id, name="张三", profession="侦探",
            background="一个经验丰富的侦探", secret="隐藏的秘密", objective="找出真相", gender="男"
        ),
        CharacterDBModel(
            script_id=db_script.id, name="李四", profession="医生",
            background="一个外科医生", secret="另一个秘密", objective="保护自己", gender="女"
        ),
    ])
    db_session.add(EvidenceDBModel(
        script_id=db_script.id, name="血迹", description="地毯上的血迹",
        location="书房", evidence_type=EvidenceType.PHYSICAL
    ))
    db_session.add(LocationDBModel(script_id=db_script.id, name="书房", description="堆满书籍的房间"))
    db_session.add(BackgroundStoryDBModel(script_id=db_script.id, title="背景", setting_description="旧的设定"))
    db_session.add(GamePhaseDBModel(
        script_id=db_script.id, phase=GamePhaseEnum.BACKGROUND, name="背景介绍",
        description="背景介绍阶段", order_index=0
    ))
    db_session.commit()
    return db_script.id


def _run(coro):
    """同步执行异步方法"""
    return asyncio.run(coro)


def _valid_character_content(**overrides):
    """可通过必填与内容质量校验的角色数据"""
    content = {
        "name": "王五",
        "profession": "律师",
        "background": "王五是一名从业二十年的资深律师，经手过大量刑事案件，逻辑缜密，言辞犀利，在业内享有很高的声誉，深受同行尊敬。",
        "secret": "王五曾经为真正的凶手辩护过，这件事一直是他心中的阴影和负担。",
        "objective": "找出案件真相，弥补自己当年辩护失误造成的遗憾。",
        "gender": "男",
        "age": 45,
        "personality_traits": ["冷静", "敏锐", "固执"],
        "is_murderer": False,
        "is_victim": False,
    }
    content.update(overrides)
    return content


def _forbid_full_rebuild(repo):
    """禁止编辑链路调用整本重建方法"""
    return patch.multiple(
        repo,
        update_complete_script=Mock(side_effect=AssertionError("编辑链路不应调用整本重建")),
        update_script=Mock(side_effect=AssertionError("编辑链路不应调用整本重建")),
    )


class TestIncrementalRepository:
    """ScriptRepository 增量方法测试"""

    def test_add_character_flush_only(self, repo, db_session, script_id):
        new_char = ScriptCharacter(script_id=script_id, name="王五", profession="律师", gender="男")
        persisted = repo.add_character(new_char)
        assert persisted.id is not None
        # 同一会话内 flush 后可见
        assert db_session.query(CharacterDBModel).filter_by(script_id=script_id, name="王五").count() == 1
        # 仅 flush 未 commit：rollback 后新增记录消失，证明方法本身不提交事务
        db_session.rollback()
        assert db_session.query(CharacterDBModel).filter_by(script_id=script_id, name="王五").count() == 0

    def test_update_character_by_name(self, repo, db_session, script_id):
        before_id = db_session.query(CharacterDBModel).filter_by(script_id=script_id, name="张三").first().id
        updated = repo.update_character_by_name(script_id, "张三", {"background": "新的背景"})
        assert updated is not None
        assert updated.background == "新的背景"
        assert updated.id == before_id  # ID保持不变
        # 保护字段不会被修改
        updated2 = repo.update_character_by_name(script_id, "张三", {"id": 999, "script_id": 999, "profession": "名侦探"})
        assert updated2.id == before_id
        assert updated2.script_id == script_id
        assert updated2.profession == "名侦探"

    def test_update_character_by_name_not_found(self, repo, script_id):
        assert repo.update_character_by_name(script_id, "不存在", {"background": "x"}) is None

    def test_delete_character_by_name(self, repo, db_session, script_id):
        other_id = db_session.query(CharacterDBModel).filter_by(script_id=script_id, name="李四").first().id
        assert repo.delete_character_by_name(script_id, "张三") is True
        # 重复删除返回 False
        assert repo.delete_character_by_name(script_id, "张三") is False
        remaining = db_session.query(CharacterDBModel).filter_by(script_id=script_id).all()
        assert len(remaining) == 1
        assert remaining[0].id == other_id  # 其他角色ID不受影响

    def test_evidence_incremental_ops(self, repo, db_session, script_id):
        ev = repo.add_evidence(ScriptEvidence(script_id=script_id, name="遗书", description="一封遗书", location="卧室"))
        assert ev.id is not None
        updated = repo.update_evidence_by_name(script_id, "遗书", {"description": "被撕碎的遗书", "evidence_type": "DOCUMENT"})
        assert updated.description == "被撕碎的遗书"
        assert repo.update_evidence_by_name(script_id, "不存在", {"description": "x"}) is None
        assert repo.delete_evidence_by_name(script_id, "遗书") is True
        assert db_session.query(EvidenceDBModel).filter_by(script_id=script_id, name="遗书").count() == 0
        # 原有证据未受影响
        assert db_session.query(EvidenceDBModel).filter_by(script_id=script_id, name="血迹").count() == 1

    def test_location_incremental_ops(self, repo, db_session, script_id):
        loc = repo.add_location(ScriptLocation(script_id=script_id, name="花园", description="室外花园"))
        assert loc.id is not None
        updated = repo.update_location_by_name(script_id, "花园", {"is_crime_scene": True, "searchable_items": ["铲子"]})
        assert updated.is_crime_scene is True
        assert updated.searchable_items == ["铲子"]
        assert repo.delete_location_by_name(script_id, "花园") is True
        assert db_session.query(LocationDBModel).filter_by(script_id=script_id, name="花园").count() == 0

    def test_upsert_background_story_update_existing(self, repo, db_session, script_id):
        before_id = db_session.query(BackgroundStoryDBModel).filter_by(script_id=script_id).first().id
        story = repo.upsert_background_story(script_id, {"setting_description": "新的设定"})
        assert story.id == before_id
        assert story.setting_description == "新的设定"
        # 仍然只有一条记录，没有新建
        assert db_session.query(BackgroundStoryDBModel).filter_by(script_id=script_id).count() == 1

    def test_upsert_background_story_create(self, repo, db_session):
        db_script = ScriptDBModel(title="无故事剧本", description="d")
        db_session.add(db_script)
        db_session.commit()
        story = repo.upsert_background_story(db_script.id, {"setting_description": "全新设定", "title": "t"})
        assert story.id is not None
        assert story.script_id == db_script.id
        assert db_session.query(BackgroundStoryDBModel).filter_by(script_id=db_script.id).count() == 1

    def test_update_script_info_fields(self, repo, script_id):
        info = repo.update_script_info_fields(script_id, {"title": "新标题", "duration_minutes": 240})
        assert info.title == "新标题"
        assert info.estimated_duration == 240
        # 保护字段不生效
        info2 = repo.update_script_info_fields(script_id, {"id": 999})
        assert info2.id == script_id
        # 剧本不存在返回 None
        assert repo.update_script_info_fields(99999, {"title": "x"}) is None


class TestExecuteInstructionIncremental:
    """execute_instruction 增量落库测试"""

    def test_add_character(self, editor, repo, db_session, script_id):
        phase_ids_before = [p.id for p in db_session.query(GamePhaseDBModel).filter_by(script_id=script_id).all()]
        char_ids_before = {c.id for c in db_session.query(CharacterDBModel).filter_by(script_id=script_id).all()}
        instruction = EditInstruction(
            action="add", target="character",
            content=_valid_character_content(), description="添加角色王五"
        )
        with _forbid_full_rebuild(repo):
            result = _run(editor.execute_instruction(instruction, script_id))
        assert result.success
        assert result.data["character"]["id"] is not None
        # 已有角色ID不变、game_phases未被触碰
        char_ids_after = {c.id for c in db_session.query(CharacterDBModel).filter_by(script_id=script_id).all()}
        assert char_ids_before.issubset(char_ids_after)
        phase_ids_after = [p.id for p in db_session.query(GamePhaseDBModel).filter_by(script_id=script_id).all()]
        assert phase_ids_before == phase_ids_after
        # updated_script 快照包含新角色
        assert "王五" in [c.name for c in result.updated_script.characters]

    def test_add_character_validation_failure(self, editor, db_session, script_id):
        instruction = EditInstruction(
            action="add", target="character",
            content={"name": "缺字段"}, description="缺字段"
        )
        result = _run(editor.execute_instruction(instruction, script_id))
        assert not result.success
        assert "缺少必填字段" in result.message
        # 校验失败不写库
        assert db_session.query(CharacterDBModel).filter_by(script_id=script_id).count() == 2

    def test_update_character(self, editor, db_session, script_id):
        before_id = db_session.query(CharacterDBModel).filter_by(script_id=script_id, name="张三").first().id
        instruction = EditInstruction(
            action="update", target="character",
            content={"name": "张三", "background": "更新后的背景"}, description="更新背景"
        )
        result = _run(editor.execute_instruction(instruction, script_id))
        assert result.success
        row = db_session.query(CharacterDBModel).filter_by(script_id=script_id, name="张三").first()
        assert row.background == "更新后的背景"
        assert row.id == before_id  # ID不变

    def test_update_character_not_found(self, editor, script_id):
        instruction = EditInstruction(
            action="update", target="character",
            content={"name": "不存在的人", "background": "x"}, description="更新"
        )
        result = _run(editor.execute_instruction(instruction, script_id))
        assert not result.success
        assert "未找到角色" in result.message

    def test_delete_character(self, editor, db_session, script_id):
        keep_id = db_session.query(CharacterDBModel).filter_by(script_id=script_id, name="李四").first().id
        instruction = EditInstruction(
            action="delete", target="character",
            content={"name": "张三"}, description="删除张三"
        )
        result = _run(editor.execute_instruction(instruction, script_id))
        assert result.success
        remaining = db_session.query(CharacterDBModel).filter_by(script_id=script_id).all()
        assert [c.name for c in remaining] == ["李四"]
        assert remaining[0].id == keep_id  # 剩余角色ID不变

    def test_update_evidence(self, editor, db_session, script_id):
        before_id = db_session.query(EvidenceDBModel).filter_by(script_id=script_id, name="血迹").first().id
        instruction = EditInstruction(
            action="update", target="evidence",
            content={"name": "血迹", "description": "新的描述", "evidence_type": "DOCUMENT"},
            description="更新证据"
        )
        result = _run(editor.execute_instruction(instruction, script_id))
        assert result.success
        row = db_session.query(EvidenceDBModel).filter_by(script_id=script_id, name="血迹").first()
        assert row.description == "新的描述"
        assert row.id == before_id

    def test_delete_location(self, editor, db_session, script_id):
        instruction = EditInstruction(
            action="delete", target="location",
            content={"name": "书房"}, description="删除书房"
        )
        result = _run(editor.execute_instruction(instruction, script_id))
        assert result.success
        assert db_session.query(LocationDBModel).filter_by(script_id=script_id).count() == 0

    def test_update_info(self, editor, db_session, script_id):
        instruction = EditInstruction(
            action="modify", target="info",
            content={"title": "全新标题", "estimated_duration": 240, "difficulty_level": "hard"},
            description="修改剧本信息"
        )
        result = _run(editor.execute_instruction(instruction, script_id))
        assert result.success
        row = db_session.query(ScriptDBModel).filter_by(id=script_id).first()
        assert row.title == "全新标题"
        # 验证 Pydantic字段名到数据库列名的映射
        assert row.duration_minutes == 240
        assert row.difficulty == "hard"

    def test_update_story(self, editor, db_session, script_id):
        before_id = db_session.query(BackgroundStoryDBModel).filter_by(script_id=script_id).first().id
        instruction = EditInstruction(
            action="update", target="story",
            content={"setting_description": "全新的背景设定"}, description="改背景故事"
        )
        result = _run(editor.execute_instruction(instruction, script_id))
        assert result.success
        rows = db_session.query(BackgroundStoryDBModel).filter_by(script_id=script_id).all()
        assert len(rows) == 1  # upsert 不新建记录
        assert rows[0].id == before_id
        assert rows[0].setting_description == "全新的背景设定"

    def test_sequential_instructions_same_session(self, editor, db_session, script_id):
        """同一会话内连续执行：后一条指令能看到前一条 flush 的变更"""
        add = EditInstruction(
            action="add", target="character",
            content=_valid_character_content(), description="添加王五"
        )
        r1 = _run(editor.execute_instruction(add, script_id))
        assert r1.success
        # 紧接着更新刚添加的角色（依赖会话失效后的新鲜读取）
        update = EditInstruction(
            action="update", target="character",
            content={"name": "王五", "profession": "检察官"}, description="更新王五"
        )
        r2 = _run(editor.execute_instruction(update, script_id))
        assert r2.success, r2.message
        row = db_session.query(CharacterDBModel).filter_by(script_id=script_id, name="王五").first()
        assert row.profession == "检察官"
        # 统一提交后数据仍在
        db_session.commit()
        assert db_session.query(CharacterDBModel).filter_by(script_id=script_id).count() == 3


class TestParseInstruction:
    """parse_user_instruction 解析行为测试"""

    def _llm_response(self, content):
        return SimpleNamespace(content=content)

    def test_parse_failure_returns_empty_list(self, editor, script_id):
        """LLM解析彻底失败时返回空指令列表，不再生成兜底占位指令"""
        categorize = self._llm_response('{"category": "character", "confidence": 0.9, "reasoning": "测试"}')
        with patch("src.services.script_editor_service.llm_service") as mock_llm:
            mock_llm.chat_completion = AsyncMock(side_effect=[
                categorize,
                Exception("LLM服务异常"),
                Exception("LLM服务异常"),
                Exception("LLM服务异常"),
            ])
            result = _run(editor.parse_user_instruction("添加一个角色", script_id))
        assert result == []

    def test_parse_invalid_json_all_retries_returns_empty_list(self, editor, script_id):
        """LLM持续返回非法JSON时也返回空指令列表"""
        categorize = self._llm_response('{"category": "character", "confidence": 0.9, "reasoning": "测试"}')
        bad = self._llm_response("这不是合法的JSON")
        with patch("src.services.script_editor_service.llm_service") as mock_llm:
            mock_llm.chat_completion = AsyncMock(side_effect=[categorize, bad, bad, bad])
            result = _run(editor.parse_user_instruction("添加一个角色", script_id))
        assert result == []

    def test_parse_retry_carries_reminder(self, editor, script_id):
        """首次返回非法JSON时，下一轮重试的请求中应带有格式提醒"""
        categorize = self._llm_response('{"category": "character", "confidence": 0.9, "reasoning": "测试"}')
        bad = self._llm_response("这不是合法的JSON")
        good = self._llm_response(
            '[{"action": "delete", "target": "character", "content": {"name": "张三"}, "description": "删除张三"}]'
        )
        with patch("src.services.script_editor_service.llm_service") as mock_llm:
            mock_llm.chat_completion = AsyncMock(side_effect=[categorize, bad, good])
            result = _run(editor.parse_user_instruction("删除张三这个角色", script_id))
        assert len(result) == 1
        assert result[0].action == "delete"
        # 第一次解析尝试不带提醒
        first_messages = mock_llm.chat_completion.call_args_list[1].args[0]
        assert "标准JSON格式" not in first_messages[1].content
        # 第二次解析尝试（重试）带有格式提醒
        retry_messages = mock_llm.chat_completion.call_args_list[2].args[0]
        assert "标准JSON格式" in retry_messages[1].content
