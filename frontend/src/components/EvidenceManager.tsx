import { ScriptEvidence as Evidence, EvidenceType, ImageType, ScriptEvidence, ScriptsService, Service } from '@/client';
import ImageSelector from '@/components/ImageSelector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Edit, FileText, Lightbulb, Lock, MapPin, Plus, Search, Trash2, User, X } from 'lucide-react';
import Image from 'next/image';
import React, { useCallback, useEffect, useState } from 'react';

import { toast } from 'sonner';
interface EvidenceManagerProps {
  scriptId: string;
}

const EvidenceManager: React.FC<EvidenceManagerProps> = ({

  scriptId
}) => {
  // 证据相关状态
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [editingEvidence, setEditingEvidence] = useState<Evidence | null>(null);

  // 使用 client services 替代 useApiClient
  const getScriptWithDetail = async (scriptId: number) => {
    const response = await ScriptsService.getScriptApiScriptsScriptIdGet(scriptId);
    return response.data;
  };
  

  const createEvidence = async (request: ScriptEvidence) => {
    const response = await Service.createEvidenceApiEvidenceScriptIdEvidencePost(request.script_id!, request as any);
    return response.data;
  };
  
  const updateEvidence = async (evidenceId: number, request: ScriptEvidence) => {
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
  
  const initEvidenceForm = useCallback(async () => {
    if(scriptId){
      const script = await getScriptWithDetail(Number(scriptId));
      const evidences = script?.evidence || [];
      if(evidences){
        setEvidences(evidences);
      }
    }
  }, [scriptId]);

  useEffect(() => {
    initEvidenceForm();
  }, [initEvidenceForm]);


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
          is_hidden: evidenceForm.is_hidden,
          image_url: evidenceForm.image_url,

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



  return (
    <Card className="border-blue-500/30 shadow-2xl shadow-blue-500/10 modern-card">
      <CardHeader className="relative overflow-hidden">
        <div className="relative flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 rounded-lg border border-blue-500/30">
              <Search className="w-6 h-6 text-blue-200" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-blue-200 flex items-center gap-2">
                证据管理
              </CardTitle>
              <p className="text-sm text-blue-300/70 mt-1">管理剧本中的所有证据信息</p>
            </div>
          </div>
          <Button 
            onClick={() => setShowEvidenceForm(true)}
            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-lg hover:shadow-blue-500/25 transition-all duration-300 modern-button"
          >
            <Plus className="w-4 h-4 mr-2" />
            添加证据
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* 证据卡片网格 */}
        <div className="mb-6">
          {evidences.length === 0 ? (
            <div className="text-blue-300 text-center py-16 bg-gradient-to-br from-slate-700/30 to-slate-800/30 rounded-2xl border-2 border-dashed border-blue-500/30 backdrop-blur-sm modern-empty-state">
              <div className="text-6xl mb-6 opacity-60"><Search className="w-16 h-16 mx-auto" /></div>
              <div className="text-xl font-semibold mb-2">暂无证据</div>
              <div className="text-sm opacity-70 mb-6">点击上方按钮添加第一个证据</div>
              <div className="flex justify-center">
                <Button 
                  onClick={() => setShowEvidenceForm(true)}
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  立即添加
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {evidences.map((ev) => (
                <div key={ev.id} className="bg-gradient-to-br from-slate-700/80 to-slate-800/80 rounded-2xl p-6 border border-blue-500/20 hover:border-blue-400/40 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/20 hover:scale-[1.02] group modern-card evidence-card">
                  {/* 卡片头部 */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h4 className="text-xl font-bold text-blue-200 mb-3 group-hover:text-blue-100 transition-colors flex items-center gap-2">
                        <Search className="w-5 h-5" />
                        {ev.name}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={ev.importance === '关键证据' ? 'destructive' : ev.importance === '重要证据' ? 'default' : 'secondary'}>
                          {ev.importance}
                        </Badge>
                        <Badge variant="outline" className="bg-blue-600/20 text-blue-300 border-blue-500/30">
                          {ev.evidence_type}
                        </Badge>
                        {ev.is_hidden && (
                          <Badge variant="outline" className="bg-orange-600/20 text-orange-300 border-orange-500/30">
                            <Lock className="w-3 h-3 mr-1" /> 隐藏
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 图片区域 */}
                  <div className="mb-6">
                    {ev.image_url ? (
                      <div className="w-full h-48 rounded-xl overflow-hidden border border-purple-500/30 bg-slate-800 shadow-lg group-hover:shadow-purple-500/20 transition-all duration-300">
                        <Image 
                          src={ev.image_url || ''} 
                          alt={ev.name || ''}
                          width={400}
                          height={300}
                          className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik02NCA5NkM3NC4yIDk2IDgyIDg4LjIgODIgNzhDODIgNjcuOCA3NC4yIDYwIDY0IDYwQzUzLjggNjAgNDYgNjcuOCA0NiA3OEM0NiA4OC4yIDUzLjggOTYgNjQgOTZaIiBmaWxsPSIjNkI3Mjg0Ci8+CjxwYXRoIGQ9Ik00MCA0MEg4OFY4OEg0MFY0MFoiIHN0cm9rZT0iIzZCNzI4NCIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIi8+PC9zdmc+Cg==';
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-48 rounded-xl border-2 border-dashed border-purple-500/30 flex items-center justify-center bg-gradient-to-br from-slate-800/50 to-slate-700/50 backdrop-blur-sm">
                        <div className="text-center">
                          <div className="text-5xl mb-3 opacity-60">🖼️</div>
                          <div className="text-sm text-purple-300 opacity-70">暂无图片</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 证据信息 */}
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-blue-400" />
                      <span className="text-blue-200 font-medium">位置:</span>
                      <span className="text-blue-100 flex-1">{ev.location}</span>
                    </div>
                    
                    {ev.related_to && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="w-4 h-4 text-blue-400" />
                        <span className="text-blue-200 font-medium">关联:</span>
                        <span className="text-blue-100 flex-1">{ev.related_to}</span>
                      </div>
                    )}
                    
                    <div className="text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-4 h-4 text-blue-400" />
                        <span className="text-blue-200 font-medium">描述:</span>
                      </div>
                      <p className="text-blue-100 text-xs leading-relaxed pl-6 line-clamp-3">{ev.description}</p>
                    </div>
                    
                    {ev.significance && (
                      <div className="text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <Lightbulb className="w-4 h-4 text-blue-400" />
                          <span className="text-blue-200 font-medium">重要性:</span>
                        </div>
                        <p className="text-blue-100 text-xs leading-relaxed pl-6 line-clamp-2">{ev.significance}</p>
                      </div>
                    )}
                  </div>
                  
                  {/* 操作按钮 */}
                  <div className="flex gap-3 pt-6 border-t border-blue-500/20">
                    <Button
                      onClick={() => handleEditEvidence(ev)}
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-gradient-to-r from-blue-600/20 to-cyan-600/20 text-blue-300 border-blue-500/30 hover:from-blue-600/40 hover:to-cyan-600/40 hover:border-blue-400/50 transition-all duration-300 modern-button"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      <span>编辑</span>
                    </Button>
                    <Button
                      onClick={() => handleDeleteEvidence(ev.id!)}
                      variant="outline"
                      size="sm"
                      className="flex-1 bg-gradient-to-r from-red-600/20 to-pink-600/20 text-red-300 border-red-500/30 hover:from-red-600/40 hover:to-pink-600/40 hover:border-red-400/50 transition-all duration-300 modern-button"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
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
            className="bg-gradient-to-br from-slate-900/98 via-indigo-950/98 to-slate-900/98 backdrop-blur-xl border-indigo-500/40 !max-w-[95vw] !w-[95vw] max-h-[95vh] overflow-hidden custom-scrollbar"
            showCloseButton={false}
          >
            <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-6 border-b border-indigo-500/20">
              <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-200 to-indigo-200 bg-clip-text text-transparent flex items-center gap-3">
                {editingEvidence ? <><Edit className="w-6 h-6 text-blue-400" /> 编辑证据</> : <><Plus className="w-6 h-6 text-blue-400" /> 添加证据</>}
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetForm}
                className="text-blue-300 hover:text-blue-100 hover:bg-blue-500/20 h-auto p-3 rounded-lg transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </Button>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-1 custom-scrollbar dialog-content-scroll max-h-[70vh]">
              <div className="space-y-4">
                {/* 第一行：左侧证据信息，右侧图片选择器 */}
                <div className="flex gap-6">
                  {/* 左侧：证据基本信息 */}
                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-blue-200 mb-2">证据名称</label>
                        <Input
                          type="text"
                          name="name"
                          value={evidenceForm.name}
                          onChange={handleEvidenceFormChange}
                          className="bg-slate-700 border-blue-500/30 focus:ring-blue-400 text-blue-100"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-blue-200 mb-2">发现位置</label>
                        <Input
                          type="text"
                          name="location"
                          value={evidenceForm.location}
                          onChange={handleEvidenceFormChange}
                          className="bg-slate-700 border-blue-500/30 focus:ring-blue-400 text-blue-100"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-purple-200 mb-2">证据类型</label>
                        <Select
                          name="evidence_type"
                          value={evidenceForm.evidence_type}
                          onValueChange={(value) => handleEvidenceFormChange({ target: { name: 'evidence_type', value } } as unknown as React.ChangeEvent<HTMLInputElement>)}
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
                          onValueChange={(value) => handleEvidenceFormChange({ target: { name: 'importance', value } } as unknown as React.ChangeEvent<HTMLInputElement>)}
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
                    </div>
                  </div>
                  
                  {/* 右侧：图片选择器 */}
                  <div className="flex-shrink-0">
                    <label className="block text-sm font-medium text-purple-200 mb-2">证据图片</label>
                    <ImageSelector
                      url={evidenceForm.image_url || ''}
                      imageType={ImageType.EVIDENCE}
                      scriptId={Number(scriptId)}
                      onImageChange={(url) => setEvidenceForm(prev => ({ ...prev, image_url: url }))}
                      contextInfo={JSON.stringify({
                        name: evidenceForm.name,
                        type: evidenceForm.evidence_type,
                        location: evidenceForm.location,
                        description: evidenceForm.description,
                        importance: evidenceForm.importance,
                        related_to: evidenceForm.related_to
                      })}
                      className="w-40"
                      imageHeight="h-40"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  
                  <div>
                    <label className="block text-sm font-medium text-blue-200 mb-2">关联角色</label>
                    <Input
                      type="text"
                      name="related_to"
                      value={evidenceForm.related_to || ''}
                      onChange={handleEvidenceFormChange}
                      className="bg-slate-700 border-blue-500/30 focus:ring-blue-400 text-blue-100"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-2">证据描述</label>
                  <Textarea
                    name="description"
                    value={evidenceForm.description}
                    onChange={handleEvidenceFormChange}
                    rows={3}
                    className="bg-slate-700 border-blue-500/30 focus:ring-blue-400 text-blue-100"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-blue-200 mb-2">重要性说明</label>
                  <Textarea
                    name="significance"
                    value={evidenceForm.significance || ''}
                    onChange={handleEvidenceFormChange}
                    rows={2}
                    className="bg-slate-700 border-blue-500/30 focus:ring-blue-400 text-blue-100"
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
                  <label className="text-sm text-blue-200">隐藏证据（玩家初始不可见）</label>
                </div>
                

              </div>
            </div>
            <DialogFooter className="flex justify-center mt-8 pt-6 border-t border-indigo-500/20">
              <Button
                onClick={handleSaveEvidence}
                className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white px-8 py-3 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
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