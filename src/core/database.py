"""数据库连接和配置管理"""
import os
import asyncpg # type: ignore
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

class DatabaseConfig:
    """数据库配置"""
    
    def __init__(self):
        self.host = os.getenv("DB_HOST", "localhost")
        self.port = int(os.getenv("DB_PORT", "5432"))
        self.database = os.getenv("DB_NAME", "jubensha")
        self.username = os.getenv("DB_USER", "postgres")
        self.password = os.getenv("DB_PASSWORD", "")
        self.min_connections = int(os.getenv("DB_MIN_CONNECTIONS", "5"))
        self.max_connections = int(os.getenv("DB_MAX_CONNECTIONS", "20"))
    
    @property
    def dsn(self) -> str:
        """获取数据库连接字符串"""
        return f"postgresql://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}"
    
    @property
    def default_dsn(self) -> str:
        """获取默认数据库连接字符串"""
        return f"postgresql://{self.username}:{self.password}@{self.host}:{self.port}/postgres"

class DatabaseManager:
    """数据库连接管理器"""
    
    def __init__(self):
        self.config = DatabaseConfig()
        self.pool: Optional[asyncpg.Pool] = None
    
    async def create_database_if_not_exists(self):
        """如果数据库不存在则创建"""
        try:
            # 连接到默认数据库
            conn = await asyncpg.connect(self.config.default_dsn)
            
            # 检查数据库是否存在
            result = await conn.fetch(
                "SELECT 1 FROM pg_database WHERE datname = $1",
                self.config.database
            )
            
            if not result:
                # 创建数据库
                await conn.execute(f"CREATE DATABASE {self.config.database}")
                print(f"✅ 数据库 {self.config.database} 创建成功")
            
            await conn.close()
        except Exception as e:
            print(f"❌ 创建数据库失败: {e}")
            raise
    
    async def initialize(self):
        """初始化数据库连接池"""
        try:
            # 先确保数据库存在
            await self.create_database_if_not_exists()
            
            self.pool = await asyncpg.create_pool(
                self.config.dsn,
                min_size=self.config.min_connections,
                max_size=self.config.max_connections
            )
            print(f"✅ 数据库连接池已初始化 ({self.config.host}:{self.config.port})")
        except Exception as e:
            print(f"❌ 数据库连接失败: {e}")
            raise
    
    async def close(self):
        """关闭数据库连接池"""
        if self.pool:
            await self.pool.close()
            print("✅ 数据库连接池已关闭")
    
    @asynccontextmanager
    async def get_connection(self):
        """获取数据库连接"""
        if not self.pool:
            raise RuntimeError("数据库连接池未初始化")
        
        async with self.pool.acquire() as connection:
            yield connection
    
    async def execute_query(self, query: str, *args) -> list:
        """执行查询语句"""
        async with self.get_connection() as conn:
            return await conn.fetch(query, *args)
    
    async def execute_command(self, command: str, *args) -> str:
        """执行命令语句"""
        async with self.get_connection() as conn:
            return await conn.execute(command, *args)
    
    async def execute_transaction(self, commands: list) -> bool:
        """执行事务"""
        async with self.get_connection() as conn:
            async with conn.transaction():
                try:
                    for command, args in commands:
                        await conn.execute(command, *args)
                    return True
                except Exception as e:
                    print(f"事务执行失败: {e}")
                    return False

# 全局数据库管理器实例
db_manager = DatabaseManager()

# 数据库初始化SQL
INIT_SQL = """
-- 创建剧本信息表
CREATE TABLE IF NOT EXISTS scripts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    author VARCHAR(100),
    player_count INTEGER DEFAULT 4,
    duration_minutes INTEGER DEFAULT 120,
    difficulty VARCHAR(20) DEFAULT '中等',
    tags TEXT[], -- PostgreSQL数组类型
    status VARCHAR(20) DEFAULT 'draft',
    cover_image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建角色表
CREATE TABLE IF NOT EXISTS characters (
    id SERIAL PRIMARY KEY,
    script_id INTEGER REFERENCES scripts(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    age INTEGER,
    profession VARCHAR(100),
    background TEXT,
    secret TEXT,
    objective TEXT,
    gender VARCHAR(10) DEFAULT '中性',
    is_murderer BOOLEAN DEFAULT FALSE,
    is_victim BOOLEAN DEFAULT FALSE,
    personality_traits TEXT[],
    avatar_url TEXT,
    voice_preference VARCHAR(50),
    voice_id VARCHAR(100)
);

-- 创建证据表
CREATE TABLE IF NOT EXISTS evidence (
    id SERIAL PRIMARY KEY,
    script_id INTEGER REFERENCES scripts(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    description TEXT,
    related_to VARCHAR(100),
    significance TEXT,
    evidence_type VARCHAR(20) DEFAULT 'physical',
    importance VARCHAR(20) DEFAULT '重要证据',
    image_url TEXT,
    is_hidden BOOLEAN DEFAULT FALSE
);

-- 创建场景表
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    script_id INTEGER REFERENCES scripts(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    searchable_items TEXT[],
    background_image_url TEXT,
    is_crime_scene BOOLEAN DEFAULT FALSE
);

-- 创建背景故事表
CREATE TABLE IF NOT EXISTS background_stories (
    id SERIAL PRIMARY KEY,
    script_id INTEGER REFERENCES scripts(id) ON DELETE CASCADE,
    title VARCHAR(255),
    setting_description TEXT,
    incident_description TEXT,
    victim_background TEXT,
    investigation_scope TEXT,
    rules_reminder TEXT,
    murder_method VARCHAR(100),
    murder_location VARCHAR(255),
    discovery_time VARCHAR(100),
    victory_conditions JSONB
);

-- 创建游戏阶段表
CREATE TABLE IF NOT EXISTS game_phases (
    id SERIAL PRIMARY KEY,
    script_id INTEGER REFERENCES scripts(id) ON DELETE CASCADE,
    phase VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    order_index INTEGER DEFAULT 0
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_characters_script_id ON characters(script_id);
CREATE INDEX IF NOT EXISTS idx_evidence_script_id ON evidence(script_id);
CREATE INDEX IF NOT EXISTS idx_locations_script_id ON locations(script_id);
CREATE INDEX IF NOT EXISTS idx_scripts_status ON scripts(status);
CREATE INDEX IF NOT EXISTS idx_scripts_author ON scripts(author);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_scripts_updated_at BEFORE UPDATE ON scripts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
"""

async def initialize_database():
    """初始化数据库表结构"""
    await db_manager.initialize()
    
    try:
        async with db_manager.get_connection() as conn:
            await conn.execute(INIT_SQL)
        print("✅ 数据库表结构初始化完成")
    except Exception as e:
        print(f"❌ 数据库初始化失败: {e}")
        raise