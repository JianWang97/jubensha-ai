/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ImageType } from './ImageType';
/**
 * 图片生成请求模型
 */
export type ImageGenerationRequest = {
    image_type: ImageType;
    script_id: number;
    positive_prompt?: (string | null);
    negative_prompt?: (string | null);
};

