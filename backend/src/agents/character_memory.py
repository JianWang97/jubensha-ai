"""角色私有记忆层。

参照 hello-agents chapter15 AI Town 的 MemoryManager，
针对剧本杀场景简化为无向量数据库的双层记忆：
  - working_memory : 最近 N 条公开对话（短期，所有人共享的信息）
  - personal_log   : 本角色的私有事件日志（搜证结论、发言记录、内部分析）

另外维护一个 suspicion_map，记录对其他角色的怀疑度（0.0–1.0），
随游戏进程动态更新，为 PhaseDirector 提供上下文。
"""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import NamedTuple


# ---------------------------------------------------------------------------
# 数据结构
# ---------------------------------------------------------------------------

class PublicSpeech(NamedTuple):
    speaker: str
    content: str


@dataclass
class PersonalEvent:
    content: str
    importance: float = 0.5  # 0.0–1.0


# ---------------------------------------------------------------------------
# 主类
# ---------------------------------------------------------------------------

class CharacterMemory:
    """角色私有记忆，参照 hello-agents MemoryManager 的分层思想。

    working_memory  —— 短期，滑动窗口，存放最近公开对话（所有人可见信息）
    personal_log    —— 私有事件日志（搜证发现、自己说了什么、推理笔记）
    suspicion_map   —— {角色名: 怀疑度 0.0-1.0}
    """

    # 工作记忆窗口大小（条）——覆盖 DISCUSSION/INVESTIGATION 阶段的 N×5 轮对话
    WORKING_CAPACITY = 30
    # 私有日志最大条数（超出时按重要性淘汰最低的）
    PERSONAL_LOG_CAPACITY = 60

    def __init__(self) -> None:
        self._working: deque[PublicSpeech] = deque(maxlen=self.WORKING_CAPACITY)
        self._personal_log: list[PersonalEvent] = []
        self.suspicion_map: dict[str, float] = {}

    # ------------------------------------------------------------------
    # 写入接口（参照 hello-agents _save_conversation_to_memory）
    # ------------------------------------------------------------------

    def observe_public_speech(self, speaker: str, content: str) -> None:
        """观察一条公开发言并存入工作记忆。"""
        self._working.append(PublicSpeech(speaker=speaker, content=content))

    def record_personal_event(self, content: str, importance: float = 0.5) -> None:
        """记录私有事件（自己的行动/发现/推理）。

        当容量超出时，淘汰重要性最低的条目。
        """
        self._personal_log.append(PersonalEvent(content=content, importance=importance))
        if len(self._personal_log) > self.PERSONAL_LOG_CAPACITY:
            # 按重要性升序排序，移除最不重要的
            self._personal_log.sort(key=lambda e: e.importance)
            self._personal_log.pop(0)

    def update_suspicion(self, target: str, delta: float) -> None:
        """更新对某角色的怀疑度，值被钳制在 [0.0, 1.0]。"""
        current = self.suspicion_map.get(target, 0.3)  # 初始中性值
        self.suspicion_map[target] = max(0.0, min(1.0, current + delta))

    # ------------------------------------------------------------------
    # 读取接口（供 PhaseDirector 构建 user message）
    # ------------------------------------------------------------------

    def recall_working(self, limit: int | None = None) -> str:
        """返回格式化的工作记忆字符串（最近公开对话）。"""
        entries = list(self._working)
        if limit:
            entries = entries[-limit:]
        if not entries:
            return ""
        lines = [f"{s.speaker}: {s.content}" for s in entries]
        return "**最近的公开对话：**\n" + "\n".join(lines)

    def recall_personal(self, limit: int = 8) -> str:
        """返回格式化的私有事件日志（按时间顺序，取最近 N 条）。"""
        entries = self._personal_log[-limit:] if self._personal_log else []
        if not entries:
            return ""
        lines = [f"- {e.content}" for e in entries]
        return "**我的行动记录：**\n" + "\n".join(lines)

    def recall_suspicions(self) -> str:
        """返回格式化的怀疑度摘要（仅保留非零条目）。"""
        suspects = {k: v for k, v in self.suspicion_map.items() if v > 0.0}
        if not suspects:
            return ""
        sorted_suspects = sorted(suspects.items(), key=lambda x: -x[1])
        lines = [
            f"- {name}：{'高度怀疑' if score >= 0.7 else '有所怀疑' if score >= 0.4 else '轻微怀疑'}"
            for name, score in sorted_suspects
        ]
        return "**我目前的怀疑对象：**\n" + "\n".join(lines)

    def build_memory_context(self, include_suspicions: bool = True) -> str:
        """组合全部记忆上下文，供注入 user message。

        参照 hello-agents NPCAgentManager._build_memory_context()。
        """
        parts: list[str] = []

        personal = self.recall_personal()
        if personal:
            parts.append(personal)

        if include_suspicions:
            suspicions = self.recall_suspicions()
            if suspicions:
                parts.append(suspicions)

        working = self.recall_working()
        if working:
            parts.append(working)

        return "\n\n".join(parts)
