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
  const [isCharacterFormFullscreen, setIsCharacterFormFullscreen] = useState(true);
  
  // 声音列表相关状态
  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);

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

    }

    if (!editingCharacter?.id) {
      toast('请先保存角色后再生成头像');
      return;
    }

    setIsGeneratingImage(true);
    try {
      const request: ImageGenerationRequest = {
        positive_prompt: imageGenParams.positive_prompt,
        negative_prompt: imageGenParams.negative_prompt,
        script_id: Number(scriptId),
        target_id: editingCharacter.id,
        width: imageGenParams.width,
        height: imageGenParams.height,
        steps: imageGenParams.steps,
        cfg: imageGenParams.cfg_scale,
        seed: imageGenParams.seed
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
    <Card className="bg-gradient-to-br from-slate-800/90 via-purple-900/90 to-slate-800/90 backdrop-blur-md border-purple-500/30">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-bold text-purple-200 flex items-center gap-2">
            👥 角色管理
          </CardTitle>
          <Button 
            onClick={() => setShowCharacterForm(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500"
          >
            ➕ 添加角色
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* 角色卡片网格 */}
        <div className="mb-6">
          {characters.length === 0 ? (
            <div className="text-purple-300 text-center py-12 bg-slate-700/30 rounded-xl border-2 border-dashed border-purple-500/30">
              <div className="text-4xl mb-4">👥</div>
              <div className="text-lg">暂无角色</div>
              <div className="text-sm mt-2 opacity-70">点击上方按钮添加第一个角色</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {characters.map((character) => (
                <div key={character.id} className="bg-gradient-to-br from-slate-700/80 to-slate-800/80 rounded-xl p-6 border border-purple-500/20 hover:border-purple-400/40 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10 group">
                  {/* 卡片头部 */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-purple-200 mb-2 group-hover:text-purple-100 transition-colors">{character.name}</h4>
                      <div className="flex flex-wrap gap-2">
                        {character.is_victim && (
                          <Badge variant="destructive" className="bg-red-600/20 text-red-300 border-red-500/30">
                            💀 受害者
                          </Badge>
                        )}
                        {character.is_murderer && (
                          <Badge variant="destructive" className="bg-orange-600/20 text-orange-300 border-orange-500/30">
                            🔪 凶手
                          </Badge>
                        )}
                        {character.gender && (
                          <Badge variant="outline" className="bg-blue-600/20 text-blue-300 border-blue-500/30">
                            {character.gender === '男' ? '👨' : character.gender === '女' ? '👩' : '👤'} {character.gender}
                          </Badge>
                        )}
                        {character.age && (
                          <Badge variant="outline" className="bg-green-600/20 text-green-300 border-green-500/30">
                            🎂 {character.age}岁
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 头像区域 */}
                  <div className="mb-4">
                    {character.avatar_url ? (
                      <div className="w-full h-40 rounded-lg overflow-hidden border border-purple-500/30 bg-slate-800">
                        <img 
                          src={character.avatar_url} 
                          alt={character.name}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik02NCA5NkM3NC4yIDk2IDgyIDg4LjIgODIgNzhDODIgNjcuOCA3NC4yIDYwIDY0IDYwQzUzLjggNjAgNDYgNjcuOCA0NiA3OEM0NiA4OC4yIDUzLjggOTYgNjQgOTZaIiBmaWxsPSIjNkI3Mjg0Ii8+CjxwYXRoIGQ9Ik00MCA0MEg4OFY4OEg0MFY0MFoiIHN0cm9rZT0iIzZCNzI4NCIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIi8+PC9zdmc+Cg==';
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-40 rounded-lg border-2 border-dashed border-purple-500/30 flex items-center justify-center bg-slate-800/50">
                        <div className="text-center">
                          <div className="text-3xl mb-2 opacity-50">👤</div>
                          <div className="text-sm text-purple-300 opacity-70">暂无头像</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 角色信息 */}
                  <div className="space-y-3 mb-4">
                    {character.profession && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-purple-400">💼</span>
                        <span className="text-purple-200 font-medium">职业:</span>
                        <span className="text-purple-100 flex-1">{character.profession}</span>
                      </div>
                    )}
                    
                    {character.background && (
                      <div className="text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-purple-400">📖</span>
                          <span className="text-purple-200 font-medium">背景:</span>
                        </div>
                        <p className="text-purple-100 text-xs leading-relaxed pl-6 line-clamp-3">{character.background}</p>
                      </div>
                    )}
                    
                    {character.secret && (
                      <div className="text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-purple-400">🤫</span>
                          <span className="text-purple-200 font-medium">秘密:</span>
                        </div>
                        <p className="text-purple-100 text-xs leading-relaxed pl-6 line-clamp-2">{character.secret}</p>
                      </div>
                    )}
                    
                    {character.objective && (
                      <div className="text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-purple-400">🎯</span>
                          <span className="text-purple-200 font-medium">目标:</span>
                        </div>
                        <p className="text-purple-100 text-xs leading-relaxed pl-6 line-clamp-2">{character.objective}</p>
                      </div>
                    )}
                    
                    {character.personality_traits && character.personality_traits.length > 0 && (
                      <div className="text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-purple-400">🎭</span>
                          <span className="text-purple-200 font-medium">性格:</span>
                        </div>
                        <div className="flex flex-wrap gap-1 pl-6">
                          {character.personality_traits.map((trait, index) => (
                            <Badge key={index} variant="outline" className="text-xs bg-purple-600/20 text-purple-300 border-purple-500/30">
                              {trait}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {character.voice_id && (
                      <div className="text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-purple-400">🎤</span>
                          <span className="text-purple-200 font-medium">语音:</span>
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
                  <div className="flex gap-2 pt-4 border-t border-purple-500/20">
                    <Button
                      onClick={() => handleEditCharacter(character)}
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-blue-600/20 text-blue-300 border-blue-500/30 hover:bg-blue-600/30"
                    >
                      <span>✏️</span>
                      <span>编辑</span>
                    </Button>
                    <Button
                      onClick={() => handleDeleteCharacter(character.id!)}
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-red-600/20 text-red-300 border-red-500/30 hover:bg-red-600/30"
                    >
                      <span>🗑️</span>
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
            className={isCharacterFormFullscreen ? "overflow-y-auto bg-gradient-to-br from-slate-800/95 via-purple-900/95 to-slate-800/95 backdrop-blur-md border-purple-500/30" : "max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-800/95 via-purple-900/95 to-slate-800/95 backdrop-blur-md border-purple-500/30"}
            fullscreen={isCharacterFormFullscreen}
          >
            <DialogHeader className="flex flex-row items-center justify-between">
              <DialogTitle className="text-xl font-bold text-purple-200 flex items-center gap-2">
                {editingCharacter ? '✏️ 编辑角色' : '➕ 添加角色'}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCharacterFormFullscreen(!isCharacterFormFullscreen)}
                  className="text-purple-300 hover:text-purple-100 text-lg h-auto p-2"
                  title={isCharacterFormFullscreen ? '退出全屏' : '全屏显示'}
                >
                  {isCharacterFormFullscreen ? '🗗' : '🗖'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetForm}
                  className="text-purple-300 hover:text-purple-100 text-2xl h-auto p-1"
                >
                  ✕
                </Button>
              </div>
            </DialogHeader>
          
            <div className="space-y-6">
                {/* 基本信息 */}
                <div className="bg-slate-700/30 rounded-xl p-6 border border-purple-500/20">
                  <h3 className="text-lg font-semibold text-purple-200 mb-4 flex items-center gap-2">
                    👤 基本信息
                  </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-purple-200 font-medium">角色名称 *</label>
                    <Input
                      id="name"
                      value={characterForm.name}
                      onChange={(e) => setCharacterForm({ ...characterForm, name: e.target.value })}
                      required
                      className="bg-slate-800/50 border-purple-500/30 text-purple-100 placeholder-purple-400/50 focus:border-purple-400"
                      placeholder="输入角色名称"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="age" className="text-purple-200 font-medium">年龄</label>
                    <Input
                      id="age"
                      type="number"
                      value={characterForm.age || ''}
                      onChange={(e) => setCharacterForm({ ...characterForm, age: e.target.value ? parseInt(e.target.value) : undefined })}
                      className="bg-slate-800/50 border-purple-500/30 text-purple-100 placeholder-purple-400/50 focus:border-purple-400"
                      placeholder="输入年龄"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="gender" className="text-purple-200 font-medium">性别</label>
                    <Select value={characterForm.gender || ''} onValueChange={(value) => setCharacterForm({ ...characterForm, gender: value || undefined })}>
                      <SelectTrigger className="bg-slate-800/50 border-purple-500/30 text-purple-100 focus:border-purple-400">
                        <SelectValue placeholder="选择性别" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-purple-500/30">
                        <SelectItem value="男" className="text-purple-100 hover:bg-purple-600/20">👨 男</SelectItem>
                        <SelectItem value="女" className="text-purple-100 hover:bg-purple-600/20">👩 女</SelectItem>
                        <SelectItem value="中性" className="text-purple-100 hover:bg-purple-600/20">👤 中性</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="profession" className="text-purple-200 font-medium">职业</label>
                    <Input
                      id="profession"
                      value={characterForm.profession || ''}
                      onChange={(e) => setCharacterForm({ ...characterForm, profession: e.target.value || undefined })}
                      className="bg-slate-800/50 border-purple-500/30 text-purple-100 placeholder-purple-400/50 focus:border-purple-400"
                      placeholder="输入职业"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="voice_id" className="text-purple-200 font-medium">语音声音</label>
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
                    <label htmlFor="personality_traits" className="text-purple-200 font-medium">性格特征</label>
                    <Input
                      id="personality_traits"
                      value={characterForm.personality_traits?.join(', ') || ''}
                      onChange={(e) => {
                        const traits = e.target.value.split(',').map(t => t.trim()).filter(t => t);
                        setCharacterForm({ ...characterForm, personality_traits: traits.length > 0 ? traits : undefined });
                      }}
                      className="bg-slate-800/50 border-purple-500/30 text-purple-100 placeholder-purple-400/50 focus:border-purple-400"
                      placeholder="例如: 聪明, 勇敢, 善良 (用逗号分隔)"
                    />
                  </div>
                </div>
                
                {/* 角色标识 */}
                <div className="mt-4 space-y-3">
                  <label className="text-purple-200 font-medium">角色标识</label>
                  <div className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="is_victim"
                        checked={characterForm.is_victim || false}
                        onCheckedChange={(checked) => setCharacterForm({ ...characterForm, is_victim: !!checked })}
                        className="border-purple-500/30 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-500"
                      />
                      <label htmlFor="is_victim" className="text-red-300 font-medium cursor-pointer">💀 受害者</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="is_murderer"
                        checked={characterForm.is_murderer || false}
                        onCheckedChange={(checked) => setCharacterForm({ ...characterForm, is_murderer: !!checked })}
                        className="border-purple-500/30 data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-500"
                      />
                      <label htmlFor="is_murderer" className="text-orange-300 font-medium cursor-pointer">🔪 凶手</label>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 详细信息 */}
              <div className="bg-slate-700/30 rounded-xl p-6 border border-purple-500/20">
                <h3 className="text-lg font-semibold text-purple-200 mb-4 flex items-center gap-2">
                  📝 详细信息
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="background" className="text-purple-200 font-medium">背景故事</label>
                    <Textarea
                      id="background"
                      value={characterForm.background || ''}
                      onChange={(e) => setCharacterForm({ ...characterForm, background: e.target.value || undefined })}
                      rows={4}
                      className="bg-slate-800/50 border-purple-500/30 text-purple-100 placeholder-purple-400/50 focus:border-purple-400 resize-none"
                      placeholder="描述角色的背景故事..."
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="secret" className="text-purple-200 font-medium">秘密</label>
                    <Textarea
                      id="secret"
                      value={characterForm.secret || ''}
                      onChange={(e) => setCharacterForm({ ...characterForm, secret: e.target.value || undefined })}
                      rows={3}
                      className="bg-slate-800/50 border-purple-500/30 text-purple-100 placeholder-purple-400/50 focus:border-purple-400 resize-none"
                      placeholder="角色隐藏的秘密..."
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="objective" className="text-purple-200 font-medium">目标</label>
                    <Textarea
                      id="objective"
                      value={characterForm.objective || ''}
                      onChange={(e) => setCharacterForm({ ...characterForm, objective: e.target.value || undefined })}
                      rows={3}
                      className="bg-slate-800/50 border-purple-500/30 text-purple-100 placeholder-purple-400/50 focus:border-purple-400 resize-none"
                      placeholder="角色的目标和动机..."
                    />
                  </div>
                </div>
              </div>
              
              {/* AI头像生成 */}
              <div className="bg-slate-700/30 rounded-xl p-6 border border-purple-500/20">
                <h3 className="text-lg font-semibold text-purple-200 mb-4 flex items-center gap-2">
                  🎨 AI头像生成
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="positive_prompt" className="text-purple-200 font-medium">正向提示词</label>
                    <Textarea
                      id="positive_prompt"
                      value={imageGenParams.positive_prompt}
                      onChange={(e) => setImageGenParams(prev => ({ ...prev, positive_prompt: e.target.value }))}
                      rows={3}
                      className="bg-slate-800/50 border-purple-500/30 text-purple-100 placeholder-purple-400/50 focus:border-purple-400 resize-none"
                      placeholder="描述角色外观的正向提示词"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="negative_prompt" className="text-purple-200 font-medium">负向提示词</label>
                    <Textarea
                      id="negative_prompt"
                      value={imageGenParams.negative_prompt}
                      onChange={(e) => setImageGenParams(prev => ({ ...prev, negative_prompt: e.target.value }))}
                      rows={2}
                      className="bg-slate-800/50 border-purple-500/30 text-purple-100 placeholder-purple-400/50 focus:border-purple-400 resize-none"
                      placeholder="不希望出现的元素"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="width" className="text-purple-200 font-medium text-sm">宽度</label>
                      <Input
                        id="width"
                        type="number"
                        value={imageGenParams.width}
                        onChange={(e) => setImageGenParams(prev => ({ ...prev, width: parseInt(e.target.value) }))}
                        className="bg-slate-800/50 border-purple-500/30 text-purple-100 focus:border-purple-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="height" className="text-purple-200 font-medium text-sm">高度</label>
                      <Input
                        id="height"
                        type="number"
                        value={imageGenParams.height}
                        onChange={(e) => setImageGenParams(prev => ({ ...prev, height: parseInt(e.target.value) }))}
                        className="bg-slate-800/50 border-purple-500/30 text-purple-100 focus:border-purple-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="steps" className="text-purple-200 font-medium text-sm">步数</label>
                      <Input
                        id="steps"
                        type="number"
                        value={imageGenParams.steps}
                        onChange={(e) => setImageGenParams(prev => ({ ...prev, steps: parseInt(e.target.value) }))}
                        className="bg-slate-800/50 border-purple-500/30 text-purple-100 focus:border-purple-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="cfg_scale" className="text-purple-200 font-medium text-sm">CFG Scale</label>
                      <Input
                        id="cfg_scale"
                        type="number"
                        step="0.1"
                        value={imageGenParams.cfg_scale}
                        onChange={(e) => setImageGenParams(prev => ({ ...prev, cfg_scale: parseFloat(e.target.value) }))}
                        className="bg-slate-800/50 border-purple-500/30 text-purple-100 focus:border-purple-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="seed" className="text-purple-200 font-medium text-sm">种子</label>
                      <Input
                        id="seed"
                        type="number"
                        value={imageGenParams.seed}
                        onChange={(e) => setImageGenParams(prev => ({ ...prev, seed: parseInt(e.target.value) }))}
                        className="bg-slate-800/50 border-purple-500/30 text-purple-100 focus:border-purple-400"
                      />
                    </div>
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
                          <span className="animate-spin mr-2">⚡</span>
                          生成中...
                        </>
                      ) : (
                        <>
                          <span className="mr-2">🤖</span>
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
                          <span className="animate-spin mr-2">⚡</span>
                          生成中...
                        </>
                      ) : (
                        <>
                          <span className="mr-2">🎨</span>
                          生成AI头像
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {characterForm.avatar_url && (
                    <div className="mt-4">
                      <div className="w-32 h-32 rounded-lg overflow-hidden border border-purple-500/30 bg-slate-800">
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
            </div>
         
            <DialogFooter className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
                className="flex-1 bg-slate-600/20 text-slate-300 border-slate-500/30 hover:bg-slate-600/30"
              >
                取消
              </Button>
              <Button
                type="button"
                onClick={handleSaveCharacter}
                disabled={isLoading || !characterForm.name}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin mr-2">⚡</span>
                    保存中...
                  </>
                ) : (
                  <>
                    <span className="mr-2">{editingCharacter ? '💾' : '➕'}</span>
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