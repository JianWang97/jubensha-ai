# 剧本杀数据文件结构说明

本文件夹按照数据库表结构重新组织了剧本杀游戏的数据文件，使数据结构更加清晰和规范。

# 数据文件结构说明

本目录包含剧本杀游戏的所有数据文件，采用按剧本分组的组织方式，每个剧本一个文件夹，通过文件后缀区分不同类型的数据。

## 文件夹结构

```
data/
├── README.md                    # 本说明文件
├── business_murder/             # 商业纠纷谋杀案剧本
│   ├── script.json              # 剧本基本信息
│   ├── characters.json          # 角色数据
│   ├── evidence.json            # 证据数据
│   ├── locations.json           # 场所数据
│   ├── background.json          # 背景故事数据
│   └── phases.json              # 游戏阶段数据
└── mansion_mystery/             # 古宅疑云剧本
    ├── script.json              # 剧本基本信息
    ├── characters.json          # 角色数据
    ├── evidence.json            # 证据数据
    ├── locations.json           # 场所数据
    ├── background.json          # 背景故事数据
    └── phases.json              # 游戏阶段数据
```

## 数据表对应关系

### 1. scripts/ - 对应数据库 `scripts` 表
包含剧本的基本信息：
- id: 剧本唯一标识
- title: 剧本标题
- description: 剧本描述
- victim: 受害者
- setting: 场景设定
- max_players: 最大玩家数
- estimated_duration: 预计游戏时长（分钟）
- difficulty_level: 难度等级
- theme: 主题类型
- created_at/updated_at: 创建/更新时间

### 2. characters/ - 对应数据库 `characters` 表
包含角色的详细信息：
- id: 角色唯一标识
- script_id: 所属剧本ID
- name: 角色姓名
- age: 年龄
- gender: 性别
- profession: 职业
- background: 背景故事
- secret: 角色秘密
- objective: 角色目标
- personality_traits: 性格特征
- is_murderer: 是否为凶手
- is_victim: 是否为受害者
- voice: TTS语音配置

### 3. evidence/ - 对应数据库 `evidence` 表
包含证据的详细信息：
- id: 证据唯一标识
- script_id: 所属剧本ID
- name: 证据名称
- description: 证据描述
- location_id: 发现地点ID
- related_character_id: 相关角色ID
- evidence_type: 证据类型
- importance_level: 重要程度
- discovery_phase: 发现阶段
- significance: 证据意义

### 4. locations/ - 对应数据库 `locations` 表
包含场所的详细信息：
- id: 场所唯一标识
- script_id: 所属剧本ID
- name: 场所名称
- description: 场所描述
- searchable_items: 可搜查物品列表
- is_crime_scene: 是否为犯罪现场

### 5. background_stories/ - 对应数据库 `background_stories` 表
包含背景故事的详细信息：
- id: 背景故事唯一标识
- script_id: 所属剧本ID
- title: 故事标题
- setting_description: 场景描述
- incident_description: 事件描述
- victim_background: 受害者背景
- investigation_scope: 调查范围
- rules_reminder: 规则提醒
- murder_method: 谋杀方式
- murder_location: 谋杀地点
- discovery_time: 发现时间
- victory_conditions: 胜利条件

### 6. game_phases/ - 对应数据库 `game_phases` 表
包含游戏阶段的信息：
- id: 阶段唯一标识
- name: 阶段名称
- description: 阶段描述
- order_index: 阶段顺序
- estimated_duration: 预计时长（分钟）

## 优势

1. **结构清晰**: 按照数据库表结构组织，便于理解和维护
2. **数据规范**: 每个文件都有明确的数据结构和字段定义
3. **易于扩展**: 添加新剧本只需按照相同结构创建对应文件
4. **关联明确**: 通过ID字段建立数据间的关联关系
5. **便于查询**: 可以根据需要单独加载特定类型的数据
6. **版本控制友好**: 小文件便于版本控制和协作开发

## 使用说明

1. 添加新剧本时，需要在每个对应文件夹中创建相应的数据文件
2. 所有ID字段必须保持唯一性和一致性
3. script_id字段用于关联不同类型的数据到同一个剧本
4. 文件命名建议使用 `{script_id}_{data_type}.json` 格式
5. 游戏阶段数据可以在多个剧本间共享，如 `standard_phases.json`