import React from 'react';

interface Character {
  id: number;
  name: string;
  background: string;
  gender: string;
  age: number;
  profession: string;
  secret: string;
  objective: string;
  is_victim: boolean;
  is_murderer: boolean;
}

interface CharacterListProps {
  characters: Character[];
}

const CharacterList = ({ characters = [] }: CharacterListProps) => {
  const getCharacterIcon = (character: Character) => {
    if (character.is_victim) return '💀';
    if (character.is_murderer) return '🔪';
    return '🕵️';
  };

  const getCharacterBorderColor = (character: Character) => {
    if (character.is_victim) return 'border-red-400';
    if (character.is_murderer) return 'border-orange-400';
    return 'border-purple-400';
  };

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 shadow-2xl border border-white/20">
      <h3 className="text-2xl font-bold text-white mb-5">角色列表 ({characters.length})</h3>
      {characters.length === 0 ? (
        <div className="text-center text-gray-300 py-8">
          <p>暂无角色信息</p>
          <p className="text-sm mt-2">请选择剧本后开始游戏</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {characters.map((character) => (
            <li 
              key={character.id} 
              className={`bg-white/10 rounded-lg p-4 border-l-4 ${getCharacterBorderColor(character)} transition-all duration-300 hover:bg-white/20 hover:border-opacity-80`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-lg text-white flex items-center gap-2">
                  <span className="text-xl">{getCharacterIcon(character)}</span>
                  {character.name}
                </p>
                <div className="text-sm text-gray-300">
                  {character.gender} · {character.age}岁
                </div>
              </div>
              <p className="text-sm text-gray-300 mb-2">
                <span className="font-semibold">职业:</span> {character.profession}
              </p>
              <p className="text-sm text-gray-300 mb-2">
                <span className="font-semibold">背景:</span> {character.background}
              </p>
              <p className="text-sm text-gray-300 mb-2">
                <span className="font-semibold">目标:</span> {character.objective}
              </p>
              {character.secret && (
                <p className="text-sm text-yellow-300">
                  <span className="font-semibold">秘密:</span> {character.secret}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CharacterList;