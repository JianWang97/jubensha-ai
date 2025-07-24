import React, { useEffect, useState } from 'react';
import { ScriptEvidence as Evidence, EvidenceType, ImageGenerationRequestModel as ImageGenerationRequest } from '@/client';
import { ScriptsService, Service } from '@/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface EvidenceManagerProps {
  generateEvidenceImage?: (request: ImageGenerationRequest) => Promise<{ url: string }>;
  scriptId: string;
}

const EvidenceManager: React.FC<EvidenceManagerProps> = ({
  generateEvidenceImage,
  scriptId
}) => {
  // 证据相关状态
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [editingEvidence, setEditingEvidence] = useState<Evidence | null>(null);
  const [isEvidenceFormFullscreen, setIsEvidenceFormFullscreen] = useState(true);

  // 使用 client services 替代 useApiClient
  const getScriptWithDetail = async (scriptId: number) => {
    const response = await ScriptsService.getScriptApiScriptsScriptIdGet(scriptId);
    return response.data;
  };
  
  const generateEvidencePrompt = async (request: any) => {
    const response = await Service.generateEvidencePromptApiEvidenceEvidenceGeneratePromptPost(request);
    return response.data;
  };
  
  const createEvidence = async (request: any) => {
    const response = await Service.createEvidenceApiEvidenceScriptIdEvidencePost(request.script_id, request);
    return response.data;
  };
  
  const updateEvidence = async (evidenceId: number, request: any) => {
    const response = await Service.updateEvidenceApiEvidenceScriptIdEvidenceEvidenceIdPut(Number(scriptId), evidenceId, request);
    return response.data;
  };
  
  const deleteEvidence = async (evidenceId: number) => {
    const response = await Service.deleteEvidenceApiEvidenceScriptIdEvidenceEvidenceIdDelete(Number(scriptId), evidenceId);
    return response.data;
  };
  
  const [evidenceForm, setEvidenceForm] = useState<Partial<Evidence>>({
    name: '',
    description: '',
    image_url: '',
    significance: '',
    evidence_type: EvidenceType.PHYSICAL,
    importance: '重要证据',
    is_hidden: false,
    location: '',
    related_to: ''
  });
  
  useEffect(() => {
    initEvidenceForm();
  }, [scriptId]);

  const initEvidenceForm = async () => {
    if(scriptId){
      const script = await getScriptWithDetail(Number(scriptId));
      const evidences = script?.evidence || [];
      if(evidences){
        setEvidences(evidences);
      }
    }
  };
  // 图片生成相关状态
  const [imageGeneration, setImageGeneration] = useState({
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

  // 处理证据表单变化
  const handleEvidenceFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setEvidenceForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  // 添加或编辑证据
  const handleSaveEvidence = async () => {
    try {
      if (editingEvidence) {
        // 编辑模式 - 调用更新API
        await updateEvidence(editingEvidence.id!, {
          name: evidenceForm.name,
          description: evidenceForm.description,
          evidence_type: evidenceForm.evidence_type,
          location: evidenceForm.location,
          significance: evidenceForm.significance,
          related_to: evidenceForm.related_to,
          importance: evidenceForm.importance,
          is_hidden: evidenceForm.is_hidden
        });
        toast('证据更新成功！');
      } else {
        // 添加模式 - 调用创建API
        await createEvidence({
          script_id: Number(scriptId),
          name: evidenceForm.name || '',
          description: evidenceForm.description,
          evidence_type: evidenceForm.evidence_type,
          location: evidenceForm.location,
          significance: evidenceForm.significance,
          related_to: evidenceForm.related_to,
          importance: evidenceForm.importance,
          is_hidden: evidenceForm.is_hidden
        });
        toast('证据创建成功！');
      }
      
      // 重新加载证据列表
      await initEvidenceForm();
      
      // 重置表单
      resetForm();
    } catch (error) {
      console.error('保存证据失败:', error);
      toast('保存证据失败，请重试。');
    }
  };

  // 重置表单
  const resetForm = () => {
    setEvidenceForm({
      name: '',
      location: '',
      description: '',
      related_to: '',
      significance: '',
      evidence_type: EvidenceType.PHYSICAL,
      importance: '一般证据',
      is_hidden: false,
      image_url: ''
    });
    setEditingEvidence(null);
    setShowEvidenceForm(false);
  };

  // 编辑证据
  const handleEditEvidence = (ev: Evidence) => {
    setEvidenceForm(ev);
    setEditingEvidence(ev);
    setShowEvidenceForm(true);
  };

  // 删除证据
  const handleDeleteEvidence = async (id: number) => {
    if (confirm('确定要删除这个证据吗？')) {
      try {
        await deleteEvidence(id);
        toast('证据删除成功！');
        
        // 重新加载证据列表
        await initEvidenceForm();
      } catch (error) {
        console.error('删除证据失败:', error);
        toast('删除证据失败，请重试。');
      }
    }
  };

  // 生成提示词
  const handlePromptGeneration = async () => {
    if (!evidenceForm.name || !evidenceForm.description) {
      toast('请先填写证据名称和描述');
      return;
    }

    setIsGeneratingPrompt(true);
    try {
      const result = await generateEvidencePrompt({
        evidence_name: evidenceForm.name,
        evidence_description: evidenceForm.description,
        evidence_type: evidenceForm.evidence_type || 'physical',
        location: evidenceForm.location || '',
        related_to: evidenceForm.related_to || '',
        script_context: '' // 可以从剧本信息中获取
      });

      if (result) {
        // 更新图片生成参数
        setImageGeneration(prev => ({
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

  // 生成图片
  const handleImageGeneration = async () => {
    if (!generateEvidenceImage || !imageGeneration.positive_prompt.trim()) {
      toast('请输入正向提示词');
      return;
    }

    if (!editingEvidence?.id) {
      toast('请先保存证据后再生成图片');
      return;
    }

    setIsGeneratingImage(true);
    try {
      const request: ImageGenerationRequest = {
        positive_prompt: imageGeneration.positive_prompt,
        negative_prompt: imageGeneration.negative_prompt,
        script_id: Number(scriptId),
        target_id: editingEvidence.id,
        width: imageGeneration.width,
        height: imageGeneration.height,
        steps: imageGeneration.steps,
        cfg: imageGeneration.cfg_scale,
        seed: imageGeneration.seed
      };
      
      const result = await generateEvidenceImage(request);
      if (result && result.url) {
        setEvidenceForm(prev => ({ ...prev, image_url: result.url }));
        initEvidenceForm();
        toast('图片生成成功！');
      } else {
        throw new Error('生成结果无效');
      }
    } catch (error) {
      console.error('图片生成失败:', error);
      toast('图片生成失败，请重试。');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-slate-800/90 via-purple-900/90 to-slate-800/90 backdrop-blur-md border-purple-500/30">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-bold text-purple-200 flex items-center gap-2">
            🔍 证据管理
          </CardTitle>
          <Button 
            onClick={() => setShowEvidenceForm(true)}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
          >
            ➕ 添加证据
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* 证据卡片网格 */}
        <div className="mb-6">
          {evidences.length === 0 ? (
            <div className="text-purple-300 text-center py-12 bg-slate-700/30 rounded-xl border-2 border-dashed border-purple-500/30">
              <div className="text-4xl mb-4">🔍</div>
              <div className="text-lg">暂无证据</div>
              <div className="text-sm mt-2 opacity-70">点击上方按钮添加第一个证据</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {evidences.map((ev) => (
                <div key={ev.id} className="bg-gradient-to-br from-slate-700/80 to-slate-800/80 rounded-xl p-6 border border-purple-500/20 hover:border-purple-400/40 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10 group">
                  {/* 卡片头部 */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-purple-200 mb-2 group-hover:text-purple-100 transition-colors">{ev.name}</h4>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={ev.importance === '关键证据' ? 'destructive' : ev.importance === '重要证据' ? 'default' : 'secondary'}>
                          {ev.importance}
                        </Badge>
                        <Badge variant="outline" className="bg-blue-600/20 text-blue-300 border-blue-500/30">
                          {ev.evidence_type}
                        </Badge>
                        {ev.is_hidden && (
                          <Badge variant="outline" className="bg-orange-600/20 text-orange-300 border-orange-500/30">
                            🔒 隐藏
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 图片区域 */}
                  <div className="mb-4">
                    {ev.image_url ? (
                      <div className="w-full h-40 rounded-lg overflow-hidden border border-purple-500/30 bg-slate-800">
                        <img 
                          src={ev.image_url} 
                          alt={ev.name}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik02NCA5NkM3NC4yIDk2IDgyIDg4LjIgODIgNzhDODIgNjcuOCA3NC4yIDYwIDY0IDYwQzUzLjggNjAgNDYgNjcuOCA0NiA3OEM0NiA4OC4yIDUzLjggOTYgNjQgOTZaIiBmaWxsPSIjNkI3Mjg0Ii8+CjxwYXRoIGQ9Ik00MCA0MEg4OFY4OEg0MFY0MFoiIHN0cm9rZT0iIzZCNzI4NCIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIi8+PC9zdmc+Cg==';
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-40 rounded-lg border-2 border-dashed border-purple-500/30 flex items-center justify-center bg-slate-800/50">
                        <div className="text-center">
                          <div className="text-3xl mb-2 opacity-50">🖼️</div>
                          <div className="text-sm text-purple-300 opacity-70">暂无图片</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 证据信息 */}
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-purple-400">📍</span>
                      <span className="text-purple-200 font-medium">位置:</span>
                      <span className="text-purple-100 flex-1">{ev.location}</span>
                    </div>
                    
                    {ev.related_to && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-purple-400">👤</span>
                        <span className="text-purple-200 font-medium">关联:</span>
                        <span className="text-purple-100 flex-1">{ev.related_to}</span>
                      </div>
                    )}
                    
                    <div className="text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-purple-400">📝</span>
                        <span className="text-purple-200 font-medium">描述:</span>
                      </div>
                      <p className="text-purple-100 text-xs leading-relaxed pl-6 line-clamp-3">{ev.description}</p>
                    </div>
                    
                    {ev.significance && (
                      <div className="text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-purple-400">💡</span>
                          <span className="text-purple-200 font-medium">重要性:</span>
                        </div>
                        <p className="text-purple-100 text-xs leading-relaxed pl-6 line-clamp-2">{ev.significance}</p>
                      </div>
                    )}
                  </div>
                  
                  {/* 操作按钮 */}
                  <div className="flex gap-2 pt-4 border-t border-purple-500/20">
                    <Button
                      onClick={() => handleEditEvidence(ev)}
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-blue-600/20 text-blue-300 border-blue-500/30 hover:bg-blue-600/30"
                    >
                      <span>✏️</span>
                      <span>编辑</span>
                    </Button>
                    <Button
                      onClick={() => handleDeleteEvidence(ev.id!)}
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

        {/* 证据表单弹窗 */}
        <Dialog open={showEvidenceForm} onOpenChange={setShowEvidenceForm}>
          <DialogContent 
            fullscreen={isEvidenceFormFullscreen}
            className={isEvidenceFormFullscreen 
              ? "bg-slate-800 border-purple-500/30 max-w-none w-full h-full overflow-y-auto"
              : "bg-slate-800 border-purple-500/30 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            }
            showCloseButton={false}
          >
            <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
              <DialogTitle className="text-xl font-bold text-purple-200">
                {editingEvidence ? '✏️ 编辑证据' : '➕ 添加证据'}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEvidenceFormFullscreen(!isEvidenceFormFullscreen)}
                  className="text-purple-300 hover:text-purple-100 text-lg h-auto p-2"
                  title={isEvidenceFormFullscreen ? '退出全屏' : '全屏显示'}
                >
                  {isEvidenceFormFullscreen ? '🗗' : '🗖'}
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
            <div className="flex-1 overflow-y-auto px-1">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">证据名称</label>
                    <Input
                      type="text"
                      name="name"
                      value={evidenceForm.name}
                      onChange={handleEvidenceFormChange}
                      className="bg-slate-700 border-purple-500/30 focus:ring-purple-400 text-purple-100"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">发现位置</label>
                    <Input
                      type="text"
                      name="location"
                      value={evidenceForm.location}
                      onChange={handleEvidenceFormChange}
                      className="bg-slate-700 border-purple-500/30 focus:ring-purple-400 text-purple-100"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">证据类型</label>
                    <Select
                      name="evidence_type"
                      value={evidenceForm.evidence_type}
                      onValueChange={(value) => handleEvidenceFormChange({ target: { name: 'evidence_type', value } } as any)}
                    >
                      <SelectTrigger className="bg-slate-700 border-purple-500/30 text-purple-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="physical">物理证据</SelectItem>
                        <SelectItem value="document">文件证据</SelectItem>
                        <SelectItem value="video">视频证据</SelectItem>
                        <SelectItem value="audio">音频证据</SelectItem>
                        <SelectItem value="image">图片证据</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">重要程度</label>
                    <Select
                      name="importance"
                      value={evidenceForm.importance}
                      onValueChange={(value) => handleEvidenceFormChange({ target: { name: 'importance', value } } as any)}
                    >
                      <SelectTrigger className="bg-slate-700 border-purple-500/30 text-purple-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="一般证据">一般证据</SelectItem>
                        <SelectItem value="重要证据">重要证据</SelectItem>
                        <SelectItem value="关键证据">关键证据</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">关联角色</label>
                    <Input
                      type="text"
                      name="related_to"
                      value={evidenceForm.related_to || ''}
                      onChange={handleEvidenceFormChange}
                      className="bg-slate-700 border-purple-500/30 focus:ring-purple-400 text-purple-100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">图片URL</label>
                    <Input
                      type="text"
                      name="image_url"
                      value={evidenceForm.image_url || ''}
                      onChange={handleEvidenceFormChange}
                      placeholder="图片URL（可通过下方生成功能获取）"
                      className="bg-slate-700 border-purple-500/30 focus:ring-purple-400 text-purple-100"
                    />
                  </div>
                  
                  {/* 图片生成区域 */}
                  {generateEvidenceImage && (
                    <div className="col-span-full border border-purple-500/30 rounded-lg p-4 bg-slate-700/50">
                      <h4 className="text-lg font-semibold text-purple-200 mb-4">🎨 AI图片生成</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-purple-200 mb-2">正向提示词 *</label>
                          <Textarea
                            value={imageGeneration.positive_prompt}
                            onChange={(e) => setImageGeneration(prev => ({ ...prev, positive_prompt: e.target.value }))}
                            placeholder="描述你想要生成的图片内容..."
                            rows={3}
                            className="bg-slate-600 border-purple-500/30 focus:ring-purple-400 text-purple-100"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-purple-200 mb-2">反向提示词</label>
                          <Textarea
                            value={imageGeneration.negative_prompt}
                            onChange={(e) => setImageGeneration(prev => ({ ...prev, negative_prompt: e.target.value }))}
                            placeholder="描述你不想要的内容..."
                            rows={3}
                            className="bg-slate-600 border-purple-500/30 focus:ring-purple-400 text-purple-100"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-purple-200 mb-2">图片尺寸</label>
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              value={imageGeneration.width}
                              onChange={(e) => setImageGeneration(prev => ({ ...prev, width: parseInt(e.target.value) || 512 }))}
                              placeholder="宽度"
                              className="bg-slate-600 border-purple-500/30 focus:ring-purple-400 text-purple-100"
                            />
                            <span className="text-purple-300 self-center">×</span>
                            <Input
                              type="number"
                              value={imageGeneration.height}
                              onChange={(e) => setImageGeneration(prev => ({ ...prev, height: parseInt(e.target.value) || 512 }))}
                              placeholder="高度"
                              className="bg-slate-600 border-purple-500/30 focus:ring-purple-400 text-purple-100"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-purple-200 mb-2">生成参数</label>
                          <div className="grid grid-cols-3 gap-2">
                            <Input
                              type="number"
                              value={imageGeneration.steps}
                              onChange={(e) => setImageGeneration(prev => ({ ...prev, steps: parseInt(e.target.value) || 20 }))}
                              placeholder="步数"
                              className="bg-slate-600 border-purple-500/30 focus:ring-purple-400 text-purple-100"
                            />
                            <Input
                              type="number"
                              step="0.1"
                              value={imageGeneration.cfg_scale}
                              onChange={(e) => setImageGeneration(prev => ({ ...prev, cfg_scale: parseFloat(e.target.value) || 7 }))}
                              placeholder="CFG"
                              className="bg-slate-600 border-purple-500/30 focus:ring-purple-400 text-purple-100"
                            />
                            <Input
                              type="number"
                              value={imageGeneration.seed}
                              onChange={(e) => setImageGeneration(prev => ({ ...prev, seed: parseInt(e.target.value) || -1 }))}
                              placeholder="种子"
                              className="bg-slate-600 border-purple-500/30 focus:ring-purple-400 text-purple-100"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex gap-3">
                        <Button
                          type="button"
                          onClick={handlePromptGeneration}
                          disabled={isGeneratingPrompt || !evidenceForm.name || !evidenceForm.description}
                          className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white"
                        >
                          {isGeneratingPrompt ? '🤖 生成中...' : '🤖 AI生成提示词'}
                        </Button>
                        <Button
                          type="button"
                          onClick={handleImageGeneration}
                          disabled={isGeneratingImage || !imageGeneration.positive_prompt.trim()}
                          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white"
                        >
                          {isGeneratingImage ? '🎨 生成中...' : '🎨 生成图片'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">证据描述</label>
                  <Textarea
                    name="description"
                    value={evidenceForm.description}
                    onChange={handleEvidenceFormChange}
                    rows={3}
                    className="bg-slate-700 border-purple-500/30 focus:ring-purple-400 text-purple-100"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">重要性说明</label>
                  <Textarea
                    name="significance"
                    value={evidenceForm.significance || ''}
                    onChange={handleEvidenceFormChange}
                    rows={2}
                    className="bg-slate-700 border-purple-500/30 focus:ring-purple-400 text-purple-100"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="is_hidden"
                    checked={evidenceForm.is_hidden}
                    onChange={handleEvidenceFormChange}
                    className="w-4 h-4 text-purple-600 bg-slate-700 border-purple-500/30 rounded focus:ring-purple-400"
                  />
                  <label className="text-sm text-purple-200">隐藏证据（玩家初始不可见）</label>
                </div>
                
                {/* 图片预览 */}
                {evidenceForm.image_url && (
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-2">图片预览</label>
                    <div className="w-32 h-32 rounded-lg overflow-hidden border border-purple-500/30">
                      <img 
                        src={evidenceForm.image_url} 
                        alt="预览"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik02NCA5NkM3NC4yIDk2IDgyIDg4LjIgODIgNzhDODIgNjcuOCA3NC4yIDYwIDY0IDYwQzUzLjggNjAgNDYgNjcuOCA0NiA3OEM0NiA4OC4yIDUzLjggOTYgNjQgOTZaIiBmaWxsPSIjNkI3Mjg0Ii8+CjxwYXRoIGQ9Ik00MCA0MEg4OFY4OEg0MFY0MFoiIHN0cm9rZT0iIzZCNzI4NCIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIi8+PC9zdmc+Cg==';
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter className="flex justify-end gap-3 mt-6 pt-4 border-t border-purple-500/20">
              <Button
                variant="secondary"
                onClick={resetForm}
                className="bg-gray-600 hover:bg-gray-500 text-white"
              >
                取消
              </Button>
              <Button
                onClick={handleSaveEvidence}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white"
              >
                {editingEvidence ? '保存修改' : '添加证据'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default EvidenceManager;