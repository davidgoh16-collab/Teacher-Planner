import React, { useState } from 'react';
import {
  Sparkles, Palette, ArrowRight, ArrowLeft, Check, CalendarRange, CalendarDays,
  UploadCloud, GraduationCap, Users, Link2, Rocket, Loader2, Plus,
} from 'lucide-react';
import { getThemePresets, DEFAULT_THEME_COLOR, isValidHex } from '../utils/themeColor';
import { usePlannerData } from '../src/context/PlannerContext';
import { saveAcademicYear, saveTerm, saveTimetable } from '../services/plannerDataService';
import { extractTermsFromUrl } from '../services/termImportService';
import { parseTimetableImage, parseTimetableText } from '../services/aiService';
import { importTimetableFile, TIMETABLE_ACCEPT, confirmScanConsent, isLikelyScan } from '../services/timetableImportService';
import { saveColleague } from '../services/colleagueService';
import { readFileContent } from '../utils/fileUtils';
import ImportHelp from './ui/ImportHelp';

interface OnboardingModalProps {
  isOpen: boolean;
  userName?: string;
  themeColor: string;
  userUid?: string;
  onThemeColorChange: (hex: string) => void;
  onFinish: () => void;
}

const currentAcademicYearName = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const start = now.getMonth() >= 7 ? y : y - 1; // academic year rolls over around September
  return `${start}/${start + 1}`;
};

const StepDot: React.FC<{ active: boolean; done: boolean }> = ({ active, done }) => (
  <span className={`h-1.5 rounded-full transition-all ${active ? 'w-6 bg-primary-600' : done ? 'w-1.5 bg-primary-400' : 'w-1.5 bg-slate-300 dark:bg-slate-600'}`} />
);

const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, userName, themeColor, userUid, onThemeColorChange, onFinish }) => {
  const { academicYears, selectedAcademicYearId, setSelectedAcademicYearId, refreshPlannerData } = usePlannerData();

  const [step, setStep] = useState(0);

  // Academic year
  const [yearName, setYearName] = useState(currentAcademicYearName());
  const [yearId, setYearId] = useState<string | null>(selectedAcademicYearId);
  const [creatingYear, setCreatingYear] = useState(false);

  // Terms
  const [termUrl, setTermUrl] = useState('');
  const [importingTerms, setImportingTerms] = useState(false);
  const [termsMsg, setTermsMsg] = useState<string | null>(null);
  const [termsErr, setTermsErr] = useState<string | null>(null);

  // Own timetable
  const [ttBusy, setTtBusy] = useState(false);
  const [ttMsg, setTtMsg] = useState<string | null>(null);
  const [ttErr, setTtErr] = useState<string | null>(null);

  // Staff / students
  const [peopleBusy, setPeopleBusy] = useState<'staff' | 'student' | null>(null);
  const [staffMsg, setStaffMsg] = useState<string | null>(null);
  const [studentMsg, setStudentMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const firstName = (userName || '').split(' ')[0];
  const activeYearId = yearId || selectedAcademicYearId;
  const activeYearName = academicYears.find(y => y.id === activeYearId)?.name || yearName;

  const handleCreateYear = async () => {
    if (!yearName.trim()) return;
    setCreatingYear(true);
    try {
      const id = `academic_year_${yearName.replace(/[^a-zA-Z0-9]/g, '_')}`;
      await saveAcademicYear({ id, name: yearName.trim(), isDefault: true });
      setYearId(id);
      await refreshPlannerData();
      setSelectedAcademicYearId(id);
    } catch (e) {
      console.error('Failed to create academic year', e);
    } finally {
      setCreatingYear(false);
    }
  };

  const handleImportTerms = async () => {
    if (!termUrl.trim() || !activeYearId) return;
    setImportingTerms(true); setTermsErr(null); setTermsMsg(null);
    try {
      const extracted = await extractTermsFromUrl(termUrl.trim());
      let i = 0;
      for (const t of extracted) {
        await saveTerm({
          id: `term_${Date.now()}_${i++}`,
          academicYearId: activeYearId,
          name: t.name,
          startDate: new Date(t.startDate),
          endDate: new Date(t.endDate),
          halfTermStart: t.halfTermStart ? new Date(t.halfTermStart) : undefined,
          halfTermEnd: t.halfTermEnd ? new Date(t.halfTermEnd) : undefined,
        });
      }
      await refreshPlannerData();
      setTermsMsg(`Added ${extracted.length} term${extracted.length === 1 ? '' : 's'}. You can fine-tune them in Settings.`);
    } catch (e: any) {
      setTermsErr(e?.message || 'Could not import terms. You can add them later in Settings.');
    } finally {
      setImportingTerms(false);
    }
  };

  const handleOwnTimetable = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeYearId) return;
    setTtBusy(true); setTtErr(null); setTtMsg(null);
    try {
      // PDFs/images go to the vision model as-is; Word/Excel/CSV/text are extracted to
      // plain text client-side and parsed through the text route.
      const content = await readFileContent(file);
      // Consent gate: a scan/photo with no text layer is sent to Gemini as a raw image.
      if (content.isBase64 && !confirmScanConsent(1)) {
        setTtErr('Cancelled — the file was not sent.');
        setTtBusy(false);
        return;
      }
      const result = content.isBase64
        ? await parseTimetableImage(content.text, content.mimeType)
        : await parseTimetableText(content.text);
      await saveTimetable(activeYearId, 'week1', result.week1 || {});
      await saveTimetable(activeYearId, 'week2', result.week2 || {});
      await refreshPlannerData();
      setTtMsg('Your timetable was imported. You can adjust any lesson in Settings → Timetables.');
    } catch (err: any) {
      console.error(err);
      setTtErr(err?.message?.includes('Unsupported file type')
        ? err.message
        : 'Could not read that timetable. Try a clearer image/PDF, or set it up later in Settings.');
    } finally {
      setTtBusy(false);
    }
  };

  const handlePeople = async (e: React.ChangeEvent<HTMLInputElement>, type: 'staff' | 'student') => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    // Consent gate for scanned/photo files sent to Gemini as raw images.
    const scanCount = files.filter(isLikelyScan).length;
    if (scanCount > 0 && !confirmScanConsent(scanCount)) return;
    setPeopleBusy(type);
    if (type === 'staff') setStaffMsg(null); else setStudentMsg(null);
    let saved = 0;
    for (const f of files) {
      const res = await importTimetableFile(f, type);
      if (!res.error) {
        try {
          await saveColleague({
            name: res.name, type: res.type, week1: res.week1, week2: res.week2,
            timetableImage: res.base64 || undefined,
            timetableMimeType: res.base64 ? res.mimeType : undefined,
          });
          saved++;
        } catch (err) { console.error(err); }
      }
    }
    const msg = `Added ${saved} ${type === 'staff' ? 'staff' : 'student'} timetable${saved === 1 ? '' : 's'}. Rename anyone in the Meeting Planner if needed.`;
    if (type === 'staff') setStaffMsg(msg); else setStudentMsg(msg);
    setPeopleBusy(null);
  };

  const themePicker = (
    <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
      {getThemePresets(userUid).map(preset => {
        const selected = (themeColor || DEFAULT_THEME_COLOR).toLowerCase() === preset.hex.toLowerCase();
        return (
          <button key={preset.hex} title={preset.name} onClick={() => onThemeColorChange(preset.hex)}
            className={`h-10 w-10 rounded-full border-2 transition-transform hover:scale-110 ${selected ? 'border-slate-900 dark:border-white ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ring-slate-400' : 'border-transparent'}`}
            style={{ backgroundColor: preset.hex }} aria-label={preset.name} />
        );
      })}
    </div>
  );

  const noYet = <p className="text-xs text-amber-600 dark:text-amber-400">Set your academic year first (previous step) so this can be saved to it.</p>;

  const steps: { icon: React.ReactNode; title: string; body: React.ReactNode }[] = [
    {
      icon: <Sparkles size={24} />,
      title: firstName ? `Welcome, ${firstName}!` : 'Welcome to Teacher Planner',
      body: (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">Let's set up your planner together — academic year, term dates, your timetable, then your colleagues' and students' timetables. It only takes a couple of minutes, and you can change anything later.</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">You can skip any step and come back to it from Settings.</p>
        </div>
      ),
    },
    {
      icon: <Palette size={24} />,
      title: 'Pick your colour',
      body: (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">Choose an accent colour — it themes the whole app.</p>
          {themePicker}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Custom</label>
            <input type="color" value={isValidHex(themeColor || '') ? themeColor : DEFAULT_THEME_COLOR} onChange={(e) => onThemeColorChange(e.target.value)} className="h-9 w-14 rounded cursor-pointer bg-transparent border border-slate-300 dark:border-slate-700" />
            <span className="px-3 py-1.5 rounded-lg bg-primary-600 text-white text-sm">Preview</span>
          </div>
        </div>
      ),
    },
    {
      icon: <CalendarDays size={24} />,
      title: 'Your academic year',
      body: (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">Name the academic year you're planning. Everything else (terms, timetable) is saved under it.</p>
          {activeYearId ? (
            <div className="flex items-center gap-2 text-sm text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 rounded-lg p-3">
              <Check size={16} /> Using academic year <strong>{activeYearName}</strong>.
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <input value={yearName} onChange={(e) => setYearName(e.target.value)} placeholder="2025/2026"
                className="flex-1 min-w-[160px] bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.1] rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white" />
              <button onClick={handleCreateYear} disabled={creatingYear || !yearName.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                {creatingYear ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Create
              </button>
            </div>
          )}
        </div>
      ),
    },
    {
      icon: <CalendarRange size={24} />,
      title: 'Term dates',
      body: (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">Paste a link to your school's term-dates page and we'll read it for you — or skip and add them later in Settings.</p>
          {!activeYearId ? noYet : (
            <>
              <div className="flex gap-2 flex-wrap">
                <input type="url" value={termUrl} onChange={(e) => setTermUrl(e.target.value)} placeholder="https://yourschool.sch.uk/term-dates"
                  className="flex-1 min-w-[200px] bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.1] rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white" />
                <button onClick={handleImportTerms} disabled={importingTerms || !termUrl.trim()}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
                  {importingTerms ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />} Import
                </button>
              </div>
              {termsMsg && <p className="text-xs text-primary-600 dark:text-primary-400">{termsMsg}</p>}
              {termsErr && <p className="text-xs text-red-600 dark:text-red-400">{termsErr}</p>}
              <ImportHelp
                formats="a link to a public webpage listing your term dates (your school or council site)"
                tips={[
                  'The page must be viewable without logging in — if it is behind a login, add the dates in Settings → Terms instead.',
                ]}
              />
            </>
          )}
        </div>
      ),
    },
    {
      icon: <UploadCloud size={24} />,
      title: 'Upload your timetable',
      body: (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">Upload your own timetable — the AI reads it into your weekly grid.</p>
          {!activeYearId ? noYet : (
            <>
              <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors ${ttBusy ? 'opacity-60 pointer-events-none' : 'border-slate-300 dark:border-slate-600 hover:border-primary-400'}`}>
                {ttBusy ? <Loader2 className="w-7 h-7 text-primary-600 animate-spin" /> : <UploadCloud className="w-7 h-7 text-primary-600 dark:text-primary-400" />}
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{ttBusy ? 'Reading your timetable…' : 'Choose your timetable file'}</span>
                <input type="file" accept={TIMETABLE_ACCEPT} className="hidden" onChange={handleOwnTimetable} disabled={ttBusy} />
              </label>
              {ttMsg && <p className="text-xs text-primary-600 dark:text-primary-400">{ttMsg}</p>}
              {ttErr && <p className="text-xs text-red-600 dark:text-red-400">{ttErr}</p>}
              <ImportHelp
                formats="photo or screenshot (PNG, JPG), PDF, Word (.docx), Excel (.xlsx), CSV or plain text"
                tips={[
                  'A straight-on screenshot of the full grid works best — include the day and period headers.',
                  'PDF exports from SIMS, Bromcom or Arbor work well.',
                  'If the file shows only one week, it fills Week 1 and you can copy it to Week 2 in Settings.',
                ]}
              />
            </>
          )}
        </div>
      ),
    },
    {
      icon: <Users size={24} />,
      title: 'Staff timetables',
      body: (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">Upload your colleagues' timetables — select several at once and the AI identifies each person by name.</p>
          <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors ${peopleBusy === 'staff' ? 'opacity-60 pointer-events-none' : 'border-slate-300 dark:border-slate-600 hover:border-primary-400'}`}>
            {peopleBusy === 'staff' ? <Loader2 className="w-7 h-7 text-primary-600 animate-spin" /> : <Users className="w-7 h-7 text-primary-600 dark:text-primary-400" />}
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{peopleBusy === 'staff' ? 'Adding staff…' : 'Choose staff timetable files'}</span>
            <span className="text-xs text-slate-400">Select several at once</span>
            <input type="file" accept={TIMETABLE_ACCEPT} multiple className="hidden" onChange={(e) => handlePeople(e, 'staff')} disabled={peopleBusy !== null} />
          </label>
          {staffMsg && <p className="text-xs text-primary-600 dark:text-primary-400">{staffMsg}</p>}
          <ImportHelp
            formats="PNG/JPG, PDF, Word, Excel/CSV or text — one person per file, several files at once"
            tips={["Names are read from the document; if it doesn't show one, the file name is used — so name files like 'J Smith.pdf'."]}
          />
        </div>
      ),
    },
    {
      icon: <GraduationCap size={24} />,
      title: 'Student timetables',
      body: (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">Add student timetables the same way — later you can match your timetable against a student's to find when to meet or observe them.</p>
          <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors ${peopleBusy === 'student' ? 'opacity-60 pointer-events-none' : 'border-slate-300 dark:border-slate-600 hover:border-primary-400'}`}>
            {peopleBusy === 'student' ? <Loader2 className="w-7 h-7 text-primary-600 animate-spin" /> : <GraduationCap className="w-7 h-7 text-primary-600 dark:text-primary-400" />}
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{peopleBusy === 'student' ? 'Adding students…' : 'Choose student timetable files'}</span>
            <span className="text-xs text-slate-400">Select several at once</span>
            <input type="file" accept={TIMETABLE_ACCEPT} multiple className="hidden" onChange={(e) => handlePeople(e, 'student')} disabled={peopleBusy !== null} />
          </label>
          {studentMsg && <p className="text-xs text-primary-600 dark:text-primary-400">{studentMsg}</p>}
          <ImportHelp
            formats="PNG/JPG, PDF, Word, Excel/CSV or text — one student per file, several files at once"
            tips={["Names are read from the document; if it doesn't show one, the file name is used — so name files like 'A Jones.pdf'."]}
          />
        </div>
      ),
    },
    {
      icon: <Rocket size={24} />,
      title: "You're all set!",
      body: (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">Your planner is ready. You can revisit any of this from Settings, and share your timetable or projects from the <strong>Shared</strong> area anytime.</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Tip: the Meeting Planner finds common free time with the colleagues and students you just added.</p>
        </div>
      ),
    },
  ];

  const total = steps.length;
  const isLast = step === total - 1;
  const current = steps[step];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-black/[0.06] dark:border-white/[0.08] overflow-hidden animate-in">
        <div className="px-6 py-5 flex items-center gap-3 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 shrink-0">{current.icon}</div>
          <div>
            <h2 className="font-serif text-lg text-slate-900 dark:text-white leading-tight">{current.title}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Step {step + 1} of {total}</p>
          </div>
        </div>

        <div className="p-6 min-h-[230px]">{current.body}</div>

        <div className="px-6 py-3 flex items-center justify-center gap-1.5">
          {steps.map((_, i) => <StepDot key={i} active={i === step} done={i < step} />)}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <button onClick={onFinish} className="text-sm text-slate-500 dark:text-slate-400 hover:underline">Skip setup</button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button onClick={() => setStep(s => Math.max(0, s - 1))} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
                <ArrowLeft size={16} /> Back
              </button>
            )}
            {!isLast ? (
              <button onClick={() => setStep(s => Math.min(total - 1, s + 1))} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white">
                Next <ArrowRight size={16} />
              </button>
            ) : (
              <button onClick={onFinish} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white">
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
