import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function HomePage() {
  const [sessionId, setSessionId] = useState('');
  const [scriptId, setScriptId] = useState('1');

  const gameUrl = sessionId 
    ? `/game?session_id=${encodeURIComponent(sessionId)}&script_id=${scriptId}`
    : `/game?script_id=${scriptId}`;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl md:text-7xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600" style={{ textShadow: '0 0 15px rgba(255, 255, 255, 0.3)' }}>
          AI 剧本杀
        </h1>
        <p className="text-lg md:text-xl text-gray-300 mb-8">
          欢迎来到 AI 驱动的剧本杀世界。在这里，每个选择都至关重要，每个线索都可能揭示真相。与您的朋友一起，或与我们的 AI 角色对战，解开复杂的谜团。
        </p>
        
        {/* 游戏设置区域 */}
        <div className="mb-8 p-6 bg-gray-800 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 text-purple-400">快速开始</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="sessionId" className="block text-sm font-medium text-gray-300 mb-2">
                房间ID (可选)
              </label>
              <input
                id="sessionId"
                type="text"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                placeholder="输入房间ID加入现有游戏，留空则创建新游戏"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-2">默认剧本: <span className="text-purple-400 font-medium">{scriptId === '1' ? '商业谋杀案' : '豪宅谜案'}</span></p>
              <button
                onClick={() => setScriptId(scriptId === '1' ? '2' : '1')}
                className="text-sm text-purple-400 hover:text-purple-300 underline"
              >
                切换到{scriptId === '1' ? '豪宅谜案' : '商业谋杀案'}
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href={gameUrl} className="px-8 py-4 bg-purple-600 hover:bg-purple-700 rounded-lg text-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-purple-500/50">
            进入游戏大厅
          </Link>
          <Link href="/script-manager" className="px-8 py-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-gray-500/50">
            管理我的剧本
          </Link>
        </div>
      </div>
      <footer className="absolute bottom-8 text-gray-500">
        <p>&copy; {new Date().getFullYear()} AI JUBENSHA. All rights reserved.</p>
      </footer>
    </div>
  );
}

