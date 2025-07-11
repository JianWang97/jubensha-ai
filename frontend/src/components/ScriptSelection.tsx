import React, { useState, useEffect } from 'react';
import { Script, ApiError, useApiClient } from '@/hooks/useApiClient';

interface ScriptSelectionProps {
  onSelectScript: (script: Script) => void;
}

const ScriptSelection: React.FC<ScriptSelectionProps> = ({ onSelectScript }) => {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const { loading, error, getScripts, clearError } = useApiClient();

  const fetchScripts = async () => {
    try {
      clearError();
      const fetchedScripts = await getScripts();
      setScripts(fetchedScripts);
      setRetryCount(0);
    } catch (e) {
      // 错误处理已经在useApiClient中完成
      console.error('获取剧本失败:', e);
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    fetchScripts();
  };

  useEffect(() => {
    fetchScripts();
  }, []);

  if (loading) {
    return (
      <div className="text-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
        <p>加载剧本中...</p>
        {retryCount > 0 && <p className="text-sm text-gray-400 mt-2">重试次数: {retryCount}</p>}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center">
        <div className="text-red-400 mb-4">
          <i className="fas fa-exclamation-triangle text-2xl mb-2"></i>
          <p>{error}</p>
        </div>
        <button 
          onClick={handleRetry}
          className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors duration-300"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-8">
      <h2 className="text-4xl font-bold text-center mb-10 text-white" style={{ textShadow: '0 0 10px rgba(255, 255, 255, 0.3)' }}>选择你的剧本</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {scripts.map((script) => (
          <div key={script.id} className="bg-gray-800 bg-opacity-50 backdrop-blur-sm rounded-lg overflow-hidden shadow-lg border border-gray-700 hover:border-purple-500 transition-all duration-300 transform hover:-translate-y-2">
            {script.cover_image_url && <img src={script.cover_image_url} alt={script.title} className="w-full h-48 object-cover" />}
            <div className="p-6">
              <h3 className="text-2xl font-bold mb-2 text-purple-400">{script.title}</h3>
              <p className="text-gray-300 mb-4 h-24 overflow-hidden">{script.description}</p>
              <div className="flex justify-between items-center text-gray-400 text-sm mb-6">
                <span><i className="fas fa-users mr-2"></i>{script.player_count}人</span>
                <span><i className="fas fa-clock mr-2"></i>{script.duration_minutes}分钟</span>
              </div>
              <button 
                onClick={() => onSelectScript(script)} 
                className="w-full bg-purple-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-purple-700 transition-all duration-300 shadow-lg shadow-purple-500/30 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-75">
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