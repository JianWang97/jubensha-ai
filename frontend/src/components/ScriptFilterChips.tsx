import { cn } from '@/lib/utils';

interface ScriptFilterChipsProps {
  selectedDifficulty: string | null;
  onDifficultyChange: (value: string | null) => void;
  selectedDuration: string | null;
  onDurationChange: (value: string | null) => void;
}

const ScriptFilterChips: React.FC<ScriptFilterChipsProps> = ({
  selectedDifficulty,
  onDifficultyChange,
  selectedDuration,
  onDurationChange,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500 font-medium whitespace-nowrap">难度：</span>
        {['全部', '简单', '中等', '困难'].map((d) => (
          <button
            key={d}
            onClick={() => onDifficultyChange(d === '全部' ? null : d)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium cursor-pointer transition-all border',
              selectedDifficulty === (d === '全部' ? null : d)
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-transparent shadow-md'
                : 'bg-slate-800/60 text-slate-400 border-slate-700/40 hover:bg-slate-700/60 hover:text-slate-200'
            )}
          >
            {d}
          </button>
        ))}
      </div>
      <div className="hidden sm:block w-px h-5 bg-slate-700/50" />
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500 font-medium whitespace-nowrap">时长：</span>
        {['全部', '1小时内', '1-2小时', '2小时以上'].map((d) => (
          <button
            key={d}
            onClick={() => onDurationChange(d === '全部' ? null : d)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium cursor-pointer transition-all border',
              selectedDuration === (d === '全部' ? null : d)
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-transparent shadow-md'
                : 'bg-slate-800/60 text-slate-400 border-slate-700/40 hover:bg-slate-700/60 hover:text-slate-200'
            )}
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ScriptFilterChips;
