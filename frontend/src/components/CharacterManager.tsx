import { CharacterCreateRequest, CharacterUpdateRequest, ImageType, ScriptCharacter, Service } from '@/client';
import ImageSelector from '@/components/ImageSelector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Book,
  Briefcase,
  Calendar,
  Edit,
  EyeOff,
  Mic,
  Plus,
  Target,
  Trash2,
  User,
  Users,
  VolumeX,
  X
} from 'lucide-react';
import Image from 'next/image';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

interface CharacterManagerProps {
  scriptId: string;
  onCharacterUpdate?: () => void;
}
interface VoiceOption {
  voice_id: string;
  voice_name: string;
  description?: string[];
  created_time: string;
}
const CharacterManager: React.FC<CharacterManagerProps> = ({ 
  scriptId, 
  onCharacterUpdate 
}) => {
  const [characters, setCharacters] = useState<ScriptCharacter[]>([]);
  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([]);
  const [showCharacterForm, setShowCharacterForm] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<ScriptCharacter | null>(null);
  const [characterForm, setCharacterForm] = useState<Partial<ScriptCharacter>>({});

  // 获取服务
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
  
  
  // 初始化角色表单
  const initCharacterForm = () => {
    setCharacterForm({
      name: '',
      age: undefined,
      gender: undefined,
      profession: undefined,
      background: undefined,
      secret: undefined,
      objective: undefined,
      personality_traits: undefined,
      voice_id: undefined,
      is_victim: false,
      is_murderer: false,
      avatar_url: undefined
    });
  };

  // 加载角色列表
  const loadCharacters = useCallback(async () => {
    try {
      if(scriptId){
        const charactersData = await getCharacters(Number(scriptId));
        if(charactersData){
          setCharacters(charactersData);
        }
      }
    } catch (error) {
      console.error('加载角色失败:', error);
      toast('加载角色失败');
    }
  }, [scriptId]);

  // 加载语音选项
  const loadVoiceOptions = useCallback(async () => {
    try {
      const voices = await getVoiceOptions();
      setVoiceOptions(voices || []);
    } catch (error) {
      console.error('加载语音选项失败:', error);
    }
  }, []);

  useEffect(() => {
    if (showCharacterForm && voiceOptions.length === 0) {
      loadVoiceOptions();
    }
  }, [showCharacterForm, voiceOptions.length, loadVoiceOptions]);

  useEffect(() => {
    if(scriptId){
      loadCharacters();
    }
  }, [scriptId, loadCharacters]);

  // 编辑角色
  const handleEditCharacter = (character: ScriptCharacter) => {
    setEditingCharacter(character);
    setCharacterForm({
      ...character,
      personality_traits: character.personality_traits || []
    });
    setShowCharacterForm(true);
  };

  // 保存角色
  const handleSaveCharacter = async () => {
    try {
      const characterData = {
        ...characterForm,
        script_id: Number(scriptId)
      };

      if (editingCharacter) {
        await updateCharacter(Number(scriptId),editingCharacter.id!, characterData);
        toast('角色更新成功！');
      } else {
        await createCharacter(characterData as CharacterCreateRequest);
        toast('角色创建成功！');
      }

      setShowCharacterForm(false);
      setEditingCharacter(null);
      initCharacterForm();
      loadCharacters();
      onCharacterUpdate?.();
    } catch (error) {
      console.error('保存角色失败:', error);
      toast('保存角色失败，请重试。');
    }
  };

  // 删除角色
  const handleDeleteCharacter = async (characterId: number) => {
    try {
      if (confirm('确定要删除这个角色吗？')) {
        await deleteCharacter(Number(scriptId),characterId);
        toast('角色删除成功！');
        loadCharacters();
        onCharacterUpdate?.();
      }
    } catch (error) {
      console.error('删除角色失败:', error);
      toast('删除角色失败，请重试。');
    }
  };

  // 生成提示词

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
                        <Image 
                          src={character.avatar_url || ''} 
                          alt={character.name || ''}
                          width={256}
                          height={192}
                          className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik02NCA5NkM3NC4yIDk2IDgyIDg4LjIgODIgNzhDODIgNjcuOCA3NC4yIDYwIDY0IDYwQzUzLjggNjAgNDYgNjcuOCA0NiA3OEM0NiA4OC4yIDUzLjggOTYgNjQgOTZaIiBmaWxsPSIjNkI3Mjg0Ci8+CjxwYXRoIGQ9Ik00MCA0MEg4OFY4OEg0MFY0MFoiIHN0cm9rZT0iIzZCNzI4NCIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIi8+PC9zdmc+Cg==';
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
      </CardContent>

      {/* 角色编辑对话框 */}
      <Dialog open={showCharacterForm} onOpenChange={setShowCharacterForm}>
        <DialogContent showCloseButton={false} className="max-w-5xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-800/95 to-slate-900/95 border-blue-500/30 shadow-2xl shadow-blue-500/20 backdrop-blur-lg">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-semibold text-blue-200 flex items-center gap-2">
                <Users className="w-5 h-5" />
                {editingCharacter ? '编辑角色' : '添加角色'}
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCharacterForm(false);
                  setEditingCharacter(null);
                  initCharacterForm();
                }}
                className="text-blue-300 hover:text-blue-100 hover:bg-blue-500/20 h-auto p-3 rounded-lg transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </DialogHeader>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 左侧：基本信息 */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-blue-200 font-medium">角色名称 *</Label>
                <Input
                  id="name"
                  value={characterForm.name || ''}
                  onChange={(e) => setCharacterForm({ ...characterForm, name: e.target.value })}
                  className="bg-slate-700/50 border-blue-500/30 text-blue-100 focus:border-blue-400/50"
                  placeholder="输入角色名称"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="age" className="text-blue-200 font-medium">年龄</Label>
                  <Input
                    id="age"
                    type="number"
                    value={characterForm.age || ''}
                    onChange={(e) => setCharacterForm({ ...characterForm, age: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="bg-slate-700/50 border-blue-500/30 text-blue-100 focus:border-blue-400/50"
                    placeholder="年龄"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-blue-200 font-medium">性别</Label>
                  <Select value={characterForm.gender || ''} onValueChange={(value) => setCharacterForm({ ...characterForm, gender: value || undefined })}>
                    <SelectTrigger className="bg-slate-700/50 border-blue-500/30 text-blue-100">
                      <SelectValue placeholder="选择性别" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="男">男</SelectItem>
                      <SelectItem value="女">女</SelectItem>
                      <SelectItem value="其他">其他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profession" className="text-blue-200 font-medium">职业</Label>
                <Input
                  id="profession"
                  value={characterForm.profession || ''}
                  onChange={(e) => setCharacterForm({ ...characterForm, profession: e.target.value || undefined })}
                  className="bg-slate-700/50 border-blue-500/30 text-blue-100 focus:border-blue-400/50"
                  placeholder="输入职业"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-blue-200 font-medium">性格特征</Label>
                <MultiSelect
                  options={[
                    { value: '冷静', label: '冷静' },
                    { value: '热情', label: '热情' },
                    { value: '谨慎', label: '谨慎' },
                    { value: '冲动', label: '冲动' },
                    { value: '聪明', label: '聪明' },
                    { value: '善良', label: '善良' },
                    { value: '狡猾', label: '狡猾' },
                    { value: '勇敢', label: '勇敢' },
                    { value: '胆小', label: '胆小' },
                    { value: '幽默', label: '幽默' }
                  ]}
                  selected={characterForm.personality_traits || []}
                  onChange={(traits) => {
                    setCharacterForm({ ...characterForm, personality_traits: traits.length > 0 ? traits : undefined });
                  }}
                  placeholder="选择性格特征"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-blue-200 font-medium">语音</Label>
                <Select 
                  value={characterForm.voice_id || 'none'} 
                  onValueChange={(value) => setCharacterForm({ ...characterForm, voice_id: value === 'none' ? undefined : value })}
                  searchable={true}
                >
                  <SelectTrigger className="bg-slate-700/50 border-blue-500/30 text-blue-100">
                    <SelectValue placeholder="选择语音" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">无语音</SelectItem>
                    {voiceOptions.map((voice) => (
                      <SelectItem key={voice.voice_id} value={voice.voice_id}>
                        {voice.voice_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_victim"
                    checked={characterForm.is_victim || false}
                    onCheckedChange={(checked) => setCharacterForm({ ...characterForm, is_victim: !!checked })}
                  />
                  <Label htmlFor="is_victim" className="text-blue-200 font-medium">受害者</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_murderer"
                    checked={characterForm.is_murderer || false}
                    onCheckedChange={(checked) => setCharacterForm({ ...characterForm, is_murderer: !!checked })}
                  />
                  <Label htmlFor="is_murderer" className="text-blue-200 font-medium">凶手</Label>
                </div>
              </div>
            </div>

            {/* 右侧：头像和详细信息 */}
            <div className="space-y-4">
              {/* 头像选择器 */}
              <div className="space-y-2">
                <Label className="text-blue-200 font-medium">角色头像</Label>
                <ImageSelector
                  imageType={ImageType.CHARACTER}
                  scriptId={scriptId}
                  url={characterForm.avatar_url || ''}
                  onImageChange={(url) => setCharacterForm(prev => ({ ...prev, avatar_url: url }))}
                  contextInfo={JSON.stringify({
                    name: characterForm.name,
                    age: characterForm.age,
                    gender: characterForm.gender,
                    profession: characterForm.profession,
                    personality_traits: characterForm.personality_traits,
                    background: characterForm.background,
                    is_victim: characterForm.is_victim,
                    is_murderer: characterForm.is_murderer
                  })}
                />
              </div>

              {/* 详细信息 */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="background" className="text-blue-200 font-medium">背景故事 *</Label>
                  <Textarea
                    id="background"
                    value={characterForm.background || ''}
                    onChange={(e) => setCharacterForm({ ...characterForm, background: e.target.value || undefined })}
                    className="bg-slate-700/50 border-blue-500/30 text-blue-100 focus:border-blue-400/50 min-h-[100px]"
                    placeholder="描述角色的背景故事..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secret" className="text-blue-200 font-medium">秘密</Label>
                  <Textarea
                    id="secret"
                    value={characterForm.secret || ''}
                    onChange={(e) => setCharacterForm({ ...characterForm, secret: e.target.value || undefined })}
                    className="bg-slate-700/50 border-blue-500/30 text-blue-100 focus:border-blue-400/50 min-h-[80px]"
                    placeholder="角色隐藏的秘密..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="objective" className="text-blue-200 font-medium">目标</Label>
                  <Textarea
                    id="objective"
                    value={characterForm.objective || ''}
                    onChange={(e) => setCharacterForm({ ...characterForm, objective: e.target.value || undefined })}
                    className="bg-slate-700/50 border-blue-500/30 text-blue-100 focus:border-blue-400/50 min-h-[80px]"
                    placeholder="角色的目标和动机..."
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-3 pt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowCharacterForm(false);
                setEditingCharacter(null);
                initCharacterForm();
              }}
              className="bg-slate-700/50 text-blue-300 border-blue-500/30 hover:bg-slate-600/50"
            >
              取消
            </Button>
            <Button
              onClick={handleSaveCharacter}
              disabled={!characterForm.name || !characterForm.background}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg hover:shadow-blue-500/25 transition-all duration-300"
            >
              {editingCharacter ? '更新角色' : '创建角色'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default CharacterManager;