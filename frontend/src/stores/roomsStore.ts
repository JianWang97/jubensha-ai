import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Script } from './scriptsStore';

export interface Player {
  id: number;
  name: string;
  avatar: string;
  isHost: boolean;
  status: 'ready' | 'not_ready' | 'disconnected';
  character?: string | null;
  joinedAt: string;
}

export interface RoomSettings {
  allowSpectators: boolean;
  autoStart: boolean;
  voiceChat: boolean;
  recordGame: boolean;
  maxPlayers: number;
  isPrivate: boolean;
  password?: string;
}

export interface ChatMessage {
  id: number;
  playerId: number;
  playerName: string;
  message: string;
  timestamp: string;
  type?: 'message' | 'system' | 'action';
}

export interface Room {
  id: number;
  name: string;
  script: string | Script;
  host: Player;
  currentPlayers: number;
  maxPlayers: number;
  status: 'waiting' | 'playing' | 'finished';
  isPrivate: boolean;
  createdAt: string;
  estimatedStart?: string;
  description?: string;
  settings: RoomSettings;
  players: Player[];
  chatMessages: ChatMessage[];
}

export interface CreateRoomData {
  name: string;
  script: string;
  maxPlayers: number;
  isPrivate: boolean;
  description?: string;
  password?: string;
}

export interface MatchPreferences {
  script: string;
  playerCount: string;
  difficulty: string;
  category?: string;
}

interface RoomsState {
  // 数据状态
  rooms: Room[];
  filteredRooms: Room[];
  currentRoom: Room | null;
  myRooms: Room[];
  
  // 筛选和搜索状态
  searchTerm: string;
  statusFilter: string;
  activeTab: 'all' | 'public' | 'my';
  
  // 匹配状态
  isMatching: boolean;
  matchPreferences: MatchPreferences;
  
  // 加载状态
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setRooms: (rooms: Room[]) => void;
  setCurrentRoom: (room: Room | null) => void;
  setSearchTerm: (term: string) => void;
  setStatusFilter: (status: string) => void;
  setActiveTab: (tab: 'all' | 'public' | 'my') => void;
  
  // 房间操作
  createRoom: (roomData: CreateRoomData) => Promise<Room | null>;
  joinRoom: (roomId: number, password?: string) => Promise<boolean>;
  leaveRoom: (roomId: number) => Promise<boolean>;
  updateRoom: (roomId: number, updates: Partial<Room>) => void;
  deleteRoom: (roomId: number) => void;
  
  // 玩家操作
  kickPlayer: (roomId: number, playerId: number) => void;
  promotePlayer: (roomId: number, playerId: number) => void;
  togglePlayerReady: (roomId: number, playerId: number) => void;
  
  // 聊天操作
  sendMessage: (roomId: number, message: string) => void;
  addSystemMessage: (roomId: number, message: string) => void;
  
  // 房间设置
  updateRoomSettings: (roomId: number, settings: Partial<RoomSettings>) => void;
  
  // 快速匹配
  setMatchPreferences: (preferences: Partial<MatchPreferences>) => void;
  startQuickMatch: (preferences: MatchPreferences) => Promise<Room | null>;
  stopMatching: () => void;
  
  // 筛选和搜索
  applyFilters: () => void;
  clearFilters: () => void;
  
  // 数据获取
  fetchRooms: () => Promise<void>;
  fetchRoomDetail: (id: number) => Promise<Room | null>;
  fetchMyRooms: () => Promise<void>;
  
  // 重置状态
  reset: () => void;
}

// 模拟房间数据
const mockRooms: Room[] = [
  {
    id: 1,
    name: '古宅疑云 - 推理之夜',
    script: '古宅疑云',
    host: { id: 1, name: '玩家A', avatar: '', isHost: true, status: 'ready', joinedAt: '2024-01-15 20:30' },
    currentPlayers: 4,
    maxPlayers: 6,
    status: 'waiting',
    isPrivate: false,
    createdAt: '2024-01-15 20:30',
    estimatedStart: '2024-01-15 21:00',
    description: '欢迎新手玩家，我们会耐心引导游戏流程',
    settings: {
      allowSpectators: true,
      autoStart: false,
      voiceChat: true,
      recordGame: true,
      maxPlayers: 6,
      isPrivate: false
    },
    players: [
      { id: 1, name: '玩家A', avatar: '', isHost: true, status: 'ready', joinedAt: '2024-01-15 20:30' },
      { id: 2, name: '玩家B', avatar: '', isHost: false, status: 'ready', joinedAt: '2024-01-15 20:35' },
      { id: 3, name: '玩家C', avatar: '', isHost: false, status: 'not_ready', joinedAt: '2024-01-15 20:40' },
      { id: 4, name: '玩家D', avatar: '', isHost: false, status: 'ready', joinedAt: '2024-01-15 20:45' }
    ],
    chatMessages: [
      { id: 1, playerId: 1, playerName: '玩家A', message: '欢迎大家！', timestamp: '20:30' },
      { id: 2, playerId: 2, playerName: '玩家B', message: '大家好！', timestamp: '20:35' },
      { id: 3, playerId: 1, playerName: '玩家A', message: '等人齐了就开始', timestamp: '20:40' }
    ]
  },
  {
    id: 2,
    name: '末日求生挑战',
    script: '末日求生',
    host: { id: 5, name: '玩家E', avatar: '', isHost: true, status: 'ready', joinedAt: '2024-01-15 19:00' },
    currentPlayers: 6,
    maxPlayers: 8,
    status: 'playing',
    isPrivate: false,
    createdAt: '2024-01-15 19:00',
    estimatedStart: '2024-01-15 19:30',
    description: '高难度挑战，需要有经验的玩家',
    settings: {
      allowSpectators: false,
      autoStart: true,
      voiceChat: true,
      recordGame: true,
      maxPlayers: 8,
      isPrivate: false
    },
    players: [
      { id: 5, name: '玩家E', avatar: '', isHost: true, status: 'ready', joinedAt: '2024-01-15 19:00' },
      { id: 6, name: '玩家F', avatar: '', isHost: false, status: 'ready', joinedAt: '2024-01-15 19:05' },
      { id: 7, name: '玩家G', avatar: '', isHost: false, status: 'ready', joinedAt: '2024-01-15 19:10' },
      { id: 8, name: '玩家H', avatar: '', isHost: false, status: 'ready', joinedAt: '2024-01-15 19:15' },
      { id: 9, name: '玩家I', avatar: '', isHost: false, status: 'ready', joinedAt: '2024-01-15 19:20' },
      { id: 10, name: '玩家J', avatar: '', isHost: false, status: 'ready', joinedAt: '2024-01-15 19:25' }
    ],
    chatMessages: []
  },
  {
    id: 3,
    name: '校园回忆录',
    script: '校园青春',
    host: { id: 11, name: '玩家K', avatar: '', isHost: true, status: 'ready', joinedAt: '2024-01-15 21:00' },
    currentPlayers: 2,
    maxPlayers: 5,
    status: 'waiting',
    isPrivate: true,
    createdAt: '2024-01-15 21:00',
    estimatedStart: '2024-01-15 21:30',
    description: '朋友聚会专用房间',
    settings: {
      allowSpectators: false,
      autoStart: false,
      voiceChat: true,
      recordGame: false,
      maxPlayers: 5,
      isPrivate: true,
      password: '123456'
    },
    players: [
      { id: 11, name: '玩家K', avatar: '', isHost: true, status: 'ready', joinedAt: '2024-01-15 21:00' },
      { id: 12, name: '玩家L', avatar: '', isHost: false, status: 'not_ready', joinedAt: '2024-01-15 21:05' }
    ],
    chatMessages: []
  }
];

const initialMatchPreferences: MatchPreferences = {
  script: '',
  playerCount: '',
  difficulty: ''
};

export const useRoomsStore = create<RoomsState>()(persist(
  (set, get) => ({
    // 初始状态
    rooms: [],
    filteredRooms: [],
    currentRoom: null,
    myRooms: [],
    searchTerm: '',
    statusFilter: '',
    activeTab: 'all',
    isMatching: false,
    matchPreferences: initialMatchPreferences,
    isLoading: false,
    error: null,

    // Actions
    setRooms: (rooms) => {
      set({ rooms, filteredRooms: rooms });
      get().applyFilters();
    },

    setCurrentRoom: (room) => set({ currentRoom: room }),

    setSearchTerm: (term) => {
      set({ searchTerm: term });
      get().applyFilters();
    },

    setStatusFilter: (status) => {
      set({ statusFilter: status });
      get().applyFilters();
    },

    setActiveTab: (tab) => {
      set({ activeTab: tab });
      get().applyFilters();
    },

    // 房间操作
    createRoom: async (roomData) => {
      set({ isLoading: true, error: null });
      try {
        // 模拟API调用
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const newRoom: Room = {
          id: Date.now(), // 简单的ID生成
          ...roomData,
          host: { 
            id: 999, // 模拟当前用户ID
            name: '当前用户', 
            avatar: '', 
            isHost: true, 
            status: 'ready',
            joinedAt: new Date().toLocaleString('zh-CN')
          },
          currentPlayers: 1,
          status: 'waiting',
          createdAt: new Date().toLocaleString('zh-CN'),
          estimatedStart: new Date(Date.now() + 30 * 60000).toLocaleString('zh-CN'),
          settings: {
            allowSpectators: true,
            autoStart: false,
            voiceChat: true,
            recordGame: true,
            maxPlayers: roomData.maxPlayers,
            isPrivate: roomData.isPrivate,
            password: roomData.password
          },
          players: [
            { 
              id: 999, 
              name: '当前用户', 
              avatar: '', 
              isHost: true, 
              status: 'ready',
              joinedAt: new Date().toLocaleString('zh-CN')
            }
          ],
          chatMessages: []
        };
        
        const { rooms } = get();
        set({ 
          rooms: [newRoom, ...rooms],
          currentRoom: newRoom,
          isLoading: false 
        });
        get().applyFilters();
        
        return newRoom;
      } catch (error) {
        set({ 
          error: error instanceof Error ? error.message : '创建房间失败',
          isLoading: false 
        });
        return null;
      }
    },

    joinRoom: async (roomId, password) => {
      set({ isLoading: true, error: null });
      try {
        // 模拟API调用
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const { rooms } = get();
        const room = rooms.find(r => r.id === roomId);
        
        if (!room) {
          set({ error: '房间不存在', isLoading: false });
          return false;
        }
        
        if (room.isPrivate && room.settings.password !== password) {
          set({ error: '密码错误', isLoading: false });
          return false;
        }
        
        if (room.currentPlayers >= room.maxPlayers) {
          set({ error: '房间已满', isLoading: false });
          return false;
        }
        
        // 检查是否已经在房间中
        if (room.players.some(p => p.id === 999)) {
          set({ error: '你已经在房间中', isLoading: false });
          return false;
        }
        
        const newPlayer: Player = {
          id: 999, // 模拟当前用户ID
          name: '当前用户',
          avatar: '',
          isHost: false,
          status: 'not_ready',
          joinedAt: new Date().toLocaleString('zh-CN')
        };
        
        const updatedRoom = {
          ...room,
          currentPlayers: room.currentPlayers + 1,
          players: [...room.players, newPlayer]
        };
        
        const updatedRooms = rooms.map(r => r.id === roomId ? updatedRoom : r);
        
        set({ 
          rooms: updatedRooms,
          currentRoom: updatedRoom,
          isLoading: false 
        });
        get().applyFilters();
        
        // 添加系统消息
        get().addSystemMessage(roomId, `${newPlayer.name} 加入了房间`);
        
        return true;
      } catch (error) {
        set({ 
          error: error instanceof Error ? error.message : '加入房间失败',
          isLoading: false 
        });
        return false;
      }
    },

    leaveRoom: async (roomId) => {
      try {
        const { rooms } = get();
        const room = rooms.find(r => r.id === roomId);
        
        if (!room) return false;
        
        const currentPlayer = room.players.find(p => p.id === 999);
        if (!currentPlayer) return false;
        
        // 如果是房主离开，需要转让房主或删除房间
        if (currentPlayer.isHost && room.players.length > 1) {
          const nextHost = room.players.find(p => p.id !== 999);
          if (nextHost) {
            get().promotePlayer(roomId, nextHost.id);
          }
        }
        
        const updatedRoom = {
          ...room,
          currentPlayers: room.currentPlayers - 1,
          players: room.players.filter(p => p.id !== 999)
        };
        
        // 如果房间没有玩家了，删除房间
        if (updatedRoom.players.length === 0) {
          get().deleteRoom(roomId);
        } else {
          const updatedRooms = rooms.map(r => r.id === roomId ? updatedRoom : r);
          set({ rooms: updatedRooms });
          get().applyFilters();
          
          // 添加系统消息
          get().addSystemMessage(roomId, `${currentPlayer.name} 离开了房间`);
        }
        
        set({ currentRoom: null });
        return true;
      } catch (error) {
        set({ error: error instanceof Error ? error.message : '离开房间失败' });
        return false;
      }
    },

    updateRoom: (roomId, updates) => {
      const { rooms } = get();
      const updatedRooms = rooms.map(room => 
        room.id === roomId ? { ...room, ...updates } : room
      );
      set({ rooms: updatedRooms });
      
      // 如果更新的是当前房间，也更新currentRoom
      const { currentRoom } = get();
      if (currentRoom && currentRoom.id === roomId) {
        set({ currentRoom: { ...currentRoom, ...updates } });
      }
      
      get().applyFilters();
    },

    deleteRoom: (roomId) => {
      const { rooms } = get();
      const updatedRooms = rooms.filter(room => room.id !== roomId);
      set({ rooms: updatedRooms });
      
      // 如果删除的是当前房间，清空currentRoom
      const { currentRoom } = get();
      if (currentRoom && currentRoom.id === roomId) {
        set({ currentRoom: null });
      }
      
      get().applyFilters();
    },

    // 玩家操作
    kickPlayer: (roomId, playerId) => {
      const { rooms } = get();
      const room = rooms.find(r => r.id === roomId);
      if (!room) return;
      
      const playerToKick = room.players.find(p => p.id === playerId);
      if (!playerToKick || playerToKick.isHost) return;
      
      const updatedRoom = {
        ...room,
        currentPlayers: room.currentPlayers - 1,
        players: room.players.filter(p => p.id !== playerId)
      };
      
      get().updateRoom(roomId, updatedRoom);
      get().addSystemMessage(roomId, `${playerToKick.name} 被踢出房间`);
    },

    promotePlayer: (roomId, playerId) => {
      const { rooms } = get();
      const room = rooms.find(r => r.id === roomId);
      if (!room) return;
      
      const newHost = room.players.find(p => p.id === playerId);
      if (!newHost) return;
      
      const updatedRoom = {
        ...room,
        host: { ...newHost, isHost: true },
        players: room.players.map(p => ({
          ...p,
          isHost: p.id === playerId
        }))
      };
      
      get().updateRoom(roomId, updatedRoom);
      get().addSystemMessage(roomId, `${newHost.name} 成为新的房主`);
    },

    togglePlayerReady: (roomId, playerId) => {
      const { rooms } = get();
      const room = rooms.find(r => r.id === roomId);
      if (!room) return;
      
      const updatedRoom = {
        ...room,
        players: room.players.map(p => 
          p.id === playerId 
            ? { ...p, status: p.status === 'ready' ? 'not_ready' : 'ready' as const }
            : p
        )
      };
      
      get().updateRoom(roomId, updatedRoom as any);
    },

    // 聊天操作
    sendMessage: (roomId, message) => {
      const { rooms } = get();
      const room = rooms.find(r => r.id === roomId);
      if (!room) return;
      
      const newMessage: ChatMessage = {
        id: room.chatMessages.length + 1,
        playerId: 999, // 模拟当前用户ID
        playerName: '当前用户',
        message,
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        type: 'message'
      };
      
      const updatedRoom = {
        ...room,
        chatMessages: [...room.chatMessages, newMessage]
      };
      
      get().updateRoom(roomId, updatedRoom);
    },

    addSystemMessage: (roomId, message) => {
      const { rooms } = get();
      const room = rooms.find(r => r.id === roomId);
      if (!room) return;
      
      const systemMessage: ChatMessage = {
        id: room.chatMessages.length + 1,
        playerId: 0, // 系统消息
        playerName: '系统',
        message,
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        type: 'system'
      };
      
      const updatedRoom = {
        ...room,
        chatMessages: [...room.chatMessages, systemMessage]
      };
      
      get().updateRoom(roomId, updatedRoom);
    },

    // 房间设置
    updateRoomSettings: (roomId, settings) => {
      const { rooms } = get();
      const room = rooms.find(r => r.id === roomId);
      if (!room) return;
      
      const updatedRoom = {
        ...room,
        settings: { ...room.settings, ...settings }
      };
      
      get().updateRoom(roomId, updatedRoom);
    },

    // 快速匹配
    setMatchPreferences: (preferences) => {
      set({ matchPreferences: { ...get().matchPreferences, ...preferences } });
    },

    startQuickMatch: async (preferences) => {
      set({ isMatching: true, error: null });
      try {
        // 模拟匹配过程
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { rooms } = get();
        
        // 查找合适的房间
        const availableRooms = rooms.filter(room => 
          room.status === 'waiting' && 
          room.currentPlayers < room.maxPlayers &&
          !room.isPrivate &&
          (!preferences.script || room.script === preferences.script)
        );
        
        if (availableRooms.length > 0) {
          // 找到合适的房间，自动加入
          const targetRoom = availableRooms[0];
          const success = await get().joinRoom(targetRoom.id);
          
          set({ isMatching: false });
          return success ? targetRoom : null;
        } else {
          // 没有合适的房间，创建新房间
          const roomData: CreateRoomData = {
            name: `${preferences.script || '快速匹配'} - 房间`,
            script: preferences.script || '古宅疑云',
            maxPlayers: 6,
            isPrivate: false,
            description: '通过快速匹配创建的房间'
          };
          
          const newRoom = await get().createRoom(roomData);
          set({ isMatching: false });
          return newRoom;
        }
      } catch (error) {
        set({ 
          error: error instanceof Error ? error.message : '匹配失败',
          isMatching: false 
        });
        return null;
      }
    },

    stopMatching: () => {
      set({ isMatching: false });
    },

    // 筛选和搜索
    applyFilters: () => {
      const { rooms, searchTerm, statusFilter, activeTab } = get();
      let filtered = [...rooms];

      // 标签页过滤
      if (activeTab === 'my') {
        // 这里应该根据当前用户过滤
        filtered = filtered.filter(room => room.host.id === 999);
      } else if (activeTab === 'public') {
        filtered = filtered.filter(room => !room.isPrivate);
      }

      // 搜索过滤
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(room => 
          room.name.toLowerCase().includes(term) ||
          (typeof room.script === 'string' ? room.script.toLowerCase().includes(term) : room.script.title.toLowerCase().includes(term)) ||
          room.host.name.toLowerCase().includes(term) ||
          (room.description && room.description.toLowerCase().includes(term))
        );
      }

      // 状态过滤
      if (statusFilter) {
        filtered = filtered.filter(room => room.status === statusFilter);
      }

      set({ filteredRooms: filtered });
    },

    clearFilters: () => {
      set({ 
        searchTerm: '', 
        statusFilter: '' 
      });
      get().applyFilters();
    },

    // 数据获取
    fetchRooms: async () => {
      set({ isLoading: true, error: null });
      try {
        // 模拟API调用
        await new Promise(resolve => setTimeout(resolve, 500));
        
        get().setRooms(mockRooms);
        set({ isLoading: false });
      } catch (error) {
        set({ 
          error: error instanceof Error ? error.message : '获取房间列表失败',
          isLoading: false 
        });
      }
    },

    fetchRoomDetail: async (id) => {
      set({ isLoading: true, error: null });
      try {
        // 模拟API调用
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const room = mockRooms.find(r => r.id === id);
        if (room) {
          set({ currentRoom: room, isLoading: false });
          return room;
        } else {
          set({ error: '房间不存在', isLoading: false });
          return null;
        }
      } catch (error) {
        set({ 
          error: error instanceof Error ? error.message : '获取房间详情失败',
          isLoading: false 
        });
        return null;
      }
    },

    fetchMyRooms: async () => {
      set({ isLoading: true, error: null });
      try {
        // 模拟API调用
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const myRooms = mockRooms.filter(room => room.host.id === 999);
        set({ myRooms, isLoading: false });
      } catch (error) {
        set({ 
          error: error instanceof Error ? error.message : '获取我的房间失败',
          isLoading: false 
        });
      }
    },

    // 重置状态
    reset: () => set({
      rooms: [],
      filteredRooms: [],
      currentRoom: null,
      myRooms: [],
      searchTerm: '',
      statusFilter: '',
      activeTab: 'all',
      isMatching: false,
      matchPreferences: initialMatchPreferences,
      isLoading: false,
      error: null
    })
  }),
  {
    name: 'rooms-store',
    partialize: (state) => ({
      matchPreferences: state.matchPreferences,
      activeTab: state.activeTab
    })
  }
));

// 选择器函数
export const useRooms = () => useRoomsStore(state => state.rooms);
export const useFilteredRooms = () => useRoomsStore(state => state.filteredRooms);
export const useCurrentRoom = () => useRoomsStore(state => state.currentRoom);
export const useMyRooms = () => useRoomsStore(state => state.myRooms);
export const useRoomSearch = () => useRoomsStore(state => state.searchTerm);
export const useRoomStatusFilter = () => useRoomsStore(state => state.statusFilter);
export const useRoomActiveTab = () => useRoomsStore(state => state.activeTab);
export const useMatchPreferences = () => useRoomsStore(state => state.matchPreferences);
export const useIsMatching = () => useRoomsStore(state => state.isMatching);
export const useRoomLoading = () => useRoomsStore(state => state.isLoading);
export const useRoomError = () => useRoomsStore(state => state.error);

// 动作选择器
export const useRoomActions = () => useRoomsStore(state => ({
  setRooms: state.setRooms,
  setCurrentRoom: state.setCurrentRoom,
  setSearchTerm: state.setSearchTerm,
  setStatusFilter: state.setStatusFilter,
  setActiveTab: state.setActiveTab,
  createRoom: state.createRoom,
  joinRoom: state.joinRoom,
  leaveRoom: state.leaveRoom,
  updateRoom: state.updateRoom,
  deleteRoom: state.deleteRoom,
  kickPlayer: state.kickPlayer,
  promotePlayer: state.promotePlayer,
  togglePlayerReady: state.togglePlayerReady,
  sendMessage: state.sendMessage,
  addSystemMessage: state.addSystemMessage,
  updateRoomSettings: state.updateRoomSettings,
  setMatchPreferences: state.setMatchPreferences,
  startQuickMatch: state.startQuickMatch,
  stopMatching: state.stopMatching,
  applyFilters: state.applyFilters,
  clearFilters: state.clearFilters,
  fetchRooms: state.fetchRooms,
  fetchRoomDetail: state.fetchRoomDetail,
  fetchMyRooms: state.fetchMyRooms,
  reset: state.reset
}));