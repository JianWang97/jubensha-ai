/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * 用户响应模式
 */
export type UserResponse = {
    id: number;
    username: string;
    email: string;
    nickname: (string | null);
    avatar_url: (string | null);
    bio: (string | null);
    is_active: boolean;
    is_verified: boolean;
    is_admin: boolean;
    last_login_at: (string | null);
    created_at: string;
    updated_at: string;
};

