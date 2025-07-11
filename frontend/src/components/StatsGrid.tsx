import React from 'react';

const StatCard = ({ label, value }: { label: string, value: string | number }) => (
  <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 text-center shadow-lg transform hover:-translate-y-2 transition-all duration-300">
    <p className="text-5xl font-bold text-purple-600 mb-2">{value}</p>
    <p className="text-gray-500 font-semibold">{label}</p>
  </div>
);

const StatsGrid = () => {
  // 示例数据
  const stats = [
    { label: '总剧本数', value: 12 },
    { label: '已发布', value: 8 },
    { label: '草稿', value: 4 },
    { label: '总玩家数', value: 128 },
  ];

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => (
        <StatCard key={index} label={stat.label} value={stat.value} />
      ))}
    </div>
  );
};

export default StatsGrid;