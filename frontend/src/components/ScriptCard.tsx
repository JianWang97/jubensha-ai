import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScriptStatus } from '@/client';
import { Clock, Heart, Play, Star, Users } from 'lucide-react';
import { useRouter } from 'next/router';

export const ScriptCardSkeleton = () => (
  <div className="relative overflow-hidden rounded-lg border border-slate-700/30 bg-slate-900/50 h-80 animate-pulse">
    <div className="absolute inset-0 bg-white/5" />
    <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3">
      {/* 标题 */}
      <div className="h-5 bg-white/10 rounded w-2/3" />
      {/* 元信息行 */}
      <div className="flex items-center gap-3">
        <div className="h-3 bg-white/10 rounded w-10" />
        <div className="h-3 bg-white/10 rounded w-12" />
        <div className="h-3 bg-white/10 rounded w-8" />
      </div>
      {/* 描述 */}
      <div className="h-4 bg-white/10 rounded w-full" />
      <div className="h-4 bg-white/10 rounded w-5/6" />
      {/* 标签 */}
      <div className="flex gap-2 pt-0.5">
        <div className="h-5 bg-white/10 rounded-full w-12" />
        <div className="h-5 bg-white/10 rounded-full w-14" />
        <div className="h-5 bg-white/10 rounded-full w-10" />
      </div>
      {/* 底部：状态 + 按钮 */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-600/20">
        <div className="h-5 bg-white/10 rounded w-12" />
        <div className="h-6 bg-white/10 rounded w-16" />
      </div>
    </div>
  </div>
);

interface ScriptCardProps {
  script: any;
  onDetailClick?: (script: any) => void;
  onFavoriteToggle?: (scriptId: number) => void;
  onEdit?: (scriptId: number) => void;
  onDelete?: (scriptId: number) => void;
  onPublish?: (scriptId: number) => void;
  isMyScript?: boolean;
}

const ScriptCard: React.FC<ScriptCardProps> = ({ script, onDetailClick, onFavoriteToggle, onEdit, onDelete, onPublish, isMyScript }) => {
  const router = useRouter();

  return (
    <Card
      className="group relative overflow-hidden border-slate-700/30 hover:border-indigo-500/40 transition-all duration-500 cursor-pointer h-80"
      onClick={() => onDetailClick && onDetailClick(script)}
    >
      {/* 背景图片 - 覆盖整个卡片 */}
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element -- 动态远程封面URL（含兜底生图接口），next/image 优化器无法保证可加载，保持 <img> 以避免渲染风险 */}
        <img
          src={script.cover_image_url || script.image || `https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent('mystery script book cover, dark theme, elegant design')}&image_size=landscape_4_3`}
          alt={script.title}
          className="w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-700"
        />
        {/* 渐变遮罩 - 从底部开始更强烈 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      </div>

      {/* Hover快捷操作覆盖层 */}
      <div className="absolute inset-0 z-20 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-3 pointer-events-none group-hover:pointer-events-auto">
        <Button
          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-6 py-2 rounded-md font-medium shadow-lg"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/game?script_id=${script.id}`);
          }}
        >
          <Play className="h-4 w-4 mr-2" />
          立即游玩
        </Button>
        <Button
          variant="outline"
          className="border-white/30 text-white hover:bg-white/10 hover:text-white px-6 py-2 rounded-md font-medium backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            if (onDetailClick) onDetailClick(script);
          }}
        >
          查看详情
        </Button>
      </div>

      {/* 顶部浮动元素（高于 hover 覆盖层，保证可点击） */}
      <div className="relative z-30">
        {/* 收藏按钮 */}
        {!isMyScript && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-3 right-3 h-8 w-8 p-0 bg-slate-900/40 hover:bg-slate-900/60 border-0 backdrop-blur-sm"
            onClick={(e) => {
              e.stopPropagation();
              if (onFavoriteToggle) onFavoriteToggle(script.id);
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
      </div>

      {/* 内容区域 - 毛玻璃背景（高于 hover 覆盖层，保证操作按钮可点击） */}
      <div className="absolute bottom-0 left-0 right-0 z-30">
        <div className="bg-slate-900/40 backdrop-blur-md border-t border-slate-700/30 p-4 space-y-2.5">
          {/* 标题 */}
          <h3 className="font-bold text-white text-lg leading-snug line-clamp-1 group-hover:text-indigo-300 transition-colors">
            {script.title}
          </h3>

          {/* 元信息辅助行：人数 / 时长 / 评分 / 作者 */}
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {script.player_count || '4-6'}人
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {script.duration || '2-3小时'}
            </span>
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-amber-400/70 text-amber-400/70" />
              {script.rating || '4.5'}
            </span>
            {!isMyScript && (
              <span className="ml-auto truncate text-slate-500">by {script.author}</span>
            )}
          </div>

          {/* 描述 */}
          <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">
            {script.description || '暂无描述'}
          </p>

          {/* 标签 */}
          <div className="flex flex-wrap gap-1.5">
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

          {/* 底部：状态与操作按钮 */}
          <div className="flex items-center justify-between pt-2.5 border-t border-slate-600/30">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${script.status === ScriptStatus.ARCHIVED || script.status === ScriptStatus.PUBLISHED
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
              {script.status === ScriptStatus.ARCHIVED || script.status === ScriptStatus.PUBLISHED ? '已发布' : '草稿'}
            </span>

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
                      if (onEdit) onEdit(script.id);
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
                        if (onPublish) onPublish(script.id);
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
                      if (onDelete) onDelete(script.id);
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

export default ScriptCard;
