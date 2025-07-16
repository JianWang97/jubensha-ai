"""剧本数据访问层"""
from typing import List, Optional, Dict, Any
from ..models.script import (
    Script, ScriptInfo, ScriptCharacter, ScriptEvidence, 
    ScriptLocation, ScriptStatus, EvidenceType
)
from .database import db_manager
from datetime import datetime

class ScriptRepository:
    """剧本数据访问层"""
    
    async def create_script(self, script: Script) -> int:
        """创建新剧本"""
        async with db_manager.get_connection() as conn:
            async with conn.transaction():
                # 插入剧本基本信息
                script_id = await conn.fetchval(
                    """
                    INSERT INTO scripts (title, description, author, player_count, 
                                       duration_minutes, difficulty, tags, status, cover_image_url)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    RETURNING id
                    """,
                    script.info.title, script.info.description, script.info.author,
                    script.info.player_count, script.info.duration_minutes,
                    script.info.difficulty, script.info.tags, script.info.status.value,
                    script.info.cover_image_url
                )
                
                # 插入背景故事
                if script.background_story:
                    await conn.execute(
                        """
                        INSERT INTO background_stories (script_id, title, setting_description,
                                                       incident_description, victim_background,
                                                       investigation_scope, rules_reminder)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                        """,
                        script_id,
                        script.background_story.get("title", ""),
                        script.background_story.get("setting_description", ""),
                        script.background_story.get("incident_description", ""),
                        script.background_story.get("victim_background", ""),
                        script.background_story.get("investigation_scope", ""),
                        script.background_story.get("rules_reminder", "")
                    )
                
                # 插入角色
                for character in script.characters:
                    await conn.execute(
                        """
                        INSERT INTO characters (script_id, name, age, profession, background,
                                              secret, objective, gender, is_murderer, is_victim,
                                              personality_traits, avatar_url, voice_preference)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                        """,
                        script_id, character.name, character.age, character.profession,
                        character.background, character.secret, character.objective,
                        character.gender, character.is_murderer, character.is_victim,
                        character.personality_traits, character.avatar_url, character.voice_preference
                    )
                
                # 插入证据
                for evidence in script.evidence:
                    await conn.execute(
                        """
                        INSERT INTO evidence (script_id, name, location, description, related_to,
                                            significance, evidence_type, importance, image_url, is_hidden)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                        """,
                        script_id, evidence.name, evidence.location, evidence.description,
                        evidence.related_to, evidence.significance, evidence.evidence_type.value,
                        evidence.importance, evidence.image_url, evidence.is_hidden
                    )
                
                # 插入场景
                for location in script.locations:
                    await conn.execute(
                        """
                        INSERT INTO locations (script_id, name, description, searchable_items,
                                             background_image_url, is_crime_scene)
                        VALUES ($1, $2, $3, $4, $5, $6)
                        """,
                        script_id, location.name, location.description, location.searchable_items,
                        location.background_image_url, location.is_crime_scene
                    )
                
                # 插入游戏阶段
                for i, phase in enumerate(script.game_phases):
                    await conn.execute(
                        """
                        INSERT INTO game_phases (script_id, phase, name, description, order_index)
                        VALUES ($1, $2, $3, $4, $5)
                        """,
                        script_id, phase.get("phase", ""), phase.get("name", ""),
                        phase.get("description", ""), i
                    )
                
                return script_id
    
    async def get_script_by_id(self, script_id: int) -> Optional[Script]:
        """根据ID获取剧本"""
        async with db_manager.get_connection() as conn:
            # 获取剧本基本信息
            script_row = await conn.fetchrow(
                "SELECT * FROM scripts WHERE id = $1", script_id
            )
            
            if not script_row:
                return None
            
            # 构建剧本信息
            script_info = ScriptInfo(
                id=script_row["id"],
                title=script_row["title"],
                description=script_row["description"],
                author=script_row["author"],
                player_count=script_row["player_count"],
                duration_minutes=script_row["duration_minutes"],
                difficulty=script_row["difficulty"],
                tags=script_row["tags"] or [],
                status=ScriptStatus(script_row["status"]),
                created_at=script_row["created_at"],
                updated_at=script_row["updated_at"],
                cover_image_url=script_row["cover_image_url"]
            )
            
            # 获取背景故事
            background_row = await conn.fetchrow(
                "SELECT * FROM background_stories WHERE script_id = $1", script_id
            )
            background_story = {}
            if background_row:
                background_story = {
                    "title": background_row["title"],
                    "setting_description": background_row["setting_description"],
                    "incident_description": background_row["incident_description"],
                    "victim_background": background_row["victim_background"],
                    "investigation_scope": background_row["investigation_scope"],
                    "rules_reminder": background_row["rules_reminder"],
                    "murder_method": background_row.get("murder_method", ""),
                    "murder_location": background_row.get("murder_location", ""),
                    "discovery_time": background_row.get("discovery_time", ""),
                    "victory_conditions": background_row.get("victory_conditions", {})
                }
            
            # 获取角色
            character_rows = await conn.fetch(
                "SELECT * FROM characters WHERE script_id = $1 ORDER BY id", script_id
            )
            characters = []
            for row in character_rows:
                character = ScriptCharacter(
                    id=row["id"],
                    script_id=row["script_id"],
                    name=row["name"],
                    age=row["age"],
                    profession=row["profession"],
                    background=row["background"],
                    secret=row["secret"],
                    objective=row["objective"],
                    gender=row["gender"],
                    is_murderer=row["is_murderer"],
                    is_victim=row["is_victim"],
                    personality_traits=row["personality_traits"] or [],
                    avatar_url=row["avatar_url"],
                    voice_preference=row["voice_preference"],
                    voice_id=row["voice_id"]
                )
                characters.append(character)
            
            # 获取证据
            evidence_rows = await conn.fetch(
                "SELECT * FROM evidence WHERE script_id = $1 ORDER BY id", script_id
            )
            evidence_list = []
            for row in evidence_rows:
                evidence = ScriptEvidence(
                    id=row["id"],
                    script_id=row["script_id"],
                    name=row["name"],
                    location=row["location"],
                    description=row["description"],
                    related_to=row["related_to"],
                    significance=row["significance"],
                    evidence_type=EvidenceType(row["evidence_type"]),
                    importance=row["importance"],
                    image_url=row["image_url"],
                    is_hidden=row["is_hidden"]
                )
                evidence_list.append(evidence)
            
            # 获取场景
            location_rows = await conn.fetch(
                "SELECT * FROM locations WHERE script_id = $1 ORDER BY id", script_id
            )
            locations = []
            for row in location_rows:
                location = ScriptLocation(
                    id=row["id"],
                    script_id=row["script_id"],
                    name=row["name"],
                    description=row["description"],
                    searchable_items=row["searchable_items"] or [],
                    background_image_url=row["background_image_url"],
                    is_crime_scene=row["is_crime_scene"]
                )
                locations.append(location)
            
            # 获取游戏阶段
            phase_rows = await conn.fetch(
                "SELECT * FROM game_phases WHERE script_id = $1 ORDER BY order_index", script_id
            )
            game_phases = []
            for row in phase_rows:
                phase = {
                    "phase": row["phase"],
                    "name": row["name"],
                    "description": row["description"]
                }
                game_phases.append(phase)
            
            return Script(
                info=script_info,
                background_story=background_story,
                characters=characters,
                evidence=evidence_list,
                locations=locations,
                game_phases=game_phases
            )
    
    async def get_scripts_list(self, status: Optional[ScriptStatus] = None, 
                              author: Optional[str] = None,
                              limit: int = 20, offset: int = 0) -> List[ScriptInfo]:
        """获取剧本列表"""
        query = "SELECT * FROM scripts WHERE 1=1"
        params = []
        
        if status:
            query += " AND status = $" + str(len(params) + 1)
            params.append(status.value)
        
        if author:
            query += " AND author = $" + str(len(params) + 1)
            params.append(author)
        
        query += " ORDER BY updated_at DESC LIMIT $" + str(len(params) + 1)
        params.append(limit)
        query += " OFFSET $" + str(len(params) + 1)
        params.append(offset)
        
        rows = await db_manager.execute_query(query, *params)
        
        scripts = []
        for row in rows:
            script_info = ScriptInfo(
                id=row["id"],
                title=row["title"],
                description=row["description"],
                author=row["author"],
                player_count=row["player_count"],
                duration_minutes=row["duration_minutes"],
                difficulty=row["difficulty"],
                tags=row["tags"] or [],
                status=ScriptStatus(row["status"]),
                created_at=row["created_at"],
                updated_at=row["updated_at"],
                cover_image_url=row["cover_image_url"]
            )
            scripts.append(script_info)
        
        return scripts
    
    async def update_script(self, script_id: int, script: Script) -> bool:
        """更新剧本"""
        try:
            async with db_manager.get_connection() as conn:
                async with conn.transaction():
                    # 更新剧本基本信息
                    await conn.execute(
                        """
                        UPDATE scripts SET title = $2, description = $3, author = $4,
                                         player_count = $5, duration_minutes = $6,
                                         difficulty = $7, tags = $8, status = $9,
                                         cover_image_url = $10
                        WHERE id = $1
                        """,
                        script_id, script.info.title, script.info.description,
                        script.info.author, script.info.player_count,
                        script.info.duration_minutes, script.info.difficulty,
                        script.info.tags, script.info.status.value,
                        script.info.cover_image_url
                    )
                    
                    # 删除旧数据
                    await conn.execute("DELETE FROM characters WHERE script_id = $1", script_id)
                    await conn.execute("DELETE FROM evidence WHERE script_id = $1", script_id)
                    await conn.execute("DELETE FROM locations WHERE script_id = $1", script_id)
                    await conn.execute("DELETE FROM game_phases WHERE script_id = $1", script_id)
                    await conn.execute("DELETE FROM background_stories WHERE script_id = $1", script_id)
                    
                    # 重新插入数据（复用创建逻辑的部分代码）
                    # 这里可以优化为增量更新，但为了简化先采用删除重建的方式
                    
            return True
        except Exception as e:
            print(f"更新剧本失败: {e}")
            return False
    
    async def update_cover_image_url(self, script_id: int, image_url: str) -> bool:
        """更新剧本封面图片URL"""
        try:
            await db_manager.execute_command(
                "UPDATE scripts SET cover_image_url = $2 WHERE id = $1",
                script_id, image_url
            )
            return True
        except Exception as e:
            print(f"更新封面图片URL失败: {e}")
            return False
    
    async def update_character_avatar_url(self, character_id: int, avatar_url: str) -> bool:
        """更新角色头像URL"""
        try:
            await db_manager.execute_command(
                "UPDATE characters SET avatar_url = $2 WHERE id = $1",
                character_id, avatar_url
            )
            return True
        except Exception as e:
            print(f"更新角色头像URL失败: {e}")
            return False
    
    async def update_evidence_image_url(self, evidence_id: int, image_url: str) -> bool:
        """更新证据图片URL"""
        try:
            await db_manager.execute_command(
                "UPDATE evidence SET image_url = $2 WHERE id = $1",
                evidence_id, image_url
            )
            return True
        except Exception as e:
            print(f"更新证据图片URL失败: {e}")
            return False
    
    async def update_location_background_url(self, location_id: int, background_url: str) -> bool:
        """更新场景背景图片URL"""
        try:
            await db_manager.execute_command(
                "UPDATE locations SET background_image_url = $2 WHERE id = $1",
                location_id, background_url
            )
            return True
        except Exception as e:
            print(f"更新场景背景图片URL失败: {e}")
            return False

    async def delete_script(self, script_id: int) -> bool:
        """删除剧本"""
        try:
            result = await db_manager.execute_command(
                "DELETE FROM scripts WHERE id = $1", script_id
            )
            return "DELETE 1" in result
        except Exception as e:
            print(f"删除剧本失败: {e}")
            return False
    
    async def search_scripts(self, keyword: str, limit: int = 20) -> List[ScriptInfo]:
        """搜索剧本"""
        query = """
        SELECT * FROM scripts 
        WHERE title ILIKE $1 OR description ILIKE $1 OR author ILIKE $1
        ORDER BY updated_at DESC
        LIMIT $2
        """
        
        rows = await db_manager.execute_query(query, f"%{keyword}%", limit)
        
        scripts = []
        for row in rows:
            script_info = ScriptInfo(
                id=row["id"],
                title=row["title"],
                description=row["description"],
                author=row["author"],
                player_count=row["player_count"],
                duration_minutes=row["duration_minutes"],
                difficulty=row["difficulty"],
                tags=row["tags"] or [],
                status=ScriptStatus(row["status"]),
                created_at=row["created_at"],
                updated_at=row["updated_at"],
                cover_image_url=row["cover_image_url"]
            )
            scripts.append(script_info)
        
        return scripts
    
    async def get_script_stats(self) -> Dict[str, Any]:
        """获取剧本统计信息"""
        async with db_manager.get_connection() as conn:
            # 总数统计
            total_scripts = await conn.fetchval("SELECT COUNT(*) FROM scripts")
            
            # 状态统计
            status_stats = await conn.fetch(
                "SELECT status, COUNT(*) as count FROM scripts GROUP BY status"
            )
            
            # 作者统计
            author_stats = await conn.fetch(
                "SELECT author, COUNT(*) as count FROM scripts GROUP BY author ORDER BY count DESC LIMIT 10"
            )
            
            return {
                "total_scripts": total_scripts,
                "status_distribution": {row["status"]: row["count"] for row in status_stats},
                "top_authors": [{"author": row["author"], "count": row["count"]} for row in author_stats]
            }

    async def get_all_scripts(self) -> List[Dict]:
        """获取所有剧本的简要信息"""
        query = "SELECT id, title, description, author, player_count, difficulty, status FROM scripts ORDER BY updated_at DESC"
        rows = await db_manager.execute_query(query)
        
        scripts = []
        for row in rows:
            scripts.append({
                'id': row['id'],
                'title': row['title'],
                'description': row['description'],
                'author': row['author'],
                'player_count': row['player_count'],
                'difficulty': row['difficulty'],
                'status': row['status'],
            })
        return scripts
    
    async def get_script_characters(self, script_id: int) -> List[Dict]:
        """获取指定剧本的角色信息"""
        query = "SELECT * FROM characters WHERE script_id = $1 ORDER BY id"
        rows = await db_manager.execute_query(query, script_id)
        
        characters = []
        for row in rows:
            characters.append({
                'id': row['id'],
                'name': row['name'],
                'background': row['background'],
                'gender': row['gender'],
                'age': row['age'],
                'profession': row['profession'],
                'secret': row['secret'],
                'objective': row['objective'],
                'is_victim': row['is_victim'],
                'is_murderer': row['is_murderer'],
                'personality_traits': row['personality_traits'],
                'avatar_url': row['avatar_url']
            })
        return characters
    
    async def get_script_background(self, script_id: int) -> str:
        """获取指定剧本的背景故事"""
        query = "SELECT setting_description FROM background_stories WHERE script_id = $1 LIMIT 1"
        row = await db_manager.execute_query(query, script_id)
        if row:
            return row[0]['setting_description']
        return ""
    
    async def create_script(self, script_info: Dict) -> int:
        """创建剧本（简化版本，只创建基本信息）"""
        query = """
        INSERT INTO scripts (title, description, player_count, difficulty, 
                           duration_minutes, tags, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
        """
        
        result = await db_manager.execute_query(
            query,
            script_info['title'],
            script_info['description'],
            script_info['player_count'],
            script_info['difficulty'],
            script_info.get('estimated_time', 120),  # 使用duration_minutes字段
            script_info['tags'],
            script_info['status']
        )
        return result[0]['id']
    
    async def create_background_story(self, background_data: Dict) -> None:
        """创建背景故事"""
        script_id = background_data['script_id']
        
        # 如果content是JSON字符串，解析它
        content = background_data.get('content', {})
        if isinstance(content, str):
            try:
                import json
                content = json.loads(content)
            except json.JSONDecodeError:
                content = {}
        
        # 如果content不是字典，创建一个默认结构
        if not isinstance(content, dict):
            content = {'setting_description': str(content)}
        
        query = """
        INSERT INTO background_stories (
            script_id, title, setting_description, incident_description,
            victim_background, investigation_scope, rules_reminder,
            murder_method, murder_location, discovery_time, victory_conditions
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        """
        
        # 处理victory_conditions，确保它是JSONB格式
        victory_conditions = content.get('victory_conditions', {})
        if isinstance(victory_conditions, dict):
            import json
            victory_conditions = json.dumps(victory_conditions, ensure_ascii=False)
        
        await db_manager.execute_command(
            query,
            script_id,
            content.get('title', ''),
            content.get('setting_description', ''),
            content.get('incident_description', ''),
            content.get('victim_background', ''),
            content.get('investigation_scope', ''),
            content.get('rules_reminder', ''),
            content.get('murder_method', ''),
            content.get('murder_location', ''),
            content.get('discovery_time', ''),
            victory_conditions
        )
    
    async def create_character(self, character_data: Dict) -> None:
        """创建角色"""
        query = """
        INSERT INTO characters (script_id, name, background, gender, age, 
                              profession, secret, objective, 
                              is_victim, is_murderer, personality_traits)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        """
        await db_manager.execute_command(
            query,
            character_data['script_id'],
            character_data['name'],
            character_data.get('background') or character_data.get('background_story', ''),
            character_data['gender'],
            character_data.get('age'),
            character_data.get('profession') or character_data.get('occupation', ''),
            character_data.get('secret') or '',
            character_data.get('objective') or character_data.get('motivation', ''),
            character_data['is_victim'],
            character_data['is_murderer'],
            character_data.get('personality_traits', [])
        )
    
    async def update_character(self, character_id: int, character_data: Dict) -> bool:
        """更新角色"""
        try:
            # 构建动态更新查询
            set_clauses = []
            params = [character_id]
            param_index = 2
            
            for field, value in character_data.items():
                if field == 'name':
                    set_clauses.append(f"name = ${param_index}")
                elif field == 'age':
                    set_clauses.append(f"age = ${param_index}")
                elif field == 'profession':
                    set_clauses.append(f"profession = ${param_index}")
                elif field == 'background':
                    set_clauses.append(f"background = ${param_index}")
                elif field == 'secret':
                    set_clauses.append(f"secret = ${param_index}")
                elif field == 'objective':
                    set_clauses.append(f"objective = ${param_index}")
                elif field == 'gender':
                    set_clauses.append(f"gender = ${param_index}")
                elif field == 'is_murderer':
                    set_clauses.append(f"is_murderer = ${param_index}")
                elif field == 'is_victim':
                    set_clauses.append(f"is_victim = ${param_index}")
                elif field == 'personality_traits':
                    set_clauses.append(f"personality_traits = ${param_index}")
                elif field == 'avatar_url':
                    set_clauses.append(f"avatar_url = ${param_index}")
                elif field == 'voice_id':
                    set_clauses.append(f"voice_id = ${param_index}")
                else:
                    continue  # 跳过不支持的字段
                
                params.append(value)
                param_index += 1
            
            if not set_clauses:
                return False
            
            query = f"UPDATE characters SET {', '.join(set_clauses)} WHERE id = $1"
            await db_manager.execute_command(query, *params)
            return True
        except Exception as e:
            print(f"更新角色失败: {e}")
            return False
    
    async def delete_character(self, character_id: int) -> bool:
        """删除角色"""
        try:
            await db_manager.execute_command(
                "DELETE FROM characters WHERE id = $1", character_id
            )
            return True
        except Exception as e:
            print(f"删除角色失败: {e}")
            return False
    
    async def create_evidence(self, evidence_data: Dict) -> int:
        """创建证据"""
        query = """
        INSERT INTO evidence (script_id, name, description, evidence_type, location, 
                            significance, related_to, importance, is_hidden)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
        """
        result = await db_manager.execute_query(
            query,
            evidence_data['script_id'],
            evidence_data['name'],
            evidence_data['description'],
            evidence_data.get('evidence_type', 'physical'),
            evidence_data.get('location', ''),
            evidence_data.get('significance', ''),
            evidence_data.get('related_to', ''),
            evidence_data.get('importance', '重要证据'),
            evidence_data.get('is_hidden', False)
        )
        return result[0]['id']
    
    async def update_evidence(self, evidence_id: int, evidence_data: Dict) -> bool:
        """更新证据"""
        try:
            query = """
        UPDATE evidence 
        SET name = $2, description = $3, evidence_type = $4, location = $5,
            significance = $6, related_to = $7, importance = $8, is_hidden = $9
        WHERE id = $1
        """
            await db_manager.execute_command(
                query,
                evidence_id,
                evidence_data['name'],
                evidence_data['description'],
                evidence_data.get('evidence_type', 'physical'),
                evidence_data.get('location', ''),
                evidence_data.get('significance', ''),
                evidence_data.get('related_to', ''),
                evidence_data.get('importance', '重要证据'),
                evidence_data.get('is_hidden', False)
            )
            return True
        except Exception as e:
            print(f"更新证据失败: {e}")
            return False
    
    async def delete_evidence(self, evidence_id: int) -> bool:
        """删除证据"""
        try:
            # 先获取证据信息，用于删除关联的图片文件
            evidence_row = await db_manager.execute_query(
                "SELECT image_url FROM evidence WHERE id = $1", evidence_id
            )
            
            # 删除证据记录
            await db_manager.execute_command(
                "DELETE FROM evidence WHERE id = $1", evidence_id
            )
            
            # 如果有图片文件，返回图片URL供调用者删除
            if evidence_row and evidence_row[0]['image_url']:
                return evidence_row[0]['image_url']
            
            return True
        except Exception as e:
            print(f"删除证据失败: {e}")
            return False
    
    async def create_location(self, location_data: Dict) -> None:
        """创建场景"""
        query = """
        INSERT INTO locations (script_id, name, description)
        VALUES ($1, $2, $3)
        """
        await db_manager.execute_command(
            query,
            location_data['script_id'],
            location_data['name'],
            location_data['description']
        )
    
    async def create_game_phase(self, phase_data: Dict) -> None:
        """创建游戏阶段"""
        query = """
        INSERT INTO game_phases (script_id, phase, name, description, order_index)
        VALUES ($1, $2, $3, $4, $5)
        """
        await db_manager.execute_command(
            query,
            phase_data['script_id'],
            phase_data['name'],
            phase_data['name'],
            phase_data['description'],
            phase_data['order_index']
        )

# 全局仓库实例
script_repository = ScriptRepository()