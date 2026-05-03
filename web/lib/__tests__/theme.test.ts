import { getTheme } from '@/lib/theme';

describe('getTheme', () => {
  it('returns teal theme for SFW mode', () => {
    const theme = getTheme(true);
    expect(theme.accent).toBe('teal');
    expect(theme.activeTab).toBe('bg-teal-600');
    expect(theme.btn).toContain('teal');
  });

  it('returns rose theme for NSFW mode', () => {
    const theme = getTheme(false);
    expect(theme.accent).toBe('rose');
    expect(theme.activeTab).toBe('bg-rose-600');
    expect(theme.btn).toContain('rose');
  });

  it('returns all expected keys', () => {
    const theme = getTheme(true);
    const keys = ['accent', 'gradient', 'gradientBold', 'gradientHover', 'btn', 'btnText', 'btnBorder', 'btnBg', 'spinnerBorder', 'activeTab', 'link', 'pulse'];
    for (const key of keys) {
      expect(theme).toHaveProperty(key);
    }
  });
});
