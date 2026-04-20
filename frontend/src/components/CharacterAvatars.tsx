'use client';
import { ScriptCharacter } from '@/client';
import { useTTSStore } from '@/stores/ttsStore';
import Image from 'next/image';

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
            // 图片加载失败时显示默认emoji
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.parentElement!.innerHTML = getDefaultEmoji(character);
          }}
        />
      );
    }
    
    // 没有头像URL时使用默认emoji
    return getDefaultEmoji(character);
  };
  
  const getDefaultEmoji = (character: ScriptCharacter) => {
    if (character.gender === '女') return '👩';
    if (character.gender === '男') return '👨';
    return '🕵️';
  };

  const getCharacterBorderColor = (character: ScriptCharacter) => {
    return 'border-blue-500';
  };

  const getCharacterBgColor = (character: ScriptCharacter) => {
    return 'bg-blue-500/20';
  };

  if (characters.length === 0) {
    return null;
  }

  const renderCharacter = (character: ScriptCharacter, isSpeaking: boolean) => {
    return (
      <div key={character.id} className={`relative flex flex-col items-center transition-all duration-500`}>
        {/* 角色头像 */}
        <div className={`relative w-16 h-16 rounded-full border-4 ${getCharacterBorderColor(character)} ${getCharacterBgColor(character)} backdrop-blur-sm flex items-center justify-center transition-all duration-500 shadow-lg ${
          isSpeaking ? 'scale-125 shadow-2xl ring-2 ring-purple-400' : 'hover:scale-110 hover:shadow-xl'
        }`}>
          <div className="w-full h-full flex items-center justify-center text-2xl">
            {getCharacterAvatar(character)}
          </div>
          
          {/* 发言指示器 */}
          {isSpeaking && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-green-400 to-blue-500 rounded-full border-2 border-white animate-pulse shadow-lg"></div>
          )}
          
          {/* 说话时的脉冲光晕 */}
          {isSpeaking && (
            <div className="absolute inset-0 rounded-full bg-purple-400/30 animate-ping" />
          )}
        </div>
        
        {/* 角色名称 */}
        <div className={`mt-1 font-medium text-center bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full text-xs whitespace-nowrap ${
          isSpeaking ? 'bg-purple-900/50 text-purple-300 font-bold' : 'text-white'
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