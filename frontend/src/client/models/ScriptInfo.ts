/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ScriptStatus } from './ScriptStatus';
/**
 * 剧本基本信息
 */
export type ScriptInfo = {
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
     * 剧本标题
     */
    title?: string;
    /**
     * 剧本描述
     */
    description?: string;
    /**
     * 作者
     */
    author?: (string | null);
    /**
     * 玩家数量
     */
    player_count?: number;
    /**
     * 预计游戏时长(分钟)
     */
    duration_minutes?: number;
    /**
     * 难度等级
     */
    difficulty?: string;
    /**
     * 标签列表
     */
    tags?: Array<string>;
    status?: ScriptStatus;
    /**
     * 封面图片URL
     */
    cover_image_url?: (string | null);
    /**
     * 是否公开
     */
    is_public?: boolean;
    /**
     * 价格
     */
    price?: number;
};

