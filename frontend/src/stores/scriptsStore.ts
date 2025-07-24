import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ScriptsService } from '../client/services/ScriptsService';
import type { ScriptInfo } from '../client/models/ScriptInfo';

export interface Script {
  id: number;
  title: string;
  description: string;
  difficulty: string;
  playerCount: string;
  duration: string;
  category: string;
  rating: number;
  tags: string[];
  image: string;
  isFavorite: boolean;
  author?: string;
  status?: string;
  price?: number;
  is_public?: boolean;
  play_count?: number;
  characters?: Character[];
  rules?: string;
  reviews?: Review[];
}

export interface Character {
  id: number;
  name: string;
  description: string;
  background: string;
}

export interface Review {
  id: number;
  userId: number;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface ScriptFilters {
  category: string;
  difficulty: string;
  playerCount: [number, number];
  duration: string;
  rating: [number, number];
  tags: string[];
}

interface ScriptsState {
  // 数据状态
  scripts: Script[];
  filteredScripts: Script[];
  selectedScript: Script | null;
  favorites: number[];
  
  // 筛选和搜索状态
  searchTerm: string;
  filters: ScriptFilters;
  viewMode: 'grid' | 'list';
  sortBy: 'rating' | 'title' | 'difficulty' | 'duration';
  sortOrder: 'asc' | 'desc';
  
  // 加载状态
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setScripts: (scripts: Script[]) => void;
  setSelectedScript: (script: Script | null) => void;
  setSearchTerm: (term: string) => void;
  setFilters: (filters: Partial<ScriptFilters>) => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setSortBy: (sortBy: string, order?: 'asc' | 'desc') => void;
  
  // 收藏相关
  toggleFavorite: (scriptId: number) => void;
  addToFavorites: (scriptId: number) => void;
  removeFromFavorites: (scriptId: number) => void;
  
  // 筛选和搜索
  applyFilters: () => void;
  clearFilters: () => void;
  searchScripts: (term: string) => void;
  
  // 数据获取
  fetchScripts: () => Promise<void>;
  fetchScriptDetail: (id: number) => Promise<Script | null>;
  
  // 重置状态
  reset: () => void;
}

const initialFilters: ScriptFilters = {
  category: '',
  difficulty: '',
  playerCount: [2, 10],
  duration: '',
  rating: [0, 5],
  tags: []
};

// 数据转换函数：将后端ScriptInfo转换为前端Script格式
const convertScriptInfo = (scriptInfo: ScriptInfo): Script => {
  return {
    id: scriptInfo.id!,
    title: scriptInfo.title || '',
    description: scriptInfo.description || '',
    difficulty: scriptInfo.difficulty || '中等',
    playerCount: `${scriptInfo.player_count || 6}人`,
    duration: `${Math.floor((scriptInfo.duration_minutes || 180) / 60)}小时`,
    category: scriptInfo.category || '推理',
    rating: Number(scriptInfo.rating) || 4.0,
    tags: Array.isArray(scriptInfo.tags) ? scriptInfo.tags : [],
    image: scriptInfo.cover_image_url || `https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(scriptInfo.title + ' mystery game scene')}&image_size=landscape_4_3`,
    isFavorite: false, // 将在applyFilters中根据favorites数组设置
    author: scriptInfo.author || '',
    status: scriptInfo.status || '',
    price: Number(scriptInfo.price) || 0,
    is_public: scriptInfo.is_public,
    play_count: scriptInfo.play_count || 0
  };
};


export const useScriptsStore = create<ScriptsState>()(persist(
  (set, get) => ({
    // 初始状态
    scripts: [],
    filteredScripts: [],
    selectedScript: null,
    favorites: [],
    searchTerm: '',
    filters: initialFilters,
    viewMode: 'grid',
    sortBy: 'rating',
    sortOrder: 'desc',
    isLoading: false,
    error: null,

    // Actions
    setScripts: (scripts) => {
      set({ scripts, filteredScripts: scripts });
      get().applyFilters();
    },

    setSelectedScript: (script) => set({ selectedScript: script }),

    setSearchTerm: (term) => {
      set({ searchTerm: term });
      get().applyFilters();
    },

    setFilters: (newFilters) => {
      set({ filters: { ...get().filters, ...newFilters } });
      get().applyFilters();
    },

    setViewMode: (mode) => set({ viewMode: mode }),

    setSortBy: (sortBy, order = 'desc') => {
      set({ sortBy: sortBy as 'rating' | 'title' | 'difficulty' | 'duration', sortOrder: order });
      get().applyFilters();
    },

    // 收藏相关
    toggleFavorite: (scriptId) => {
      const { favorites, scripts } = get();
      const isFavorite = favorites.includes(scriptId);
      
      if (isFavorite) {
        get().removeFromFavorites(scriptId);
      } else {
        get().addToFavorites(scriptId);
      }
      
      // 更新scripts中的isFavorite状态
      const updatedScripts = scripts.map(script => 
        script.id === scriptId 
          ? { ...script, isFavorite: !isFavorite }
          : script
      );
      
      set({ scripts: updatedScripts });
      get().applyFilters();
    },

    addToFavorites: (scriptId) => {
      const { favorites } = get();
      if (!favorites.includes(scriptId)) {
        set({ favorites: [...favorites, scriptId] });
      }
    },

    removeFromFavorites: (scriptId) => {
      const { favorites } = get();
      set({ favorites: favorites.filter(id => id !== scriptId) });
    },

    // 筛选和搜索
    applyFilters: () => {
      const { scripts, searchTerm, filters, sortBy, sortOrder, favorites } = get();
      let filtered = [...scripts];

      // 更新收藏状态
      filtered = filtered.map(script => ({
        ...script,
        isFavorite: favorites.includes(script.id)
      }));

      // 搜索过滤
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(script => 
          script.title.toLowerCase().includes(term) ||
          script.description.toLowerCase().includes(term) ||
          script.tags.some(tag => tag.toLowerCase().includes(term)) ||
          script.category.toLowerCase().includes(term)
        );
      }

      // 分类过滤
      if (filters.category) {
        filtered = filtered.filter(script => script.category === filters.category);
      }

      // 难度过滤
      if (filters.difficulty) {
        filtered = filtered.filter(script => script.difficulty === filters.difficulty);
      }

      // 时长过滤
      if (filters.duration) {
        filtered = filtered.filter(script => script.duration === filters.duration);
      }

      // 评分过滤
      filtered = filtered.filter(script => 
        script.rating >= filters.rating[0] && script.rating <= filters.rating[1]
      );

      // 标签过滤
      if (filters.tags.length > 0) {
        filtered = filtered.filter(script => 
          filters.tags.some(tag => script.tags.includes(tag))
        );
      }

      // 排序
      filtered.sort((a, b) => {
        let aValue, bValue;
        
        switch (sortBy) {
          case 'rating':
            aValue = a.rating;
            bValue = b.rating;
            break;
          case 'title':
            aValue = a.title;
            bValue = b.title;
            break;
          case 'difficulty':
            const difficultyOrder = { '简单': 1, '中等': 2, '困难': 3 };
            aValue = difficultyOrder[a.difficulty] || 0;
            bValue = difficultyOrder[b.difficulty] || 0;
            break;
          case 'duration':
            // 简单的时长排序，可以根据需要优化
            aValue = a.duration;
            bValue = b.duration;
            break;
          default:
            return 0;
        }
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortOrder === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }
        
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      });

      set({ filteredScripts: filtered });
    },

    clearFilters: () => {
      set({ 
        searchTerm: '', 
        filters: initialFilters 
      });
      get().applyFilters();
    },

    searchScripts: (term) => {
      get().setSearchTerm(term);
    },

    // 数据获取
    fetchScripts: async () => {
      set({ isLoading: true, error: null });
      try {
        // 调用真实API
        const response = await ScriptsService.getPublicScriptsApiScriptsPublicGet();
        
        if (response && response.items) {
          // 转换数据格式
          const scripts = response.items.map(convertScriptInfo);
          get().setScripts(scripts);
        } else {
          throw new Error('获取剧本列表失败');
        }
        
        set({ isLoading: false });
      } catch (error) {
        console.error('获取剧本列表失败:', error);
        set({ 
          error: error instanceof Error ? error.message : '获取剧本列表失败',
          isLoading: false 
        });
      }
    },

    fetchScriptDetail: async (id) => {
      set({ isLoading: true, error: null });
      try {
        // 调用真实API获取剧本基本信息
        const response = await ScriptsService.getScriptInfoApiScriptsScriptIdInfoGet(id);
        
        if (response && response.success && response.data) {
          const script = convertScriptInfo(response.data);
          set({ selectedScript: script, isLoading: false });
          return script;
        } else {
          throw new Error(response?.message || '剧本不存在');
        }
      } catch (error) {
        console.error('获取剧本详情失败:', error);
        set({ 
          error: error instanceof Error ? error.message : '获取剧本详情失败',
          isLoading: false 
        });
        return null;
      }
    },

    // 重置状态
    reset: () => set({
      scripts: [],
      filteredScripts: [],
      selectedScript: null,
      searchTerm: '',
      filters: initialFilters,
      viewMode: 'grid',
      sortBy: 'rating',
      sortOrder: 'desc',
      isLoading: false,
      error: null
    })
  }),
  {
    name: 'scripts-store',
    partialize: (state) => ({
      favorites: state.favorites,
      viewMode: state.viewMode,
      sortBy: state.sortBy,
      sortOrder: state.sortOrder
    })
  }
));

// 选择器函数
export const useScripts = () => useScriptsStore(state => state.scripts);
export const useFilteredScripts = () => useScriptsStore(state => state.filteredScripts);
export const useSelectedScript = () => useScriptsStore(state => state.selectedScript);
export const useFavorites = () => useScriptsStore(state => state.favorites);
export const useScriptFilters = () => useScriptsStore(state => state.filters);
export const useScriptSearch = () => useScriptsStore(state => state.searchTerm);
export const useScriptViewMode = () => useScriptsStore(state => state.viewMode);
export const useScriptLoading = () => useScriptsStore(state => state.isLoading);
export const useScriptError = () => useScriptsStore(state => state.error);

// 动作选择器
export const useScriptActions = () => {
  const setScripts = useScriptsStore(state => state.setScripts);
  const setSelectedScript = useScriptsStore(state => state.setSelectedScript);
  const setSearchTerm = useScriptsStore(state => state.setSearchTerm);
  const setFilters = useScriptsStore(state => state.setFilters);
  const setViewMode = useScriptsStore(state => state.setViewMode);
  const setSortBy = useScriptsStore(state => state.setSortBy);
  const toggleFavorite = useScriptsStore(state => state.toggleFavorite);
  const applyFilters = useScriptsStore(state => state.applyFilters);
  const clearFilters = useScriptsStore(state => state.clearFilters);
  const searchScripts = useScriptsStore(state => state.searchScripts);
  const fetchScripts = useScriptsStore(state => state.fetchScripts);
  const fetchScriptDetail = useScriptsStore(state => state.fetchScriptDetail);
  const reset = useScriptsStore(state => state.reset);
  
  return {
    setScripts,
    setSelectedScript,
    setSearchTerm,
    setFilters,
    setViewMode,
    setSortBy,
    toggleFavorite,
    applyFilters,
    clearFilters,
    searchScripts,
    fetchScripts,
    fetchScriptDetail,
    reset
  };
};