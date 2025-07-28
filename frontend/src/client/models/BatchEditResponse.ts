/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { EditResult } from './EditResult';
import type { Script_Output } from './Script_Output';
/**
 * 批量编辑响应
 */
export type BatchEditResponse = {
    results: Array<EditResult>;
    success_count: number;
    total_count: number;
    updated_script?: (Script_Output | null);
};

