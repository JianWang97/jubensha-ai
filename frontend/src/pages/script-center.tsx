import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Bookmark, BookOpen, Clock, Grid, Heart, Library, List, Play, Plus, Search, Share2, Star, User, Users } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

import { ScriptInfo, ScriptsService, ScriptStatus, Service } from '@/client';
import type { ScriptCharacter } from '@/client/models/ScriptCharacter';
import type { Script_Output } from '@/client/models/Script_Output';
import AppLayout from '@/components/AppLayout';
import AuthGuard from '@/components/AuthGuard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

type TabType = 'my-scripts' | 'script-library';



const ScriptCard = ({ script, onDetailClick, onFavoriteToggle, onEdit, onDelete, onPublish, isMyScript }) => {
  const router = useRouter();

  return (
    <Card
      className="group relative overflow-hidden border-slate-700/30 hover:border-indigo-500/40 transition-all duration-500 cursor-pointer h-80"
      onClick={() => onDetailClick && onDetailClick(script)}
    >
      {/* 背景图片 - 覆盖整个卡片 */}
      <div className="absolute inset-0">
        <img
          src={script.cover_image_url || script.image || `https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent('mystery script book cover, dark theme, elegant design')}&image_size=landscape_4_3`}
          alt={script.title}
          className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-700"
        />
        {/* 渐变遮罩 - 从底部开始更强烈 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      </div>

      {/* 顶部浮动元素 */}
      <div className="relative z-10">
        {/* 收藏按钮 */}
        {!isMyScript && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-3 right-3 h-8 w-8 p-0 bg-slate-900/40 hover:bg-slate-900/60 border-0 backdrop-blur-sm"
            onClick={(e) => {
              e.stopPropagation();
              onFavoriteToggle && onFavoriteToggle(script.id);
            }}
          >
            <Heart className={`h-4 w-4 ${script.isFavorite ? 'fill-rose-400 text-rose-400' : 'text-white/80'}`} />
          </Button>
        )}

        {/* 分类标签 */}
        <div className="absolute top-3 left-3">
          <Badge className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0 text-xs font-medium">
            {script.category || '推理'}
          </Badge>
        </div>

        {/* 评分 */}
        <div className="absolute top-3 right-16 flex items-center gap-1 bg-slate-900/50 backdrop-blur-sm rounded-full px-2 py-1">
          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
          <span className="text-xs font-medium text-white">{script.rating || '4.5'}</span>
        </div>
      </div>

      {/* 内容区域 - 毛玻璃背景 */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <div className="bg-slate-900/40 backdrop-blur-md border-t border-slate-700/30 p-4 space-y-3">
          {/* 状态和作者信息 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-xs font-medium ${script.status === ScriptStatus.ARCHIVED || script.status === ScriptStatus.PUBLISHED
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                {script.status === ScriptStatus.ARCHIVED || script.status === ScriptStatus.PUBLISHED ? '已发布' : '草稿'}
              </span>
              {!isMyScript && (
                <span className="text-xs text-slate-400 bg-slate-800/60 px-2 py-1 rounded">
                  by {script.author}
                </span>
              )}
            </div>
            <span className="text-indigo-300 text-sm">{script.player_count}人</span>
          </div>

          {/* 标题 */}
          <h3 className="font-semibold text-white text-lg leading-tight line-clamp-1 group-hover:text-indigo-300 transition-colors">
            {script.title}
          </h3>

          {/* 描述 */}
          <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">
            {script.description || '暂无描述'}
          </p>

          {/* 标签 */}
          <div className="flex flex-wrap gap-1">
            {(script.tags || ['悬疑', '推理']).slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs text-slate-300 border-slate-600 bg-slate-800/50">
                {tag}
              </Badge>
            ))}
            {(script.tags || []).length > 3 && (
              <Badge variant="outline" className="text-xs text-slate-400 border-slate-600 bg-slate-800/30">
                +{(script.tags || []).length - 3}
              </Badge>
            )}
          </div>

          {/* 底部信息和操作按钮 */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-600/30">
            <div className="flex items-center gap-4 text-xs text-slate-300">
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>{script.player_count || '4-6'}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{script.duration || '2-3小时'}</span>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-1">
              {isMyScript ? (
                // 我的剧本：编辑、删除、发布
                <>
                  <Button
                    size="sm"
                    className="h-7 px-2 bg-indigo-500/80 hover:bg-indigo-600 text-white border-0 text-xs backdrop-blur-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit && onEdit(script.id);
                    }}
                  >
                    编辑
                  </Button>
                  {script.status === ScriptStatus.DRAFT && (
                    <Button
                      size="sm"
                      className="h-7 px-2 bg-emerald-500/80 hover:bg-emerald-600 text-white border-0 text-xs backdrop-blur-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPublish && onPublish(script.id);
                      }}
                    >
                      发布
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="h-7 px-2 bg-rose-500/80 hover:bg-rose-600 text-white border-0 text-xs backdrop-blur-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete && onDelete(script.id);
                    }}
                  >
                    删除
                  </Button>
                </>
              ) : (
                // 剧本库：查看、开始
                <>
                  <Button
                    size="sm"
                    className="h-7 px-2 bg-gradient-to-r from-indigo-500/80 to-purple-500/80 hover:from-indigo-600 hover:to-purple-600 text-white border-0 text-xs backdrop-blur-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `/game?script_id=${script.id}`;
                    }}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    开始
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

const ScriptDetailDrawer = ({ script, isOpen, onClose }) => {
  const [scriptDetails, setScriptDetails] = useState<Script_Output | null>(null);
  const [characters, setCharacters] = useState<ScriptCharacter[]>([]);
  const [gamePhases, setGamePhases] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 获取剧本详细信息
  useEffect(() => {
    if (script && isOpen) {
      fetchScriptDetails();
    }
  }, [script, isOpen]);

  const fetchScriptDetails = async () => {
    if (!script?.id) return;

    try {
      setLoading(true);
      // 获取完整剧本信息
      const scriptResponse = await ScriptsService.getScriptApiScriptsScriptIdGet(script.id);
      // 确保 scriptResponse.data 不为 undefined 时才设置状态
      if (scriptResponse.data) {
        setScriptDetails(scriptResponse.data);
      }

      // 获取角色信息
      try {
        const charactersResponse = await Service.getCharactersApiCharactersScriptIdCharactersGet(script.id);
        setCharacters(charactersResponse.data || []);
      } catch (error) {
        console.warn('Failed to fetch characters:', error);
        setCharacters([]);
      }

      // 获取游戏阶段信息（如果有相关API）
      // const phasesResponse = await Service.getGamePhasesApiGamePhasesScriptIdPhasesGet(script.id);
      // setGamePhases(phasesResponse.data || []);

    } catch (error) {
      console.error('Failed to fetch script details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!script) return null;

  const displayScript = scriptDetails?.info || script;
  const formatDuration = (minutes: number | null | undefined): string => {
    if (!minutes || typeof minutes !== 'number') return '未知';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
    }
    return `${mins}分钟`;
  };

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="max-h-[85vh] bg-slate-950/95 border-slate-700/30 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-5xl">
          <DrawerHeader className="pb-6">
            <div className="flex items-start gap-6">
              <div className="relative">
                <img
                  src={displayScript.cover_image_url || displayScript.image || `https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent('mystery script book cover, dark theme, elegant design')}&image_size=square_hd`}
                  alt={displayScript.title}
                  className="w-40 h-40 object-cover object-center rounded-2xl shadow-2xl"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent rounded-2xl" />
              </div>
              <div className="flex-1 space-y-4">
                <DrawerTitle className="text-3xl font-bold text-white leading-tight">{displayScript.title}</DrawerTitle>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-slate-800/50 rounded-full px-3 py-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold text-white">{displayScript.rating > 0 ? displayScript.rating.toFixed(1) : '暂无评分'}</span>
                  </div>
                  <Badge className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-3 py-1 text-sm font-medium">
                    {displayScript.category || '推理'}
                  </Badge>
                  <Badge variant="outline" className="border-slate-600/50 text-slate-300 bg-slate-800/30 px-3 py-1">
                    {displayScript.difficulty_level || '中等'}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(displayScript.tags && Array.isArray(displayScript.tags) && displayScript.tags.length > 0 ? displayScript.tags : ['暂无标签']).map((tag, index) => (
                    <Badge key={index} variant="secondary" className="bg-slate-800/50 text-slate-300 border-slate-600/30 text-xs">
                      {typeof tag === 'string' ? tag : String(tag)}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center gap-8 text-slate-400">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    <span className="font-medium">{displayScript.player_count}人</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    <span className="font-medium">{formatDuration(displayScript.estimated_duration)}</span>
                  </div>
                  {displayScript.play_count > 0 && (
                    <div className="flex items-center gap-2">
                      <Play className="h-5 w-5" />
                      <span className="font-medium">已游玩{displayScript.play_count}次</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DrawerHeader>
          <div className="px-6 pb-6">
            <Tabs defaultValue="description" className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-slate-900/50 border-slate-700/30 rounded-xl p-1">
                <TabsTrigger
                  value="description"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white text-slate-400 rounded-lg transition-all font-medium"
                >
                  剧本介绍
                </TabsTrigger>
                <TabsTrigger
                  value="characters"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white text-slate-400 rounded-lg transition-all font-medium"
                >
                  角色信息
                </TabsTrigger>
                <TabsTrigger
                  value="rules"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white text-slate-400 rounded-lg transition-all font-medium"
                >
                  游戏规则
                </TabsTrigger>
                <TabsTrigger
                  value="reviews"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white text-slate-400 rounded-lg transition-all font-medium"
                >
                  评价
                </TabsTrigger>
              </TabsList>
              <TabsContent value="description" className="mt-6">
                <ScrollArea className="h-60">
                  <div className="space-y-4">
                    {loading ? (
                      <div className="flex items-center justify-center h-40">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                      </div>
                    ) : (
                      <>
                        <p className="text-slate-300 leading-relaxed text-base">
                          {displayScript.description || '暂无剧本介绍'}
                        </p>
                        {scriptDetails?.background_story && (
                          <>
                            <Separator className="my-6 bg-white/10" />
                            <div>
                              <h4 className="font-semibold mb-3 text-white text-lg">背景故事</h4>
                              <p className="text-slate-300 leading-relaxed text-base">
                                {scriptDetails.info.description}
                              </p>
                            </div>
                          </>
                        )}
                        {displayScript.status && (
                          <>
                            <Separator className="my-6 bg-white/10" />
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400">状态：</span>
                              <Badge variant={displayScript.status === 'PUBLISHED' ? 'default' : 'secondary'}>
                                {displayScript.status === 'PUBLISHED' ? '已发布' : displayScript.status === 'DRAFT' ? '草稿' : '已归档'}
                              </Badge>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="characters" className="mt-6">
                <ScrollArea className="h-60">
                  <div className="space-y-4">
                    {loading ? (
                      <div className="flex items-center justify-center h-40">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                      </div>
                    ) : characters.length > 0 ? (
                      characters.map((character, index) => (
                        <div key={character.id || index} className="border border-slate-600/30 rounded-xl p-5 bg-slate-800/30 backdrop-blur-sm">
                          <div className="flex items-start gap-4">
                            {character.avatar_url && (
                              <img
                                src={character.avatar_url}
                                alt={character.name}
                                className="w-12 h-12 rounded-full object-cover"
                              />
                            )}
                            <div className="flex-1">
                              <h4 className="font-semibold mb-2 text-white text-lg flex items-center gap-2">
                                {character.name}
                                {character.gender && (
                                  <Badge variant="outline" className="text-xs border-slate-500/40 text-slate-300">
                                    {character.gender === 'MALE' ? '男' : character.gender === 'FEMALE' ? '女' : '中性'}
                                  </Badge>
                                )}
                                {character.age && (
                                  <Badge variant="outline" className="text-xs border-slate-500/40 text-slate-300">
                                    {character.age}岁
                                  </Badge>
                                )}
                              </h4>
                              {character.profession && (
                                <p className="text-indigo-300 text-sm mb-2">{character.profession}</p>
                              )}
                              <p className="text-slate-400 leading-relaxed text-sm">
                                {character.background || '暂无角色背景'}
                              </p>
                              {character.personality_traits && Array.isArray(character.personality_traits) && character.personality_traits.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1">
                                  {character.personality_traits.map((trait, traitIndex) => (
                                    <Badge key={traitIndex} variant="secondary" className="text-xs bg-slate-700/50 text-slate-300">
                                      {typeof trait === 'string' ? trait : String(trait)}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-slate-400">暂无角色信息</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="rules" className="mt-6">
                <ScrollArea className="h-60">
                  <div className="space-y-6">
                    {loading ? (
                      <div className="flex items-center justify-center h-40">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                      </div>
                    ) : (
                      <>
                        {Array.isArray(gamePhases) && gamePhases.length > 0 ? (
                          <div className="bg-slate-800/30 rounded-xl p-5">
                            <h4 className="font-semibold mb-4 text-white text-lg">游戏阶段</h4>
                            <ol className="list-decimal list-inside space-y-2 text-slate-400 leading-relaxed">
                              {gamePhases.map((phase, index) => (
                                <li key={phase?.id || index}>
                                  <span className="font-medium text-white">{phase?.name || `阶段${index + 1}`}</span>
                                  {phase?.description && (
                                    <span className="ml-2">- {phase.description}</span>
                                  )}
                                  {phase?.duration_minutes && (
                                    <span className="ml-2 text-indigo-300">({phase.duration_minutes}分钟)</span>
                                  )}
                                </li>
                              ))}
                            </ol>
                          </div>
                        ) : (
                          <div className="bg-slate-800/30 rounded-xl p-5">
                            <h4 className="font-semibold mb-4 text-white text-lg">游戏流程</h4>
                            <ol className="list-decimal list-inside space-y-2 text-slate-400 leading-relaxed">
                              <li>角色分配和背景介绍</li>
                              <li>自由探索和线索搜集</li>
                              <li>集中讨论和信息交换</li>
                              <li>推理分析和投票环节</li>
                              <li>真相揭晓和结果公布</li>
                            </ol>
                          </div>
                        )}
                        <div className="bg-slate-800/30 rounded-xl p-5">
                          <h4 className="font-semibold mb-4 text-white text-lg">游戏信息</h4>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-slate-400">玩家人数：</span>
                              <span className="text-white font-medium">{displayScript.player_count}人</span>
                            </div>
                            <div>
                              <span className="text-slate-400">游戏时长：</span>
                              <span className="text-white font-medium">{formatDuration(displayScript.estimated_duration)}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">难度等级：</span>
                              <span className="text-white font-medium">{displayScript.difficulty_level || '中等'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">剧本分类：</span>
                              <span className="text-white font-medium">{displayScript.category || '推理'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="bg-slate-800/30 rounded-xl p-5">
                          <h4 className="font-semibold mb-4 text-white text-lg">注意事项</h4>
                          <ul className="list-disc list-inside space-y-2 text-slate-400 leading-relaxed">
                            <li>本剧本由 AI 角色自动演绎</li>
                            <li>无需真人参与即可观看流程</li>
                          </ul>
                        </div>
                      </>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="reviews" className="mt-6">
                <ScrollArea className="h-60">
                  <div className="space-y-4">
                    {loading ? (
                      <div className="flex items-center justify-center h-40">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                      </div>
                    ) : (
                      <>
                        <div className="bg-slate-800/30 rounded-xl p-5">
                          <h4 className="font-semibold mb-4 text-white text-lg">剧本统计</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-white mb-1">
                                {displayScript.rating > 0 ? displayScript.rating.toFixed(1) : '暂无'}
                              </div>
                              <div className="text-slate-400 text-sm">平均评分</div>
                              {displayScript.rating && typeof displayScript.rating === 'number' && displayScript.rating > 0 && (
                                <div className="flex justify-center mt-2">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                      key={star}
                                      className={`h-4 w-4 ${star <= Math.round(displayScript.rating)
                                          ? 'fill-amber-400 text-amber-400'
                                          : 'text-slate-500'
                                        }`}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-white mb-1">
                                {displayScript.play_count || 0}
                              </div>
                              <div className="text-slate-400 text-sm">游玩次数</div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-800/30 rounded-xl p-5">
                          <h4 className="font-semibold mb-4 text-white text-lg">剧本信息</h4>
                          <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-400">作者：</span>
                              <span className="text-white">{displayScript.author || '未知'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">创建时间：</span>
                              <span className="text-white">
                                {displayScript.created_at ? new Date(displayScript.created_at).toLocaleDateString() : '未知'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">最后更新：</span>
                              <span className="text-white">
                                {displayScript.updated_at ? new Date(displayScript.updated_at).toLocaleDateString() : '未知'}
                              </span>
                            </div>
                            {displayScript.price !== undefined && (
                              <div className="flex justify-between">
                                <span className="text-slate-400">价格：</span>
                                <span className="text-white">
                                  {displayScript.price > 0 ? `¥${displayScript.price}` : '免费'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-center py-4">
                          <p className="text-slate-400 text-sm">暂无用户评价</p>
                          -                         <p className="text-slate-500 text-xs mt-1">成为第一个评价此剧本的玩家</p>
                          +                         <p className="text-slate-500 text-xs mt-1">成为第一个评价此剧本的用户</p>
                        </div>
                      </>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
            <div className="flex gap-3 mt-6">
              <Button
                className="flex-1 h-12 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-medium"
                onClick={() => {
                  onClose();
                  window.location.href = `/game?script_id=${displayScript.id}`;
                }}
              >
                <Play className="h-4 w-4 mr-2" />
                立即开始
              </Button>
              <Button
                variant="outline"
                className="h-12 px-6 border-slate-600/40 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500/50"
              >
                <Bookmark className="h-4 w-4 mr-2" />
                收藏
              </Button>
              <Button
                variant="outline"
                className="h-12 px-6 border-slate-600/40 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500/50"
              >
                <Share2 className="h-4 w-4 mr-2" />
                分享
              </Button>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};



export default function ScriptCenter() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('my-scripts');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [selectedScript, setSelectedScript] = useState<ScriptInfo | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // 分别存储我的剧本和剧本库
  const [myScripts, setMyScripts] = useState<ScriptInfo[]>([]);
  const [libraryScripts, setLibraryScripts] = useState<ScriptInfo[]>([]);

  // 获取我的剧本
  const getMyScripts = async () => {
    const response = await ScriptsService.getScriptsApiScriptsGet();
    return response.items || [];
  };

  // 获取剧本库（公开剧本）
  const getLibraryScripts = async () => {
    const response = await ScriptsService.getPublicScriptsApiScriptsPublicGet();
    return response.items || [];
  };

  const deleteScript = async (scriptId: number) => {
    await ScriptsService.deleteScriptApiScriptsScriptIdDelete(scriptId);
  };

  // 获取脚本数据
  const fetchScripts = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'my-scripts') {
        const scriptData = await getMyScripts();
        setMyScripts(scriptData);
      } else {
        const scriptData = await getLibraryScripts();
        setLibraryScripts(scriptData);
      }
    } catch (err) {
      console.error('获取脚本列表失败:', err);
      setError('获取脚本列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScripts();
  }, [activeTab]);

  // 编辑脚本处理（仅限我的剧本）
  const handleEdit = (scriptId: number) => {
    router.push(`/script-manager/edit/${scriptId}`);
  };

  // 删除脚本处理
  const handleDelete = async (scriptId: number) => {
    if (window.confirm('确定要删除这个脚本吗？')) {
      try {
        await deleteScript(scriptId);
        // 重新获取脚本列表
        await fetchScripts();
      } catch (err) {
        console.error('删除脚本失败:', err);
        setError('删除脚本失败');
      }
    }
  };

  // 发布剧本到剧本库
  const handlePublish = async (scriptId: number) => {
    if (window.confirm('确定要将此剧本发布到剧本库吗？发布后其他用户将可以查看和使用此剧本。')) {
      try {
        await ScriptsService.updateScriptStatusApiScriptsScriptIdStatusPatch(
          scriptId,
          ScriptStatus.PUBLISHED
        );

        await fetchScripts();
        toast.success('剧本发布成功！现在其他用户可以在剧本库中看到您的剧本了。');
      } catch (err) {
        console.error('发布剧本失败:', err);
        setError('发布剧本失败');
      }
    }
  };



  // 收藏切换
  const handleFavoriteToggle = (scriptId: number) => {
    // 实现收藏功能
    console.log('Toggle favorite for script:', scriptId);
  };

  // 查看剧本详情
  const handleScriptDetail = (script: ScriptInfo) => {
    setSelectedScript(script);
    setIsDetailOpen(true);
  };



  // 过滤脚本
  const filterScripts = (scripts: ScriptInfo[]) => {
    let filtered = scripts;

    // 搜索过滤
    if (searchTerm) {
      filtered = filtered.filter(script =>
        script.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        script.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        script.author?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  };

  const currentScripts = activeTab === 'my-scripts' ? myScripts : libraryScripts;
  const filteredScripts = filterScripts(currentScripts);
  const isMyScripts = activeTab === 'my-scripts';

  return (
    <AuthGuard>
      <AppLayout>
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950/30 to-slate-900">
          {/* 现代化头部 */}
          <div className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-xl border-b border-indigo-500/20">
            <div className="max-w-7xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                {/* 左侧标题和搜索 */}
                <div className="flex items-center gap-6 flex-1 max-w-3xl">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-6 h-6 text-purple-400" />
                    <h1 className="text-2xl font-bold text-white">剧本中心</h1>
                  </div>

                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      placeholder="搜索剧本..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-12 h-12 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-400 focus:border-indigo-400 focus:bg-slate-800/70 transition-all rounded-xl"
                    />
                  </div>
                </div>

                {/* 右侧控制 */}
                <div className="flex items-center gap-3">
                  {/* 创建按钮 */}
                  <Button
                    onClick={() => router.push('/script-manager/create')}
                    className="h-12 px-6 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    创建剧本
                  </Button>



                  {/* 视图切换 */}
                  <div className="flex bg-slate-800/50 border border-slate-700/50 rounded-xl p-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode('grid')}
                      className={`h-10 px-4 rounded-lg transition-all ${viewMode === 'grid'
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                          : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                        }`}
                    >
                      <Grid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className={`h-10 px-4 rounded-lg transition-all ${viewMode === 'list'
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                          : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                        }`}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 标签页切换 */}
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="bg-slate-900/60 backdrop-blur-sm rounded-lg p-4 border border-indigo-500/30">
              <div className="flex bg-slate-950/70 rounded-lg p-1 w-fit">
                <button
                  onClick={() => setActiveTab('my-scripts')}
                  className={`flex items-center gap-2 px-6 py-3 rounded-md text-sm font-medium transition-all ${activeTab === 'my-scripts'
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                >
                  <User className="w-4 h-4" />
                  我的剧本
                </button>
                <button
                  onClick={() => setActiveTab('script-library')}
                  className={`flex items-center gap-2 px-6 py-3 rounded-md text-sm font-medium transition-all ${activeTab === 'script-library'
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                >
                  <Library className="w-4 h-4" />
                  剧本库
                </button>
              </div>
            </div>
          </div>

          {/* 主内容区域 */}
          <div className="max-w-7xl mx-auto px-6 pb-8">
            <div className="flex gap-8">


              {/* 主内容区域 */}
              <div className="flex-1 min-w-0">
                {loading ? (
                  <div className="flex items-center justify-center py-24">
                    <div className="text-center space-y-4">
                      <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto"></div>
                      <div className="text-slate-400 text-lg">加载中...</div>
                    </div>
                  </div>
                ) : error ? (
                  <div className="flex items-center justify-center py-24">
                    <div className="text-center space-y-4">
                      <div className="text-red-400 text-lg mb-4">{error}</div>
                      <Button
                        onClick={() => fetchScripts()}
                        className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-8 py-3 rounded-xl"
                      >
                        重新加载
                      </Button>
                    </div>
                  </div>
                ) : filteredScripts.length === 0 ? (
                  <div className="bg-slate-900/50 rounded-lg p-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-6 bg-indigo-500/20 rounded-full flex items-center justify-center">
                      {isMyScripts ? (
                        <User className="w-8 h-8 text-indigo-400" />
                      ) : (
                        <Library className="w-8 h-8 text-indigo-400" />
                      )}
                    </div>

                    <div className="space-y-3 mb-6">
                      <h3 className="text-xl font-semibold text-white">
                        {searchTerm
                          ? '没有找到匹配的剧本'
                          : (isMyScripts ? '暂无我的剧本' : '剧本库为空')
                        }
                      </h3>
                      <p className="text-gray-400">
                        {searchTerm
                          ? '尝试调整搜索条件'
                          : (isMyScripts ? '开始创建您的第一个剧本' : '暂时没有公开的剧本')
                        }
                      </p>
                    </div>

                    {isMyScripts && !searchTerm && (
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        <Button
                          onClick={() => router.push('/script-manager/create')}
                          className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-medium"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          创建新剧本
                        </Button>
                        <Button
                          onClick={() => setActiveTab('script-library')}
                          variant="outline"
                          className="border-slate-600/50 text-slate-300 hover:bg-slate-800/50 px-6 py-3 rounded-lg font-medium"
                        >
                          <Library className="w-4 h-4 mr-2" />
                          浏览剧本库
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`grid gap-6 ${viewMode === 'grid'
                      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
                      : 'grid-cols-1 max-w-4xl mx-auto'
                    }`}>
                    {filteredScripts.map((script) => (
                      <ScriptCard
                        key={script.id}
                        script={script}
                        onDetailClick={handleScriptDetail}
                        onFavoriteToggle={handleFavoriteToggle}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onPublish={handlePublish}

                        isMyScript={isMyScripts}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 剧本详情抽屉 */}
          <ScriptDetailDrawer
            script={selectedScript}
            isOpen={isDetailOpen}
            onClose={() => setIsDetailOpen(false)}
          />
        </div>
      </AppLayout>
    </AuthGuard>
  );
}