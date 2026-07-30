import { ScriptsService, Service } from '@/client';
import type { ScriptCharacter } from '@/client/models/ScriptCharacter';
import type { Script_Output } from '@/client/models/Script_Output';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bookmark, Clock, Play, Share2, Star, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface ScriptDetailDrawerProps {
  script: any;
  isOpen: boolean;
  onClose: () => void;
}

const ScriptDetailDrawer: React.FC<ScriptDetailDrawerProps> = ({ script, isOpen, onClose }) => {
  const [scriptDetails, setScriptDetails] = useState<Script_Output | null>(null);
  const [characters, setCharacters] = useState<ScriptCharacter[]>([]);
  const [gamePhases] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchScriptDetails = useCallback(async () => {
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
  }, [script]);

  // 获取剧本详细信息
  useEffect(() => {
    if (script && isOpen) {
      fetchScriptDetails();
    }
  }, [script, isOpen, fetchScriptDetails]);

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
                {/* eslint-disable-next-line @next/next/no-img-element -- 动态远程封面URL（含兜底生图接口），next/image 优化器无法保证可加载，保持 <img> 以避免渲染风险 */}
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
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white text-slate-400 rounded-md transition-all font-medium"
                >
                  剧本介绍
                </TabsTrigger>
                <TabsTrigger
                  value="characters"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white text-slate-400 rounded-md transition-all font-medium"
                >
                  角色信息
                </TabsTrigger>
                <TabsTrigger
                  value="rules"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white text-slate-400 rounded-md transition-all font-medium"
                >
                  游戏规则
                </TabsTrigger>
                <TabsTrigger
                  value="reviews"
                  className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white text-slate-400 rounded-md transition-all font-medium"
                >
                  评价
                </TabsTrigger>
              </TabsList>
              <TabsContent value="description" className="mt-6">
                <ScrollArea className="h-60">
                  <div className="space-y-4">
                    {loading ? (
                      <div className="flex items-center justify-center h-40">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
                      </div>
                    ) : (
                      <>
                        <p className="text-slate-300 leading-relaxed text-base">
                          {displayScript.description || '暂无剧本介绍'}
                        </p>
                        {scriptDetails?.background_story && (
                          <>
                            <Separator className="my-6 bg-slate-700/40" />
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
                            <Separator className="my-6 bg-slate-700/40" />
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
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
                      </div>
                    ) : characters.length > 0 ? (
                      characters.map((character, index) => (
                        <div key={character.id || index} className="border border-slate-600/30 rounded-xl p-5 bg-slate-800/30 backdrop-blur-sm">
                          <div className="flex items-start gap-4">
                            {character.avatar_url && (
                              // eslint-disable-next-line @next/next/no-img-element -- 角色头像为动态远程URL，next/image 优化器无法保证可加载，保持 <img> 以避免渲染风险
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
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
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
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
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
                          <p className="text-slate-500 text-xs mt-1">成为第一个评价此剧本的用户</p>
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

export default ScriptDetailDrawer;
