/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UserResponse } from './UserResponse';
/**
 * 认证令牌模式
 */
export type Token = {
    access_token: string;
    token_type?: string;
    expires_in: number;
    user: UserResponse;
};

