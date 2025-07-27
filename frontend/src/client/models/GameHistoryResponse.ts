/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UserBrief } from './UserBrief';
/**
 * 游戏历史记录响应模式
 */
export type GameHistoryResponse = {
    id: number;
    session_id: string;
    script_id: number;
    script_title: string;
    host_user_id: number;
    status: string;
    created_at: string;
    started_at: (string | null);
    ended_at: (string | null);
    participants?: Array<UserBrief>;
};

