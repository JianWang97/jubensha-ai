import React from 'react';
import { Skull, Swords, UserRound } from 'lucide-react';

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
  compact?: boolean; // 紧凑模式，用于游戏进行时
}

const CharacterList = ({ characters = [], compact = false }: CharacterListProps) => {
  const getCharacterIcon = (character: Character) => {
    if (character.is_victim) return <Skull className="h-5 w-5 text-thread" />;
    if (character.is_murderer) return <Swords className="h-5 w-5 text-brass" />;
    return <UserRound className="h-5 w-5 text-mist" />;
  };

  const getCharacterBorderColor = (character: Character) => {
    if (character.is_victim) return 'border-thread/40';
    if (character.is_murderer) return 'border-brass/40';
    return 'border-line';
  };

  if (compact) {
    // 紧凑模式：只显示基本信息
    return (
      <div className="bg-panel border border-line rounded-sm p-4">
        <h3 className="font-dossier text-lg font-bold text-paper mb-3">角色信息</h3>
        {characters.length === 0 ? (
          <div className="text-center text-mist py-4">
            <p className="text-sm">暂无角色信息</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {characters.map((character) => (
              <li 
                key={character.id} 
                className={`bg-raised rounded-sm p-3 border-l-4 ${getCharacterBorderColor(character)} transition-colors hover:bg-panel`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm text-paper flex items-center gap-2">
                    {getCharacterIcon(character)}
                    {character.name}
                  </p>
                  <div className="text-xs text-mist">
                    {character.profession}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // 完整模式：显示详细信息
  return (
    <div className="bg-panel border border-line rounded-sm p-6">
      <h3 className="font-dossier text-2xl font-bold text-paper mb-5">角色列表 ({characters.length})</h3>
      {characters.length === 0 ? (
        <div className="text-center text-mist py-8">
          <p>暂无角色信息</p>
          <p className="text-sm mt-2">请选择剧本后开始游戏</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {characters.map((character) => (
            <li 
              key={character.id} 
              className={`bg-raised rounded-sm p-4 border-l-4 ${getCharacterBorderColor(character)} transition-colors hover:bg-panel`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-lg text-paper flex items-center gap-2">
                  {getCharacterIcon(character)}
                  {character.name}
                </p>
                <div className="text-sm text-mist">
                  {character.gender} · {character.age}岁
                </div>
              </div>
              <p className="text-sm text-mist mb-2">
                <span className="font-semibold">职业:</span> {character.profession}
              </p>
              <p className="text-sm text-mist mb-2">
                <span className="font-semibold">背景:</span> {character.background}
              </p>
              <p className="text-sm text-mist mb-2">
                <span className="font-semibold">目标:</span> {character.objective}
              </p>
              {character.secret && (
                <p className="text-sm text-brass">
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