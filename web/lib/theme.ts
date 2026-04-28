export function getTheme(sfwMode: boolean) {
  if (sfwMode) {
    return {
      accent: 'teal',
      gradient: 'from-teal-400 to-blue-400',
      gradientBold: 'from-teal-600 to-blue-600',
      gradientHover: 'hover:from-teal-700 hover:to-blue-700',
      btn: 'bg-teal-600 hover:bg-teal-700',
      btnText: 'text-teal-400',
      btnBorder: 'border-teal-500/30',
      btnBg: 'bg-teal-600/20',
      spinnerBorder: 'border-t-teal-500',
      activeTab: 'bg-teal-600',
      link: 'text-teal-400 hover:text-teal-300',
      pulse: 'bg-emerald-400',
    };
  }
  return {
    accent: 'rose',
    gradient: 'from-rose-400 to-violet-400',
    gradientBold: 'from-rose-600 to-violet-600',
    gradientHover: 'hover:from-rose-700 hover:to-violet-700',
    btn: 'bg-rose-600 hover:bg-rose-700',
    btnText: 'text-rose-400',
    btnBorder: 'border-rose-500/30',
    btnBg: 'bg-rose-600/20',
    spinnerBorder: 'border-t-rose-500',
    activeTab: 'bg-rose-600',
    link: 'text-rose-400 hover:text-rose-300',
    pulse: 'bg-rose-400',
  };
}
