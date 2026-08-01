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
  ChevronDown,
  ChevronUp,
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
  onCountChange?: (count: number) => void;
}
interface VoiceOption {
  voice_id: string;
  voice_name: string;
  description?: string[];
  created_time: string;
}
const CharacterManager: React.FC<CharacterManagerProps> = ({ 
  scriptId, 
  onCharacterUpdate,
  onCountChange
}) => {
  const [characters, setCharacters] = useState<ScriptCharacter[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string | number>>(new Set());
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
          onCountChange?.(charactersData.length);
        }
      }
    } catch (error) {
      console.error('加载角色失败:', error);
      toast('加载角色失败');
    }
  }, [scriptId, onCountChange]);

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
    <Card className="border-transparent shadow-none">
      <CardHeader className="px-0 pt-0">  
        <div className="relative flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center border border-brass/30 bg-brass/10 rounded-sm">
              <Users className="w-5 h-5 text-brass" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-paper flex items-center gap-2">
                角色管理
              </CardTitle>
              <p className="text-sm text-mist mt-0.5">管理剧本中的所有角色信息</p>
            </div>
          </div>
          <Button 
            onClick={() => setShowCharacterForm(true)}
            className="h-8 rounded-sm border border-brass/40 bg-brass/10 px-3 font-data text-xs tracking-widest text-brass hover:bg-brass/20"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            添加角色
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        {/* 角色卡片网格 */}
        <div className="mb-6">
          {characters.length === 0 ? (
            <div className="text-mist text-center py-14 bg-panel/60 rounded-sm border border-dashed border-line">
              <div className="text-4xl mb-4 opacity-60"><Users className="w-12 h-12 mx-auto text-faint" /></div>
              <div className="text-lg font-medium mb-1 text-paper">暂无角色</div>
              <div className="text-sm opacity-70 mb-5">点击上方按钮添加第一个角色</div>
              <div className="flex justify-center">
                <Button 
                  onClick={() => setShowCharacterForm(true)}
                  className="h-8 rounded-sm border border-brass/40 bg-brass/10 px-3 font-data text-xs tracking-widest text-brass hover:bg-brass/20"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  立即添加
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {characters.map((character) => {
                const isExpanded = expandedIds.has(character.id!);
                const toggleExpand = () => {
                  setExpandedIds(prev => {
                    const next = new Set(prev);
                    if (next.has(character.id!)) next.delete(character.id!);
                    else next.add(character.id!);
                    return next;
                  });
                };
                return (
                <div key={character.id} className="rounded-sm border border-line bg-raised transition-colors hover:border-brass/30 group character-card overflow-hidden">
                  {/* 卡片头部 - 始终显示 */}
                  <div
                    className="flex items-start justify-between p-5 cursor-pointer"
                    onClick={toggleExpand}
                  >
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-paper mb-3 transition-colors flex items-center gap-2">
                        <User className="w-4 h-4 text-brass/70" />
                        {character.name}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {character.is_victim && (
                          <Badge variant="destructive" className="bg-thread-dim/30 text-thread border-thread/30">
                            <VolumeX className="w-3 h-3 mr-1" /> 受害者
                          </Badge>
                        )}
                        {character.is_murderer && (
                          <Badge variant="destructive" className="bg-thread-dim/30 text-thread border-thread/30">
                            <Target className="w-3 h-3 mr-1" /> 凶手
                          </Badge>
                        )}
                        {character.gender && (
                          <Badge variant="outline" className="bg-brass/10 text-mist border-line">
                            <User className="w-3 h-3 mr-1" /> {character.gender}
                          </Badge>
                        )}
                        {character.age && (
                          <Badge variant="outline" className="bg-brass/10 text-mist border-line">
                            <Calendar className="w-3 h-3 mr-1" /> {character.age}岁
                          </Badge>
                        )}
                      </div>
                      {!isExpanded && character.profession && (
                        <p className="text-sm text-mist/70 mt-2 flex items-center gap-1">
                          <Briefcase className="w-3 h-3" /> {character.profession}
                        </p>
                      )}
                      {!isExpanded && character.background && (
                        <p className="text-xs text-paper/85/60 mt-1 line-clamp-1">{character.background}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0 ml-2 text-brass/70">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>

                  {/* 可折叠内容 */}
                  <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="px-6 pb-6">
                      {/* 头像区域 */}
                      <div className="mb-6">
                        {character.avatar_url ? (
                          <div className="w-full h-48 rounded-xl overflow-hidden border border-line bg-slate-800 shadow-lg group-hover:shadow-blue-500/20 transition-all duration-300">
                            <Image 
                              src={character.avatar_url || ''} 
                              alt={character.name || ''}
                              width={256}
                              height={192}
                              className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik02NCA5NkM3NC4yIDk2IDgyIDg4LjIgODIgNzhDODIgNjcuOCA3NC4yIDYwIDY0IDYwQzUzLjggNjAgNDYgNjcuOCA0NiA3OEM0NiA4OC4yIDUzLjggOTYgNjQgOTZaIiBmaWxsPSIjNkI3Mjg0Ii8+PC9zdmc+Cg==';
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-full h-48 rounded-sm border border-dashed border-line flex items-center justify-center bg-ink/30">
                            <div className="text-center">
                              <div className="text-5xl mb-3 opacity-60"><User className="w-12 h-12 mx-auto" /></div>
                              <div className="text-sm text-mist opacity-70">暂无头像</div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 角色信息 */}
                      <div className="space-y-3 mb-4">
                        {character.profession && (
                          <div className="flex items-center gap-2 text-sm">
                            <Briefcase className="w-4 h-4 text-brass/70" />
                            <span className="text-mist font-medium">职业:</span>
                            <span className="text-paper/85 flex-1">{character.profession}</span>
                          </div>
                        )}
                        
                        {character.background && (
                          <div className="text-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <Book className="w-4 h-4 text-brass/70" />
                              <span className="text-mist font-medium">背景:</span>
                            </div>
                            <p className="text-paper/85 text-xs leading-relaxed pl-6 line-clamp-3">{character.background}</p>
                          </div>
                        )}
                        
                        {character.secret && (
                          <div className="text-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <EyeOff className="w-4 h-4 text-brass/70" />
                              <span className="text-mist font-medium">秘密:</span>
                            </div>
                            <p className="text-paper/85 text-xs leading-relaxed pl-6 line-clamp-2">{character.secret}</p>
                          </div>
                        )}
                        
                        {character.objective && (
                          <div className="text-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <Target className="w-4 h-4 text-brass/70" />
                              <span className="text-mist font-medium">目标:</span>
                            </div>
                            <p className="text-paper/85 text-xs leading-relaxed pl-6 line-clamp-2">{character.objective}</p>
                          </div>
                        )}
                        
                        {character.personality_traits && character.personality_traits.length > 0 && (
                          <div className="text-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <User className="w-4 h-4 text-brass/70" />
                              <span className="text-mist font-medium">性格:</span>
                            </div>
                            <div className="flex flex-wrap gap-1 pl-6">
                              {character.personality_traits.map((trait, index) => (
                                <Badge key={index} variant="outline" className="text-xs bg-brass/10 text-mist border-line">
                                  {trait}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {character.voice_id && (
                          <div className="text-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <Mic className="w-4 h-4 text-brass/70" />
                              <span className="text-mist font-medium">语音:</span>
                            </div>
                            <div className="pl-6">
                              <Badge variant="outline" className="text-xs bg-brass/10 text-mist border-line">
                                {voiceOptions.find(v => v.voice_id === character.voice_id)?.voice_name || character.voice_id}
                              </Badge>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* 操作按钮 */}
                      <div className="flex gap-3 pt-6 border-t border-hairline">
                        <Button
                          onClick={(e) => { e.stopPropagation(); handleEditCharacter(character); }}
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 rounded-sm border-line text-mist hover:border-brass/40 hover:text-brass"
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          <span>编辑</span>
                        </Button>
                        <Button
                          onClick={(e) => { e.stopPropagation(); handleDeleteCharacter(character.id!); }}
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 rounded-sm border-line text-mist hover:border-thread/50 hover:text-thread"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          <span>删除</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>

      {/* 角色编辑对话框 */}
      <Dialog open={showCharacterForm} onOpenChange={setShowCharacterForm}>
        <DialogContent showCloseButton={false} className="max-w-5xl max-h-[90vh] overflow-y-auto bg-panel border-line">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-semibold text-paper flex items-center gap-2">
                <Users className="w-5 h-5 text-brass" />
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
                className="text-mist hover:text-paper hover:bg-raised h-auto p-3 rounded-sm"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </DialogHeader>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 左侧：基本信息 */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-mist font-medium">角色名称 *</Label>
                <Input
                  id="name"
                  value={characterForm.name || ''}
                  onChange={(e) => setCharacterForm({ ...characterForm, name: e.target.value })}
                  className="bg-slate-700/50 border-line text-paper/85 focus:border-brass/40"
                  placeholder="输入角色名称"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="age" className="text-mist font-medium">年龄</Label>
                  <Input
                    id="age"
                    type="number"
                    value={characterForm.age || ''}
                    onChange={(e) => setCharacterForm({ ...characterForm, age: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="bg-slate-700/50 border-line text-paper/85 focus:border-brass/40"
                    placeholder="年龄"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-mist font-medium">性别</Label>
                  <Select value={characterForm.gender || ''} onValueChange={(value) => setCharacterForm({ ...characterForm, gender: value || undefined })}>
                    <SelectTrigger className="bg-slate-700/50 border-line text-paper/85">
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
                <Label htmlFor="profession" className="text-mist font-medium">职业</Label>
                <Input
                  id="profession"
                  value={characterForm.profession || ''}
                  onChange={(e) => setCharacterForm({ ...characterForm, profession: e.target.value || undefined })}
                  className="bg-slate-700/50 border-line text-paper/85 focus:border-brass/40"
                  placeholder="输入职业"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-mist font-medium">性格特征</Label>
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
                <Label className="text-mist font-medium">语音</Label>
                <Select 
                  value={characterForm.voice_id || 'none'} 
                  onValueChange={(value) => setCharacterForm({ ...characterForm, voice_id: value === 'none' ? undefined : value })}
                  searchable={true}
                >
                  <SelectTrigger className="bg-slate-700/50 border-line text-paper/85">
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
                  <Label htmlFor="is_victim" className="text-mist font-medium">受害者</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_murderer"
                    checked={characterForm.is_murderer || false}
                    onCheckedChange={(checked) => setCharacterForm({ ...characterForm, is_murderer: !!checked })}
                  />
                  <Label htmlFor="is_murderer" className="text-mist font-medium">凶手</Label>
                </div>
              </div>
            </div>

            {/* 右侧：头像和详细信息 */}
            <div className="space-y-4">
              {/* 头像选择器 */}
              <div className="space-y-2">
                <Label className="text-mist font-medium">角色头像</Label>
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
                  <Label htmlFor="background" className="text-mist font-medium">背景故事 *</Label>
                  <Textarea
                    id="background"
                    value={characterForm.background || ''}
                    onChange={(e) => setCharacterForm({ ...characterForm, background: e.target.value || undefined })}
                    className="bg-slate-700/50 border-line text-paper/85 focus:border-brass/40 min-h-[100px]"
                    placeholder="描述角色的背景故事..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secret" className="text-mist font-medium">秘密</Label>
                  <Textarea
                    id="secret"
                    value={characterForm.secret || ''}
                    onChange={(e) => setCharacterForm({ ...characterForm, secret: e.target.value || undefined })}
                    className="bg-slate-700/50 border-line text-paper/85 focus:border-brass/40 min-h-[80px]"
                    placeholder="角色隐藏的秘密..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="objective" className="text-mist font-medium">目标</Label>
                  <Textarea
                    id="objective"
                    value={characterForm.objective || ''}
                    onChange={(e) => setCharacterForm({ ...characterForm, objective: e.target.value || undefined })}
                    className="bg-slate-700/50 border-line text-paper/85 focus:border-brass/40 min-h-[80px]"
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
              className="bg-slate-700/50 text-mist border-line hover:bg-slate-600/50"
            >
              取消
            </Button>
            <Button
              onClick={handleSaveCharacter}
              disabled={!characterForm.name || !characterForm.background}
              className="h-9 rounded-sm border border-brass/40 bg-brass/10 px-6 font-data text-sm tracking-widest text-brass hover:bg-brass/20"
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