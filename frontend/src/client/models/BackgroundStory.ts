/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * 背景故事
 */
export type BackgroundStory = {
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
     * 标题
     */
    title?: string;
    /**
     * 背景设定
     */
    setting_description?: (string | null);
    /**
     * 事件描述
     */
    incident_description?: (string | null);
    /**
     * 受害者背景
     */
    victim_background?: (string | null);
    /**
     * 调查范围
     */
    investigation_scope?: (string | null);
    /**
     * 规则提醒
     */
    rules_reminder?: (string | null);
    /**
     * 作案手法
     */
    murder_method?: (string | null);
    /**
     * 作案地点
     */
    murder_location?: (string | null);
    /**
     * 发现时间
     */
    discovery_time?: (string | null);
    /**
     * 胜利条件
     */
    victory_conditions?: (Record<string, any> | null);
};

