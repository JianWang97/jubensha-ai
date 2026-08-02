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
  onCountChange?: (count: number) => void;
}

const EvidenceManager: React.FC<EvidenceManagerProps> = ({

  scriptId,
  onCountChange
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
        onCountChange?.(evidences.length);
      }
    }
  }, [scriptId, onCountChange]);

  useEffect(() => {
    initEvidenceForm();
  }, [initEvidenceForm]);

  // AI 通过对话更新剧本后实时刷新证据列表
  useEffect(() => {
    const handleScriptDataUpdate = (e: Event) => {
      if ((e as CustomEvent).detail?.type === 'script_data_update') {
        initEvidenceForm();
      }
    };
    window.addEventListener('script_edit_result', handleScriptDataUpdate);
    return () => window.removeEventListener('script_edit_result', handleScriptDataUpdate);
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
    <Card className="border-transparent shadow-none">
      <CardHeader className="px-0 pt-0">
        <div className="relative flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center border border-brass/30 bg-brass/10 rounded-sm">
              <Search className="w-5 h-5 text-brass" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-paper flex items-center gap-2">
                证据管理
              </CardTitle>
              <p className="text-sm text-mist mt-0.5">管理剧本中的所有证据信息</p>
            </div>
          </div>
          <Button 
            onClick={() => setShowEvidenceForm(true)}
            className="h-8 rounded-sm border border-brass/40 bg-brass/10 px-3 font-data text-xs tracking-widest text-brass hover:bg-brass/20"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            添加证据
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        {/* 证据卡片网格 */}
        <div className="mb-6">
          {evidences.length === 0 ? (
            <div className="text-mist text-center py-14 bg-panel/60 rounded-sm border border-dashed border-line">
              <div className="text-4xl mb-4 opacity-60"><Search className="w-12 h-12 mx-auto text-faint" /></div>
              <div className="text-lg font-medium mb-1 text-paper">暂无证据</div>
              <div className="text-sm opacity-70 mb-5">点击上方按钮添加第一个证据</div>
              <div className="flex justify-center">
                <Button 
                  onClick={() => setShowEvidenceForm(true)}
                  className="h-8 rounded-sm border border-brass/40 bg-brass/10 px-3 font-data text-xs tracking-widest text-brass hover:bg-brass/20"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  立即添加
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
              {evidences.map((ev) => (
                <div key={ev.id} className="rounded-sm border border-line bg-raised p-5 transition-colors hover:border-brass/30 group evidence-card">
                  {/* 卡片头部 */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-paper mb-3 transition-colors flex items-center gap-2">
                        <Search className="w-4 h-4 text-brass/70" />
                        {ev.name}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={ev.importance === '关键证据' ? 'destructive' : ev.importance === '重要证据' ? 'default' : 'secondary'}>
                          {ev.importance}
                        </Badge>
                        <Badge variant="outline" className="border-line text-mist">
                          {ev.evidence_type}
                        </Badge>
                        {ev.is_hidden && (
                          <Badge variant="outline" className="border-thread/30 text-thread">
                            <Lock className="w-3 h-3 mr-1" /> 隐藏
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 图片区域 */}
                  <div className="mb-5">
                    {ev.image_url ? (
                      <div className="w-full h-44 rounded-sm overflow-hidden border border-line bg-ink/50">
                        <Image 
                          src={ev.image_url || ''} 
                          alt={ev.name || ''}
                          width={400}
                          height={300}
                          className="w-full h-full object-cover transition-transform duration-500"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik02NCA5NkM3NC4yIDk2IDgyIDg4LjIgODIgNzhDODIgNjcuOCA3NC4yIDYwIDY0IDYwQzUzLjggNjAgNDYgNjcuOCA0NiA3OEM0NiA4OC4yIDUzLjggOTYgNjQgOTZaIiBmaWxsPSIjNkI3Mjg0Ci8+CjxwYXRoIGQ9Ik00MCA0MEg4OFY4OEg0MFY0MFoiIHN0cm9rZT0iIzZCNzI4NCIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIi8+PC9zdmc+Cg==';
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-full h-44 rounded-sm border border-dashed border-line flex items-center justify-center bg-ink/30">
                        <div className="text-center">
                          <div className="text-4xl mb-2 opacity-50">🗂️</div>
                          <div className="text-sm text-faint">暂无图片</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 证据信息 */}
                  <div className="space-y-2.5 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-3.5 h-3.5 text-brass/70" />
                      <span className="text-mist font-medium">位置:</span>
                      <span className="text-paper/85 flex-1">{ev.location}</span>
                    </div>
                    
                    {ev.related_to && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="w-3.5 h-3.5 text-brass/70" />
                        <span className="text-mist font-medium">关联:</span>
                        <span className="text-paper/85 flex-1">{ev.related_to}</span>
                      </div>
                    )}
                    
                    <div className="text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-3.5 h-3.5 text-brass/70" />
                        <span className="text-mist font-medium">描述:</span>
                      </div>
                      <p className="text-paper/75 text-xs leading-relaxed pl-6 line-clamp-3">{ev.description}</p>
                    </div>
                    
                    {ev.significance && (
                      <div className="text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <Lightbulb className="w-3.5 h-3.5 text-brass/70" />
                          <span className="text-mist font-medium">重要性:</span>
                        </div>
                        <p className="text-paper/75 text-xs leading-relaxed pl-6 line-clamp-2">{ev.significance}</p>
                      </div>
                    )}
                  </div>
                  
                  {/* 操作按钮 */}
                  <div className="flex gap-2.5 pt-4 border-t border-hairline">
                    <Button
                      onClick={() => handleEditEvidence(ev)}
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 rounded-sm border-line text-mist hover:border-brass/40 hover:text-brass"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      <span>编辑</span>
                    </Button>
                    <Button
                      onClick={() => handleDeleteEvidence(ev.id!)}
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 rounded-sm border-line text-mist hover:border-thread/50 hover:text-thread"
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
            className="bg-panel border-line !max-w-[95vw] !w-[95vw] max-h-[95vh] overflow-hidden custom-scrollbar"
            showCloseButton={false}
          >
            <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-5 border-b border-hairline">
              <DialogTitle className="text-xl font-semibold text-paper flex items-center gap-3">
                {editingEvidence ? <><Edit className="w-5 h-5 text-brass" /> 编辑证据</> : <><Plus className="w-5 h-5 text-brass" /> 添加证据</>}
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetForm}
                className="text-mist hover:text-paper hover:bg-raised h-auto p-2 rounded-sm"
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
                        <label className="block text-sm font-medium text-mist mb-1.5">证据名称</label>
                        <Input
                          type="text"
                          name="name"
                          value={evidenceForm.name}
                          onChange={handleEvidenceFormChange}
                          className="bg-panel border-line focus:ring-brass/30 text-paper"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-mist mb-1.5">发现位置</label>
                        <Input
                          type="text"
                          name="location"
                          value={evidenceForm.location}
                          onChange={handleEvidenceFormChange}
                          className="bg-panel border-line focus:ring-brass/30 text-paper"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-mist mb-1.5">证据类型</label>
                        <Select
                          name="evidence_type"
                          value={evidenceForm.evidence_type}
                          onValueChange={(value) => handleEvidenceFormChange({ target: { name: 'evidence_type', value } } as unknown as React.ChangeEvent<HTMLInputElement>)}
                        >
                          <SelectTrigger className="bg-panel border-line text-paper">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-panel border-line text-paper">
                            <SelectItem value="physical">物理证据</SelectItem>
                            <SelectItem value="document">文件证据</SelectItem>
                            <SelectItem value="video">视频证据</SelectItem>
                            <SelectItem value="audio">音频证据</SelectItem>
                            <SelectItem value="image">图片证据</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-mist mb-1.5">重要程度</label>
                        <Select
                          name="importance"
                          value={evidenceForm.importance}
                          onValueChange={(value) => handleEvidenceFormChange({ target: { name: 'importance', value } } as unknown as React.ChangeEvent<HTMLInputElement>)}
                        >
                          <SelectTrigger className="bg-panel border-line text-paper">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-panel border-line text-paper">
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
                    <label className="block text-sm font-medium text-mist mb-1.5">证据图片</label>
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
                    <label className="block text-sm font-medium text-mist mb-1.5">关联角色</label>
                    <Input
                      type="text"
                      name="related_to"
                      value={evidenceForm.related_to || ''}
                      onChange={handleEvidenceFormChange}
                      className="bg-panel border-line focus:ring-brass/30 text-paper"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-mist mb-1.5">证据描述</label>
                  <Textarea
                    name="description"
                    value={evidenceForm.description}
                    onChange={handleEvidenceFormChange}
                    rows={3}
                    className="bg-panel border-line focus:ring-brass/30 text-paper"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-mist mb-1.5">重要性说明</label>
                  <Textarea
                    name="significance"
                    value={evidenceForm.significance || ''}
                    onChange={handleEvidenceFormChange}
                    rows={2}
                    className="bg-panel border-line focus:ring-brass/30 text-paper"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="is_hidden"
                    checked={evidenceForm.is_hidden}
                    onChange={handleEvidenceFormChange}
                    className="w-4 h-4 accent-brass bg-panel border-line rounded focus:ring-brass"
                  />
                  <label className="text-sm text-mist">隐藏证据（玩家初始不可见）</label>
                </div>
                

              </div>
            </div>
            <DialogFooter className="flex justify-center mt-6 pt-5 border-t border-hairline">
              <Button
                onClick={handleSaveEvidence}
                className="h-9 rounded-sm border border-brass/40 bg-brass/10 px-6 font-data text-sm tracking-widest text-brass hover:bg-brass/20"
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