/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ScriptCharacter } from './ScriptCharacter';
export type APIResponse_List_ScriptCharacter__ = {
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
    data?: (Array<ScriptCharacter> | null);
    /**
     * 错误代码
     */
    error_code?: (string | null);
    /**
     * 响应时间
     */
    timestamp?: string;
};

