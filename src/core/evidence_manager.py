"""证据管理器"""
from typing import Dict, List, Optional

class EvidenceManager:
    """证据管理器"""
    
    def __init__(self, evidence_data: List[Dict]):
        self.evidence = evidence_data
        self.discovered_evidence = []
    
    def process_evidence_search(self, action: str, character: str) -> Optional[Dict]:
        """处理搜证行动，判断是否发现证据"""
        action_lower = action.lower()
        
        for evidence in self.evidence:
            # 检查是否已经被发现
            if evidence["id"] in [e["id"] for e in self.discovered_evidence]:
                continue
                
            # 检查行动中是否提到了证据的位置
            location_keywords = evidence["location"].lower().split()
            if any(keyword in action_lower for keyword in location_keywords):
                # 发现证据
                self.discovered_evidence.append(evidence)
                return evidence
                
        return None
    
    def get_discovered_evidence(self) -> List[Dict]:
        """获取已发现的证据"""
        return self.discovered_evidence
    
    def get_undiscovered_evidence(self) -> List[Dict]:
        """获取未发现的证据"""
        discovered_ids = [e["id"] for e in self.discovered_evidence]
        return [e for e in self.evidence if e["id"] not in discovered_ids]
    
    def get_evidence_by_location(self, location: str) -> List[Dict]:
        """根据位置获取证据"""
        return [e for e in self.evidence if location.lower() in e["location"].lower()]