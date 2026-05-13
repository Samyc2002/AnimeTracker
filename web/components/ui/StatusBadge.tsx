const toneColors = {
  emerald: 'bg-emerald-900/60 text-emerald-300',
  blue: 'bg-blue-900/60 text-blue-300',
  amber: 'bg-amber-900/60 text-amber-300',
  red: 'bg-red-900/60 text-red-300',
  purple: 'bg-purple-900/60 text-purple-300',
  indigo: 'bg-indigo-900/60 text-indigo-300',
  gray: 'bg-gray-700/60 text-gray-300',
} as const;

export type StatusBadgeTone = keyof typeof toneColors;

export function StatusBadge({ tone, children }: { tone: StatusBadgeTone; children: React.ReactNode }) {
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${toneColors[tone]}`}>
      {children}
    </span>
  );
}
