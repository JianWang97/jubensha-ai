/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UserBrief } from './UserBrief';
/**
 * 游戏参与者响应模式
 */
export type GameParticipantResponse = {
    id: number;
    user_id: number;
    character_id: (number | null);
    role: string;
    status: string;
    is_winner: boolean;
    score: number;
    joined_at: string;
    left_at: (string | null);
    user: UserBrief;
};

