/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GameParticipantResponse } from './GameParticipantResponse';
import type { GameSessionResponse } from './GameSessionResponse';
/**
 * 游戏历史响应模式
 */
export type GameHistoryResponse = {
    session: GameSessionResponse;
    participation: GameParticipantResponse;
};

