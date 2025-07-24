/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * 游戏会话响应模式
 */
export type GameSessionResponse = {
    id: number;
    session_id: string;
    script_id: number;
    host_user_id: number;
    status: string;
    current_phase: (string | null);
    max_players: number;
    current_players: number;
    started_at: (string | null);
    finished_at: (string | null);
    created_at: string;
};

