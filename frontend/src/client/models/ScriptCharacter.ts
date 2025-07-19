/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * 剧本角色
 */
export type ScriptCharacter = {
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
     * 剧本ID
     */
    script_id?: (number | null);
    /**
     * 角色姓名
     */
    name?: string;
    /**
     * 年龄
     */
    age?: (number | null);
    /**
     * 职业
     */
    profession?: string;
    /**
     * 背景故事
     */
    background?: string;
    /**
     * 秘密
     */
    secret?: string;
    /**
     * 目标
     */
    objective?: string;
    /**
     * 性别
     */
    gender?: string;
    /**
     * 是否为凶手
     */
    is_murderer?: boolean;
    /**
     * 是否为受害者
     */
    is_victim?: boolean;
    /**
     * 性格特征
     */
    personality_traits?: Array<string>;
    /**
     * 头像URL
     */
    avatar_url?: (string | null);
    /**
     * 语音偏好
     */
    voice_preference?: (string | null);
    /**
     * TTS声音ID
     */
    voice_id?: (string | null);
};

