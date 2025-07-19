/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ImageGenerationRequestModel = {
    positive_prompt: string;
    negative_prompt?: string;
    script_id: number;
    target_id: number;
    width?: number;
    height?: number;
    steps?: number;
    cfg?: number;
    seed?: (number | null);
};

