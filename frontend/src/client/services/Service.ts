/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { APIResponse_BatchEditResponse_ } from '../models/APIResponse_BatchEditResponse_';
import type { APIResponse_dict_ } from '../models/APIResponse_dict_';
import type { APIResponse_Dict_str__Any__ } from '../models/APIResponse_Dict_str__Any__';
import type { APIResponse_EditResultResponse_ } from '../models/APIResponse_EditResultResponse_';
import type { APIResponse_list_ScriptCharacter__ } from '../models/APIResponse_list_ScriptCharacter__';
import type { APIResponse_ParsedInstructionsResponse_ } from '../models/APIResponse_ParsedInstructionsResponse_';
import type { APIResponse_ScriptCharacter_ } from '../models/APIResponse_ScriptCharacter_';
import type { APIResponse_str_ } from '../models/APIResponse_str_';
import type { BatchEditRequest } from '../models/BatchEditRequest';
import type { Body_upload_file_api_files_upload_post } from '../models/Body_upload_file_api_files_upload_post';
import type { CharacterCreateRequest } from '../models/CharacterCreateRequest';
import type { CharacterPromptRequest } from '../models/CharacterPromptRequest';
import type { CharacterUpdateRequest } from '../models/CharacterUpdateRequest';
import type { EvidenceCreateRequest } from '../models/EvidenceCreateRequest';
import type { EvidencePromptRequest } from '../models/EvidencePromptRequest';
import type { EvidenceUpdateRequest } from '../models/EvidenceUpdateRequest';
import type { ExecuteInstructionRequest } from '../models/ExecuteInstructionRequest';
import type { GameSessionDeleteRequest } from '../models/GameSessionDeleteRequest';
import type { GameSessionDeleteResponse } from '../models/GameSessionDeleteResponse';
import type { GenerateSuggestionRequest } from '../models/GenerateSuggestionRequest';
import type { ImageGenerationRequest } from '../models/ImageGenerationRequest';
import type { ImageResponse } from '../models/ImageResponse';
import type { LocationPromptRequest } from '../models/LocationPromptRequest';
import type { ParseInstructionRequest } from '../models/ParseInstructionRequest';
import type { PasswordChange } from '../models/PasswordChange';
import type { ScriptLocation } from '../models/ScriptLocation';
import type { Token } from '../models/Token';
import type { UserBrief } from '../models/UserBrief';
import type { UserLogin } from '../models/UserLogin';
import type { UserRegister } from '../models/UserRegister';
import type { UserResponse } from '../models/UserResponse';
import type { UserUpdate } from '../models/UserUpdate';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class Service {
    /**
     * Parse Instruction
     * 解析用户的自然语言指令
     * @param requestBody
     * @returns APIResponse_ParsedInstructionsResponse_ Successful Response
     * @throws ApiError
     */
    public static parseInstructionApiScriptEditorParseInstructionPost(
        requestBody: ParseInstructionRequest,
    ): CancelablePromise<APIResponse_ParsedInstructionsResponse_> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/script-editor/parse-instruction',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Execute Instruction
     * 执行单个编辑指令
     * @param requestBody
     * @returns APIResponse_EditResultResponse_ Successful Response
     * @throws ApiError
     */
    public static executeInstructionApiScriptEditorExecuteInstructionPost(
        requestBody: ExecuteInstructionRequest,
    ): CancelablePromise<APIResponse_EditResultResponse_> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/script-editor/execute-instruction',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Batch Edit
     * 批量执行编辑指令
     * @param requestBody
     * @returns APIResponse_BatchEditResponse_ Successful Response
     * @throws ApiError
     */
    public static batchEditApiScriptEditorBatchEditPost(
        requestBody: BatchEditRequest,
    ): CancelablePromise<APIResponse_BatchEditResponse_> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/script-editor/batch-edit',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Generate Suggestion
     * 生成AI编辑建议
     * @param requestBody
     * @returns APIResponse_str_ Successful Response
     * @throws ApiError
     */
    public static generateSuggestionApiScriptEditorGenerateSuggestionPost(
        requestBody: GenerateSuggestionRequest,
    ): CancelablePromise<APIResponse_str_> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/script-editor/generate-suggestion',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Editing Context
     * 获取剧本编辑上下文信息
     * @param scriptId
     * @returns APIResponse_Dict_str__Any__ Successful Response
     * @throws ApiError
     */
    public static getEditingContextApiScriptEditorScriptScriptIdEditingContextGet(
        scriptId: number,
    ): CancelablePromise<APIResponse_Dict_str__Any__> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/script-editor/script/{script_id}/editing-context',
            path: {
                'script_id': scriptId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Validate Script
     * 验证剧本完整性
     * @param scriptId
     * @returns APIResponse_Dict_str__Any__ Successful Response
     * @throws ApiError
     */
    public static validateScriptApiScriptEditorScriptScriptIdValidationGet(
        scriptId: number,
    ): CancelablePromise<APIResponse_Dict_str__Any__> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/script-editor/script/{script_id}/validation',
            path: {
                'script_id': scriptId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 生成图片
     * 生成图片
     * - image_type: 图片类型（cover, character, evidence, scene）必填
     * - script_id: 剧本ID
     * - positive_prompt: 提示词（可选，会通过LLM优化）
     * @param requestBody
     * @returns APIResponse_dict_ Successful Response
     * @throws ApiError
     */
    public static generateImageApiImagesGeneratePost(
        requestBody: ImageGenerationRequest,
    ): CancelablePromise<APIResponse_dict_> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/images/generate',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 获取当前用户的图片
     * 获取当前用户的所有图片
     * - script_id: 可选，如果提供则只返回该剧本的图片
     * @param scriptId
     * @returns ImageResponse Successful Response
     * @throws ApiError
     */
    public static getMyImagesApiImagesMyImagesGet(
        scriptId?: number,
    ): CancelablePromise<Array<ImageResponse>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/images/my-images',
            query: {
                'script_id': scriptId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 删除图片
     * 删除指定图片
     * @param imageId
     * @returns any Successful Response
     * @throws ApiError
     */
    public static deleteImageApiImagesImageIdDelete(
        imageId: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/images/{image_id}',
            path: {
                'image_id': imageId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 删除剧本相关图片
     * 删除剧本相关的所有图片（仅剧本作者可操作）
     * @param scriptId
     * @returns any Successful Response
     * @throws ApiError
     */
    public static deleteScriptImagesApiImagesScriptScriptIdDelete(
        scriptId: number,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/images/script/{script_id}',
            path: {
                'script_id': scriptId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 创建证据
     * 为指定剧本创建新证据
     * @param scriptId
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static createEvidenceApiEvidenceScriptIdEvidencePost(
        scriptId: number,
        requestBody: EvidenceCreateRequest,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/evidence/{script_id}/evidence',
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
     * 更新证据
     * 更新指定证据的信息
     * @param scriptId
     * @param evidenceId
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static updateEvidenceApiEvidenceScriptIdEvidenceEvidenceIdPut(
        scriptId: number,
        evidenceId: number,
        requestBody: EvidenceUpdateRequest,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/evidence/{script_id}/evidence/{evidence_id}',
            path: {
                'script_id': scriptId,
                'evidence_id': evidenceId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 删除证据
     * 删除指定证据
     * @param scriptId
     * @param evidenceId
     * @returns any Successful Response
     * @throws ApiError
     */
    public static deleteEvidenceApiEvidenceScriptIdEvidenceEvidenceIdDelete(
        scriptId: number,
        evidenceId: number,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/evidence/{script_id}/evidence/{evidence_id}',
            path: {
                'script_id': scriptId,
                'evidence_id': evidenceId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 生成证据图片提示词
     * 使用LLM生成证据图片的提示词
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static generateEvidencePromptApiEvidenceEvidenceGeneratePromptPost(
        requestBody: EvidencePromptRequest,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/evidence/evidence/generate-prompt',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 创建角色
     * 为指定剧本创建新角色
     * @param scriptId
     * @param requestBody
     * @returns APIResponse_ScriptCharacter_ Successful Response
     * @throws ApiError
     */
    public static createCharacterApiCharactersScriptIdCharactersPost(
        scriptId: number,
        requestBody: CharacterCreateRequest,
    ): CancelablePromise<APIResponse_ScriptCharacter_> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/characters/{script_id}/characters',
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
     * 获取角色列表
     * 获取指定剧本的角色列表
     * @param scriptId
     * @param skip 跳过的记录数
     * @param limit 返回的记录数
     * @returns APIResponse_list_ScriptCharacter__ Successful Response
     * @throws ApiError
     */
    public static getCharactersApiCharactersScriptIdCharactersGet(
        scriptId: number,
        skip?: number,
        limit: number = 10,
    ): CancelablePromise<APIResponse_list_ScriptCharacter__> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/characters/{script_id}/characters',
            path: {
                'script_id': scriptId,
            },
            query: {
                'skip': skip,
                'limit': limit,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 更新角色
     * 更新指定角色的信息
     * @param scriptId
     * @param characterId
     * @param requestBody
     * @returns APIResponse_ScriptCharacter_ Successful Response
     * @throws ApiError
     */
    public static updateCharacterApiCharactersScriptIdCharactersCharacterIdPut(
        scriptId: number,
        characterId: number,
        requestBody: CharacterUpdateRequest,
    ): CancelablePromise<APIResponse_ScriptCharacter_> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/characters/{script_id}/characters/{character_id}',
            path: {
                'script_id': scriptId,
                'character_id': characterId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 删除角色
     * 删除指定角色
     * @param scriptId
     * @param characterId
     * @returns APIResponse_dict_ Successful Response
     * @throws ApiError
     */
    public static deleteCharacterApiCharactersScriptIdCharactersCharacterIdDelete(
        scriptId: number,
        characterId: number,
    ): CancelablePromise<APIResponse_dict_> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/characters/{script_id}/characters/{character_id}',
            path: {
                'script_id': scriptId,
                'character_id': characterId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 获取角色详情
     * 获取指定角色的详细信息
     * @param scriptId
     * @param characterId
     * @returns APIResponse_ScriptCharacter_ Successful Response
     * @throws ApiError
     */
    public static getCharacterApiCharactersScriptIdCharactersCharacterIdGet(
        scriptId: number,
        characterId: number,
    ): CancelablePromise<APIResponse_ScriptCharacter_> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/characters/{script_id}/characters/{character_id}',
            path: {
                'script_id': scriptId,
                'character_id': characterId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 生成角色头像提示词
     * 使用LLM生成角色头像的提示词
     * @param requestBody
     * @returns APIResponse_dict_ Successful Response
     * @throws ApiError
     */
    public static generateCharacterPromptApiCharactersCharactersGeneratePromptPost(
        requestBody: CharacterPromptRequest,
    ): CancelablePromise<APIResponse_dict_> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/characters/characters/generate-prompt',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 创建场景
     * 为指定剧本创建新场景
     * @param scriptId
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static createLocationApiLocationsScriptIdLocationsPost(
        scriptId: number,
        requestBody: ScriptLocation,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/locations/{script_id}/locations',
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
     * 获取场景列表
     * 获取指定剧本的所有场景
     * @param scriptId
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getLocationsApiLocationsScriptIdLocationsGet(
        scriptId: number,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/locations/{script_id}/locations',
            path: {
                'script_id': scriptId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 更新场景
     * 更新指定场景的信息
     * @param scriptId
     * @param locationId
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static updateLocationApiLocationsScriptIdLocationsLocationIdPut(
        scriptId: number,
        locationId: number,
        requestBody: ScriptLocation,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/locations/{script_id}/locations/{location_id}',
            path: {
                'script_id': scriptId,
                'location_id': locationId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 删除场景
     * 删除指定场景
     * @param scriptId
     * @param locationId
     * @returns any Successful Response
     * @throws ApiError
     */
    public static deleteLocationApiLocationsScriptIdLocationsLocationIdDelete(
        scriptId: number,
        locationId: number,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/locations/{script_id}/locations/{location_id}',
            path: {
                'script_id': scriptId,
                'location_id': locationId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 获取场景详情
     * 获取指定场景的详细信息
     * @param scriptId
     * @param locationId
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getLocationDetailApiLocationsScriptIdLocationsLocationIdGet(
        scriptId: number,
        locationId: number,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/locations/{script_id}/locations/{location_id}',
            path: {
                'script_id': scriptId,
                'location_id': locationId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 生成场景图片提示词
     * 使用LLM生成场景图片的提示词
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static generateLocationPromptApiLocationsLocationsGeneratePromptPost(
        requestBody: LocationPromptRequest,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/locations/locations/generate-prompt',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Game Status
     * 获取游戏状态API
     * @param sessionId
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getGameStatusApiGameStatusGet(
        sessionId?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/game/status',
            query: {
                'session_id': sessionId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Start Game
     * 启动游戏API
     * @param sessionId
     * @param scriptId
     * @returns any Successful Response
     * @throws ApiError
     */
    public static startGameApiGameStartPost(
        sessionId?: (string | null),
        scriptId: number = 1,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/game/start',
            query: {
                'session_id': sessionId,
                'script_id': scriptId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Reset Game
     * 重置游戏API
     * @param sessionId
     * @returns any Successful Response
     * @throws ApiError
     */
    public static resetGameApiGameResetPost(
        sessionId?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/game/reset',
            query: {
                'session_id': sessionId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Delete Game Sessions
     * 删除游戏会话API（支持单个和批量删除）
     *
     * Args:
     * delete_request: 删除请求，包含要删除的会话ID列表
     * session_repo: 游戏会话仓库依赖
     *
     * Returns:
     * GameSessionDeleteResponse: 删除结果响应
     * @param requestBody
     * @returns GameSessionDeleteResponse Successful Response
     * @throws ApiError
     */
    public static deleteGameSessionsApiGameSessionsDelete(
        requestBody: GameSessionDeleteRequest,
    ): CancelablePromise<GameSessionDeleteResponse> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/game/sessions',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * List Game History
     * @param page 页码(>=1)
     * @param size 每页大小
     * @param skip (兼容) 偏移量
     * @param limit (兼容) 限制条数
     * @param status
     * @param scriptId
     * @param startDate
     * @param endDate
     * @returns any Successful Response
     * @throws ApiError
     */
    public static listGameHistoryApiUsersGameHistoryGet(
        page: number = 1,
        size: number = 20,
        skip?: (number | null),
        limit?: (number | null),
        status?: (string | null),
        scriptId?: (number | null),
        startDate?: (string | null),
        endDate?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/users/game-history',
            query: {
                'page': page,
                'size': size,
                'skip': skip,
                'limit': limit,
                'status': status,
                'script_id': scriptId,
                'start_date': startDate,
                'end_date': endDate,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Game Detail
     * @param sessionId
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getGameDetailApiUsersGameHistorySessionIdGet(
        sessionId: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/users/game-history/{session_id}',
            path: {
                'session_id': sessionId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Game Events
     * @param sessionId
     * @param page
     * @param size
     * @param eventType
     * @param characterName
     * @param startTime
     * @param endTime
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getGameEventsApiUsersGameHistorySessionIdEventsGet(
        sessionId: string,
        page: number = 1,
        size: number = 50,
        eventType?: (string | null),
        characterName?: (string | null),
        startTime?: (string | null),
        endTime?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/users/game-history/{session_id}/events',
            path: {
                'session_id': sessionId,
            },
            query: {
                'page': page,
                'size': size,
                'event_type': eventType,
                'character_name': characterName,
                'start_time': startTime,
                'end_time': endTime,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Resume Game
     * @param sessionId
     * @returns any Successful Response
     * @throws ApiError
     */
    public static resumeGameApiUsersGameHistorySessionIdResumePost(
        sessionId: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/users/game-history/{session_id}/resume',
            path: {
                'session_id': sessionId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Upload File
     * 文件上传API
     *
     * Args:
     * file: 上传的文件
     * category: 文件分类 (covers/avatars/evidence/scenes/general)
     *
     * Returns:
     * 上传结果和文件访问URL
     * @param formData
     * @param category
     * @returns any Successful Response
     * @throws ApiError
     */
    public static uploadFileApiFilesUploadPost(
        formData: Body_upload_file_api_files_upload_post,
        category: string = 'general',
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/files/upload',
            query: {
                'category': category,
            },
            formData: formData,
            mediaType: 'multipart/form-data',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * List Files
     * 获取文件列表API
     *
     * Args:
     * category: 文件分类过滤 (可选)
     *
     * Returns:
     * 文件列表
     * @param category
     * @returns any Successful Response
     * @throws ApiError
     */
    public static listFilesApiFilesListGet(
        category?: (string | null),
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/files/list',
            query: {
                'category': category,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Delete File
     * 删除文件API
     *
     * Args:
     * file_url: 要删除的文件URL
     *
     * Returns:
     * 删除结果
     * @param fileUrl
     * @returns any Successful Response
     * @throws ApiError
     */
    public static deleteFileApiFilesDeleteDelete(
        fileUrl: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/files/delete',
            query: {
                'file_url': fileUrl,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Storage Stats
     * 获取存储统计信息API
     *
     * Returns:
     * 存储统计数据
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getStorageStatsApiFilesStatsGet(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/files/stats',
        });
    }
    /**
     * Download File
     * 文件下载API
     *
     * Args:
     * file_path: 文件在MinIO中的路径
     *
     * Returns:
     * 文件流响应
     * @param filePath
     * @returns any Successful Response
     * @throws ApiError
     */
    public static downloadFileApiFilesDownloadFilePathGet(
        filePath: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/files/download/{file_path}',
            path: {
                'file_path': filePath,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Available Voices
     * 获取可用的TTS声音列表
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getAvailableVoicesApiTtsVoicesGet(): CancelablePromise<Record<string, any>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/tts/voices',
        });
    }
    /**
     * Get Assets
     * 通过storage接口获取MinIO文件
     * @param path
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getAssetsJubenshaAssetsPathGet(
        path: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/jubensha-assets/{path}',
            path: {
                'path': path,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 用户注册
     * 用户注册
     * @param requestBody
     * @returns UserResponse Successful Response
     * @throws ApiError
     */
    public static registerApiAuthRegisterPost(
        requestBody: UserRegister,
    ): CancelablePromise<UserResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/auth/register',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 用户登录
     * 用户登录
     * @param requestBody
     * @returns Token Successful Response
     * @throws ApiError
     */
    public static loginApiAuthLoginPost(
        requestBody: UserLogin,
    ): CancelablePromise<Token> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/auth/login',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 获取当前用户信息
     * 获取当前用户信息（使用中间件认证）
     * @returns UserResponse Successful Response
     * @throws ApiError
     */
    public static getCurrentUserInfoApiAuthMeGet(): CancelablePromise<UserResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/auth/me',
        });
    }
    /**
     * 更新用户资料
     * 更新用户资料
     * @param requestBody
     * @returns UserResponse Successful Response
     * @throws ApiError
     */
    public static updateProfileApiAuthMePut(
        requestBody: UserUpdate,
    ): CancelablePromise<UserResponse> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/auth/me',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 修改密码
     * 修改密码
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static changePasswordApiAuthChangePasswordPost(
        requestBody: PasswordChange,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/auth/change-password',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 用户登出
     * 用户登出
     * @returns any Successful Response
     * @throws ApiError
     */
    public static logoutApiAuthLogoutPost(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/auth/logout',
        });
    }
    /**
     * 获取用户列表
     * 获取用户列表（使用中间件管理员认证）
     * @param skip
     * @param limit
     * @returns UserBrief Successful Response
     * @throws ApiError
     */
    public static getUsersApiAuthUsersGet(
        skip?: number,
        limit: number = 20,
    ): CancelablePromise<Array<UserBrief>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/auth/users',
            query: {
                'skip': skip,
                'limit': limit,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 获取指定用户信息
     * 获取指定用户信息
     * @param userId
     * @returns UserBrief Successful Response
     * @throws ApiError
     */
    public static getUserByIdApiAuthUsersUserIdGet(
        userId: number,
    ): CancelablePromise<UserBrief> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/auth/users/{user_id}',
            path: {
                'user_id': userId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 验证令牌
     * 验证令牌有效性
     * @returns any Successful Response
     * @throws ApiError
     */
    public static verifyTokenApiAuthVerifyTokenGet(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/auth/verify-token',
        });
    }
}
