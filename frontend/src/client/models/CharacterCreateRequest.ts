/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * 角色创建请求模型
 */
export type CharacterCreateRequest = {
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
    name: string;
    /**
     * 角色背景
     */
    background?: (string | null);
    /**
     * 性别
     */
    gender: string;
    /**
     * 年龄
     */
    age: number;
    /**
     * 职业
     */
    profession?: (string | null);
    /**
     * 秘密
     */
    secret?: (string | null);
    /**
     * 目标
     */
    objective?: (string | null);
    /**
     * 是否为受害者
     */
    is_victim?: (boolean | null);
    /**
     * 是否为凶手
     */
    is_murderer?: (boolean | null);
    /**
     * 性格特征
     */
    personality_traits?: (Array<string> | null);
    /**
     * 头像URL
     */
    avatar_url?: (string | null);
    /**
     * 语音ID
     */
    voice_id?: (string | null);
    /**
     * 语音偏好
     */
    voice_preference?: (string | null);
};

