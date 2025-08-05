import React, { useEffect, useState } from 'react';
import { ScriptCharacter as Character, ImageGenerationRequestModel as ImageGenerationRequest } from '@/client';
import { 
  Service,
  CharacterCreateRequest,
  CharacterUpdateRequest,
  CharacterPromptRequest,
  ImageGenerationRequestModel
} from '@/client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Users, Plus, User, Calendar, Briefcase, Book, EyeOff, Target, Mic, Edit, Trash2, VolumeX, FileText, Palette, Bot, Zap, Save, Minimize2, Maximize2, X } from 'lucide-react';

// 声音选项接口
interface VoiceOption {
  voice_id: string;
  voice_name: string;
  description?: string[];
  created_time: string;
}

interface CharacterManagerProps {
  scriptId: string;
}

const CharacterManager: React.FC<CharacterManagerProps> = ({
  scriptId
}) => {
  // 角色相关状态
  const [characters, setCharacters] = useState<Character[]>([]);
  const [showCharacterForm, setShowCharacterForm] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [isCharacterFormFullscreen, setIsCharacterFormFullscreen] = useState(false);
  
  // 声音列表相关状态
  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  
  // 图片生成相关状态
  const [imageGenParams, setImageGenParams] = useState({
    positive_prompt: '',
    negative_prompt: '',
    width: 512,
    height: 512,
    steps: 20,
    cfg_scale: 7,
    seed: 1
  });
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 使用 client services 替代 useApiClient
  const getCharacters = async (scriptId: number) => {
    const response = await Service.getCharactersApiCharactersScriptIdCharactersGet(scriptId);
    return response.data;
  };
  
  const createCharacter = async (request: CharacterCreateRequest) => {
    const response = await Service.createCharacterApiCharactersScriptIdCharactersPost(Number(scriptId), request);
    return response.data;
  };
  
  const getVoiceOptions = async () => {
    const response = await Service.getAvailableVoicesApiTtsVoicesGet();
    return response.data.system_voice;
  };
  
  const updateCharacter = async (scriptId: number, characterId: number, request: CharacterUpdateRequest) => {
    const response = await Service.updateCharacterApiCharactersScriptIdCharactersCharacterIdPut(scriptId, characterId, request);
    return response.data;
  };
  
  const deleteCharacter = async (scriptId: number, characterId: number) => {
    const response = await Service.deleteCharacterApiCharactersScriptIdCharactersCharacterIdDelete(scriptId, characterId);
    return response.data;
  };
  
  const generateCharacterPrompt = async (request: CharacterPromptRequest) => {
    const response = await Service.generateCharacterPromptApiCharactersCharactersGeneratePromptPost(request);
    return response.data;
  };
  
  const generateAvatarImage = async (request: ImageGenerationRequestModel) => {
    const response = await Service.generateAvatarImageApiScriptsGenerateAvatarPost(request);
    return response.data;
  };

  const [characterForm, setCharacterForm] = useState<Partial<Character>>({
    name: '',
    age: undefined,
    profession: '',
    background: '',
    secret: '',
    objective: '',
    gender: '中性',
    is_murderer: false,
    is_victim: false,
    personality_traits: [],
    avatar_url: '',
    voice_id: undefined
  });
  
  // 获取声音列表
  const fetchVoiceOptions = async () => {
    setIsLoadingVoices(true);
    try {
      const options = await getVoiceOptions();
      setVoiceOptions(options);
    } finally {
      setIsLoadingVoices(false);
    }
  };
  
  useEffect(() => {
    console.log('useEffect', scriptId);
    
    initCharacterForm();
    fetchVoiceOptions();
  }, [scriptId]);
  
  // 当表单打开时获取声音列表
  useEffect(() => {
    if (showCharacterForm && voiceOptions.length === 0) {
      fetchVoiceOptions();
    }
  }, [showCharacterForm]);

  const initCharacterForm = async () => {
    console.log('initCharacterForm', scriptId);
    
    if(scriptId){
      const charactersData = await getCharacters(Number(scriptId));
      if(charactersData){
        setCharacters(charactersData);
      }
    }
  };

  // 添加或编辑角色
  const handleSaveCharacter = async () => {
    setIsLoading(true);
    try {
      if (editingCharacter) {
        // 编辑模式 - 调用更新API
        await updateCharacter(Number(scriptId), editingCharacter.id!, {
          name: characterForm.name,
          age: characterForm.age ?? null,
          profession: characterForm.profession,
          background: characterForm.background,
          secret: characterForm.secret,
          objective: characterForm.objective,
          gender: characterForm.gender || '中性',
          is_murderer: characterForm.is_murderer,
          is_victim: characterForm.is_victim,
          personality_traits: characterForm.personality_traits,
          avatar_url: characterForm.avatar_url || '',
          voice_id: characterForm.voice_id
        });
        toast('角色更新成功！');
      } else {
        // 添加模式 - 调用创建API
        await createCharacter({
          name: characterForm.name || '',
          age: characterForm.age ?? 0,
          profession: characterForm.profession,
          background: characterForm.background,
          secret: characterForm.secret,
          objective: characterForm.objective,
          gender: characterForm.gender || '中性',
          is_murderer: characterForm.is_murderer,
          is_victim: characterForm.is_victim,
          personality_traits: characterForm.personality_traits,
          voice_id: characterForm.voice_id
        });
        toast('角色创建成功！');
      }
      
      // 重新加载角色列表
      await initCharacterForm();
      
      // 重置表单
      resetForm();
    } catch (error) {
      console.error('保存角色失败:', error);
      toast('保存角色失败，请重试。');
    } finally {
      setIsLoading(false);
    }
  };

  // 重置表单
  const resetForm = () => {
    setCharacterForm({
      name: '',
      age: undefined,
      profession: '',
      background: '',
      secret: '',
      objective: '',
      gender: '中性',
      is_murderer: false,
      is_victim: false,
      personality_traits: [],
      avatar_url: '',
      voice_id: undefined
    });
    setEditingCharacter(null);
    setShowCharacterForm(false);
  };

  // 编辑角色
  const handleEditCharacter = (character: Character) => {
    setCharacterForm(character);
    setEditingCharacter(character);
    setShowCharacterForm(true);
  };

  // 删除角色
  const handleDeleteCharacter = async (id: number) => {
    if (confirm('确定要删除这个角色吗？')) {
      try {
        await deleteCharacter(Number(scriptId), id);
        toast('角色删除成功！');
        
        // 重新加载角色列表
        await initCharacterForm();
      } catch (error) {
        console.error('删除角色失败:', error);
        toast('删除角色失败，请重试。');
      }
    }
  };

  // 生成提示词
  const handlePromptGeneration = async () => {
    if (!characterForm.name || !characterForm.background) {
      toast('请先填写角色名称和背景故事');
      return;
    }

    setIsGeneratingPrompt(true);
    try {
      const result = await generateCharacterPrompt({
        character_name: characterForm.name,
        character_description: characterForm.background || '',
        profession: characterForm.profession || '',
        age: characterForm.age,
        gender: characterForm.gender || '中性',
        personality_traits: characterForm.personality_traits || [],
        script_context: '' // 可以从剧本信息中获取
      });

      if (result) {
        // 更新图片生成参数
        setImageGenParams(prev => ({
          ...prev,
          positive_prompt: result.prompt,
        }));
        toast('提示词生成成功！');
      }
    } catch (error) {
      console.error('提示词生成失败:', error);
      toast('提示词生成失败，请重试。');
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  // 生成头像
  const handleImageGeneration = async () => {
    if (!generateAvatarImage) {
      return;
    }

    if (!editingCharacter?.id) {
      toast('请先保存角色后再生成头像');
      return;
    }

    setIsGeneratingImage(true);
    try {
      const request: ImageGenerationRequest = {
        positive_prompt: imageGenParams.positive_prompt,
        negative_prompt: '',
        script_id: Number(scriptId),
        target_id: editingCharacter.id,
        width: 512,
        height: 512,
        steps: 20,
        cfg: 7,
        seed: -1
      };
      
      const result = await generateAvatarImage(request);
      if (result && result.url) {
        setCharacterForm(prev => ({ ...prev, avatar_url: result.url }));
        initCharacterForm();
        toast('头像生成成功！');
      } else {
        throw new Error('生成结果无效');
      }
    } catch (error) {
      console.error('头像生成失败:', error);
      toast('头像生成失败，请重试。');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <Card className="border-blue-500/30 shadow-2xl shadow-blue-500/10 modern-card">
      <CardHeader className="relative overflow-hidden">  
        <div className="relative flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 rounded-lg border border-blue-500/30">
              <Users className="w-6 h-6 text-blue-200" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-blue-200 flex items-center gap-2">
                角色管理
              </CardTitle>
              <p className="text-sm text-blue-300/70 mt-1">管理剧本中的所有角色信息</p>
            </div>
          </div>
          <Button 
            onClick={() => setShowCharacterForm(true)}
            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-lg hover:shadow-blue-500/25 transition-all duration-300 modern-button"
          >
            <Plus className="w-4 h-4 mr-2" />
            添加角色
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* 角色卡片网格 */}
        <div className="mb-6">
          {characters.length === 0 ? (
          <div className="text-blue-300 text-center py-16 bg-gradient-to-br from-slate-700/30 to-slate-800/30 rounded-2xl border-2 border-dashed border-blue-500/30 backdrop-blur-sm modern-empty-state">
            <div className="text-6xl mb-6 opacity-60"><Users className="w-16 h-16 mx-auto" /></div>
            <div className="text-xl font-semibold mb-2">暂无角色</div>
            <div className="text-sm opacity-70 mb-6">点击上方按钮添加第一个角色</div>
            <div className="flex justify-center">
              <Button 
                onClick={() => setShowCharacterForm(true)}
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
              >
                <Plus className="w-4 h-4 mr-2" />
                立即添加
              </Button>
            </div>
          </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {characters.map((character) => (
                <div key={character.id} className="bg-gradient-to-br from-slate-700/80 to-slate-800/80 rounded-2xl p-6 border border-blue-500/20 hover:border-blue-400/40 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/20 hover:scale-[1.02] group modern-card character-card">
                  {/* 卡片头部 */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h4 className="text-xl font-bold text-blue-200 mb-3 group-hover:text-blue-100 transition-colors flex items-center gap-2">
                        <User className="w-5 h-5" />
                        {character.name}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {character.is_victim && (
                          <Badge variant="destructive" className="bg-red-600/20 text-red-300 border-red-500/30">
                            <VolumeX className="w-3 h-3 mr-1" /> 受害者
                          </Badge>
                        )}
                        {character.is_murderer && (
                          <Badge variant="destructive" className="bg-orange-600/20 text-orange-300 border-orange-500/30">
                            <Target className="w-3 h-3 mr-1" /> 凶手
                          </Badge>
                        )}
                        {character.gender && (
                          <Badge variant="outline" className="bg-blue-600/20 text-blue-300 border-blue-500/30">
                            <User className="w-3 h-3 mr-1" /> {character.gender}
                          </Badge>
                        )}
                        {character.age && (
                          <Badge variant="outline" className="bg-green-600/20 text-green-300 border-green-500/30">
                            <Calendar className="w-3 h-3 mr-1" /> {character.age}岁
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 头像区域 */}
                  <div className="mb-6">
                    {character.avatar_url ? (
                      <div className="w-full h-48 rounded-xl overflow-hidden border border-blue-500/30 bg-slate-800 shadow-lg group-hover:shadow-blue-500/20 transition-all duration-300">
                        <img 
                          src={character.avatar_url} 
                          alt={character.name}
                          className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik02NCA5NkM3NC4yIDk2IDgyIDg4LjIgODIgNzhDODIgNjcuOCA3NC4yIDYwIDY0IDYwQzUzLjggNjAgNDYgNjcuOCA0NiA3OEM0NiA4OC4yIDUzLjggOTYgNjQgOTZaIiBmaWxsPSIjNkI3Mjg0Ii8+CjxwYXRoIGQ9Ik00MCA0MEg4OFY4OEg0MFY0MFoiIHN0cm9rZT0iIzZCNzI4NCIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIi8+PC9zdmc+Cg==';
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-48 rounded-xl border-2 border-dashed border-blue-500/30 flex items-center justify-center bg-gradient-to-br from-slate-800/50 to-slate-700/50 backdrop-blur-sm">
                        <div className="text-center">
                          <div className="text-5xl mb-3 opacity-60"><User className="w-12 h-12 mx-auto" /></div>
                          <div className="text-sm text-blue-300 opacity-70">暂无头像</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 角色信息 */}
                  <div className="space-y-3 mb-4">
                    {character.profession && (
                      <div className="flex items-center gap-2 text-sm">
                        <Briefcase className="w-4 h-4 text-blue-400" />
                        <span className="text-blue-200 font-medium">职业:</span>
                        <span className="text-blue-100 flex-1">{character.profession}</span>
                      </div>
                    )}
                    
                    {character.background && (
                      <div className="text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <Book className="w-4 h-4 text-blue-400" />
                          <span className="text-blue-200 font-medium">背景:</span>
                        </div>
                        <p className="text-blue-100 text-xs leading-relaxed pl-6 line-clamp-3">{character.background}</p>
                      </div>
                    )}
                    
                    {character.secret && (
                      <div className="text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <EyeOff className="w-4 h-4 text-blue-400" />
                          <span className="text-blue-200 font-medium">秘密:</span>
                        </div>
                        <p className="text-blue-100 text-xs leading-relaxed pl-6 line-clamp-2">{character.secret}</p>
                      </div>
                    )}
                    
                    {character.objective && (
                      <div className="text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <Target className="w-4 h-4 text-blue-400" />
                          <span className="text-blue-200 font-medium">目标:</span>
                        </div>
                        <p className="text-blue-100 text-xs leading-relaxed pl-6 line-clamp-2">{character.objective}</p>
                      </div>
                    )}
                    
                    {character.personality_traits && character.personality_traits.length > 0 && (
                      <div className="text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-4 h-4 text-blue-400" />
                          <span className="text-blue-200 font-medium">性格:</span>
                        </div>
                        <div className="flex flex-wrap gap-1 pl-6">
                          {character.personality_traits.map((trait, index) => (
                            <Badge key={index} variant="outline" className="text-xs bg-blue-600/20 text-blue-300 border-blue-500/30">
                              {trait}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {character.voice_id && (
                      <div className="text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <Mic className="w-4 h-4 text-blue-400" />
                          <span className="text-blue-200 font-medium">语音:</span>
                        </div>
                        <div className="pl-6">
                          <Badge variant="outline" className="text-xs bg-green-600/20 text-green-300 border-green-500/30">
                            {voiceOptions.find(v => v.voice_id === character.voice_id)?.voice_name || character.voice_id}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* 操作按钮 */}
                  <div className="flex gap-3 pt-6 border-t border-blue-500/20">
                    <Button
                      onClick={() => handleEditCharacter(character)}
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 text-blue-300 border-blue-500/30 hover:from-blue-600/40 hover:to-cyan-600/40 hover:border-blue-400/50 transition-all duration-300 modern-button"
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      <span>编辑</span>
                    </Button>
                    <Button
                      onClick={() => handleDeleteCharacter(character.id!)}
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-gradient-to-r from-red-600/20 to-pink-600/20 text-red-300 border-red-500/30 hover:from-red-600/40 hover:to-pink-600/40 hover:border-red-400/50 transition-all duration-300 modern-button"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      <span>删除</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 角色表单对话框 */}
        <Dialog open={showCharacterForm} onOpenChange={setShowCharacterForm}>
          <DialogContent 
            showCloseButton={false}
            className="bg-gradient-to-br from-slate-900/98 via-blue-950/98 to-slate-900/98 backdrop-blur-xl border-blue-500/40 !max-w-[95vw] !w-[95vw] max-h-[95vh] overflow-hidden custom-scrollbar"
          >
            <DialogHeader className="flex flex-row items-center justify-between border-b border-blue-500/20 pb-6">
              <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-200 to-cyan-200 bg-clip-text text-transparent flex items-center gap-3">
                <User className="w-6 h-6 text-blue-400" />
                {editingCharacter ? '编辑角色' : '添加角色'}
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetForm}
                className="text-blue-300 hover:text-blue-100 hover:bg-blue-500/20 h-auto p-3 rounded-lg transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </Button>
            </DialogHeader>
          
            <div className="space-y-6 overflow-y-auto custom-scrollbar dialog-content-scroll flex-1 max-h-[70vh]">
              {/* AI头像生成 - 移动到最顶部 */}
              <div className="bg-slate-700/30 rounded-xl p-6 border border-blue-500/20">
                <h3 className="text-lg font-semibold text-blue-200 mb-4 flex items-center gap-2">
                  <Palette className="w-5 h-5" /> AI头像生成
                </h3>
                <div className="flex gap-6">
                  {/* 左侧：生成控件 */}
                  <div className="flex-1 space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="positive_prompt" className="text-blue-200 font-medium">正向提示词</label>
                      <Textarea
                        id="positive_prompt"
                        value={imageGenParams.positive_prompt}
                        onChange={(e) => setImageGenParams(prev => ({ ...prev, positive_prompt: e.target.value }))}
                        rows={3}
                        className="bg-slate-800/50 border-blue-500/30 text-blue-100 placeholder-blue-400/50 focus:border-blue-400 resize-none"
                        placeholder="描述角色外观的正向提示词"
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={handlePromptGeneration}
                        disabled={isGeneratingPrompt || !characterForm.name || !characterForm.background}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50"
                      >
                        {isGeneratingPrompt ? (
                          <>
                            <Zap className="w-4 h-4 mr-2 animate-spin" />
                            生成中...
                          </>
                        ) : (
                          <>
                            <Bot className="w-4 h-4 mr-2" />
                            生成提示词
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        onClick={handleImageGeneration}
                        disabled={isGeneratingImage || !imageGenParams.positive_prompt.trim()}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50"
                      >
                        {isGeneratingImage ? (
                          <>
                            <Zap className="w-4 h-4 mr-2 animate-spin" />
                            生成中...
                          </>
                        ) : (
                          <>
                            <Palette className="w-4 h-4 mr-2" />
                            生成AI头像
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {/* 右侧：头像预览 */}
                  {characterForm.avatar_url && (
                    <div className="flex-shrink-0">
                      <label className="block text-sm font-medium text-blue-200 mb-2">头像预览</label>
                      <div className="w-32 h-32 rounded-lg overflow-hidden border border-blue-500/30 bg-slate-800">
                        <img 
                          src={characterForm.avatar_url} 
                          alt="角色头像"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
                {/* 基本信息 */}
                <div className="bg-slate-700/30 rounded-xl p-6 border border-blue-500/20">
                  <h3 className="text-lg font-semibold text-blue-200 mb-4 flex items-center gap-2">
                    <User className="w-5 h-5" /> 基本信息
                  </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-blue-200 font-medium">角色名称 *</label>
                    <Input
                      id="name"
                      value={characterForm.name}
                      onChange={(e) => setCharacterForm({ ...characterForm, name: e.target.value })}
                      required
                      className="bg-slate-800/50 border-blue-500/30 text-blue-100 placeholder-blue-400/50 focus:border-blue-400"
                      placeholder="输入角色名称"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="age" className="text-blue-200 font-medium">年龄</label>
                    <Input
                      id="age"
                      type="number"
                      value={characterForm.age || ''}
                      onChange={(e) => setCharacterForm({ ...characterForm, age: e.target.value ? parseInt(e.target.value) : undefined })}
                      className="bg-slate-800/50 border-blue-500/30 text-blue-100 placeholder-blue-400/50 focus:border-blue-400"
                      placeholder="输入年龄"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="gender" className="text-blue-200 font-medium">性别</label>
                    <Select value={characterForm.gender || ''} onValueChange={(value) => setCharacterForm({ ...characterForm, gender: value || undefined })}>
                      <SelectTrigger className="bg-slate-800/50 border-blue-500/30 text-blue-100 focus:border-blue-400">
                        <SelectValue placeholder="选择性别" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-blue-500/30">
                         <SelectItem value="男" className="text-blue-100 hover:bg-blue-600/20"><User className="w-4 h-4 inline mr-2" />男</SelectItem>
                         <SelectItem value="女" className="text-blue-100 hover:bg-blue-600/20"><User className="w-4 h-4 inline mr-2" />女</SelectItem>
                         <SelectItem value="中性" className="text-blue-100 hover:bg-blue-600/20"><User className="w-4 h-4 inline mr-2" />中性</SelectItem>
                       </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="profession" className="text-blue-200 font-medium">职业</label>
                    <Input
                      id="profession"
                      value={characterForm.profession || ''}
                      onChange={(e) => setCharacterForm({ ...characterForm, profession: e.target.value || undefined })}
                      className="bg-slate-800/50 border-blue-500/30 text-blue-100 placeholder-blue-400/50 focus:border-blue-400"
                      placeholder="输入职业"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="voice_id" className="text-blue-200 font-medium">语音声音</label>
                    <Combobox
                      options={[
                        { value: 'none', label: '🔇 无声音' },
                        ...voiceOptions.map((voice) => ({
                          value: voice.voice_id,
                          label: `🎤 ${voice.voice_name}`,
                          description: voice.description ? voice.description.join(', ') : undefined
                        }))
                      ]}
                      value={characterForm.voice_id || 'none'}
                      onValueChange={(value) => setCharacterForm({ ...characterForm, voice_id: value === 'none' ? undefined : value })}
                      placeholder={isLoadingVoices ? "加载中..." : "选择语音声音"}
                      searchPlaceholder="搜索语音声音..."
                      emptyText="未找到匹配的语音"
                      disabled={isLoadingVoices}
                    />
                  </div>
                  
                  <div className="space-y-2 md:col-span-2">
                    <label htmlFor="personality_traits" className="text-blue-200 font-medium">性格特征</label>
                    <Input
                      id="personality_traits"
                      value={characterForm.personality_traits?.join(', ') || ''}
                      onChange={(e) => {
                        const traits = e.target.value.split(',').map(t => t.trim()).filter(t => t);
                        setCharacterForm({ ...characterForm, personality_traits: traits.length > 0 ? traits : undefined });
                      }}
                      className="bg-slate-800/50 border-blue-500/30 text-blue-100 placeholder-blue-400/50 focus:border-blue-400"
                      placeholder="例如: 聪明, 勇敢, 善良 (用逗号分隔)"
                    />
                  </div>
                </div>
                
                {/* 角色标识 */}
                <div className="mt-4 space-y-3">
                  <label className="text-blue-200 font-medium">角色标识</label>
                  <div className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="is_victim"
                        checked={characterForm.is_victim || false}
                        onCheckedChange={(checked) => setCharacterForm({ ...characterForm, is_victim: !!checked })}
                        className="border-blue-500/30 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-500"
                      />
                      <label htmlFor="is_victim" className="text-red-300 font-medium cursor-pointer flex items-center gap-2"><VolumeX className="w-4 h-4" />受害者</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="is_murderer"
                        checked={characterForm.is_murderer || false}
                        onCheckedChange={(checked) => setCharacterForm({ ...characterForm, is_murderer: !!checked })}
                        className="border-blue-500/30 data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-500"
                      />
                      <label htmlFor="is_murderer" className="text-orange-300 font-medium cursor-pointer flex items-center gap-2"><Target className="w-4 h-4" />凶手</label>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 详细信息 */}
              <div className="bg-slate-700/30 rounded-xl p-6 border border-blue-500/20">
                <h3 className="text-lg font-semibold text-blue-200 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" /> 详细信息
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="background" className="text-blue-200 font-medium">背景故事</label>
                    <Textarea
                      id="background"
                      value={characterForm.background || ''}
                      onChange={(e) => setCharacterForm({ ...characterForm, background: e.target.value || undefined })}
                      rows={4}
                      className="bg-slate-800/50 border-blue-500/30 text-blue-100 placeholder-blue-400/50 focus:border-blue-400 resize-none"
                      placeholder="描述角色的背景故事..."
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="secret" className="text-blue-200 font-medium">秘密</label>
                    <Textarea
                      id="secret"
                      value={characterForm.secret || ''}
                      onChange={(e) => setCharacterForm({ ...characterForm, secret: e.target.value || undefined })}
                      rows={3}
                      className="bg-slate-800/50 border-blue-500/30 text-blue-100 placeholder-blue-400/50 focus:border-blue-400 resize-none"
                      placeholder="角色隐藏的秘密..."
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="objective" className="text-blue-200 font-medium">目标</label>
                    <Textarea
                      id="objective"
                      value={characterForm.objective || ''}
                      onChange={(e) => setCharacterForm({ ...characterForm, objective: e.target.value || undefined })}
                      rows={3}
                      className="bg-slate-800/50 border-blue-500/30 text-blue-100 placeholder-blue-400/50 focus:border-blue-400 resize-none"
                      placeholder="角色的目标和动机..."
                    />
                  </div>
                </div>
              </div>
              

            </div>
         
            <DialogFooter className="flex justify-center mt-8 pt-6 border-t border-blue-500/20">
              <Button
                type="button"
                onClick={handleSaveCharacter}
                disabled={isLoading || !characterForm.name}
                className="bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 hover:from-blue-500 hover:via-cyan-500 hover:to-teal-500 disabled:opacity-50 text-white px-8 py-3 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {isLoading ? (
                  <>
                    <Zap className="w-4 h-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {editingCharacter ? '更新角色' : '创建角色'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default CharacterManager;