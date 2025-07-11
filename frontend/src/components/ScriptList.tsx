import React from 'react';

const ScriptList = () => {
  // 示例数据
  const scripts = [
    { title: '豪门惊梦', status: '已发布', players: 6, difficulty: '困难' },
    { title: '校园怪谈', status: '草稿', players: 8, difficulty: '中等' },
    { title: '古堡秘宝', status: '已发布', players: 5, difficulty: '简单' },
  ];

  return (
    <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-lg overflow-hidden">
      <table className="w-full text-left text-gray-800">
        <thead className="bg-gray-100">
          <tr className="border-b-2 border-gray-200">
            <th className="p-5 font-semibold">标题</th>
            <th className="p-5 font-semibold">状态</th>
            <th className="p-5 font-semibold">玩家人数</th>
            <th className="p-5 font-semibold">难度</th>
            <th className="p-5 font-semibold">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {scripts.map((script, index) => (
            <tr key={index} className="hover:bg-gray-50 transition-colors duration-200">
              <td className="p-5 font-bold">{script.title}</td>
              <td className="p-5">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${script.status === '已发布' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  {script.status}
                </span>
              </td>
              <td className="p-5">{script.players}</td>
              <td className="p-5">{script.difficulty}</td>
              <td className="p-5 space-x-4">
                <button className="text-purple-600 hover:text-purple-800 font-semibold">编辑</button>
                <button className="text-red-600 hover:text-red-800 font-semibold">删除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ScriptList;