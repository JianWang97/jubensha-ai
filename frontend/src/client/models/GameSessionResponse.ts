/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * 游戏会话响应模式
 */
export type GameSessionResponse = {
    id: number;
    script_id: number;
    host_user_id: number;
    current_players: number;
    max_players: number;
    status: string;
    created_at: string;
    started_at: (string | null);
    ended_at: (string | null);
};

