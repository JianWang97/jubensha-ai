"""CharacterMemory 私有日志淘汰的单元测试。

回归点：personal_log 超出容量时，旧实现对整个列表按重要性排序再 pop(0)，
这会**永久**打乱日志的时间顺序；此后 recall_personal() 的“取最近 N 条”
（self._personal_log[-limit:]）实际返回的是“重要性最高的 N 条”，注入 LLM 的
“我的行动记录”不再反映真实的近期事件。

修复：只移除重要性最低的一条，保留其余条目的插入（时间）顺序。
"""
import pytest

from src.agents.character_memory import CharacterMemory

pytestmark = pytest.mark.unit


def _idx(event) -> int:
    """从 'evt-<i>' 内容中取出插入序号。"""
    return int(event.content.split("-")[1])


def test_single_eviction_removes_lowest_importance_and_keeps_order():
    mem = CharacterMemory()
    cap = CharacterMemory.PERSONAL_LOG_CAPACITY

    # 填满容量，唯一一条低重要性事件放在中间位置
    for i in range(cap):
        importance = 0.1 if i == cap // 2 else 0.9
        mem.record_personal_event(f"evt-{i}", importance=importance)

    # 再写一条高重要性事件，触发一次淘汰
    mem.record_personal_event(f"evt-{cap}", importance=0.9)

    contents = [e.content for e in mem._personal_log]
    assert len(contents) == cap
    # 被淘汰的应是那条唯一的最低重要性事件
    assert f"evt-{cap // 2}" not in contents
    # 其余条目保持插入（时间）顺序
    expected = [f"evt-{i}" for i in range(cap) if i != cap // 2] + [f"evt-{cap}"]
    assert contents == expected


def test_many_evictions_preserve_chronological_order():
    """多次淘汰后，存活条目仍按插入顺序排列（旧的整表排序实现会打乱）。"""
    import random

    mem = CharacterMemory()
    cap = CharacterMemory.PERSONAL_LOG_CAPACITY
    rng = random.Random(1)

    for i in range(cap * 3):
        mem.record_personal_event(f"evt-{i}", importance=round(rng.uniform(0.1, 0.9), 2))

    indices = [_idx(e) for e in mem._personal_log]
    assert indices == sorted(indices), "存活条目必须保持插入顺序，不能被重要性排序打乱"
