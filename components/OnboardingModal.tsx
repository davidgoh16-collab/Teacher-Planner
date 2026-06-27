import React, { useState } from 'react';
import {
  Sparkles, Palette, Users, ArrowRight, ArrowLeft, Check, CalendarRange,
  LayoutGrid, Clock, CalendarDays, UploadCloud, GraduationCap, Link2, Rocket,
} from 'lucide-react';
import { THEME_PRESETS, DEFAULT_THEME_COLOR, isValidHex } from '../utils/themeColor';

interface OnboardingModalProps {
  isOpen: boolean;
  userName?: string;
  themeColor: string;
  onThemeColorChange: (hex: string) => void;
  /** Marks onboarding complete. Optionally jump straight to a setup area afterwards. */
  onFinish: (action?: 'timetable' | 'meetings' | 'terms') => void;
}

const Feature: React.FC<{ icon: React.ReactNode; title: string; desc: string }> = ({ icon, title, desc }) => (
  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
    <div className="text-primary-600 dark:text-primary-400 mt-0.5">{icon}</div>
    <div>
      <p className="text-sm font-semibold text-slate-800 dark:text-white">{title}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
    </div>
  </div>
);

const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, userName, themeColor, onThemeColorChange, onFinish }) => {
  const [step, setStep] = useState(0);
  if (!isOpen) return null;

  const firstName = (userName || '').split(' ')[0];

  const steps: { icon: React.ReactNode; title: string; body: React.ReactNode }[] = [
    {
      icon: <Sparkles size={26} />,
      title: firstName ? `Welcome, ${firstName}!` : 'Welcome to Teacher Planner',
      body: (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            This is your own private planner. Let's take a minute to set it up — you can change anything later in Settings.
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            <Feature icon={<CalendarDays size={18} />} title="Timetable" desc="Your 2-week schedule with lesson plans." />
            <Feature icon={<Users size={18} />} title="Meeting planner" desc="Find free time with colleagues & students." />
            <Feature icon={<LayoutGrid size={18} />} title="Projects & tasks" desc="Organise your work and to-dos." />
            <Feature icon={<Clock size={18} />} title="Key dates" desc="Track terms, deadlines and events." />
          </div>
        </div>
      ),
    },
    {
      icon: <Palette size={26} />,
      title: 'Pick your colour',
      body: (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">Choose an accent colour for your planner. It themes the whole app.</p>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
            {THEME_PRESETS.map(preset => {
              const selected = (themeColor || DEFAULT_THEME_COLOR).toLowerCase() === preset.hex.toLowerCase();
              return (
                <button
                  key={preset.hex}
                  title={preset.name}
                  onClick={() => onThemeColorChange(preset.hex)}
                  className={`h-10 w-10 rounded-full border-2 transition-transform hover:scale-110 ${selected ? 'border-slate-900 dark:border-white ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ring-slate-400' : 'border-transparent'}`}
                  style={{ backgroundColor: preset.hex }}
                  aria-label={preset.name}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Custom</label>
            <input
              type="color"
              value={isValidHex(themeColor || '') ? themeColor : DEFAULT_THEME_COLOR}
              onChange={(e) => onThemeColorChange(e.target.value)}
              className="h-9 w-14 rounded cursor-pointer bg-transparent border border-slate-300 dark:border-slate-700"
            />
            <span className="px-3 py-1.5 rounded-lg bg-primary-600 text-white text-sm">Preview</span>
          </div>
        </div>
      ),
    },
    {
      icon: <UploadCloud size={26} />,
      title: 'Add your timetable',
      body: (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Upload a photo, PDF or screenshot of your timetable and the AI will read it into your weekly grid — or paste the text. You'll do this in <span className="font-medium">Settings → Timetables</span>.
          </p>
          <Feature icon={<CalendarDays size={18} />} title="Two-week timetables" desc="Supports Week 1 / Week 2 rotations automatically." />
          <p className="text-xs text-slate-500 dark:text-slate-400">You can finish setup now and do this whenever you're ready.</p>
        </div>
      ),
    },
    {
      icon: <GraduationCap size={26} />,
      title: 'Staff & student timetables',
      body: (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            In the <span className="font-medium">Meeting planner</span> you can upload <span className="font-medium">several timetables at once</span>. The AI identifies each person by name (from the file or filename) and adds them under the <span className="font-medium">Staff</span> or <span className="font-medium">Students</span> tab.
          </p>
          <Feature icon={<Users size={18} />} title="Find common free time" desc="See when you and colleagues are all free." />
          <Feature icon={<GraduationCap size={18} />} title="Match a student" desc="Spot when you can meet or observe a student." />
        </div>
      ),
    },
    {
      icon: <CalendarRange size={26} />,
      title: 'Term dates',
      body: (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Paste a link to your school's term-dates page and the agent will fetch and add them for you — or enter them by hand. This lives in <span className="font-medium">Settings → Terms</span>.
          </p>
          <Feature icon={<Link2 size={18} />} title="Import from a URL" desc="e.g. your school's 'term dates' web page." />
        </div>
      ),
    },
    {
      icon: <Rocket size={26} />,
      title: "You're all set!",
      body: (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">Jump straight into a setup task, or explore on your own.</p>
          <div className="grid gap-2">
            <button onClick={() => onFinish('timetable')} className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors text-left">
              <span className="flex items-center gap-3 text-sm font-medium text-slate-800 dark:text-white"><UploadCloud size={18} className="text-primary-600 dark:text-primary-400" /> Set up my timetable</span>
              <ArrowRight size={16} className="text-slate-400" />
            </button>
            <button onClick={() => onFinish('meetings')} className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors text-left">
              <span className="flex items-center gap-3 text-sm font-medium text-slate-800 dark:text-white"><Users size={18} className="text-primary-600 dark:text-primary-400" /> Add staff & student timetables</span>
              <ArrowRight size={16} className="text-slate-400" />
            </button>
            <button onClick={() => onFinish('terms')} className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors text-left">
              <span className="flex items-center gap-3 text-sm font-medium text-slate-800 dark:text-white"><CalendarRange size={18} className="text-primary-600 dark:text-primary-400" /> Import term dates</span>
              <ArrowRight size={16} className="text-slate-400" />
            </button>
          </div>
        </div>
      ),
    },
  ];

  const total = steps.length;
  const isLast = step === total - 1;
  const current = steps[step];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-800 overflow-hidden animate-in">
        <div className="bg-slate-900 dark:bg-slate-950 px-6 py-5 flex items-center gap-3 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-400 via-primary-500 to-primary-700" />
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary-600 text-white shrink-0">{current.icon}</div>
          <div>
            <h2 className="text-lg font-bold text-white leading-tight">{current.title}</h2>
            <p className="text-xs text-slate-400">Step {step + 1} of {total}</p>
          </div>
        </div>

        <div className="p-6 min-h-[220px]">{current.body}</div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={() => onFinish()}
            className="text-sm text-slate-500 dark:text-slate-400 hover:underline"
          >
            Skip setup
          </button>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(s => Math.max(0, s - 1))}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <ArrowLeft size={16} /> Back
              </button>
            )}
            {!isLast ? (
              <button
                onClick={() => setStep(s => Math.min(total - 1, s + 1))}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white"
              >
                Next <ArrowRight size={16} />
              </button>
            ) : (
              <button
                onClick={() => onFinish()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white"
              >
                <Check size={16} /> Finish
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
