/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * 角色头像提示词生成请求模型
 */
export type CharacterPromptRequest = {
    /**
     * 记录ID
     */
    id?: (number | null);
    /**
     * 创建时间
     */
    created_at?: (string | null);
    /**
     * 更新时间
     */
    updated_at?: (string | null);
    /**
     * 角色名称
     */
    character_name: string;
    /**
     * 角色描述
     */
    character_description: string;
    /**
     * 年龄
     */
    age?: (number | null);
    /**
     * 性别
     */
    gender?: (string | null);
    /**
     * 职业
     */
    profession?: (string | null);
    /**
     * 性格特征
     */
    personality_traits?: (Array<string> | null);
    /**
     * 剧本背景
     */
    script_context?: (string | null);
};

