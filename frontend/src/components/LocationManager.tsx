import React, { useCallback, useEffect, useState } from 'react';
import { ScriptLocation as Location, ImageType } from '@/client';
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
import { MapPin, Camera, Plus, Edit, Trash2, Search, X, Zap, Save } from 'lucide-react';
import ImageSelector from '@/components/ImageSelector';

interface LocationManagerProps {
  scriptId: string;
  onCountChange?: (count: number) => void;
}

const LocationManager: React.FC<LocationManagerProps> = ({
  scriptId,
  onCountChange
}) => {
  // 场景相关状态
  const [locations, setLocations] = useState<Location[]>([]);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 使用 client services
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
  

  const [locationForm, setLocationForm] = useState<Partial<Location>>({
    name: '',
    description: '',
    searchable_items: [],
    background_image_url: '',
    is_crime_scene: false
  });
  
  // 图片生成相关状态
  const [, setImageGenParams] = useState({
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

  const initLocationForm = useCallback(async () => {
    if(scriptId){
      try {
        const response = await Service.getLocationsApiLocationsScriptIdLocationsGet(Number(scriptId));
        // API返回的是ScriptResponse格式，数据在data.locations中
        const data = response.data;
        if(data && Array.isArray(data.locations)){
          console.log('response.locations', data.locations);
          setLocations(data.locations);
          onCountChange?.(data.locations.length);
        } else {
          // 如果返回的格式不正确，设置为空数组
          setLocations([]);
          onCountChange?.(0);
          console.warn('API返回的场景数据格式不正确:', data);
        }
      } catch (error) {
        console.error('获取场景列表失败:', error);
        toast('获取场景列表失败');
        // 出错时也设置为空数组
        setLocations([]);
        onCountChange?.(0);
      }
    }
  }, [scriptId, onCountChange]);

  useEffect(() => {
    initLocationForm();
  }, [initLocationForm]);

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



  return (
    <Card className="border-transparent shadow-none">
      <CardHeader className="px-0 pt-0">
        <div className="relative flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center border border-brass/30 bg-brass/10 rounded-sm">
              <MapPin className="w-5 h-5 text-brass" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-paper flex items-center gap-2">
                场景管理
              </CardTitle>
              <p className="text-sm text-mist mt-0.5">管理剧本中的所有场景信息</p>
            </div>
          </div>
          <Button 
            onClick={() => setShowLocationForm(true)}
            className="h-8 rounded-sm border border-brass/40 bg-brass/10 px-3 font-data text-xs tracking-widest text-brass hover:bg-brass/20"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            添加场景
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        {/* 场景列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {locations?.map((location) => (
            <Card key={location.id} className="rounded-sm border border-line bg-raised transition-colors hover:border-brass/30 group location-card shadow-none">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-paper mb-2 transition-colors flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-brass/70" />
                      {location.name}
                    </h3>
                    {location.is_crime_scene && (
                      <Badge variant="destructive" className="text-xs mb-2 border-thread/30 bg-thread-dim/30 text-thread">
                        <Search className="w-3 h-3 mr-1" /> 案发现场
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditLocation(location)}
                      className="text-mist hover:text-brass hover:bg-raised"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteLocation(location)}
                      className="text-mist hover:text-thread hover:bg-raised"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                {location.background_image_url && (
                  <div className="mb-4">
                    <div className="w-full h-36 rounded-sm overflow-hidden border border-line bg-ink/50">
                      {/* 动态后端图片URL（可能来自未纳入 remotePatterns 的主机），保留原生 img 以保证渲染稳定 */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={location.background_image_url} 
                        alt={location.name}
                        className="w-full h-full object-cover transition-transform duration-500"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik02NCA5NkM3NC4yIDk2IDgyIDg4LjIgODIgNzhDODIgNjcuOCA3NC4yIDYwIDY0IDYwQzUzLjggNjAgNDYgNjcuOCA0NiA3OEM0NiA4OC4yIDUzLjggOTYgNjQgOTZaIiBmaWxsPSIjNkI3Mjg0Ii8+CjxwYXRoIGQ9Ik00MCA0MEg4OFY4OEg0MFY0MFoiIHN0cm9rZT0iIzZCNzI4NCIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIi8+PC9zdmc+Cg==';
                        }}
                      />
                    </div>
                  </div>
                )}
                
                {!location.background_image_url && (
                  <div className="mb-4">
                    <div className="w-full h-36 rounded-sm border border-dashed border-line flex items-center justify-center bg-ink/30">
                      <div className="text-center">
                        <Camera className="w-10 h-10 mb-2 opacity-60 text-faint" />
                        <div className="text-sm text-faint">暂无图片</div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="mb-4 bg-ink/40 p-3 rounded-sm border border-hairline">
                  <p className="text-mist text-sm line-clamp-2">
                    {location.description}
                  </p>
                </div>
                
                {location.searchable_items && location.searchable_items.length > 0 && (
                  <div>
                    <p className="text-mist text-xs mb-1 flex items-center gap-1">
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
          <div className="text-mist text-center py-14 bg-panel/60 rounded-sm border border-dashed border-line">
            <div className="text-4xl mb-4 opacity-60"><MapPin className="w-12 h-12 mx-auto text-faint" /></div>
            <div className="text-lg font-medium mb-1 text-paper">暂无场景</div>
            <div className="text-sm opacity-70 mb-5">点击上方按钮添加第一个场景</div>
            <div className="flex justify-center">
              <Button 
                onClick={() => setShowLocationForm(true)}
                className="h-8 rounded-sm border border-brass/40 bg-brass/10 px-3 font-data text-xs tracking-widest text-brass hover:bg-brass/20"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                立即添加
              </Button>
            </div>
          </div>
        )}

        {/* 场景表单对话框 */}
        <Dialog open={showLocationForm} onOpenChange={setShowLocationForm}>
          <DialogContent 
            showCloseButton={false}
            className="bg-panel border-line min-h-[80vh] !max-w-[95vw] !w-[95vw] max-h-[95vh] overflow-hidden text-paper custom-scrollbar">
            <DialogHeader className="border-b border-hairline pb-5">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-xl font-semibold text-paper flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-brass" />
                  {editingLocation ? '编辑场景' : '添加场景'}
                </DialogTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetForm}
                  className="text-mist hover:text-paper hover:bg-raised h-auto p-2 rounded-sm"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </DialogHeader>
            
            <div className="space-y-6 overflow-y-auto custom-scrollbar dialog-content-scroll flex-1 max-h-[70vh]">
              {/* 第一行：场景图片居中 */}
              <div className="bg-ink/40 rounded-sm p-6 border border-hairline">
                <h3 className="text-base font-semibold text-paper mb-4 flex items-center justify-center gap-2">
                  <Camera className="w-5 h-5 text-brass/70" /> 场景图片
                </h3>
                <div className="flex justify-center">
                  <ImageSelector
                    url={locationForm.background_image_url || ''}
                    imageType={ImageType.SCENE}
                    scriptId={scriptId}
                    onImageChange={(url) => {setLocationForm(prev => ({ ...prev, background_image_url: url }));console.log('选择图片:', url);}}
                    contextInfo={JSON.stringify({
                      name: locationForm.name,
                      description: locationForm.description,
                      is_crime_scene: locationForm.is_crime_scene,
                      searchable_items: locationForm.searchable_items
                    })}
                    className="w-48"
                    imageHeight="h-48"
                  />
                </div>
              </div>
              
              {/* 基本信息 */}
              <div className="bg-ink/40 rounded-xl p-6 border border-hairline">
                <h3 className="text-lg font-semibold text-mist mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5" /> 基本信息
                </h3>
                <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-mist mb-2">
                    场景名称 *
                  </label>
                  <Input
                    value={locationForm.name || ''}
                    onChange={(e) => setLocationForm(prev => ({ ...prev, name: e.target.value }))}
                    className="bg-panel border-line text-paper/85 placeholder:text-faint focus:border-brass/60"
                    placeholder="输入场景名称"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-mist mb-2">
                    场景描述 *
                  </label>
                  <Textarea
                    value={locationForm.description || ''}
                    onChange={(e) => setLocationForm(prev => ({ ...prev, description: e.target.value }))}
                    className="bg-panel border-line text-paper/85 placeholder:text-faint focus:border-brass/60 resize-none"
                    rows={4}
                    placeholder="详细描述这个场景的环境、氛围等"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_crime_scene"
                    checked={locationForm.is_crime_scene || false}
                    onCheckedChange={(checked) => setLocationForm(prev => ({ ...prev, is_crime_scene: checked as boolean }))}
                    className="border-line data-[state=checked]:bg-red-600 data-[state=checked]:border-red-500"
                  />
                  <label htmlFor="is_crime_scene" className="text-sm text-thread">
                    标记为案发现场
                  </label>
                </div>

                {/* 可搜索物品 */}
                <div>
                  <label className="block text-sm font-medium text-mist mb-2">
                    可搜索物品
                  </label>
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={newSearchableItem}
                      onChange={(e) => setNewSearchableItem(e.target.value)}
                      className="bg-panel border-line text-paper/85 placeholder:text-faint focus:border-brass/60 flex-1"
                      placeholder="输入物品名称"
                      onKeyPress={(e) => e.key === 'Enter' && handleAddSearchableItem()}
                    />
                    <Button
                      type="button"
                      onClick={handleAddSearchableItem}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-500"
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
                          className="ml-1 text-red-400 hover:text-thread"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

            </div>
            </div>

            <DialogFooter className="flex justify-center mt-8 pt-6 border-t border-hairline">
              <Button
                onClick={handleSaveLocation}
                disabled={isLoading || !locationForm.name?.trim() || !locationForm.description?.trim()}
                className="h-9 rounded-sm border border-brass/40 bg-brass/10 px-6 font-data text-sm tracking-widest text-brass hover:bg-brass/20 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Zap className="w-4 h-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {editingLocation ? '更新场景' : '创建场景'}
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

export default LocationManager;