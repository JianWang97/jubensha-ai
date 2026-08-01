import React, { useState, useEffect, useCallback } from 'react';
import { ScriptInfo } from '@/client';
import { ScriptsService } from '@/client';

interface ScriptSelectionProps {
  onSelectScript: (script: ScriptInfo) => void;
}

const ScriptSelection: React.FC<ScriptSelectionProps> = ({ onSelectScript }) => {
  const [scripts, setScripts] = useState<ScriptInfo[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 使用 client services 替代 useApiClient
  const fetchScripts = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      const response = await ScriptsService.getScriptsApiScriptsGet();
      const fetchedScripts = response.items || [];
      setScripts(fetchedScripts);
      setRetryCount(0);
    } catch (e) {
      console.error('获取剧本失败:', e);
      setError('获取剧本失败，请重试');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    fetchScripts();
  };

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  if (loading) {
    return (
      <div className="text-center text-mist">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brass mx-auto mb-4"></div>
        <p>加载剧本中...</p>
        {retryCount > 0 && <p className="text-sm text-faint mt-2">重试次数: {retryCount}</p>}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center">
        <div className="text-thread mb-4">
          <i className="fas fa-exclamation-triangle text-2xl mb-2"></i>
          <p>{error}</p>
        </div>
        <button 
          onClick={handleRetry}
          className="bg-brass/10 border border-brass/40 text-brass hover:bg-brass/20 px-6 py-2 rounded-sm transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-8">
      <h2 className="font-dossier text-4xl font-bold text-center mb-10 text-paper">选择你的剧本</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {scripts.map((script) => (
          <div key={script.id} className="bg-panel border border-line hover:border-brass/40 rounded-sm overflow-hidden transition-all duration-300 transform hover:-translate-y-2">
            {/* 封面图为动态后端URL（主机可能不在 remotePatterns 内），保留原生 img */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {script.cover_image_url && <img src={script.cover_image_url} alt={script.title} className="w-full h-48 object-cover" />}
            <div className="p-6">
              <h3 className="font-dossier text-2xl font-bold mb-2 text-paper">{script.title}</h3>
              <p className="text-mist mb-4 h-24 overflow-hidden">{script.description}</p>
              <div className="flex justify-between items-center text-mist text-sm mb-6">
                <span><i className="fas fa-users mr-2"></i>{script.player_count}人</span>
              </div>
              <button 
                onClick={() => onSelectScript(script)} 
                className="w-full bg-brass/10 border border-brass/40 text-brass hover:bg-brass/20 font-bold py-3 px-4 rounded-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brass/30">
                选择这个剧本
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScriptSelection;