/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { APIResponse_BatchEditResponse_ } from '../models/APIResponse_BatchEditResponse_';
import type { APIResponse_dict_ } from '../models/APIResponse_dict_';
import type { APIResponse_Dict_str__Any__ } from '../models/APIResponse_Dict_str__Any__';
import type { APIResponse_EditResultResponse_ } from '../models/APIResponse_EditResultResponse_';
import type { APIResponse_List_ScriptCharacter__ } from '../models/APIResponse_List_ScriptCharacter__';
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
import type { GameHistoryResponse } from '../models/GameHistoryResponse';
import type { GameParticipantResponse } from '../models/GameParticipantResponse';
import type { GameSessionCreate } from '../models/GameSessionCreate';
import type { GameSessionResponse } from '../models/GameSessionResponse';
import type { GenerateSuggestionRequest } from '../models/GenerateSuggestionRequest';
import type { ImageGenerationRequestModel } from '../models/ImageGenerationRequestModel';
import type { ParseInstructionRequest } from '../models/ParseInstructionRequest';
import type { PasswordChange } from '../models/PasswordChange';
import type { ScriptCoverPromptRequest } from '../models/ScriptCoverPromptRequest';
import type { ScriptLocation } from '../models/ScriptLocation';
import type { Token } from '../models/Token';
import type { TTSRequest } from '../models/TTSRequest';
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
     * 生成封面图片
     * 生成剧本封面图片
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static generateCoverImageApiScriptsGenerateCoverPost(
        requestBody: ImageGenerationRequestModel,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/scripts/generate/cover',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 生成剧本封面提示词
     * 使用LLM生成剧本封面图片的提示词
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static generateScriptCoverPromptApiScriptsGenerateCoverPromptPost(
        requestBody: ScriptCoverPromptRequest,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/scripts/generate/cover-prompt',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 生成角色头像
     * 生成角色头像图片
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static generateAvatarImageApiScriptsGenerateAvatarPost(
        requestBody: ImageGenerationRequestModel,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/scripts/generate/avatar',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 生成证据图片
     * 生成证据图片
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static generateEvidenceImageApiScriptsGenerateEvidencePost(
        requestBody: ImageGenerationRequestModel,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/scripts/generate/evidence',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 生成场景背景图
     * 生成场景背景图片
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static generateSceneImageApiScriptsGenerateScenePost(
        requestBody: ImageGenerationRequestModel,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/scripts/generate/scene',
            body: requestBody,
            mediaType: 'application/json',
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
     * @returns APIResponse_List_ScriptCharacter__ Successful Response
     * @throws ApiError
     */
    public static getCharactersApiCharactersScriptIdCharactersGet(
        scriptId: number,
        skip?: number,
        limit: number = 10,
    ): CancelablePromise<APIResponse_List_ScriptCharacter__> {
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
     * Get Game Status
     * 获取游戏状态API
     * @param sessionId
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getGameStatusApiGameStatusGet(
        sessionId?: string,
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
        sessionId?: string,
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
        sessionId?: string,
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
     * Stream Tts
     * TTS流式音频生成API
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static streamTtsApiTtsStreamPost(
        requestBody: TTSRequest,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/tts/stream',
            body: requestBody,
            mediaType: 'application/json',
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
    /**
     * 创建游戏会话
     * 创建游戏会话
     * @param requestBody
     * @returns GameSessionResponse Successful Response
     * @throws ApiError
     */
    public static createGameSessionApiUsersGameSessionsPost(
        requestBody: GameSessionCreate,
    ): CancelablePromise<GameSessionResponse> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/users/game-sessions',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 加入游戏会话
     * 加入游戏会话
     * @param sessionId
     * @returns any Successful Response
     * @throws ApiError
     */
    public static joinGameSessionApiUsersGameSessionsSessionIdJoinPost(
        sessionId: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/users/game-sessions/{session_id}/join',
            path: {
                'session_id': sessionId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 离开游戏会话
     * 离开游戏会话
     * @param sessionId
     * @returns any Successful Response
     * @throws ApiError
     */
    public static leaveGameSessionApiUsersGameSessionsSessionIdLeavePost(
        sessionId: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/users/game-sessions/{session_id}/leave',
            path: {
                'session_id': sessionId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 获取游戏历史
     * 获取用户游戏历史
     * @param skip 跳过的记录数
     * @param limit 返回的记录数
     * @returns GameHistoryResponse Successful Response
     * @throws ApiError
     */
    public static getGameHistoryApiUsersGameHistoryGet(
        skip?: number,
        limit: number = 20,
    ): CancelablePromise<Array<GameHistoryResponse>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/users/game-history',
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
     * 获取游戏会话详情
     * 获取游戏会话详情
     * @param sessionId
     * @returns GameSessionResponse Successful Response
     * @throws ApiError
     */
    public static getGameSessionApiUsersGameSessionsSessionIdGet(
        sessionId: string,
    ): CancelablePromise<GameSessionResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/users/game-sessions/{session_id}',
            path: {
                'session_id': sessionId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 获取游戏参与者
     * 获取游戏参与者列表
     * @param sessionId
     * @returns GameParticipantResponse Successful Response
     * @throws ApiError
     */
    public static getGameParticipantsApiUsersGameSessionsSessionIdParticipantsGet(
        sessionId: string,
    ): CancelablePromise<Array<GameParticipantResponse>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/users/game-sessions/{session_id}/participants',
            path: {
                'session_id': sessionId,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * 获取用户统计信息
     * 获取用户统计信息
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getUserStatsApiUsersStatsGet(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/users/stats',
        });
    }
}
