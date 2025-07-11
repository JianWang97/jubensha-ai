import { useEffect } from 'react';
import { useTTSStore } from '@/stores/ttsStore';
import { VoiceMapping } from './websocketService';

export interface TTSQueueItem {
  character: string;
  text: string;
}

export const useTTSService = (voiceMapping: VoiceMapping) => {
  const {
    ttsEnabled,
    isPlaying,
    audioStatus,
    audioInitialized,
    queueTTS,
    stopAllAudio,
    toggleTTS,
    initializeAudio
  } = useTTSStore();

  // 使用传入的voiceMapping更新store中的voiceMapping
  useEffect(() => {
    useTTSStore.getState().setVoiceMapping(voiceMapping);
  }, [voiceMapping]);

  return {
    ttsEnabled,
    isPlaying,
    audioStatus,
    audioInitialized,
    queueTTS: (character: string, text: string) => queueTTS(character, text),
    stopAllAudio,
    toggleTTS,
    initializeAudio
  };
};