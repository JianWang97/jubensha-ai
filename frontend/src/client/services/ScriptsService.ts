/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { APIResponse_Script_ } from '../models/APIResponse_Script_';
import type { APIResponse_ScriptInfo_ } from '../models/APIResponse_ScriptInfo_';
import type { APIResponse_str_ } from '../models/APIResponse_str_';
import type { PaginatedResponse_ScriptInfo_ } from '../models/PaginatedResponse_ScriptInfo_';
import type { Script_Input } from '../models/Script_Input';
import type { ScriptInfo } from '../models/ScriptInfo';
import type { ScriptStatus } from '../models/ScriptStatus';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ScriptsService {
    /**
     * Create Script
     * 创建新剧本
     * @param requestBody
     * @returns APIResponse_ScriptInfo_ Successful Response
     * @throws ApiError
     */
    public static createScriptApiScriptsPost(
        requestBody: ScriptInfo,
    ): CancelablePromise<APIResponse_ScriptInfo_> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/scripts/',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Scripts
     * 获取剧本列表（分页）
     * @param status 剧本状态过滤
     * @param author 作者过滤
     * @param page 页码
     * @param size 每页数量
     * @returns PaginatedResponse_ScriptInfo_ Successful Response
     * @throws ApiError
     */
    public static getScriptsApiScriptsGet(
        status?: (ScriptStatus | null),
        author?: (string | null),
        page: number = 1,
        size: number = 20,
    ): CancelablePromise<PaginatedResponse_ScriptInfo_> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/scripts/',
            query: {
                'status': status,
                'author': author,
                'page': page,
                'size': size,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Create Complete Script
     * 创建完整剧本（包含所有关联数据）
     * @param requestBody
     * @returns APIResponse_Script_ Successful Response
     * @throws ApiError
     */
    public static createCompleteScriptApiScriptsCompletePost(
        requestBody: Script_Input,
    ): CancelablePromise<APIResponse_Script_> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/scripts/complete',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Search Scripts
     * 搜索剧本
     * @param keyword 搜索关键词
     * @param page 页码
     * @param size 每页数量
     * @returns PaginatedResponse_ScriptInfo_ Successful Response
     * @throws ApiError
     */
    public static searchScriptsApiScriptsSearchGet(
        keyword: string,
        page: number = 1,
        size: number = 20,
    ): CancelablePromise<PaginatedResponse_ScriptInfo_> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/scripts/search',
            query: {
                'keyword': keyword,
                'page': page,
                'size': size,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Script
     * 获取完整剧本信息
     * @param scriptId
     * @returns APIResponse_Script_ Successful Response
     * @throws ApiError
     */
    public static getScriptApiScriptsScriptIdGet(
        scriptId: number,
    ): CancelablePromise<APIResponse_Script_> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/scripts/{script_id}',
            path: {
                'script_id': scriptId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Update Script
     * 更新完整剧本
     * @param scriptId
     * @param requestBody
     * @returns APIResponse_Script_ Successful Response
     * @throws ApiError
     */
    public static updateScriptApiScriptsScriptIdPut(
        scriptId: number,
        requestBody: Script_Input,
    ): CancelablePromise<APIResponse_Script_> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/scripts/{script_id}',
            path: {
                'script_id': scriptId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Delete Script
     * 删除剧本
     * @param scriptId
     * @returns APIResponse_str_ Successful Response
     * @throws ApiError
     */
    public static deleteScriptApiScriptsScriptIdDelete(
        scriptId: number,
    ): CancelablePromise<APIResponse_str_> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/scripts/{script_id}',
            path: {
                'script_id': scriptId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Script Info
     * 获取剧本基本信息
     * @param scriptId
     * @returns APIResponse_ScriptInfo_ Successful Response
     * @throws ApiError
     */
    public static getScriptInfoApiScriptsScriptIdInfoGet(
        scriptId: number,
    ): CancelablePromise<APIResponse_ScriptInfo_> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/scripts/{script_id}/info',
            path: {
                'script_id': scriptId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Update Script Info
     * 更新剧本基本信息
     * @param scriptId
     * @param requestBody
     * @returns APIResponse_ScriptInfo_ Successful Response
     * @throws ApiError
     */
    public static updateScriptInfoApiScriptsScriptIdInfoPut(
        scriptId: number,
        requestBody: ScriptInfo,
    ): CancelablePromise<APIResponse_ScriptInfo_> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/scripts/{script_id}/info',
            path: {
                'script_id': scriptId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Update Script Status
     * 更新剧本状态
     * @param scriptId
     * @param status
     * @returns APIResponse_str_ Successful Response
     * @throws ApiError
     */
    public static updateScriptStatusApiScriptsScriptIdStatusPatch(
        scriptId: number,
        status: ScriptStatus,
    ): CancelablePromise<APIResponse_str_> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/scripts/{script_id}/status',
            path: {
                'script_id': scriptId,
            },
            query: {
                'status': status,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
}
