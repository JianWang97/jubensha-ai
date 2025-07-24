/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BackgroundStory } from './BackgroundStory';
import type { GamePhase } from './GamePhase';
import type { ScriptCharacter } from './ScriptCharacter';
import type { ScriptEvidence } from './ScriptEvidence';
import type { ScriptInfo } from './ScriptInfo';
import type { ScriptLocation } from './ScriptLocation';
/**
 * 完整剧本数据
 */
export type Script_Input = {
    info: ScriptInfo;
    /**
     * 背景故事
     */
    background_story?: (BackgroundStory | null);
    /**
     * 角色列表
     */
    characters?: Array<ScriptCharacter>;
    /**
     * 证据列表
     */
    evidence?: Array<ScriptEvidence>;
    /**
     * 场景列表
     */
    locations?: Array<ScriptLocation>;
    /**
     * 游戏阶段列表
     */
    game_phases?: Array<GamePhase>;
};

