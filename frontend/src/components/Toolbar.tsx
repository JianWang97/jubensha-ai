import React from 'react';

const Toolbar = () => {
  return (
    <div className="bg-panel border border-line rounded-sm p-6 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="relative flex-grow w-full sm:w-auto">
        <input type="text" placeholder="搜索剧本..." className="w-full pl-5 pr-12 py-3 rounded-sm border border-line bg-ink/60 focus:outline-none focus:border-brass/60 focus:ring-1 focus:ring-brass/30 transition-colors text-paper placeholder:text-faint" />
        <svg className="w-6 h-6 absolute right-4 top-1/2 -translate-y-1/2 text-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
      </div>
      <div>
        <button className="bg-brass/10 border border-brass/40 text-brass hover:bg-brass/20 font-bold py-3 px-8 rounded-sm transition-colors">创建新剧本</button>
      </div>
    </div>
  );
};

export default Toolbar;