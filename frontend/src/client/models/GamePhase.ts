/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GamePhaseEnum } from './GamePhaseEnum';
/**
 * 游戏阶段
 */
export type GamePhase = {
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
     * 阶段标识
     */
    phase?: GamePhaseEnum;
    /**
     * 阶段名称
     */
    name?: string;
    /**
     * 阶段描述
     */
    description?: string;
    /**
     * 排序索引
     */
    order_index?: number;
};

