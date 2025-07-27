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
    session_id: number;
    user_id: number;
    user: UserBrief;
    role: string;
    status: string;
    joined_at: string;
};

