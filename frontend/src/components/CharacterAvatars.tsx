'use client';
import { ScriptCharacter } from '@/client';
import { useTTSStore } from '@/stores/ttsStore';
import Image from 'next/image';
import { UserRound } from 'lucide-react';

interface CharacterAvatarsProps {
  characters: ScriptCharacter[];
}

const CharacterAvatars = ({ characters = [] }: CharacterAvatarsProps) => {
  // 从TTS store获取当前发言状态
  const { currentSpeakingCharacter } = useTTSStore();
  
  const speakingCharacter = currentSpeakingCharacter;

  const getCharacterAvatar = (character: ScriptCharacter) => {
    // 如果有头像URL，返回图片元素
    if (character.avatar_url) {
      return (
        <Image 
          src={character.avatar_url || ''} 
          alt={character.name || ''}
          width={64}
          height={64}
          className="w-full h-full object-cover rounded-full"
          onError={(e) => {
            // 图片加载失败时显示名字首字
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.parentElement!.innerHTML = character.name?.[0] || '?';
          }}
        />
      );
    }
    
    // 没有头像URL时显示默认占位图标
    return (
      <span className="flex h-full w-full items-center justify-center">
        <UserRound className="h-8 w-8 text-brass" />
      </span>
    );
  };

  const getCharacterBorderColor = () => {
    return 'border-brass/40';
  };

  const getCharacterBgColor = () => {
    return 'bg-brass/15';
  };

  if (characters.length === 0) {
    return null;
  }

  const renderCharacter = (character: ScriptCharacter, isSpeaking: boolean) => {
    return (
      <div key={character.id} className={`relative flex flex-col items-center transition-all duration-500`}>
        {/* 角色头像 */}
        <div className={`relative w-16 h-16 rounded-full border-4 ${getCharacterBorderColor()} ${getCharacterBgColor()} flex items-center justify-center transition-all duration-500 ${
          isSpeaking ? 'scale-125 ring-2 ring-amber-400' : 'hover:scale-110'
        }`}>
          <div className="w-full h-full flex items-center justify-center">
            {getCharacterAvatar(character)}
          </div>
          
          {/* 发言指示器 */}
          {isSpeaking && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-ink animate-pulse"></div>
          )}
          
          {/* 说话时的脉冲光晕 */}
          {isSpeaking && (
            <div className="absolute inset-0 rounded-full bg-amber-400/20 animate-ping" />
          )}
        </div>
        
        {/* 角色名称 */}
        <div className={`mt-1 font-medium text-center bg-ink/70 border px-2 py-1 rounded-sm text-xs whitespace-nowrap ${
          isSpeaking ? 'border-brass/40 bg-brass/15 text-brass font-bold' : 'border-hairline text-mist'
        }`}>
          {character.name}
        </div>
      </div>
    );
  };

  return (
    <div className="flex items-center space-x-4">
      {characters.map((character) => 
        renderCharacter(character, character.name === speakingCharacter)
      )}
    </div>
  );
};

export default CharacterAvatars;