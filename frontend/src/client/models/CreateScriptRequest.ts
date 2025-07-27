/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * 创建剧本请求模型
 */
export type CreateScriptRequest = {
    title: string;
    description: string;
    player_count: number;
    estimated_duration?: (number | null);
    difficulty_level?: (string | null);
    category?: (string | null);
    tags?: (Array<string> | null);
    inspiration_type?: (string | null);
    inspiration_content?: (string | null);
    background_story?: (string | null);
};

