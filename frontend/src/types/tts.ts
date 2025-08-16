import { GameEventItem } from '../services/gameHistoryService';

// 音频事件类型
export interface TTSEvent extends GameEventItem {
  startTimeMs: number;
  endTimeMs: number;
  durationMs: number;
}

// 音频缓存
export interface AudioCache {
  [key: string]: HTMLAudioElement;
}