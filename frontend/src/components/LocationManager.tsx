import React, { useEffect, useState } from 'react';
import { ScriptLocation as Location, ImageGenerationRequestModel, LocationPromptRequest } from '@/client';
import { 
  Service,
} from '@/client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, MapPin, Camera, Plus, Edit, Trash2, Search } from 'lucide-react';

interface LocationManagerProps {
  scriptId: string;
}

const LocationManager: React.FC<LocationManagerProps> = ({
  scriptId
}) => {
  // 场景相关状态
  const [locations, setLocations] = useState<Location[]>([]);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  // 使用 client services
  const getLocations = async (scriptId: number) => {
    const response = await Service.getLocationsApiLocationsScriptIdLocationsGet(scriptId);
    return response.data;
  };
  
  const createLocation = async (request: Location) => {
    const response = await Service.createLocationApiLocationsScriptIdLocationsPost(Number(scriptId), request);
    return response.data;
  };
  
  const updateLocation = async (scriptId: number, locationId: number, request: Location) => {
    const response = await Service.updateLocationApiLocationsScriptIdLocationsLocationIdPut(scriptId, locationId, request);
    return response.data;
  };
  
  const deleteLocation = async (scriptId: number, locationId: number) => {
    const response = await Service.deleteLocationApiLocationsScriptIdLocationsLocationIdDelete(scriptId, locationId);
    return response.data;
  };
  
  const generateLocationImage = async (request: ImageGenerationRequestModel) => {
    const response = await Service.generateSceneImageApiScriptsGenerateScenePost(request);
    return response.data;
  };
  
  const generateLocationPrompt = async (request: LocationPromptRequest) => {
    const response = await Service.generateLocationPromptApiLocationsLocationsGeneratePromptPost(request);
    return response;
  };

  const [locationForm, setLocationForm] = useState<Partial<Location>>({
    name: '',
    description: '',
    searchable_items: [],
    background_image_url: '',
    is_crime_scene: false
  });
  
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

  // 可搜索物品输入状态
  const [newSearchableItem, setNewSearchableItem] = useState('');

  useEffect(() => {
    initLocationForm();
  }, [scriptId]);

  const initLocationForm = async () => {
    if(scriptId){
      try {
        const response = await getLocations(Number(scriptId));
        // API返回的是ScriptResponse格式，数据在data.locations中
        if(response && Array.isArray(response.locations)){
          console.log('response.locations', response.locations);
          setLocations(response.locations);
        } else {
          // 如果返回的格式不正确，设置为空数组
          setLocations([]);
          console.warn('API返回的场景数据格式不正确:', response);
        }
      } catch (error) {
        console.error('获取场景列表失败:', error);
        toast('获取场景列表失败');
        // 出错时也设置为空数组
        setLocations([]);
      }
    }
  };

  // 添加或编辑场景
  const handleSaveLocation = async () => {
    setIsLoading(true);
    try {
      if (editingLocation) {
        // 编辑模式 - 调用更新API
        await updateLocation(Number(scriptId), editingLocation.id!, {
          name: locationForm.name,
          description: locationForm.description,
          searchable_items: locationForm.searchable_items,
          background_image_url: locationForm.background_image_url || '',
          is_crime_scene: locationForm.is_crime_scene
        });
        toast('场景更新成功！');
      } else {
        // 添加模式 - 调用创建API
        await createLocation({
          name: locationForm.name || '',
          description: locationForm.description || '',
          searchable_items: locationForm.searchable_items || [],
          background_image_url: locationForm.background_image_url || '',
          is_crime_scene: locationForm.is_crime_scene || false
        });
        toast('场景创建成功！');
      }
      
      // 重新加载场景列表
      await initLocationForm();
      
      // 重置表单
      resetForm();
    } catch (error) {
      console.error('保存场景失败:', error);
      toast('保存场景失败，请重试。');
    } finally {
      setIsLoading(false);
    }
  };

  // 删除场景
  const handleDeleteLocation = async (location: Location) => {
    if (!confirm(`确定要删除场景 "${location.name}" 吗？`)) {
      return;
    }

    try {
      await deleteLocation(Number(scriptId), location.id!);
      toast('场景删除成功！');
      await initLocationForm();
    } catch (error) {
      console.error('删除场景失败:', error);
      toast('删除场景失败，请重试。');
    }
  };

  // 重置表单
  const resetForm = () => {
    setLocationForm({
      name: '',
      description: '',
      searchable_items: [],
      background_image_url: '',
      is_crime_scene: false
    });
    setEditingLocation(null);
    setShowLocationForm(false);
    setImageGenParams({
      positive_prompt: '',
      negative_prompt: '',
      width: 512,
      height: 512,
      steps: 20,
      cfg_scale: 7,
      seed: 1
    });
    setNewSearchableItem('');
  };

  // 编辑场景
  const handleEditLocation = (location: Location) => {
    setEditingLocation(location);
    setLocationForm({
      name: location.name,
      description: location.description,
      searchable_items: location.searchable_items || [],
      background_image_url: location.background_image_url || '',
      is_crime_scene: location.is_crime_scene
    });
    setShowLocationForm(true);
  };

  // 添加可搜索物品
  const handleAddSearchableItem = () => {
    if (newSearchableItem.trim() && !locationForm.searchable_items?.includes(newSearchableItem.trim())) {
      setLocationForm(prev => ({
        ...prev,
        searchable_items: [...(prev.searchable_items || []), newSearchableItem.trim()]
      }));
      setNewSearchableItem('');
    }
  };

  // 移除可搜索物品
  const handleRemoveSearchableItem = (item: string) => {
    setLocationForm(prev => ({
      ...prev,
      searchable_items: prev.searchable_items?.filter(i => i !== item) || []
    }));
  };

  // 生成场景提示词
  const handleGenerateLocationPrompt = async () => {
    if (!locationForm.name?.trim() || !locationForm.description?.trim()) {
      toast('请先填写场景名称和描述');
      return;
    }

    setIsGeneratingPrompt(true);
    try {
      const request = {
        location_name: locationForm.name,
        location_description: locationForm.description,
        script_theme: '', // 可以从剧本信息中获取
        style_preference: '', // 可以让用户选择
        is_crime_scene: locationForm.is_crime_scene || false
      };

      console.log('发送请求:', request);
      const result = await generateLocationPrompt(request);
      console.log('接收到的结果:', result);
      
      // 更健壮的数据验证
      if (result && typeof result === 'object') {
        // 检查是否有直接的prompt字段
        if (result.prompt) {
          setImageGenParams(prev => ({ ...prev, positive_prompt: result.prompt }));
          toast('场景提示词生成成功！');
          return;
        }
        // 检查是否有data.prompt字段
        if (result.data && result.data.prompt) {
          setImageGenParams(prev => ({ ...prev, positive_prompt: result.data.prompt }));
          toast('场景提示词生成成功！');
          return;
        }
        // 检查是否有success字段但没有prompt
        if (result.success === false) {
          throw new Error(result.message || '生成失败');
        }
      }
      
      console.error('意外的响应格式:', result);
      throw new Error('生成结果格式不正确');
    } catch (error) {
      console.error('场景提示词生成失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast(`场景提示词生成失败：${errorMessage}`);
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  // 生成场景图片
  const handleGenerateLocationImage = async () => {
    if (!imageGenParams.positive_prompt.trim()) {
      toast('请输入正向提示词');
      return;
    }

    setIsGeneratingImage(true);
    try {
      const request: ImageGenerationRequestModel = {
        positive_prompt: imageGenParams.positive_prompt,
        negative_prompt: imageGenParams.negative_prompt,
        script_id: Number(scriptId),
        target_id: editingLocation?.id || 0,
        width: imageGenParams.width,
        height: imageGenParams.height,
        steps: imageGenParams.steps,
        cfg: imageGenParams.cfg_scale,
        seed: imageGenParams.seed
      };

      const result = await generateLocationImage(request);
      if (result && result.url) {
        setLocationForm(prev => ({ ...prev, background_image_url: result.url }));
        toast('场景图片生成成功！');
      } else {
        throw new Error('生成结果无效');
      }
    } catch (error) {
      console.error('场景图片生成失败:', error);
      toast('场景图片生成失败，请重试。');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-slate-800/90 via-purple-900/90 to-slate-800/90 backdrop-blur-md border-purple-500/30">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xl font-bold text-purple-200 flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          场景管理
        </CardTitle>
        <Button 
          onClick={() => setShowLocationForm(true)}
          className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          添加场景
        </Button>
      </CardHeader>
      <CardContent>
        {/* 场景列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations?.map((location) => (
            <Card key={location.id} className="bg-slate-800/50 border-purple-500/30 hover:border-purple-400/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-purple-200 mb-1">{location.name}</h3>
                    {location.is_crime_scene && (
                      <Badge variant="destructive" className="text-xs mb-2">
                        案发现场
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditLocation(location)}
                      className="text-purple-300 hover:text-purple-200 hover:bg-purple-800/30"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteLocation(location)}
                      className="text-red-300 hover:text-red-200 hover:bg-red-800/30"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                
                {location.background_image_url && (
                  <div className="mb-3">
                    <img 
                      src={location.background_image_url} 
                      alt={location.name}
                      className="w-full h-24 object-cover rounded-md"
                    />
                  </div>
                )}
                
                <p className="text-purple-300/80 text-sm mb-3 line-clamp-2">
                  {location.description}
                </p>
                
                {location.searchable_items && location.searchable_items.length > 0 && (
                  <div>
                    <p className="text-purple-200 text-xs mb-1 flex items-center gap-1">
                      <Search className="w-3 h-3" />
                      可搜索物品:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {location.searchable_items.slice(0, 3).map((item, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {item}
                        </Badge>
                      ))}
                      {location.searchable_items.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{location.searchable_items.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {locations.length === 0 && (
          <div className="text-center py-8 text-purple-300/70">
            <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>暂无场景，点击上方按钮添加第一个场景</p>
          </div>
        )}

        {/* 场景表单对话框 */}
        <Dialog open={showLocationForm} onOpenChange={setShowLocationForm}>
          <DialogContent className="bg-slate-800 border-purple-500/30 text-purple-100 max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-purple-200 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                {editingLocation ? '编辑场景' : '添加场景'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 左侧：基本信息 */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    场景名称 *
                  </label>
                  <Input
                    value={locationForm.name || ''}
                    onChange={(e) => setLocationForm(prev => ({ ...prev, name: e.target.value }))}
                    className="bg-slate-700/50 border-purple-500/30 text-purple-100"
                    placeholder="输入场景名称"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    场景描述 *
                  </label>
                  <Textarea
                    value={locationForm.description || ''}
                    onChange={(e) => setLocationForm(prev => ({ ...prev, description: e.target.value }))}
                    className="bg-slate-700/50 border-purple-500/30 text-purple-100"
                    rows={4}
                    placeholder="详细描述这个场景的环境、氛围等"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_crime_scene"
                    checked={locationForm.is_crime_scene || false}
                    onCheckedChange={(checked) => setLocationForm(prev => ({ ...prev, is_crime_scene: checked as boolean }))}
                  />
                  <label htmlFor="is_crime_scene" className="text-sm text-purple-200">
                    标记为案发现场
                  </label>
                </div>

                {/* 可搜索物品 */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    可搜索物品
                  </label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={newSearchableItem}
                      onChange={(e) => setNewSearchableItem(e.target.value)}
                      className="bg-slate-700/50 border-purple-500/30 text-purple-100 flex-1"
                      placeholder="输入物品名称"
                      onKeyPress={(e) => e.key === 'Enter' && handleAddSearchableItem()}
                    />
                    <Button
                      type="button"
                      onClick={handleAddSearchableItem}
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-500"
                    >
                      添加
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {locationForm.searchable_items?.map((item, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        {item}
                        <button
                          onClick={() => handleRemoveSearchableItem(item)}
                          className="ml-1 text-red-400 hover:text-red-300"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* 右侧：图片生成 */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    背景图片URL
                  </label>
                  <Input
                    value={locationForm.background_image_url || ''}
                    onChange={(e) => setLocationForm(prev => ({ ...prev, background_image_url: e.target.value }))}
                    className="bg-slate-700/50 border-purple-500/30 text-purple-100"
                    placeholder="输入图片URL或使用下方生成功能"
                  />
                </div>

                {locationForm.background_image_url && (
                  <div>
                    <img 
                      src={locationForm.background_image_url} 
                      alt="场景预览"
                      className="w-full h-32 object-cover rounded-md border border-purple-500/30"
                    />
                  </div>
                )}

                {/* 图片生成参数 */}
                <div className="border border-purple-500/30 rounded-lg p-4">
                  <h4 className="text-purple-200 font-medium mb-3 flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    AI图片生成
                  </h4>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm text-purple-200">正向提示词</label>
                        <Button
                          type="button"
                          onClick={handleGenerateLocationPrompt}
                          disabled={isGeneratingPrompt || !locationForm.name?.trim() || !locationForm.description?.trim()}
                          size="sm"
                          variant="outline"
                          className="text-xs bg-gradient-to-r from-amber-600/20 to-orange-600/20 border-amber-500/30 text-amber-200 hover:bg-amber-600/30"
                        >
                          {isGeneratingPrompt ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              生成中...
                            </>
                          ) : (
                            <>
                              <span className="mr-1">🤖</span>
                              生成提示词
                            </>
                          )}
                        </Button>
                      </div>
                      <Textarea
                        value={imageGenParams.positive_prompt}
                        onChange={(e) => setImageGenParams(prev => ({ ...prev, positive_prompt: e.target.value }))}
                        className="bg-slate-700/50 border-purple-500/30 text-purple-100"
                        rows={2}
                        placeholder="描述想要生成的场景图片，或点击上方按钮AI生成"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-purple-200 mb-1">负向提示词</label>
                      <Input
                        value={imageGenParams.negative_prompt}
                        onChange={(e) => setImageGenParams(prev => ({ ...prev, negative_prompt: e.target.value }))}
                        className="bg-slate-700/50 border-purple-500/30 text-purple-100"
                        placeholder="不想要的元素"
                      />
                    </div>
                    
                    <Button
                      onClick={handleGenerateLocationImage}
                      disabled={isGeneratingImage || !imageGenParams.positive_prompt.trim()}
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500"
                    >
                      {isGeneratingImage ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          生成中...
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4 mr-2" />
                          生成场景图片
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={resetForm}
              >
                取消
              </Button>
              <Button
                onClick={handleSaveLocation}
                disabled={isLoading || !locationForm.name?.trim() || !locationForm.description?.trim()}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  editingLocation ? '更新场景' : '创建场景'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default LocationManager;