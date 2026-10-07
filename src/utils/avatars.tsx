import React from 'react';
import {
  User,
  Sparkles,
  Shield,
  Heart,
  Zap,
  Compass,
  Star,
  Feather,
  Flame,
  Sun,
  Moon,
  Smile,
  Crown,
  Anchor,
  Coffee,
  Gem
} from 'lucide-react';

export interface AvatarIconInfo {
  id: string;
  name: string;
  icon: React.FC<any>;
  bgColor: string;
  color: string;
  borderColor: string;
}

export const AVATAR_ICONS: AvatarIconInfo[] = [
  { id: 'sparkles', name: 'Sparkles', icon: Sparkles, bgColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', borderColor: '#f59e0b' },
  { id: 'user', name: 'Profile', icon: User, bgColor: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', borderColor: '#3b82f6' },
  { id: 'zap', name: 'Energy', icon: Zap, bgColor: 'rgba(234, 88, 12, 0.12)', color: '#ea580c', borderColor: '#ea580c' },
  { id: 'heart', name: 'Heart', icon: Heart, bgColor: 'rgba(244, 63, 94, 0.12)', color: '#f43f5e', borderColor: '#f43f5e' },
  { id: 'shield', name: 'Shield', icon: Shield, bgColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981', borderColor: '#10b981' },
  { id: 'star', name: 'Star', icon: Star, bgColor: 'rgba(168, 85, 247, 0.12)', color: '#a855f7', borderColor: '#a855f7' },
  { id: 'flame', name: 'Focus', icon: Flame, bgColor: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', borderColor: '#ef4444' },
  { id: 'compass', name: 'Explorer', icon: Compass, bgColor: 'rgba(6, 182, 212, 0.12)', color: '#06b6d4', borderColor: '#06b6d4' },
  { id: 'sun', name: 'Daylight', icon: Sun, bgColor: 'rgba(245, 158, 11, 0.12)', color: '#d97706', borderColor: '#d97706' },
  { id: 'moon', name: 'Night', icon: Moon, bgColor: 'rgba(99, 102, 241, 0.12)', color: '#6366f1', borderColor: '#6366f1' },
  { id: 'feather', name: 'Writer', icon: Feather, bgColor: 'rgba(20, 184, 166, 0.12)', color: '#0d9488', borderColor: '#0d9488' },
  { id: 'crown', name: 'Leader', icon: Crown, bgColor: 'rgba(234, 179, 8, 0.12)', color: '#ca8a04', borderColor: '#ca8a04' },
  { id: 'gem', name: 'Creator', icon: Gem, bgColor: 'rgba(236, 72, 153, 0.12)', color: '#ec4899', borderColor: '#ec4899' },
  { id: 'coffee', name: 'Calm', icon: Coffee, bgColor: 'rgba(180, 83, 9, 0.12)', color: '#b45309', borderColor: '#b45309' },
  { id: 'anchor', name: 'Steadfast', icon: Anchor, bgColor: 'rgba(71, 85, 105, 0.12)', color: '#475569', borderColor: '#475569' },
  { id: 'smile', name: 'Joy', icon: Smile, bgColor: 'rgba(34, 197, 94, 0.12)', color: '#16a34a', borderColor: '#16a34a' }
];

// Backwards-compatibility alias
export const ANIMAL_AVATARS = AVATAR_ICONS;

export function getAnimalAvatar(avatarId?: string): AvatarIconInfo {
  const found = AVATAR_ICONS.find((a) => a.id === avatarId);
  return found || AVATAR_ICONS[0];
}

export const AnimalAvatar: React.FC<{
  avatarId?: string;
  size?: number;
  style?: React.CSSProperties;
  className?: string;
}> = ({ avatarId, size = 40, style, className }) => {
  const avatar = getAnimalAvatar(avatarId);
  const IconComponent = avatar.icon;
  const iconSize = Math.max(14, Math.round(size * 0.52));

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
        color: avatar.color,
        userSelect: 'none',
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        ...style
      }}
      title={avatar.name}
    >
      <IconComponent size={iconSize} strokeWidth={2} style={{ flexShrink: 0 }} />
    </div>
  );
};
