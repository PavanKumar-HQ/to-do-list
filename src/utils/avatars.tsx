import React from 'react';

export interface AnimalAvatarInfo {
  id: string;
  name: string;
  emoji: string;
  bgColor: string;
  borderColor: string;
}

export const ANIMAL_AVATARS: AnimalAvatarInfo[] = [
  { id: 'fox', name: 'Fox', emoji: '🦊', bgColor: 'rgba(249, 115, 22, 0.15)', borderColor: '#f97316' },
  { id: 'panda', name: 'Panda', emoji: '🐼', bgColor: 'rgba(100, 116, 139, 0.15)', borderColor: '#64748b' },
  { id: 'penguin', name: 'Penguin', emoji: '🐧', bgColor: 'rgba(56, 189, 248, 0.15)', borderColor: '#38bdf8' },
  { id: 'owl', name: 'Owl', emoji: '🦉', bgColor: 'rgba(168, 85, 247, 0.15)', borderColor: '#a855f7' },
  { id: 'tiger', name: 'Tiger', emoji: '🐯', bgColor: 'rgba(234, 88, 12, 0.15)', borderColor: '#ea580c' },
  { id: 'koala', name: 'Koala', emoji: '🐨', bgColor: 'rgba(148, 163, 184, 0.15)', borderColor: '#94a3b8' },
  { id: 'octopus', name: 'Octopus', emoji: '🐙', bgColor: 'rgba(236, 72, 153, 0.15)', borderColor: '#ec4899' },
  { id: 'otter', name: 'Otter', emoji: '🦦', bgColor: 'rgba(202, 138, 4, 0.15)', borderColor: '#ca8a04' },
  { id: 'frog', name: 'Frog', emoji: '🐸', bgColor: 'rgba(34, 197, 94, 0.15)', borderColor: '#22c55e' },
  { id: 'eagle', name: 'Eagle', emoji: '🦅', bgColor: 'rgba(217, 119, 6, 0.15)', borderColor: '#d97706' },
  { id: 'wolf', name: 'Wolf', emoji: '🐺', bgColor: 'rgba(99, 102, 241, 0.15)', borderColor: '#6366f1' },
  { id: 'bear', name: 'Bear', emoji: '🐻', bgColor: 'rgba(180, 83, 9, 0.15)', borderColor: '#b45309' },
  { id: 'lion', name: 'Lion', emoji: '🦁', bgColor: 'rgba(245, 158, 11, 0.15)', borderColor: '#f59e0b' },
  { id: 'cat', name: 'Cat', emoji: '🐱', bgColor: 'rgba(244, 63, 94, 0.15)', borderColor: '#f43f5e' },
  { id: 'dog', name: 'Dog', emoji: '🐶', bgColor: 'rgba(14, 165, 233, 0.15)', borderColor: '#0ea5e9' },
  { id: 'hedgehog', name: 'Hedgehog', emoji: '🦔', bgColor: 'rgba(168, 85, 247, 0.15)', borderColor: '#a855f7' }
];

export function getAnimalAvatar(avatarId?: string): AnimalAvatarInfo {
  const found = ANIMAL_AVATARS.find((a) => a.id === avatarId);
  return found || ANIMAL_AVATARS[0]; // defaults to Fox
}

export const AnimalAvatar: React.FC<{
  avatarId?: string;
  size?: number;
  style?: React.CSSProperties;
  className?: string;
}> = ({ avatarId, size = 40, style, className }) => {
  const avatar = getAnimalAvatar(avatarId);
  const fontSize = Math.round(size * 0.58);

  return (
    <div
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: avatar.bgColor,
        border: `1.5px solid ${avatar.borderColor}40`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${fontSize}px`,
        lineHeight: 1,
        userSelect: 'none',
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        ...style
      }}
      title={avatar.name}
    >
      <span>{avatar.emoji}</span>
    </div>
  );
};
