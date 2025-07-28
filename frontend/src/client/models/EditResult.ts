/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Script_Output } from './Script_Output';
/**
 * 编辑结果模型
 */
export type EditResult = {
    success: boolean;
    message: string;
    data?: (Record<string, any> | null);
    updated_script?: (Script_Output | null);
};

