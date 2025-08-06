import React, { useState, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Service, ImageResponse, ImageGenerationRequest, ImageType } from '@/client';
import { toast } from 'sonner';
import { Camera, Trash2, Plus, Zap, X, Image, FileText, User, MapPin } from 'lucide-react';

interface ImageSelectorProps {
  /** 当前显示的图片URL */
  url?: string;
  /** 图片类型，用于生成新图片 */
  imageType: ImageType;
  /** 剧本ID */
  scriptId: string | number;
  /** 图片更新回调 */
  onImageChange: (url: string) => void;
  /** 组件宽度类名 */
  className?: string;
  /** 图片容器高度类名 */
  imageHeight?: string;
  /** 上下文信息JSON字符串，包含证据、背景、人物等信息 */
  contextInfo?: string;
}

const ImageSelector: React.FC<ImageSelectorProps> = ({
  url,
  imageType,
  scriptId,
  onImageChange,
  className = "w-full",
  imageHeight = "h-48",
  contextInfo
}) => {
  const [imageUrl, setImageUrl] = useState(url);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [images, setImages] = useState<ImageResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationParams, setGenerationParams] = useState({
    positive_prompt: '',
    negative_prompt: ''
  });

  // 图片类型标签映射
  const imageTypeLabels = {
    [ImageType.COVER]: '封面',
    [ImageType.CHARACTER]: '角色',
    [ImageType.EVIDENCE]: '证据',
    [ImageType.SCENE]: '场景'
  };

  // 获取所有图片
  const fetchImages = async () => {
    try {
      setLoading(true);
      const response = await Service.getMyImagesApiImagesMyImagesGet();
      // 过滤掉当前剧本的图片
      setImages(response);
    } catch (error) {
      console.error('获取图片失败:', error);
      toast('获取图片失败');
    } finally {
      setLoading(false);
    }
  };

  // 生成图片
  const handleGenerateImage = async () => {
    try {
      setGenerating(true);
      
      // 构建完整的正向提示词，如果有上下文信息则拼接
      let fullPositivePrompt = generationParams.positive_prompt;
      if (contextInfo) {
        fullPositivePrompt = contextInfo + (generationParams.positive_prompt ? '\n\n' + generationParams.positive_prompt : '');
      }
      
      const request: ImageGenerationRequest = {
        image_type: imageType,
        script_id: scriptId as number,
        positive_prompt: fullPositivePrompt,
        negative_prompt: generationParams.negative_prompt || null
      };
      
      const responseData = await Service.generateImageApiImagesGeneratePost(request);
      const response = responseData.data;
      if (response.url) {
        setImages([response, ...images]);
        setImageUrl(response.url);
        onImageChange(response.url);
        toast('图片生成成功！');
        setIsDrawerOpen(false);
      }
    } catch (error) {
      console.error('图片生成失败:', error);
      toast('图片生成失败，请重试');
    } finally {
      setGenerating(false);
    }
  };

  // 删除图片
  const handleDeleteImage = async (imageId: string) => {
    try {
      await Service.deleteImageApiImagesImageIdDelete(imageId);
      toast('图片删除成功');
      fetchImages(); // 重新获取图片列表
    } catch (error) {
      console.error('删除图片失败:', error);
      toast('删除图片失败');
    }
  };

  // 选择图片
  const handleSelectImage = (imageUrl: string) => {
    setImageUrl(imageUrl);
    onImageChange(imageUrl);
    console.log('选择图片:', imageUrl);
    setIsDrawerOpen(false);
    toast('图片选择成功');
  };

  // 打开抽屉时获取图片
  const handleOpenDrawer = () => {
    setIsDrawerOpen(true);
    fetchImages();
  };

  // 按类型分组图片
  const groupedImages = images.reduce((acc, img) => {
    const type = img.image_type as ImageType;
    if (!acc[type]) acc[type] = [];
    acc[type].push(img);
    return acc;
  }, {} as Record<ImageType, ImageResponse[]>);

  return (
    <>
      <div className={className}>
        <div 
          className={`${imageHeight} rounded-xl border-2 border-dashed border-gray-600/40 flex items-center justify-center bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm cursor-pointer hover:border-gray-500/60 transition-colors`}
        onClick={handleOpenDrawer}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="预览图片"
              className="w-full h-full object-cover rounded-xl"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik00MCA0MEw4OCA4OE00MCA4OEw4OCA0MCIgc3Ryb2tlPSIjNjM2NjcwIiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+';
              }}
            />
          ) : (
            <div className="text-center">
              <Camera className="w-12 h-12 mb-2 opacity-60 text-gray-400" />
              <div className="text-sm text-gray-400 opacity-70">点击选择或生成图片</div>
            </div>
          )}
        </div>
      </div>

      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent className="max-h-[95vh] bg-gradient-to-br from-gray-900/98 via-gray-800/98 to-gray-900/98 backdrop-blur-xl border-gray-700/50 shadow-2xl">
          <DrawerHeader className="relative border-b border-gray-700/50 pb-4">
            <DrawerTitle className="text-2xl font-bold text-gray-100 flex items-center gap-3">
              <Camera className="w-6 h-6 text-gray-300" />
              图片选择器 - {imageTypeLabels[imageType]}
            </DrawerTitle>
            <DrawerClose asChild>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-0 right-0 h-8 w-8 p-0 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 rounded-lg transition-all duration-200"
              >
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </DrawerHeader>
          
          <div className="p-6">
            <Tabs defaultValue="generate" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-gray-800/60 border border-gray-700/50">
                <TabsTrigger value="generate" className="data-[state=active]:bg-gray-600 data-[state=active]:text-white">生成图片</TabsTrigger>
                <TabsTrigger value="select" className="data-[state=active]:bg-gray-600 data-[state=active]:text-white">选择图片</TabsTrigger>
              </TabsList>
            
              <TabsContent value="generate" className="mt-6">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 左侧：生成参数 */}
                    <div className="space-y-6">
                      <div className="bg-gray-800/40 rounded-xl p-6 border border-gray-700/40">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-gray-200 font-medium flex items-center gap-2">
                              正向提示词 
                              <span className="text-xs text-gray-400 bg-gray-700/60 px-2 py-1 rounded">可选</span>
                            </label>
                            <Textarea
                              value={generationParams.positive_prompt}
                              onChange={(e) => setGenerationParams(prev => ({ ...prev, positive_prompt: e.target.value }))}
                              placeholder="描述您想要生成的图片内容（留空将使用默认提示词）..."
                              className="bg-gray-800/60 border-gray-600/60 text-gray-200 min-h-[100px] focus:border-gray-500/60 transition-colors"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-gray-200 font-medium flex items-center gap-2">
                              负向提示词
                              <span className="text-xs text-gray-400 bg-gray-700/60 px-2 py-1 rounded">可选</span>
                            </label>
                            <Textarea
                              value={generationParams.negative_prompt}
                              onChange={(e) => setGenerationParams(prev => ({ ...prev, negative_prompt: e.target.value }))}
                              placeholder="描述您不想要的内容（可选）..."
                              className="bg-gray-800/60 border-gray-600/60 text-gray-200 min-h-[80px] focus:border-gray-500/60 transition-colors"
                            />
                          </div>
                        </div>
                      </div>
                      
                      <Button
                        onClick={handleGenerateImage}
                        disabled={generating}
                        className="w-full bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 disabled:opacity-50 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                      >
                        {generating ? (
                          <>
                            <Zap className="w-5 h-5 mr-2 animate-spin" />
                            生成中...
                          </>
                        ) : (
                          <>
                            <Plus className="w-5 h-5 mr-2" />
                            生成{imageTypeLabels[imageType]}图片
                          </>
                        )}
                      </Button>
                    </div>
                    
                    {/* 右侧：预览区域 */}
                    <div className="space-y-4">
                      <label className="text-gray-200 font-medium">当前图片预览</label>
                      <div className="w-full h-64 rounded-xl border-2 border-dashed border-gray-600/40 flex items-center justify-center bg-gradient-to-br from-gray-800/60 to-gray-900/60">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt="当前图片"
                            className="w-full h-full object-cover rounded-xl"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik00MCA0MEw4OCA4OE00MCA4OEw4OCA0MCIgc3Ryb2tlPSIjNjM2NjcwIiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+';
                            }}
                          />
                        ) : (
                          <div className="text-center">
                            <Camera className="w-12 h-12 mb-2 opacity-60 text-gray-400" />
                            <div className="text-sm text-gray-400 opacity-70">暂无图片</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="select" className="mt-6">
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-lg text-gray-300">加载中...</div>
                  </div>
                ) : (
                  <Tabs defaultValue="evidence" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 bg-gray-800/40 border border-gray-700/40 mb-6">
                      <TabsTrigger value="evidence" className="data-[state=active]:bg-gray-600 data-[state=active]:text-white flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        证据
                      </TabsTrigger>
                      <TabsTrigger value="cover" className="data-[state=active]:bg-gray-600 data-[state=active]:text-white flex items-center gap-2">
                        <Image className="w-4 h-4" />
                        封面
                      </TabsTrigger>
                      <TabsTrigger value="character" className="data-[state=active]:bg-gray-600 data-[state=active]:text-white flex items-center gap-2">
                        <User className="w-4 h-4" />
                        角色
                      </TabsTrigger>
                      <TabsTrigger value="scene" className="data-[state=active]:bg-gray-600 data-[state=active]:text-white flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        场景
                      </TabsTrigger>
                    </TabsList>
                    
                    {/* 证据图片 */}
                    <TabsContent value="evidence" className="space-y-4">
                      <div className="max-h-[50vh] overflow-y-auto custom-scrollbar">
                        {groupedImages[ImageType.EVIDENCE] && groupedImages[ImageType.EVIDENCE].length > 0 ? (
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {groupedImages[ImageType.EVIDENCE].map((img) => (
                              <Card key={img.id} className="group relative overflow-hidden bg-gray-800/60 border-gray-700/60 hover:border-gray-500/60 transition-colors">
                                <CardContent className="p-0">
                                  <div className="relative">
                                    <img
                                      src={img.url}
                                      alt="证据图片"
                                      className="w-full h-32 object-cover cursor-pointer"
                                      onClick={() => handleSelectImage(img.url)}
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik00MCA0MEw4OCA4OE00MCA4OEw4OCA0MCIgc3Ryb2tlPSIjNjM2NjcwIiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+';
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => handleSelectImage(img.url)}
                                        className="bg-gray-600 hover:bg-gray-500 text-white"
                                      >
                                        选择
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => handleDeleteImage(img.id)}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-12 text-gray-400">
                            <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                            <div className="text-lg mb-2">暂无证据图片</div>
                            <div className="text-sm">您可以切换到生成图片标签页创建新图片</div>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                    
                    {/* 封面图片 */}
                    <TabsContent value="cover" className="space-y-4">
                      <div className="max-h-[50vh] overflow-y-auto custom-scrollbar">
                        {groupedImages[ImageType.COVER] && groupedImages[ImageType.COVER].length > 0 ? (
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {groupedImages[ImageType.COVER].map((img) => (
                              <Card key={img.id} className="group relative overflow-hidden bg-gray-800/60 border-gray-700/60 hover:border-gray-500/60 transition-colors">
                                <CardContent className="p-0">
                                  <div className="relative">
                                    <img
                                      src={img.url}
                                      alt="封面图片"
                                      className="w-full h-32 object-cover cursor-pointer"
                                      onClick={() => handleSelectImage(img.url)}
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik00MCA0MEw4OCA4OE00MCA4OEw4OCA0MCIgc3Ryb2tlPSIjNjM2NjcwIiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+';
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => handleSelectImage(img.url)}
                                        className="bg-gray-600 hover:bg-gray-500 text-white"
                                      >
                                        选择
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => handleDeleteImage(img.id)}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-12 text-gray-400">
                            <Image className="w-16 h-16 mx-auto mb-4 opacity-50" />
                            <div className="text-lg mb-2">暂无封面图片</div>
                            <div className="text-sm">您可以切换到生成图片标签页创建新图片</div>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                    
                    {/* 角色图片 */}
                    <TabsContent value="character" className="space-y-4">
                      <div className="max-h-[50vh] overflow-y-auto custom-scrollbar">
                        {groupedImages[ImageType.CHARACTER] && groupedImages[ImageType.CHARACTER].length > 0 ? (
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {groupedImages[ImageType.CHARACTER].map((img) => (
                              <Card key={img.id} className="group relative overflow-hidden bg-gray-800/60 border-gray-700/60 hover:border-gray-500/60 transition-colors">
                                <CardContent className="p-0">
                                  <div className="relative">
                                    <img
                                      src={img.url}
                                      alt="角色图片"
                                      className="w-full h-32 object-cover cursor-pointer"
                                      onClick={() => handleSelectImage(img.url)}
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik00MCA0MEw4OCA4OE00MCA4OEw4OCA0MCIgc3Ryb2tlPSIjNjM2NjcwIiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+';
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => handleSelectImage(img.url)}
                                        className="bg-gray-600 hover:bg-gray-500 text-white"
                                      >
                                        选择
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => handleDeleteImage(img.id)}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-12 text-gray-400">
                            <User className="w-16 h-16 mx-auto mb-4 opacity-50" />
                            <div className="text-lg mb-2">暂无角色图片</div>
                            <div className="text-sm">您可以切换到生成图片标签页创建新图片</div>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                    
                    {/* 场景图片 */}
                    <TabsContent value="scene" className="space-y-4">
                      <div className="max-h-[50vh] overflow-y-auto custom-scrollbar">
                        {groupedImages[ImageType.SCENE] && groupedImages[ImageType.SCENE].length > 0 ? (
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {groupedImages[ImageType.SCENE].map((img) => (
                              <Card key={img.id} className="group relative overflow-hidden bg-gray-800/60 border-gray-700/60 hover:border-gray-500/60 transition-colors">
                                <CardContent className="p-0">
                                  <div className="relative">
                                    <img
                                      src={img.url}
                                      alt="场景图片"
                                      className="w-full h-32 object-cover cursor-pointer"
                                      onClick={() => handleSelectImage(img.url)}
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik00MCA0MEw4OCA4OE00MCA4OEw4OCA0MCIgc3Ryb2tlPSIjNjM2NjcwIiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+';
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => handleSelectImage(img.url)}
                                        className="bg-gray-600 hover:bg-gray-500 text-white"
                                      >
                                        选择
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => handleDeleteImage(img.id)}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-12 text-gray-400">
                            <MapPin className="w-16 h-16 mx-auto mb-4 opacity-50" />
                            <div className="text-lg mb-2">暂无场景图片</div>
                            <div className="text-sm">您可以切换到生成图片标签页创建新图片</div>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
              </TabsContent>
            
            </Tabs>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default ImageSelector;