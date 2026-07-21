import React from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label?: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}

function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel }: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800"
    >
      {options.map((opt) => {
        const activeSeg = opt.value === value;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={activeSeg}
            onClick={() => onChange(opt.value)}
            title={opt.label}
            className={`flex min-h-[36px] items-center justify-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-all ${
              activeSeg
                ? 'bg-white text-primary-700 shadow-sm dark:bg-slate-600 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            {opt.icon}
            {opt.label && <span>{opt.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
