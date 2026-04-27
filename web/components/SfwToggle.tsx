'use client';

interface SfwToggleProps {
  sfwMode: boolean;
  onToggle: () => void;
}

export default function SfwToggle({ sfwMode, onToggle }: SfwToggleProps) {
  return (
    <button onClick={onToggle} className="flex items-center gap-1.5 select-none">
      <span className={`text-[11px] font-bold transition-colors ${sfwMode ? 'text-emerald-400' : 'text-gray-600'}`}>
        SFW
      </span>
      <div className={`relative w-10 h-5 rounded-full transition-colors ${sfwMode ? 'bg-emerald-600' : 'bg-red-600'}`}>
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            sfwMode ? '' : 'translate-x-5'
          }`}
        />
      </div>
      <span className={`text-[11px] font-bold transition-colors ${sfwMode ? 'text-gray-600' : 'text-red-400'}`}>
        NSFW
      </span>
    </button>
  );
}
