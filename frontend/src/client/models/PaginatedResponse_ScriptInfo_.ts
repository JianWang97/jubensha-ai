/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ScriptInfo } from './ScriptInfo';
export type PaginatedResponse_ScriptInfo_ = {
    /**
     * 数据列表
     */
    items?: Array<ScriptInfo>;
    /**
     * 总记录数
     */
    total?: number;
    /**
     * 当前页码
     */
    page?: number;
    /**
     * 每页大小
     */
    size?: number;
    /**
     * 总页数
     */
    pages?: number;
    /**
     * 是否有下一页
     */
    has_next?: boolean;
    /**
     * 是否有上一页
     */
    has_prev?: boolean;
};

