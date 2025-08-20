/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GameSessionDeleteFailedItem } from './GameSessionDeleteFailedItem';
/**
 * 删除游戏会话响应模式
 */
export type GameSessionDeleteResponse = {
    /**
     * 成功删除的会话ID列表
     */
    success?: Array<string>;
    /**
     * 删除失败的会话列表
     */
    failed?: Array<GameSessionDeleteFailedItem>;
    /**
     * 请求删除的总数
     */
    total_requested: number;
    /**
     * 成功删除的总数
     */
    total_success: number;
    /**
     * 删除失败的总数
     */
    total_failed: number;
};

