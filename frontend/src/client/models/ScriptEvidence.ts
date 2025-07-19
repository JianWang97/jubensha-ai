/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { EvidenceType } from './EvidenceType';
/**
 * 剧本证据
 */
export type ScriptEvidence = {
    /**
     * 记录ID
     */
    id?: (number | null);
    /**
     * 创建时间
     */
    created_at?: (string | null);
    /**
     * 更新时间
     */
    updated_at?: (string | null);
    /**
     * 剧本ID
     */
    script_id?: (number | null);
    /**
     * 证据名称
     */
    name?: string;
    /**
     * 发现地点
     */
    location?: string;
    /**
     * 证据描述
     */
    description?: string;
    /**
     * 关联角色
     */
    related_to?: (string | null);
    /**
     * 重要性说明
     */
    significance?: (string | null);
    evidence_type?: EvidenceType;
    /**
     * 重要程度
     */
    importance?: string;
    /**
     * 证据图片URL
     */
    image_url?: (string | null);
    /**
     * 是否隐藏证据
     */
    is_hidden?: boolean;
};

