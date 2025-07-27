import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Filter, Grid, List, Heart, Star, Users, Clock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import AppLayout from '@/components/AppLayout';
import { 
  useFilteredScripts, 
  useSelectedScript, 
  useScriptSearch, 
  useScriptViewMode, 
  useScriptLoading, 
  useScriptError,
  useScriptActions,
  useScriptFilters
} from '@/stores/scriptsStore';


const ScriptCard = ({ script, onDetailClick, onFavoriteToggle }) => {
  return (
    <Card 
      className="group hover:shadow-xl hover:shadow-purple-500/20 transition-all duration-300 cursor-pointer bg-gray-800/50 border-gray-700 hover:border-purple-500/50 backdrop-blur-sm"
      onClick={() => onDetailClick(script)}
    >
      <div className="relative overflow-hidden rounded-t-lg">
        <img 
          src={script.image} 
          alt={script.title}
          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 bg-gray-900/80 hover:bg-gray-900 text-white border border-gray-600"
          onClick={(e) => {
            e.stopPropagation();
            onFavoriteToggle(script.id);
          }}
        >
          <Heart className={`h-4 w-4 ${script.isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-300'}`} />
        </Button>
        <div className="absolute bottom-2 left-2">
          <Badge variant="secondary" className="bg-purple-600/80 text-white border-purple-500">
            {script.category}
          </Badge>
        </div>
      </div>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg line-clamp-1 text-white">{script.title}</CardTitle>
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-medium text-gray-300">{script.rating}</span>
          </div>
        </div>
        <CardDescription className="line-clamp-2 text-gray-400">{script.description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-1 mb-3">
          {script.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs text-gray-300 border-gray-600 hover:border-purple-500">
              {tag}
            </Badge>
          ))}
        </div>
        <div className="flex items-center justify-between text-sm text-gray-400">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{script.playerCount}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{script.duration}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ScriptDetailDrawer = ({ script, isOpen, onClose }) => {
  if (!script) return null;

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="max-h-[90vh] bg-gray-900 border-gray-700">
        <div className="mx-auto w-full max-w-4xl">
          <DrawerHeader>
            <div className="flex items-start gap-4">
              <img 
                src={script.image} 
                alt={script.title}
                className="w-32 h-32 object-cover rounded-lg"
              />
              <div className="flex-1">
                <DrawerTitle className="text-2xl mb-2 text-white">{script.title}</DrawerTitle>
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-1">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium text-gray-300">{script.rating}</span>
                  </div>
                  <Badge className="bg-purple-600 text-white">{script.category}</Badge>
                  <Badge variant="outline" className="border-gray-600 text-gray-300">{script.difficulty}</Badge>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {script.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="bg-gray-700 text-gray-300">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-6 text-sm text-gray-400">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{script.playerCount}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{script.duration}</span>
                  </div>
                </div>
              </div>
            </div>
          </DrawerHeader>
          <div className="px-4 pb-4">
            <Tabs defaultValue="description" className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-gray-800 border-gray-700">
                <TabsTrigger value="description" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-gray-300">剧本介绍</TabsTrigger>
                <TabsTrigger value="characters" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-gray-300">角色信息</TabsTrigger>
                <TabsTrigger value="rules" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-gray-300">游戏规则</TabsTrigger>
                <TabsTrigger value="reviews" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-gray-300">评价</TabsTrigger>
              </TabsList>
              <TabsContent value="description" className="mt-4">
                <ScrollArea className="h-64">
                  <p className="text-gray-300 leading-relaxed">
                    {script.description}
                  </p>
                  <Separator className="my-4 bg-gray-700" />
                  <p className="text-gray-300 leading-relaxed">
                    这是一个充满悬疑和推理元素的剧本杀游戏。玩家将扮演不同的角色，通过搜集线索、推理分析，最终找出真相。游戏过程中需要玩家之间进行充分的交流和讨论，考验逻辑思维和表达能力。
                  </p>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="characters" className="mt-4">
                <ScrollArea className="h-64">
                  <div className="space-y-4">
                    <div className="border border-gray-700 rounded-lg p-4 bg-gray-800/50">
                      <h4 className="font-medium mb-2 text-white">角色1：管家</h4>
                      <p className="text-sm text-gray-400">在古宅中工作多年的老管家，对宅院的每个角落都了如指掌...</p>
                    </div>
                    <div className="border border-gray-700 rounded-lg p-4 bg-gray-800/50">
                      <h4 className="font-medium mb-2 text-white">角色2：继承人</h4>
                      <p className="text-sm text-gray-400">刚刚回到古宅的年轻继承人，对家族历史知之甚少...</p>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="rules" className="mt-4">
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium mb-2 text-white">游戏流程</h4>
                      <ol className="list-decimal list-inside space-y-1 text-sm text-gray-400">
                        <li>角色分配和背景介绍</li>
                        <li>自由探索和线索搜集</li>
                        <li>集中讨论和信息交换</li>
                        <li>推理分析和投票环节</li>
                        <li>真相揭晓和结果公布</li>
                      </ol>
                    </div>
                    <Separator className="bg-gray-700" />
                    <div>
                      <h4 className="font-medium mb-2 text-white">注意事项</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-400">
                        <li>请保持角色扮演的连贯性</li>
                        <li>禁止私下交流游戏相关信息</li>
                        <li>尊重其他玩家的游戏体验</li>
                      </ul>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="reviews" className="mt-4">
                <ScrollArea className="h-64">
                  <div className="space-y-4">
                    <div className="border border-gray-700 rounded-lg p-4 bg-gray-800/50">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex">
                          {[1,2,3,4,5].map((star) => (
                            <Star key={star} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          ))}
                        </div>
                        <span className="text-sm font-medium text-white">玩家A</span>
                      </div>
                      <p className="text-sm text-gray-400">非常精彩的剧本，推理过程很有挑战性，角色设定也很有趣！</p>
                    </div>
                    <div className="border border-gray-700 rounded-lg p-4 bg-gray-800/50">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex">
                          {[1,2,3,4].map((star) => (
                            <Star key={star} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          ))}
                          <Star className="h-4 w-4 text-gray-500" />
                        </div>
                        <span className="text-sm font-medium text-white">玩家B</span>
                      </div>
                      <p className="text-sm text-gray-400">整体不错，但是有些线索比较难找，新手可能需要更多提示。</p>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
            <div className="flex gap-3 mt-6">
              <Button 
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                onClick={() => {
                  // 关闭抽屉并跳转到游戏页面
                  onClose();
                  window.location.href = `/game?script_id=${script.id}`;
                }}
              >
                立即开始
              </Button>
              <Button variant="outline" className="flex-1 border-gray-600 text-gray-300 hover:bg-purple-600/20 hover:border-purple-500">
                收藏剧本
              </Button>
              <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-purple-600/20 hover:border-purple-500">
                分享
              </Button>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

const ScriptFilters = () => {
  const filters = useScriptFilters();
  const { setFilters } = useScriptActions();

  const handleFilterChange = (key, value) => {
    setFilters({ [key]: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium mb-3 text-white">分类</h3>
        <Select value={filters.category} onValueChange={(value) => handleFilterChange('category', value)}>
          <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
            <SelectValue placeholder="选择分类" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-600">
            <SelectItem value="" className="text-white hover:bg-gray-700">全部分类</SelectItem>
            <SelectItem value="推理" className="text-white hover:bg-gray-700">推理</SelectItem>
            <SelectItem value="生存" className="text-white hover:bg-gray-700">生存</SelectItem>
            <SelectItem value="情感" className="text-white hover:bg-gray-700">情感</SelectItem>
            <SelectItem value="恐怖" className="text-white hover:bg-gray-700">恐怖</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <h3 className="font-medium mb-3 text-white">难度</h3>
        <Select value={filters.difficulty} onValueChange={(value) => handleFilterChange('difficulty', value)}>
          <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
            <SelectValue placeholder="选择难度" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-600">
            <SelectItem value="" className="text-white hover:bg-gray-700">全部难度</SelectItem>
            <SelectItem value="简单" className="text-white hover:bg-gray-700">简单</SelectItem>
            <SelectItem value="中等" className="text-white hover:bg-gray-700">中等</SelectItem>
            <SelectItem value="困难" className="text-white hover:bg-gray-700">困难</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <h3 className="font-medium mb-3 text-white">人数范围</h3>
        <div className="px-2">
          <Slider
            value={filters.playerCount}
            onValueChange={(value) => handleFilterChange('playerCount', value)}
            max={10}
            min={2}
            step={1}
            className="mb-2"
          />
          <div className="flex justify-between text-sm text-gray-400">
            <span>{filters.playerCount[0]}人</span>
            <span>{filters.playerCount[1]}人</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-medium mb-3 text-white">游戏时长</h3>
        <Select value={filters.duration} onValueChange={(value) => handleFilterChange('duration', value)}>
          <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
            <SelectValue placeholder="选择时长" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-600">
            <SelectItem value="" className="text-white hover:bg-gray-700">全部时长</SelectItem>
            <SelectItem value="1-2小时" className="text-white hover:bg-gray-700">1-2小时</SelectItem>
            <SelectItem value="2-3小时" className="text-white hover:bg-gray-700">2-3小时</SelectItem>
            <SelectItem value="3-4小时" className="text-white hover:bg-gray-700">3-4小时</SelectItem>
            <SelectItem value="4小时以上" className="text-white hover:bg-gray-700">4小时以上</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <h3 className="font-medium mb-3 text-white">评分</h3>
        <div className="px-2">
          <Slider
            value={filters.rating}
            onValueChange={(value) => handleFilterChange('rating', value)}
            max={5}
            min={0}
            step={0.5}
            className="mb-2"
          />
          <div className="flex justify-between text-sm text-gray-400">
            <span>{filters.rating[0]}星</span>
            <span>{filters.rating[1]}星</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ScriptsPage() {
  const filteredScripts = useFilteredScripts();
  const selectedScript = useSelectedScript();
  const searchTerm = useScriptSearch();
  const viewMode = useScriptViewMode();
  const isLoading = useScriptLoading();
  const error = useScriptError();
  const { 
    setSearchTerm, 
    setViewMode, 
    setSelectedScript, 
    toggleFavorite, 
    fetchScripts,
    clearFilters 
  } = useScriptActions();
  
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // 初始化数据
  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  const handleSearch = (term) => {
    setSearchTerm(term);
  };

  const handleScriptDetail = (script) => {
    setSelectedScript(script);
    setIsDetailOpen(true);
  };

  const handleFavoriteToggle = (scriptId) => {
    toggleFavorite(scriptId);
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
  };

  return (
    <AppLayout title="剧本库">
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
        {/* 头部导航 - 移除重复的标题和返回按钮，因为AppLayout已提供面包屑导航 */}
        <div className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                {/* 搜索框 */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="搜索剧本..."
                    value={searchTerm}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10 w-64 bg-gray-800/50 border-gray-600 text-white placeholder:text-gray-400 focus:border-purple-500"
                  />
                </div>
                {/* 筛选按钮 */}
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`border-gray-600 text-gray-300 hover:bg-purple-600/20 hover:border-purple-500 ${showFilters ? 'bg-purple-600/20 border-purple-500 text-purple-300' : ''}`}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  筛选
                </Button>
                {/* 视图切换 */}
                <div className="flex border border-gray-600 rounded-lg">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleViewModeChange('grid')}
                    className={`rounded-r-none ${viewMode === 'grid' ? 'bg-purple-600 hover:bg-purple-700' : 'text-gray-300 hover:bg-gray-700'}`}
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleViewModeChange('list')}
                    className={`rounded-l-none ${viewMode === 'list' ? 'bg-purple-600 hover:bg-purple-700' : 'text-gray-300 hover:bg-gray-700'}`}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex gap-8">
            {/* 侧边筛选面板 */}
            {showFilters && (
              <div className="w-64 flex-shrink-0">
                <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-lg text-white">筛选条件</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScriptFilters />
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 主内容区域 */}
            <div className="flex-1">
              {isLoading ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4">加载中...</div>
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <div className="text-red-400 mb-4">{error}</div>
                  <Button onClick={() => fetchScripts()} className="bg-purple-600 hover:bg-purple-700">
                    重新加载
                  </Button>
                </div>
              ) : filteredScripts.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4">没有找到符合条件的剧本</div>
                  <Button onClick={() => {
                    setSearchTerm('');
                    clearFilters();
                  }} className="bg-purple-600 hover:bg-purple-700">
                    清除筛选条件
                  </Button>
                </div>
              ) : (
                <div className={`grid gap-6 ${
                  viewMode === 'grid' 
                    ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                    : 'grid-cols-1'
                }`}>
                  {filteredScripts.map((script) => (
                    <ScriptCard
                      key={script.id}
                      script={script}
                      onDetailClick={handleScriptDetail}
                      onFavoriteToggle={handleFavoriteToggle}
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
  );
}