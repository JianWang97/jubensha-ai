// 用户认证相关类型定义

export interface User {
  id: number;
  username: string;
  email: string;
  nickname?: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: number;
  user_id: number;
  bio?: string;
  location?: string;
  website?: string;
  birth_date?: string;
  phone?: string;
  preferences?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface UserRegister {
  username: string;
  email: string;
  password: string;
  nickname?: string;
}

export interface UserLogin {
  username: string;
  password: string;
}

export interface UserUpdate {
  nickname?: string;
  email?: string;
  avatar_url?: string;
}

export interface PasswordChange {
  current_password: string;
  new_password: string;
}

export interface Token {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface UserResponse {
  id: number;
  username: string;
  email: string;
  nickname?: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  profile?: UserProfile;
}

export interface UserBrief {
  id: number;
  username: string;
  nickname?: string;
  avatar_url?: string;
}

export interface GameSession {
  id: string;
  script_id: number;
  host_user_id: number;
  session_name: string;
  max_players: number;
  current_players: number;
  status: 'waiting' | 'playing' | 'finished';
  created_at: string;
  updated_at: string;
}

export interface GameParticipant {
  id: number;
  session_id: string;
  user_id: number;
  character_id?: number;
  joined_at: string;
  user: UserBrief;
}

export interface GameHistory {
  id: string;
  script_id: number;
  script_name: string;
  host_user_id: number;
  session_name: string;
  status: string;
  created_at: string;
  finished_at?: string;
  participants: GameParticipant[];
}