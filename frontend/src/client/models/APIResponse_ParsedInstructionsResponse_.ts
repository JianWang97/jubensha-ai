/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ParsedInstructionsResponse } from './ParsedInstructionsResponse';
export type APIResponse_ParsedInstructionsResponse_ = {
    /**
     * 请求是否成功
     */
    success?: boolean;
    /**
     * 响应消息
     */
    message?: string;
    /**
     * 响应数据
     */
    data?: (ParsedInstructionsResponse | null);
    /**
     * 错误代码
     */
    error_code?: (string | null);
    /**
     * 响应时间
     */
    timestamp?: string;
};

