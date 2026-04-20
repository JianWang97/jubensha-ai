"""证据管理器 — 搜证阶段的核心逻辑。

改进点：
  1. 基于已知地点列表进行精确匹配，避免误识别
  2. 追踪每个地点由谁搜查、已发现哪些证据
  3. 搜证结果返回 (found_list, location)，允许"零收获"提示
  4. 支持同一地点有多条证据（一次搜查全部揭示）
  5. 每轮搜证可重置地点状态（多轮搜证场景）
"""
from typing import Dict, List, Optional, Tuple


class EvidenceManager:
    """证据管理器"""

    def __init__(self, evidence_data: List[Dict], locations_data: Optional[List[Dict]] = None):
        self.evidence: List[Dict] = evidence_data
        self.discovered_evidence: List[Dict] = []
        # {location_name → searcher_name}
        self.searched_locations: Dict[str, str] = {}

        # 构建已知地点集合（用于精确匹配）
        self._known_locations: List[str] = []
        if locations_data:
            for loc in locations_data:
                name = loc.get("name", "").strip()
                if name and name not in self._known_locations:
                    self._known_locations.append(name)
        # 补充证据本身带的地点
        for ev in evidence_data:
            loc = ev.get("location", "").strip()
            if loc and loc not in self._known_locations:
                self._known_locations.append(loc)

    # ------------------------------------------------------------------
    # 主接口
    # ------------------------------------------------------------------

    def process_evidence_search(
        self, action: str, character: str
    ) -> Tuple[List[Dict], Optional[str]]:
        """处理一次搜证行动。

        Returns:
            (found_evidence_list, searched_location_name)
            - found_evidence_list: 本次新发现的证据列表（可为空）
            - searched_location_name: 解析出的地点名称（None 表示无法识别地点）
        """
        if not action:
            return [], None

        location = self._extract_location(action)
        if not location:
            return [], None

        # 标记为已搜查（即使没有找到证据）
        self.searched_locations[location] = character

        # 找出该地点所有未发现的证据
        discovered_ids = {e["id"] for e in self.discovered_evidence}
        found: List[Dict] = []
        for evidence in self.evidence:
            if evidence["id"] in discovered_ids:
                continue
            if self._location_matches(evidence.get("location", ""), location):
                item = dict(evidence)
                item["discoverer"] = character
                self.discovered_evidence.append(item)
                found.append(item)

        return found, location

    def reset_for_new_round(self) -> None:
        """重置地点搜查状态（用于多轮搜证），已发现证据不清除。"""
        self.searched_locations = {}

    # ------------------------------------------------------------------
    # 查询接口
    # ------------------------------------------------------------------

    def get_discovered_evidence(self) -> List[Dict]:
        return self.discovered_evidence

    def get_undiscovered_evidence(self) -> List[Dict]:
        discovered_ids = {e["id"] for e in self.discovered_evidence}
        return [e for e in self.evidence if e["id"] not in discovered_ids]

    def get_available_locations(self) -> List[str]:
        """返回尚未搜查的地点列表。"""
        return [loc for loc in self._known_locations if loc not in self.searched_locations]

    def get_location_search_status(self) -> Dict[str, str]:
        """返回 {location_name: searcher_name} 的搜查状态字典。"""
        return dict(self.searched_locations)

    def get_evidence_by_location(self, location: str) -> List[Dict]:
        """根据地点名称查询证据（含已发现和未发现）。"""
        if not location:
            return []
        return [e for e in self.evidence if self._location_matches(e.get("location", ""), location)]

    # ------------------------------------------------------------------
    # 内部辅助
    # ------------------------------------------------------------------

    def _extract_location(self, action: str) -> Optional[str]:
        """从行动文本中提取地点名称（最长优先匹配）。"""
        action_lower = action.lower()
        best: Optional[str] = None
        best_len = 0
        for loc in self._known_locations:
            loc_lower = loc.lower()
            if loc_lower in action_lower and len(loc_lower) > best_len:
                best = loc
                best_len = len(loc_lower)
        return best

    @staticmethod
    def _location_matches(evidence_location: str, searched_location: str) -> bool:
        """判断证据的地点与搜查地点是否匹配（双向包含）。"""
        ev_lower = evidence_location.lower().strip()
        search_lower = searched_location.lower().strip()
        return search_lower in ev_lower or ev_lower in search_lower
