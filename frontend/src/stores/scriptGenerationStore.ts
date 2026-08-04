// AI 剧本生成 Agent 状态管理（不持久化）
import { create } from 'zustand';
import type { GenEvent, GenerationStatus } from '@/types/scriptGeneration';

interface ScriptGenerationState {
  status: GenerationStatus;
  events: GenEvent[];
  scriptId: number | null;

  reset: () => void;
  setStatus: (status: GenerationStatus) => void;
  setScriptId: (scriptId: number | null) => void;
  appendEvent: (event: GenEvent) => void;
  setStateFromReplay: (status: GenerationStatus, scriptId: number | null, events: GenEvent[]) => void;
}

export const useScriptGenerationStore = create<ScriptGenerationState>((set) => ({
  status: 'idle',
  events: [],
  scriptId: null,

  reset: () => set({ status: 'idle', events: [], scriptId: null }),

  setStatus: (status) => set({ status }),

  setScriptId: (scriptId) => set({ scriptId }),

  appendEvent: (event) =>
    set((state) => {
      // 根据事件类型同步整体状态
      let status = state.status;
      switch (event.type) {
        case 'step_start':
          status = 'running';
          break;
        case 'done':
          status = 'done';
          break;
        case 'error':
          status = 'error';
          break;
        case 'cancelled':
          status = 'cancelled';
          break;
      }
      return { events: [...state.events, event], status };
    }),

  setStateFromReplay: (status, scriptId, events) =>
    set({ status, scriptId, events: events || [] })
}));
