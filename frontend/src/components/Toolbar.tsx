import React from 'react';

const Toolbar = () => {
  return (
    <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 mb-8 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="relative flex-grow w-full sm:w-auto">
        <input type="text" placeholder="搜索剧本..." className="w-full pl-5 pr-12 py-3 rounded-full border-2 border-gray-200 focus:outline-none focus:border-purple-500 transition-all duration-300 text-gray-800" />
        <svg className="w-6 h-6 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
      </div>
      <div>
        <button className="bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white font-bold py-3 px-8 rounded-full shadow-lg transform hover:scale-105 transition-all duration-300">创建新剧本</button>
      </div>
    </div>
  );
};

export default Toolbar;