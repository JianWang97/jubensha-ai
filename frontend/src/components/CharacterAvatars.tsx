import React, { useState, useEffect } from 'react';
import { useTTSStore } from '@/stores/ttsStore';

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
  avatar_url?: string;
}

interface GameLogEntry {
  character: string;
  content: string;
  type?: string;
  timestamp?: Date;
}

interface CharacterAvatarsProps {
  characters: Character[];
  gameLog: GameLogEntry[];
}

const CharacterAvatars = ({ characters = [], gameLog = [] }: CharacterAvatarsProps) => {
  // 从TTS store获取当前发言状态
  const { currentSpeakingCharacter, currentSpeechText } = useTTSStore();
  
  const speakingCharacter = currentSpeakingCharacter;
  const speechBubble = currentSpeechText || '';

  const getCharacterAvatar = (character: Character) => {
    // 如果有头像URL，返回图片元素
    if (character.avatar_url) {
      return (
        <img 
          src={character.avatar_url} 
          alt={character.name}
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
  
  const getDefaultEmoji = (character: Character) => {
    if (character.is_victim) return '💀';
    if (character.is_murderer) return '🔪';
    if (character.gender === '女') return '👩';
    if (character.gender === '男') return '👨';
    return '🕵️';
  };

  const getCharacterBorderColor = (character: Character) => {
    if (character.is_victim) return 'border-red-500';
    if (character.is_murderer) return 'border-orange-500';
    return 'border-blue-500';
  };

  const getCharacterBgColor = (character: Character) => {
    if (character.is_victim) return 'bg-red-500/20';
    if (character.is_murderer) return 'bg-orange-500/20';
    return 'bg-blue-500/20';
  };

  if (characters.length === 0) {
    return null;
  }

  // 分离当前发言角色和其他角色
  const speakingChar = characters.find(char => char.name === speakingCharacter);
  const otherCharacters = characters.filter(char => char.name !== speakingCharacter);
  const isSystemSpeaking = speakingCharacter === '系统' || speakingCharacter === 'System';

  const renderCharacter = (character: Character, isSpeaking: boolean, isCenter: boolean = false) => {
    return (
      <div key={character.id} className={`relative flex flex-col items-center transition-all duration-500 ${
        isCenter ? 'transform scale-110' : ''
      }`}>
        {/* 发言气泡 */}
         {isSpeaking && speechBubble && (
           <div className={`absolute ${isCenter ? 'left-40' : 'left-28'} top-1/2 transform -translate-y-1/2 bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-xl border border-gray-200 max-w-lg min-w-[250px] z-20 animate-pulse`}>
             <div className="text-gray-800 text-sm font-medium leading-relaxed">
               {speechBubble.length > 150 ? speechBubble.substring(0, 150) + '...' : speechBubble}
             </div>
             {/* 气泡尾巴 - 指向左侧头像 */}
             <div className="absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-full w-0 h-0 border-t-8 border-b-8 border-r-8 border-transparent border-r-white/95"></div>
             
             {/* 发言动画点 */}
             <div className="absolute -bottom-3 -right-3 flex space-x-1">
               <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
               <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
               <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
             </div>
           </div>
         )}
        
        {/* 角色头像 */}
        <div className={`relative ${isSpeaking && isCenter ? 'w-32 h-32' : isSpeaking ? 'w-24 h-24' : 'w-20 h-20'} rounded-full border-4 ${getCharacterBorderColor(character)} ${getCharacterBgColor(character)} backdrop-blur-sm flex items-center justify-center transition-all duration-500 shadow-lg ${
          isSpeaking ? 'scale-125 shadow-2xl ring-4 ring-yellow-400/70 ring-offset-2 ring-offset-transparent' : 'hover:scale-110 hover:shadow-xl'
        }`}>
          <div className={`w-full h-full flex items-center justify-center ${isCenter ? 'text-4xl' : 'text-3xl'}`}>
            {getCharacterAvatar(character)}
          </div>
          
          {/* 发言指示器 */}
          {isSpeaking && (
            <div className="absolute -top-2 -right-2 w-5 h-5 bg-gradient-to-r from-green-400 to-blue-500 rounded-full border-2 border-white animate-pulse shadow-lg"></div>
          )}
          
          {/* 角色状态光环 */}
          <div className={`absolute inset-0 rounded-full transition-all duration-500 ${
            isSpeaking ? 'bg-gradient-to-r from-yellow-400/20 to-orange-400/20 animate-pulse' : ''
          }`}></div>
        </div>
        
        {/* 角色名称 */}
        <div className={`mt-2 text-white font-medium text-center bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full ${
          isCenter ? 'text-base' : 'text-sm'
        }`}>
          {character.name}
        </div>
      </div>
    );
  };

  // 渲染系统发言（在中央）
  const renderSystemSpeaking = () => {
    if (!isSystemSpeaking || !speechBubble) return null;
    
    return (
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
        <div className="relative flex flex-col items-center">
          {/* 系统发言气泡 */}
          <div className="bg-gradient-to-r from-purple-500/95 to-blue-500/95 backdrop-blur-sm rounded-xl p-6 shadow-2xl border border-purple-300 max-w-2xl min-w-[300px] animate-pulse">
            <div className="text-white text-lg font-medium leading-relaxed text-center">
              {speechBubble}
            </div>
            
            {/* 发言动画点 */}
            <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
              <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
              <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
              <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
            </div>
          </div>
          
          {/* 系统图标 */}
          <div className="mt-4 w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-3xl text-white shadow-xl ring-4 ring-purple-400/50">
            🎭
          </div>
          
          <div className="mt-2 text-white text-lg font-bold text-center bg-gradient-to-r from-purple-500/80 to-blue-500/80 backdrop-blur-sm px-4 py-2 rounded-full">
            系统
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* 系统发言（中央） */}
      {renderSystemSpeaking()}
      
      {/* 顶部角色头像区域 */}
      <div className="fixed top-4 left-4 right-4 z-10 pointer-events-none">
        <div className="flex justify-center items-start gap-6 flex-wrap">
          {otherCharacters.map((character) => 
            renderCharacter(character, false, false)
          )}
        </div>
      </div>
      
      {/* 中央发言角色 */}
      {speakingChar && !isSystemSpeaking && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
          {renderCharacter(speakingChar, true, true)}
        </div>
      )}
    </>
  );
};

export default CharacterAvatars;