export const AVATAR_OPTIONS = Array.from({ length: 20 }, (_, i) => ({
  id: `avatar-${i + 1}`,
  src: `/avatars/${i + 1}.webp`,
}));
