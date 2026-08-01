import {
  ImageType,
  ScriptsService,
  ScriptStatus
} from '@/client';
import Layout from '@/components/Layout';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';

import { Script_Output as Script } from '@/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useWebSocketStore } from '@/stores/websocketStore';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Building,
  Check,
  FileText,
  Loader2,
  PanelRight,
  Search,
  Users,
  X
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

// 动态导入组件的加载占位
const ComponentLoading = () => (
  <div className="flex items-center justify-center gap-2 py-12 text-mist">
    <Loader2 className="h-5 w-5 animate-spin text-brass" />
    <span className="text-sm">加载中…</span>
  </div>
);

// 重型管理组件按需加载（纯客户端渲染，无需 SSR）
const ChatEditor = dynamic(() => import('@/components/ChatEditor'), {
  ssr: false,
  loading: ComponentLoading,
});
const CharacterManager = dynamic(() => import('@/components/CharacterManager'), {
  ssr: false,
  loading: ComponentLoading,
});
const EvidenceManager = dynamic(() => import('@/components/EvidenceManager'), {
  ssr: false,
  loading: ComponentLoading,
});
const LocationManager = dynamic(() => import('@/components/LocationManager'), {
  ssr: false,
  loading: ComponentLoading,
});
const ImageSelector = dynamic(() => import('@/components/ImageSelector'), {
  ssr: false,
  loading: ComponentLoading,
});

// 案卷章节
type SectionKey = 'cover' | 'background' | 'characters' | 'evidence' | 'locations';

const RAIL_ITEMS: { key: SectionKey; label: string; icon: LucideIcon }[] = [
  { key: 'cover', label: '卷宗封面', icon: FileText },
  { key: 'background', label: '背景故事', icon: BookOpen },
  { key: 'characters', label: '角色卡司', icon: Users },
  { key: 'evidence', label: '证据物证', icon: Search },
  { key: 'locations', label: '场景地图', icon: Building },
];

// 红线装配顺序：背景 → 角色 → 证据 → 场景 → 发布
const THREAD_STEPS = [
  { key: 'background', label: '背景' },
  { key: 'characters', label: '角色' },
  { key: 'evidence', label: '证据' },
  { key: 'locations', label: '场景' },
  { key: 'publish', label: '发布' },
] as const;

const inputClass =
  'w-full rounded-sm border border-line bg-panel/80 px-3 py-2 text-sm text-paper placeholder:text-faint focus:border-brass/60 focus:outline-none focus:ring-1 focus:ring-brass/30';
const textareaClass =
  'w-full rounded-sm border border-line bg-panel/80 px-3 py-2 text-sm leading-relaxed text-paper placeholder:text-faint focus:border-brass/60 focus:outline-none focus:ring-1 focus:ring-brass/30';
const labelClass = 'block text-[13px] font-medium text-mist';

const ScriptEditPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingCover, setSavingCover] = useState(false);
  const [savingBackground, setSavingBackground] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [script, setScript] = useState<Script | null>(null);
  const [activeSection, setActiveSection] = useState<SectionKey>('cover');
  const [assistantOpen, setAssistantOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 1024
  );
  const [characterCount, setCharacterCount] = useState<number>(0);
  const [evidenceCount, setEvidenceCount] = useState<number>(0);
  const [locationCount, setLocationCount] = useState<number>(0);
  const [tagInput, setTagInput] = useState('');

  // 基础信息表单数据
  const [basicFormData, setBasicFormData] = useState({
    title: '',
    description: '',
    author: '',
    player_count: '' as string | number,
    duration_minutes: '' as string | number,
    difficulty: '',
    tags: [] as string[],
    status: 'DRAFT' as ScriptStatus,
    cover_image_url: ''
  });

  // WebSocket连接
  const { connect, disconnect } = useWebSocketStore();

  // 背景故事状态 - 与后端 schema 保持一致
  const [backgroundStory, setBackgroundStory] = useState({
    title: '',
    setting_description: '',
    incident_description: '',
    victim_background: '',
    investigation_scope: '',
    rules_reminder: '',
    murder_method: '',
    murder_location: '',
    discovery_time: '',
    victory_conditions: {} as Record<string, any>
  });

  const scriptId = (() => {
    if (id && typeof id === 'string' && !isNaN(parseInt(id))) return parseInt(id);
    return null;
  })();

  // 获取脚本数据
  useEffect(() => {
    if (scriptId !== null) {
      const fetchScript = async () => {
        setLoading(true);
        setError(null);
        try {
          const response = await ScriptsService.getScriptApiScriptsScriptIdGet(scriptId);
          const scriptData = response.data;
          if (!scriptData) {
            toast('剧本不存在');
            return;
          }
          setScript(scriptData);
          setBasicFormData({
            title: scriptData.info.title || '',
            description: scriptData.info.description || '',
            author: scriptData.info.author || '',
            player_count: scriptData.info.player_count || 0,
            duration_minutes: scriptData.info.duration_minutes || 0,
            difficulty: scriptData.info.difficulty || '',
            tags: scriptData.info.tags || [],
            status: (scriptData.info.status as ScriptStatus) || ScriptStatus.DRAFT,
            cover_image_url: scriptData.info.cover_image_url || ''
          });
        } catch (err) {
          console.error('获取剧本详情失败:', err);
          setError('获取剧本详情失败');
        } finally {
          setLoading(false);
        }
      };
      fetchScript();
    } else if (id) {
      setError('无效的剧本ID');
      setLoading(false);
    }
  }, [scriptId, id]);

  // WebSocket连接管理
  useEffect(() => {
    if (scriptId !== null) {
      connect(scriptId);
    }
    return () => {
      disconnect();
    };
  }, [scriptId, connect, disconnect]);

  // 加载背景故事数据
  useEffect(() => {
    if (script?.background_story) {
      setBackgroundStory({
        title: script.background_story.title || '',
        setting_description: script.background_story.setting_description || '',
        incident_description: script.background_story.incident_description || '',
        victim_background: script.background_story.victim_background || '',
        investigation_scope: script.background_story.investigation_scope || '',
        rules_reminder: script.background_story.rules_reminder || '',
        murder_method: script.background_story.murder_method || '',
        murder_location: script.background_story.murder_location || '',
        discovery_time: script.background_story.discovery_time || '',
        victory_conditions: script.background_story.victory_conditions || {}
      });
    }
  }, [script?.background_story]);

  // 基础信息提交
  const handleBasicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (scriptId === null) return;
    setSavingCover(true);
    try {
      await ScriptsService.updateScriptInfoApiScriptsScriptIdInfoPut(scriptId, {
        ...basicFormData,
        player_count:
          typeof basicFormData.player_count === 'string'
            ? basicFormData.player_count === ''
              ? 0
              : parseInt(basicFormData.player_count) || 0
            : basicFormData.player_count,
        duration_minutes:
          typeof basicFormData.duration_minutes === 'string'
            ? basicFormData.duration_minutes === ''
              ? 0
              : parseInt(basicFormData.duration_minutes) || 0
            : basicFormData.duration_minutes
      });
      toast('封面已保存。');
    } catch (err) {
      console.error('更新脚本失败:', err);
      toast('保存失败，请重试。');
    } finally {
      setSavingCover(false);
    }
  };

  // 背景故事提交（真实调用完整更新接口）
  const handleSaveBackgroundStory = async () => {
    if (scriptId === null) return;
    setSavingBackground(true);
    try {
      await ScriptsService.updateScriptApiScriptsScriptIdPut(scriptId, {
        info: {
          ...basicFormData,
          player_count:
            typeof basicFormData.player_count === 'string'
              ? parseInt(basicFormData.player_count) || 0
              : basicFormData.player_count,
          duration_minutes:
            typeof basicFormData.duration_minutes === 'string'
              ? parseInt(basicFormData.duration_minutes) || 0
              : basicFormData.duration_minutes
        },
        background_story: {
          ...backgroundStory,
          victory_conditions:
            typeof backgroundStory.victory_conditions === 'string'
              ? (() => {
                  try {
                    return JSON.parse(backgroundStory.victory_conditions);
                  } catch {
                    return null;
                  }
                })()
              : backgroundStory.victory_conditions
        }
      });
      toast('背景故事已保存。');
    } catch (err) {
      console.error('保存背景故事失败:', err);
      toast('保存失败，请重试。');
    } finally {
      setSavingBackground(false);
    }
  };

  // 发布
  const handlePublish = async () => {
    if (scriptId === null) return;
    if (!publishable) {
      setActiveSection('cover');
      toast('先完成背景、角色、证据、场景，再发布。');
      return;
    }
    if (basicFormData.status === ScriptStatus.PUBLISHED) return;
    setPublishing(true);
    try {
      await ScriptsService.updateScriptStatusApiScriptsScriptIdStatusPatch(
        scriptId,
        ScriptStatus.PUBLISHED
      );
      setBasicFormData((prev) => ({ ...prev, status: ScriptStatus.PUBLISHED }));
      toast('已发布。');
    } catch (err) {
      console.error('发布失败:', err);
      toast('发布失败，请重试。');
    } finally {
      setPublishing(false);
    }
  };

  // 处理输入变化
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setBasicFormData((prev) => ({ ...prev, [name]: value }));
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !basicFormData.tags.includes(t)) {
      setBasicFormData((prev) => ({ ...prev, tags: [...prev.tags, t] }));
    }
    setTagInput('');
  };

  // 装配完成度
  const bgComplete = !!(
    backgroundStory.setting_description?.trim() && backgroundStory.incident_description?.trim()
  );
  const stepsDone: Record<string, boolean> = {
    background: bgComplete,
    characters: characterCount > 0,
    evidence: evidenceCount > 0,
    locations: locationCount > 0
  };
  const publishable =
    bgComplete && characterCount > 0 && evidenceCount > 0 && locationCount > 0;

  const handleThreadClick = (key: string) => {
    if (key === 'publish') {
      handlePublish();
      return;
    }
    setActiveSection(key as SectionKey);
  };

  const stamp = (() => {
    switch (basicFormData.status) {
      case ScriptStatus.PUBLISHED:
        return { text: '已发布', cls: 'border-thread/70 text-thread' };
      case ScriptStatus.ARCHIVED:
        return { text: '已归档', cls: 'border-faint text-faint' };
      default:
        return { text: '草稿', cls: 'border-brass/70 text-brass' };
    }
  })();

  // —— 卷宗封面 ——
  const CoverSection = () => (
    <form onSubmit={handleBasicSubmit}>
      <header className="mb-6 flex items-center justify-between border-b border-hairline pb-3">
        <h2 className="font-dossier text-xl font-semibold text-paper">卷宗封面</h2>
        <Button
          type="submit"
          disabled={savingCover}
          className="h-8 rounded-sm border border-brass/40 bg-brass/10 px-3 font-data text-xs tracking-widest text-brass hover:bg-brass/20 disabled:opacity-50"
        >
          {savingCover ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          <span className="ml-1.5">保存封面</span>
        </Button>
      </header>

      {/* 封面图 */}
      <div className="relative mb-8">
        <span className="absolute -top-2.5 left-4 z-10 rounded-sm border border-brass/50 bg-ink px-2.5 py-0.5 font-data text-[10px] tracking-[0.25em] text-brass">
          封面
        </span>
        <ImageSelector
          url={basicFormData.cover_image_url}
          imageType={ImageType.COVER}
          scriptId={Number(scriptId)}
          onImageChange={(url) => setBasicFormData((prev) => ({ ...prev, cover_image_url: url }))}
          className="w-full"
          imageHeight="h-64 lg:h-80"
          contextInfo={JSON.stringify({
            title: basicFormData.title,
            author: basicFormData.author,
            description: basicFormData.description,
            difficulty: basicFormData.difficulty,
            player_count: basicFormData.player_count,
            duration_minutes: basicFormData.duration_minutes,
            tags: basicFormData.tags
          })}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={`${labelClass} mb-1.5`}>剧本标题</label>
          <Input
            type="text"
            name="title"
            value={basicFormData.title}
            onChange={handleInputChange}
            className={`${inputClass} font-dossier text-lg`}
            placeholder="输入剧本标题…"
            required
          />
        </div>

        <div className="sm:col-span-2">
          <label className={`${labelClass} mb-1.5`}>剧本简介</label>
          <Textarea
            name="description"
            value={basicFormData.description}
            onChange={handleInputChange}
            rows={3}
            className={textareaClass}
            placeholder="用几句话交代这个案子的气质…"
          />
        </div>

        <div>
          <label className={`${labelClass} mb-1.5`}>作者</label>
          <Input
            type="text"
            name="author"
            value={basicFormData.author}
            readOnly
            className={`${inputClass} opacity-70`}
          />
        </div>

        <div>
          <label className={`${labelClass} mb-1.5`}>玩家人数</label>
          <Input
            type="number"
            name="player_count"
            value={basicFormData.player_count}
            onChange={handleInputChange}
            min={1}
            className={inputClass}
            placeholder="3–8 人"
            required
          />
        </div>

        <div>
          <label className={`${labelClass} mb-1.5`}>游戏时长（分钟）</label>
          <Input
            type="number"
            name="duration_minutes"
            value={basicFormData.duration_minutes}
            onChange={handleInputChange}
            min={1}
            className={inputClass}
            placeholder="建议 120–240"
            required
          />
        </div>

        <div>
          <label className={`${labelClass} mb-1.5`}>难度等级</label>
          <Select
            value={basicFormData.difficulty}
            onValueChange={(value) => setBasicFormData((prev) => ({ ...prev, difficulty: value }))}
          >
            <SelectTrigger className={inputClass}>
              <SelectValue placeholder="选择难度" />
            </SelectTrigger>
            <SelectContent className="border-line bg-panel text-paper">
              <SelectItem value="简单">简单</SelectItem>
              <SelectItem value="中等">中等</SelectItem>
              <SelectItem value="困难">困难</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className={`${labelClass} mb-1.5`}>发布状态</label>
          <Select
            value={basicFormData.status}
            onValueChange={(value) =>
              setBasicFormData((prev) => ({ ...prev, status: value as ScriptStatus }))
            }
          >
            <SelectTrigger className={inputClass}>
              <SelectValue placeholder="选择状态" />
            </SelectTrigger>
            <SelectContent className="border-line bg-panel text-paper">
              <SelectItem value="DRAFT">草稿</SelectItem>
              <SelectItem value="PUBLISHED">已发布</SelectItem>
              <SelectItem value="ARCHIVED">已归档</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="sm:col-span-2">
          <label className={`${labelClass} mb-1.5`}>标签</label>
          <div className="flex flex-wrap items-center gap-2 rounded-sm border border-line bg-panel/80 px-2 py-1.5 focus-within:border-brass/60 focus-within:ring-1 focus-within:ring-brass/30">
            {basicFormData.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-sm border border-brass/30 bg-brass/10 px-2 py-0.5 text-xs text-brass"
              >
                {tag}
                <button
                  type="button"
                  onClick={() =>
                    setBasicFormData((prev) => ({
                      ...prev,
                      tags: prev.tags.filter((t) => t !== tag)
                    }))
                  }
                  aria-label={`移除标签 ${tag}`}
                  className="text-brass/60 transition-colors hover:text-thread"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
              onBlur={addTag}
              placeholder={basicFormData.tags.length ? '' : '输入标签，回车添加…'}
              className="min-w-[120px] flex-1 bg-transparent px-1 text-sm text-paper placeholder:text-faint focus:outline-none"
            />
          </div>
        </div>
      </div>
    </form>
  );

  // —— 背景故事 ——
  const BackgroundSection = () => (
    <div>
      <header className="mb-6 flex items-center justify-between border-b border-hairline pb-3">
        <h2 className="font-dossier text-xl font-semibold text-paper">背景故事</h2>
        <Button
          onClick={handleSaveBackgroundStory}
          disabled={savingBackground}
          className="h-8 rounded-sm border border-brass/40 bg-brass/10 px-3 font-data text-xs tracking-widest text-brass hover:bg-brass/20 disabled:opacity-50"
        >
          {savingBackground ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          <span className="ml-1.5">保存背景故事</span>
        </Button>
      </header>

      <div className="space-y-10">
        <div>
          <h3 className="mb-3 flex items-center gap-2 font-dossier text-base font-semibold text-paper">
            <span className="h-3 w-1 bg-brass" />
            基础设定
          </h3>
          <label className={`${labelClass} mb-1.5`}>世界观与时代背景</label>
          <Textarea
            value={backgroundStory.setting_description}
            onChange={(e) =>
              setBackgroundStory((prev) => ({ ...prev, setting_description: e.target.value }))
            }
            rows={5}
            className={`${textareaClass} font-dossier`}
            placeholder="描述剧本的世界观、时代背景、地点设定…"
          />
        </div>

        <div>
          <h3 className="mb-3 flex items-center gap-2 font-dossier text-base font-semibold text-paper">
            <span className="h-3 w-1 bg-brass" />
            事件描述
          </h3>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <label className={`${labelClass} mb-1.5`}>核心事件经过</label>
              <Textarea
                value={backgroundStory.incident_description}
                onChange={(e) =>
                  setBackgroundStory((prev) => ({
                    ...prev,
                    incident_description: e.target.value
                  }))
                }
                rows={4}
                className={`${textareaClass} font-dossier`}
                placeholder="描述核心事件的经过…"
              />
            </div>
            <div>
              <label className={`${labelClass} mb-1.5`}>发现时间</label>
              <Input
                value={backgroundStory.discovery_time}
                onChange={(e) =>
                  setBackgroundStory((prev) => ({ ...prev, discovery_time: e.target.value }))
                }
                className={inputClass}
                placeholder="事件发现的具体时间…"
              />
            </div>
            <div>
              <label className={`${labelClass} mb-1.5`}>受害者背景</label>
              <Input
                value={backgroundStory.victim_background}
                onChange={(e) =>
                  setBackgroundStory((prev) => ({
                    ...prev,
                    victim_background: e.target.value
                  }))
                }
                className={inputClass}
                placeholder="受害者的身份、背景、人际关系…"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-3 flex items-center gap-2 font-dossier text-base font-semibold text-paper">
            <span className="h-3 w-1 bg-brass" />
            调查设定
          </h3>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <label className={`${labelClass} mb-1.5`}>调查范围</label>
              <Textarea
                value={backgroundStory.investigation_scope}
                onChange={(e) =>
                  setBackgroundStory((prev) => ({
                    ...prev,
                    investigation_scope: e.target.value
                  }))
                }
                rows={3}
                className={`${textareaClass} font-dossier`}
                placeholder="玩家可以调查的范围和限制…"
              />
            </div>
            <div>
              <label className={`${labelClass} mb-1.5`}>作案地点</label>
              <Input
                value={backgroundStory.murder_location}
                onChange={(e) =>
                  setBackgroundStory((prev) => ({ ...prev, murder_location: e.target.value }))
                }
                className={inputClass}
                placeholder="案件发生的具体地点…"
              />
            </div>
            <div className="lg:col-span-2">
              <label className={`${labelClass} mb-1.5`}>作案手法</label>
              <Textarea
                value={backgroundStory.murder_method}
                onChange={(e) =>
                  setBackgroundStory((prev) => ({ ...prev, murder_method: e.target.value }))
                }
                rows={4}
                className={`${textareaClass} font-dossier`}
                placeholder="作案的具体手法和过程…"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-3 flex items-center gap-2 font-dossier text-base font-semibold text-paper">
            <span className="h-3 w-1 bg-brass" />
            规则与胜负
          </h3>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div>
              <label className={`${labelClass} mb-1.5`}>规则提醒</label>
              <Textarea
                value={backgroundStory.rules_reminder}
                onChange={(e) =>
                  setBackgroundStory((prev) => ({ ...prev, rules_reminder: e.target.value }))
                }
                rows={5}
                className={textareaClass}
                placeholder="游戏规则和注意事项…"
              />
            </div>
            <div>
              <label className={`${labelClass} mb-1.5`}>胜利条件（JSON）</label>
              <Textarea
                value={
                  typeof backgroundStory.victory_conditions === 'object'
                    ? JSON.stringify(backgroundStory.victory_conditions, null, 2)
                    : String(backgroundStory.victory_conditions || '')
                }
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setBackgroundStory((prev) => ({ ...prev, victory_conditions: parsed }));
                  } catch {
                    setBackgroundStory((prev) => ({
                      ...prev,
                      victory_conditions: e.target.value as any
                    }));
                  }
                }}
                rows={9}
                className={`${textareaClass} font-data text-[13px]`}
                placeholder={'{\n  "detective": "找出真凶并说出动机",\n  "murderer": "隐藏身份到游戏结束",\n  "others": "协助破案或完成个人目标"\n}'}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // —— 子管理组件包装（左轨目录与内容一致）——
  const ManagerSection = ({
    title,
    count,
    children
  }: {
    title: string;
    count?: number;
    children: React.ReactNode;
  }) => (
    <div>
      <header className="mb-6 flex items-center justify-between border-b border-hairline pb-3">
        <h2 className="font-dossier text-xl font-semibold text-paper">
          {title}
          {typeof count === 'number' && count > 0 && (
            <span className="ml-2 font-data text-sm font-normal tracking-wider text-mist">
              {count} 项
            </span>
          )}
        </h2>
      </header>
      {children}
    </div>
  );

  // 页面主体内容
  const pageContent = () => {
    if (loading) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="flex items-center gap-2 text-mist">
            <Loader2 className="h-5 w-5 animate-spin text-brass" />
            <span className="text-sm">读取案卷中…</span>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <div className="flex items-center gap-2 text-thread">
            <AlertTriangle className="h-5 w-5" />
            <span>{error}</span>
          </div>
          <Button
            onClick={() => router.push('/script-manager')}
            className="h-8 rounded-sm border border-line px-3 font-data text-xs tracking-widest text-mist hover:border-brass/40 hover:text-brass"
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            返回列表
          </Button>
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col">
        {/* 案卷头 */}
        <header className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-hairline bg-ink/70 px-4 py-3 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => router.push('/script-manager')}
              aria-label="返回列表"
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-sm border border-line text-mist transition-colors hover:border-brass/40 hover:text-brass"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <div className="font-data text-[10px] uppercase tracking-[0.2em] text-faint">
                剧本案卷 · No. {scriptId}
              </div>
              <h1 className="truncate font-dossier text-lg font-semibold leading-tight text-paper">
                {basicFormData.title || '未命名剧本'}
              </h1>
              <p className="truncate font-data text-[11px] tracking-wide text-faint">
                {basicFormData.author}
                {basicFormData.player_count ? ` · ${basicFormData.player_count}人` : ''}
                {basicFormData.duration_minutes ? ` · ${basicFormData.duration_minutes}分钟` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2.5">
            <span
              className={`hidden rotate-[-3deg] rounded-[3px] border-2 px-2.5 py-0.5 font-data text-xs font-semibold tracking-[0.25em] sm:inline-block ${stamp.cls}`}
            >
              {stamp.text}
            </span>
            <Button
              onClick={() => setAssistantOpen((v) => !v)}
              aria-pressed={assistantOpen}
              className={`h-8 rounded-sm border px-3 font-data text-xs tracking-widest transition-colors ${
                assistantOpen
                  ? 'border-brass/50 bg-brass/15 text-brass'
                  : 'border-line text-mist hover:border-brass/40 hover:text-brass'
              }`}
            >
              <PanelRight className="mr-1.5 h-3.5 w-3.5" />
              <span className="hidden sm:inline">AI 助手</span>
            </Button>
          </div>
        </header>

        {/* 红线装配进度 */}
        <nav
          aria-label="剧本装配进度"
          className="flex flex-shrink-0 items-center gap-1 overflow-x-auto border-b border-hairline bg-panel/40 px-4 py-2 lg:px-6"
        >
          {THREAD_STEPS.map((step, i) => {
            const isPublish = step.key === 'publish';
            const done = isPublish ? publishable : stepsDone[step.key];
            const isCurrent = (isPublish ? 'cover' : step.key) === activeSection;
            const prevDone =
              i > 0
                ? THREAD_STEPS[i - 1].key === 'publish'
                  ? publishable
                  : stepsDone[THREAD_STEPS[i - 1].key]
                : false;
            return (
              <React.Fragment key={step.key}>
                {i > 0 && (
                  <span
                    className={`h-px min-w-4 flex-1 ${prevDone ? 'bg-thread' : 'bg-line'}`}
                    aria-hidden
                  />
                )}
                <button
                  onClick={() => handleThreadClick(step.key)}
                  className={`group flex items-center gap-1.5 rounded-sm px-2 py-1 transition-colors ${
                    isCurrent ? 'bg-raised' : 'hover:bg-raised/60'
                  }`}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full border transition-colors ${
                      isPublish && publishable
                        ? 'border-thread bg-thread'
                        : done
                        ? 'border-brass bg-brass'
                        : 'border-faint bg-transparent'
                    }`}
                  />
                  <span
                    className={`font-data text-[11px] tracking-wider transition-colors ${
                      isCurrent ? 'text-paper' : 'text-mist group-hover:text-paper'
                    }`}
                  >
                    {step.label}
                  </span>
                  {isPublish && publishable && <Check className="h-3 w-3 text-thread" />}
                  {isPublish && publishing && (
                    <Loader2 className="h-3 w-3 animate-spin text-thread" />
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        {/* 工作区 */}
        <div className="flex min-h-0 flex-1">
          {/* 左轨：案卷目录 */}
          <aside className="hidden w-52 flex-shrink-0 flex-col border-r border-hairline bg-ink/40 py-4 lg:flex">
            <div className="px-4 pb-2 font-data text-[10px] uppercase tracking-[0.25em] text-faint">
              案卷目录
            </div>
            <nav className="flex flex-col gap-0.5 px-2">
              {RAIL_ITEMS.map((item) => {
                const count = (
                  item.key === 'characters'
                    ? characterCount
                    : item.key === 'evidence'
                    ? evidenceCount
                    : item.key === 'locations'
                    ? locationCount
                    : 0
                ) as number;
                const active = activeSection === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setActiveSection(item.key)}
                    aria-current={active ? 'true' : undefined}
                    className={`relative flex items-center gap-2.5 rounded-sm px-3 py-2 text-left transition-colors ${
                      active ? 'bg-raised text-paper' : 'text-mist hover:bg-raised/50 hover:text-paper'
                    }`}
                  >
                    {active && <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 bg-brass" />}
                    <item.icon className="h-4 w-4 text-brass/70" />
                    <span className="flex-1 truncate text-[13px]">{item.label}</span>
                    {count > 0 && (
                      <span className="font-data text-[10px] tracking-wider text-faint">{count}</span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="mt-auto border-t border-hairline px-4 py-3">
              <div className="font-data text-[10px] uppercase tracking-[0.2em] text-faint">
                装配完成度
              </div>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-raised">
                <div
                  className="h-full rounded-full bg-brass transition-[width] duration-500"
                  style={{
                    width: `${(Object.values(stepsDone).filter(Boolean).length / 4) * 100}%`
                  }}
                />
              </div>
              <div className="mt-1.5 font-data text-[10px] tracking-wider text-mist">
                {Object.values(stepsDone).filter(Boolean).length} / 4 已完成
              </div>
            </div>
          </aside>

          {/* 中央：案卷文档 */}
          <main className="min-w-0 flex-1 overflow-y-auto custom-scrollbar bg-gradient-to-b from-ink to-[#10141C]">
            <div className="mx-auto max-w-3xl px-5 py-8 lg:px-10">
              {activeSection === 'cover' && <CoverSection />}
              {activeSection === 'background' && <BackgroundSection />}
              {activeSection === 'characters' && (
                <ManagerSection title="角色卡司" count={characterCount}>
                  <CharacterManager
                    scriptId={String(scriptId)}
                    onCountChange={setCharacterCount}
                  />
                </ManagerSection>
              )}
              {activeSection === 'evidence' && (
                <ManagerSection title="证据物证" count={evidenceCount}>
                  <EvidenceManager scriptId={String(scriptId)} onCountChange={setEvidenceCount} />
                </ManagerSection>
              )}
              {activeSection === 'locations' && (
                <ManagerSection title="场景地图" count={locationCount}>
                  <LocationManager scriptId={String(scriptId)} onCountChange={setLocationCount} />
                </ManagerSection>
              )}
            </div>
          </main>

          {/* AI 助手抽屉（桌面常驻 / 移动端滑出，始终保活） */}
          <aside
            className={`fixed inset-y-0 right-0 z-40 flex h-full flex-shrink-0 overflow-hidden transition-[width] duration-300 lg:relative lg:inset-auto ${
              assistantOpen ? 'w-[min(92vw,380px)] lg:w-[380px]' : 'w-0'
            }`}
          >
            <div className="h-full w-[380px]">
              <ChatEditor
                scriptId={String(scriptId)}
                onScriptUpdate={(updatedScript) => {
                  setScript(updatedScript);
                  if (updatedScript.info) {
                    setBasicFormData({
                      title: updatedScript.info.title || '',
                      description: updatedScript.info.description || '',
                      author: updatedScript.info.author || '',
                      player_count: updatedScript.info.player_count || 0,
                      duration_minutes: updatedScript.info.duration_minutes || 0,
                      difficulty: updatedScript.info.difficulty || '',
                      tags: updatedScript.info.tags || [],
                      status: (updatedScript.info.status as ScriptStatus) || ScriptStatus.DRAFT,
                      cover_image_url: updatedScript.info.cover_image_url || ''
                    });
                  }
                }}
              />
            </div>
          </aside>
        </div>

        {/* 移动端遮罩 + 浮动开关 */}
        {assistantOpen && (
          <button
            aria-label="关闭 AI 助手"
            onClick={() => setAssistantOpen(false)}
            className="fixed inset-0 z-30 bg-ink/70 lg:hidden"
          />
        )}
        <button
          aria-label={assistantOpen ? '收起 AI 助手' : '打开 AI 助手'}
          onClick={() => setAssistantOpen((v) => !v)}
          className={`fixed bottom-5 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-brass/50 bg-raised text-brass shadow-lg shadow-black/40 transition-colors hover:bg-brass/20 lg:hidden ${
            assistantOpen ? 'hidden' : ''
          }`}
        >
          <PanelRight className="h-5 w-5" />
        </button>
      </div>
    );
  };

  return <Layout>{pageContent()}</Layout>;
};

export default ScriptEditPage;
