"""投票管理器"""
from typing import Dict, List, Optional, Any
from ..schemas.script import ScriptCharacter as Character

class VotingManager:
    """投票管理器"""
    
    def __init__(self, characters: List[Character]):
        self.characters = characters
        self.votes: Dict[str, str] = {}
    
    def add_vote(self, voter: str, suspect: str):
        """添加投票"""
        self.votes[voter] = suspect
    
    def get_vote_counts(self) -> Dict[str, int]:
        """获取投票统计"""
        vote_counts: Dict[str, int] = {}
        for vote in self.votes.values():
            vote_counts[vote] = vote_counts.get(vote, 0) + 1
        return vote_counts
    
    def get_most_voted(self) -> Optional[str]:
        """获取得票最多的角色"""
        vote_counts = self.get_vote_counts()
        if not vote_counts:
            return None
        return max(vote_counts.items(), key=lambda x: x[1])[0]
    
    def get_game_result(self) -> Dict[str, Any]:
        """获取游戏结果"""
        murderer = next((char.name for char in self.characters if char.is_murderer), None)
        victim = next((char.name for char in self.characters if char.is_victim), None)
        most_voted = self.get_most_voted()
        vote_counts = self.get_vote_counts()
        
        return {
            "murderer": murderer,
            "victim": victim,
            "most_voted": most_voted,
            "votes": self.votes,
            "vote_counts": vote_counts,
            "success": most_voted == murderer if most_voted else False
        }
    
    def clear_votes(self):
        """清空投票"""
        self.votes = {}