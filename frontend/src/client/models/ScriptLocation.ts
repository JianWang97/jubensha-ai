/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * 剧本场景
 */
export type ScriptLocation = {
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
     * 场景名称
     */
    name?: string;
    /**
     * 场景描述
     */
    description?: string;
    /**
     * 可搜索物品
     */
    searchable_items?: Array<string>;
    /**
     * 背景图片URL
     */
    background_image_url?: (string | null);
    /**
     * 是否为案发现场
     */
    is_crime_scene?: boolean;
};

