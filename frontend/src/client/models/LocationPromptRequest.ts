/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * 场景图片提示词生成请求模型
 */
export type LocationPromptRequest = {
    location_name: string;
    location_description: string;
    script_theme?: (string | null);
    style_preference?: (string | null);
    is_crime_scene?: boolean;
    hidden_clues?: (Array<string> | null);
    access_conditions?: (string | null);
};

