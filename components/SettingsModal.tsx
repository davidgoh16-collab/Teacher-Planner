import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2, Upload, FileText, Loader2, CheckCircle2, Sparkles, Link2 } from 'lucide-react';
import { usePlannerData } from '../src/context/PlannerContext';
import { saveAcademicYear, deleteAcademicYear, saveTerm, deleteTerm, saveTimetable } from '../services/plannerDataService';
import { AcademicYear, Term, WeeklyTimetable, TimetableEntry } from '../types';
import { toISODate } from '../utils/dateUtils';
import { getContrastTextColor, getEntryStyle, getEntryClassName } from '../utils/colorUtils';
import { parseMasterTimetableAndTerms } from '../services/aiService';
import { extractTermsFromUrl } from '../services/termImportService';
import { TIMETABLE_ACCEPT, confirmScanConsent } from '../services/timetableImportService';
import { readFileContent } from '../utils/fileUtils';
import ImportHelp from './ui/ImportHelp';
import { PERIOD_LABELS, DAYS } from '../constants';
import { getThemePresets, DEFAULT_THEME_COLOR, OWNER_THEME_COLOR, isValidHex } from '../utils/themeColor';
import { TIMETABLE_PALETTE, mapLegacyColor, clampTimetableColors } from '../utils/timetablePalette';
import { LEGACY_OWNER_UID } from '../services/migrationService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isReadOnly?: boolean;
  themeColor?: string;
  userUid?: string;
  onThemeColorChange?: (hex: string) => void;
  onReplayOnboarding?: () => void;
  initialTab?: 'years' | 'terms' | 'timetables' | 'appearance';
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, isReadOnly, themeColor, userUid, onThemeColorChange, onReplayOnboarding, initialTab }) => {
  const { academicYears, selectedAcademicYearId, terms, timetableWeek1, timetableWeek2, refreshPlannerData, setSelectedAcademicYearId } = usePlannerData();
  const [activeTab, setActiveTab] = useState<'years' | 'terms' | 'timetables' | 'appearance'>('years');

  // Academic Years state
  const [localYears, setLocalYears] = useState<AcademicYear[]>([]);

  // Terms state
  const [localTerms, setLocalTerms] = useState<Term[]>([]);

  // Term-from-URL import state
  const [termUrl, setTermUrl] = useState('');
  const [termUrlImporting, setTermUrlImporting] = useState(false);
  const [termUrlError, setTermUrlError] = useState<string | null>(null);
  const [termUrlSuccess, setTermUrlSuccess] = useState<number>(0);

  // Import State
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<boolean>(false);
  const [importMode, setImportMode] = useState<'file' | 'text'>('file');
  const [importText, setImportText] = useState('');

  // Timetables state
  const [localTimetableW1, setLocalTimetableW1] = useState<WeeklyTimetable>(timetableWeek1);
  const [localTimetableW2, setLocalTimetableW2] = useState<WeeklyTimetable>(timetableWeek2);
  const [selectedWeek, setSelectedWeek] = useState<'week1' | 'week2'>('week1');

  useEffect(() => {
    if (isOpen) {
      setLocalYears(JSON.parse(JSON.stringify(academicYears)));
      setLocalTerms(JSON.parse(JSON.stringify(terms)).map((t: any) => ({
        ...t,
        startDate: new Date(t.startDate),
        endDate: new Date(t.endDate),
        halfTermStart: t.halfTermStart ? new Date(t.halfTermStart) : undefined,
        halfTermEnd: t.halfTermEnd ? new Date(t.halfTermEnd) : undefined,
      })));
      setLocalTimetableW1(JSON.parse(JSON.stringify(timetableWeek1)));
      setLocalTimetableW2(JSON.parse(JSON.stringify(timetableWeek2)));
      setImportSuccess(false);
      setImportError(null);
    }
  }, [isOpen, academicYears, terms, timetableWeek1, timetableWeek2]);

  useEffect(() => {
    if (isOpen && initialTab) setActiveTab(initialTab);
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleSaveYears = async () => {
    if (isReadOnly) return;
    try {
      // Find deleted
      const localIds = localYears.map(y => y.id);
      for (const y of academicYears) {
        if (!localIds.includes(y.id)) {
          await deleteAcademicYear(y.id);
        }
      }
      // Save all
      for (const y of localYears) {
        await saveAcademicYear(y);
      }
      await refreshPlannerData();
    } catch (e) {
      console.error("Failed to save academic years:", e);
    }
  };

  const handleSaveTerms = async () => {
    if (isReadOnly || !selectedAcademicYearId) return;
    try {
      const localIds = localTerms.map(t => t.id);
      for (const t of terms) {
        if (!localIds.includes(t.id)) {
          await deleteTerm(selectedAcademicYearId, t.id);
        }
      }

      for (const t of localTerms) {
        await saveTerm({ ...t, academicYearId: selectedAcademicYearId });
      }

      await refreshPlannerData();
    } catch (e) {
      console.error("Failed to save terms:", e);
    }
  };

  const handleSaveTimetables = async () => {
    if (isReadOnly || !selectedAcademicYearId) return;
    try {
      // Clamp every colour to the curated palette (also self-heals legacy hex cells).
      await saveTimetable(selectedAcademicYearId, 'week1', clampTimetableColors(localTimetableW1));
      await saveTimetable(selectedAcademicYearId, 'week2', clampTimetableColors(localTimetableW2));
      await refreshPlannerData();
    } catch (e) {
      console.error("Failed to save timetables:", e);
    }
  };

  const addYear = () => {
    const id = `academic_year_${Date.now()}`;
    const newYear: AcademicYear = {
      id,
      name: 'New Year',
      isDefault: localYears.length === 0
    };
    setLocalYears([newYear, ...localYears]);
  };

  const updateYear = (id: string, field: keyof AcademicYear, value: any) => {
    setLocalYears(prev => prev.map(y => {
       if (y.id === id) {
           if (field === 'isDefault' && value === true) {
               // Ensure only one default
               prev.forEach(otherY => { if(otherY.id !== id) otherY.isDefault = false; });
           }
           return { ...y, [field]: value };
       }
       return y;
    }));
  };

  const addTerm = () => {
    if (!selectedAcademicYearId) return;
    setLocalTerms([...localTerms, {
      id: `term_${Date.now()}`,
      academicYearId: selectedAcademicYearId,
      name: 'New Term',
      startDate: new Date(),
      endDate: new Date(),
    }]);
  };

  const handleImportTermsFromUrl = async () => {
    if (!termUrl.trim() || !selectedAcademicYearId) return;
    setTermUrlImporting(true);
    setTermUrlError(null);
    setTermUrlSuccess(0);
    try {
      const extracted = await extractTermsFromUrl(termUrl.trim());
      const imported: Term[] = extracted.map((t, i) => ({
        id: `term_${Date.now()}_${i}`,
        academicYearId: selectedAcademicYearId,
        name: t.name,
        startDate: new Date(t.startDate),
        endDate: new Date(t.endDate),
        halfTermStart: t.halfTermStart ? new Date(t.halfTermStart) : undefined,
        halfTermEnd: t.halfTermEnd ? new Date(t.halfTermEnd) : undefined,
      }));
      setLocalTerms(imported); // replace with the imported set for review before saving
      setTermUrlSuccess(imported.length);
    } catch (e: any) {
      setTermUrlError(e?.message || 'Failed to import term dates.');
    } finally {
      setTermUrlImporting(false);
    }
  };

  const updateTerm = (id: string, field: keyof Term, value: any) => {
    setLocalTerms(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const updateTimetableEntry = (day: string, period: string, field: keyof TimetableEntry | 'clear', value: any) => {
    const isW1 = selectedWeek === 'week1';
    const setter = isW1 ? setLocalTimetableW1 : setLocalTimetableW2;
    const currentTable = isW1 ? localTimetableW1 : localTimetableW2;

    setter(prev => {
      const newTable = { ...prev };
      if (!newTable[day]) newTable[day] = {};

      if (field === 'clear') {
        newTable[day][period] = null;
      } else {
        const currentEntry = newTable[day][period] || { subject: '', colorClass: '' };
        newTable[day][period] = { ...currentEntry, [field]: value };
      }
      return newTable;
    });
  };

  const activeTimetable = selectedWeek === 'week1' ? localTimetableW1 : localTimetableW2;

  const handleAIImport = async (base64Content?: string, mimeType?: string, textContent?: string) => {
     if (!selectedAcademicYearId) return;
     // Consent gate: a scanned/image document is sent to Gemini as a raw image.
     if (base64Content && !confirmScanConsent(1)) {
        setImportError('Cancelled — the file was not sent.');
        return;
     }
     setIsImporting(true);
     setImportError(null);
     setImportSuccess(false);

     try {
        const result = await parseMasterTimetableAndTerms(
            base64Content || undefined,
            mimeType || undefined,
            textContent || undefined
        );

        if (result.terms && result.terms.length > 0) {
            // Assign academicYearId to incoming terms and assign new IDs to prevent collisions
            const processedTerms: Term[] = result.terms.map(t => ({
                id: `term_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                academicYearId: selectedAcademicYearId,
                name: t.name || 'New Term',
                startDate: t.startDate ? new Date(t.startDate) : new Date(),
                endDate: t.endDate ? new Date(t.endDate) : new Date(),
                halfTermStart: t.halfTermStart ? new Date(t.halfTermStart) : undefined,
                halfTermEnd: t.halfTermEnd ? new Date(t.halfTermEnd) : undefined
            }));
            setLocalTerms(processedTerms);
        }

        if (result.timetables) {
            if (result.timetables.week1) setLocalTimetableW1(result.timetables.week1);
            if (result.timetables.week2) setLocalTimetableW2(result.timetables.week2);
        }

        setImportSuccess(true);
     } catch (e) {
        console.error("AI Import Failed:", e);
        setImportError("Failed to parse timetable/terms. Please try again with a clearer file or structured text.");
     } finally {
        setIsImporting(false);
     }
  };

  const compressImage = (base64Str: string, mimeType: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!mimeType.startsWith('image/')) {
        resolve(base64Str);
        return;
      }

      const img = new Image();
      img.src = `data:${mimeType};base64,${base64Str}`;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = (height * MAX_WIDTH) / width;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64Str);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(compressedDataUrl.split(',')[1]);
      };
      img.onerror = (err) => reject(err);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      // Images/PDFs go to the vision model; Word/Excel/CSV/text are extracted to plain
      // text client-side and take the paste-text route.
      const content = await readFileContent(file);
      if (content.isBase64) {
        let base64Content = content.text;
        let mimeType = content.mimeType;
        if (mimeType.startsWith('image/')) {
          try {
             base64Content = await compressImage(base64Content, mimeType);
             mimeType = 'image/jpeg';
          } catch (err) {
            console.warn("Image compression failed, using original", err);
          }
        }
        await handleAIImport(base64Content, mimeType, undefined);
      } else {
        await handleAIImport(undefined, undefined, content.text);
      }
    } catch (err: any) {
      console.error(err);
      setImportError(err?.message?.includes('Unsupported file type') || err?.message?.includes("aren't supported")
        ? err.message
        : "Error reading file.");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-black/[0.06] dark:border-white/[0.08] w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">

        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="flex border-b border-slate-200 dark:border-slate-800 shrink-0">
          <button
            onClick={() => setActiveTab('years')}
            className={`px-6 py-3 text-sm font-medium border-b-2 ${activeTab === 'years' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            Academic Years
          </button>
          <button
            onClick={() => setActiveTab('terms')}
            className={`px-6 py-3 text-sm font-medium border-b-2 ${activeTab === 'terms' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'} ${!selectedAcademicYearId ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!selectedAcademicYearId}
          >
            Terms {selectedAcademicYearId ? '' : '(Select Year First)'}
          </button>
          <button
            onClick={() => setActiveTab('timetables')}
            className={`px-6 py-3 text-sm font-medium border-b-2 ${activeTab === 'timetables' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'} ${!selectedAcademicYearId ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!selectedAcademicYearId}
          >
            Timetables {selectedAcademicYearId ? '' : '(Select Year First)'}
          </button>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`px-6 py-3 text-sm font-medium border-b-2 ${activeTab === 'appearance' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            Appearance
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Appearance</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Pick an accent colour — it applies across the whole app.</p>
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
                {getThemePresets(userUid).map(preset => {
                  const selected = (themeColor || DEFAULT_THEME_COLOR).toLowerCase() === preset.hex.toLowerCase();
                  return (
                    <button
                      key={preset.hex}
                      title={preset.name}
                      onClick={() => onThemeColorChange?.(preset.hex)}
                      className={`h-10 w-10 rounded-full border-2 transition-transform hover:scale-110 ${selected ? 'border-slate-900 dark:border-white ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ring-slate-400' : 'border-transparent'}`}
                      style={{ backgroundColor: preset.hex }}
                      aria-label={preset.name}
                    />
                  );
                })}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Custom colour</label>
                <input
                  type="color"
                  value={isValidHex(themeColor || '') ? (themeColor as string) : DEFAULT_THEME_COLOR}
                  onChange={(e) => onThemeColorChange?.(e.target.value)}
                  className="h-9 w-14 rounded cursor-pointer bg-transparent border border-slate-300 dark:border-slate-700"
                />
                <button
                  onClick={() => onThemeColorChange?.(userUid === LEGACY_OWNER_UID ? OWNER_THEME_COLOR : DEFAULT_THEME_COLOR)}
                  className="text-sm text-slate-500 dark:text-slate-400 hover:underline"
                >
                  Reset to default
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Preview</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1.5 rounded-lg bg-primary-600 text-white text-sm">Primary button</span>
                  <span className="px-3 py-1.5 rounded-lg bg-primary-100 text-primary-800 text-sm">Soft accent</span>
                  <span className="text-primary-600 dark:text-primary-400 text-sm font-medium">Accent text</span>
                </div>
              </div>

              {onReplayOnboarding && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    onClick={onReplayOnboarding}
                    className="flex items-center gap-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    <Sparkles size={16} /> Replay the setup guide
                  </button>
                </div>
              )}
            </div>
          )}
          {activeTab === 'years' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Manage Academic Years</h3>
                {!isReadOnly && (
                  <button onClick={addYear} className="flex items-center gap-2 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors">
                    <Plus size={16} /> Add Year
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {localYears.map((year) => (
                  <div key={year.id} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <div className="flex-1">
                       <input
                         type="text"
                         value={year.name}
                         onChange={(e) => updateYear(year.id, 'name', e.target.value)}
                         className="font-bold text-lg bg-transparent border-b border-dashed border-slate-300 dark:border-slate-600 focus:border-primary-500 outline-none w-full max-w-xs text-slate-800 dark:text-white"
                         placeholder="e.g. 2026/2027"
                         disabled={isReadOnly}
                       />
                       <div className="mt-2 flex items-center gap-2">
                           <input
                             type="radio"
                             name="defaultYear"
                             checked={year.isDefault}
                             onChange={() => updateYear(year.id, 'isDefault', true)}
                             disabled={isReadOnly}
                             id={`default_${year.id}`}
                           />
                           <label htmlFor={`default_${year.id}`} className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer">Set as active/default year</label>
                       </div>
                    </div>
                    {!isReadOnly && (
                      <button onClick={() => setLocalYears(prev => prev.filter(y => y.id !== year.id))} className="text-red-500 hover:text-red-700 p-2">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                ))}
                {localYears.length === 0 && <p className="text-slate-500">No academic years found.</p>}
              </div>

              {!isReadOnly && (
                <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                  <button onClick={handleSaveYears} className="flex items-center gap-2 bg-primary-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors">
                    <Save size={18} /> Save Years
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'terms' && selectedAcademicYearId && (
            <div className="space-y-6">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                   <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Manage Terms</h3>
                   <p className="text-sm text-slate-500">For Academic Year: {academicYears.find(y => y.id === selectedAcademicYearId)?.name}</p>
                </div>

                {!isReadOnly && (
                  <button onClick={addTerm} className="flex items-center gap-2 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors">
                    <Plus size={16} /> Add Term
                  </button>
                )}
              </div>

              {!isReadOnly && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2 bg-slate-50 dark:bg-slate-800/50">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    <Link2 size={16} className="text-primary-600 dark:text-primary-400" /> Import term dates from your school's website
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    <input
                      type="url"
                      value={termUrl}
                      onChange={(e) => setTermUrl(e.target.value)}
                      placeholder="https://yourschool.sch.uk/term-dates"
                      className="flex-1 min-w-[220px] bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.1] rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white"
                    />
                    <button
                      onClick={handleImportTermsFromUrl}
                      disabled={termUrlImporting || !termUrl.trim()}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {termUrlImporting ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
                      {termUrlImporting ? 'Reading…' : 'Import'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">The assistant reads the page and fills in the terms below for you to review, then click “Save Terms”.</p>
                  <ImportHelp
                    formats="a link to a public webpage listing your term dates (your school or council site)"
                    tips={['The page must be viewable without logging in — if it is behind a login, use the Auto-Import upload or type the dates below instead.']}
                  />
                  {termUrlError && <p className="text-xs text-red-600 dark:text-red-400">{termUrlError}</p>}
                  {termUrlSuccess > 0 && <p className="text-xs text-primary-600 dark:text-primary-400">Found {termUrlSuccess} term{termUrlSuccess === 1 ? '' : 's'} — review below and save.</p>}
                </div>
              )}

              <div className="space-y-4">
                {localTerms.map((term, idx) => (
                  <div key={term.id} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-1 md:col-span-2 flex justify-between items-center mb-2">
                       <input
                         type="text"
                         value={term.name}
                         onChange={(e) => updateTerm(term.id, 'name', e.target.value)}
                         className="font-bold text-lg bg-transparent border-b border-dashed border-slate-300 dark:border-slate-600 focus:border-primary-500 outline-none w-full max-w-xs text-slate-800 dark:text-white"
                         disabled={isReadOnly}
                       />
                       {!isReadOnly && (
                         <button onClick={() => setLocalTerms(prev => prev.filter(t => t.id !== term.id))} className="text-red-500 hover:text-red-700 p-2">
                            <Trash2 size={18} />
                         </button>
                       )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={toISODate(term.startDate)}
                        onChange={(e) => updateTerm(term.id, 'startDate', new Date(e.target.value))}
                        className="w-full bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.1] rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white"
                        disabled={isReadOnly}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">End Date</label>
                      <input
                        type="date"
                        value={toISODate(term.endDate)}
                        onChange={(e) => updateTerm(term.id, 'endDate', new Date(e.target.value))}
                        className="w-full bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.1] rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white"
                        disabled={isReadOnly}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Half Term Start (Optional)</label>
                      <input
                        type="date"
                        value={term.halfTermStart ? toISODate(term.halfTermStart) : ''}
                        onChange={(e) => updateTerm(term.id, 'halfTermStart', e.target.value ? new Date(e.target.value) : undefined)}
                        className="w-full bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.1] rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white"
                        disabled={isReadOnly}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Half Term End (Optional)</label>
                      <input
                        type="date"
                        value={term.halfTermEnd ? toISODate(term.halfTermEnd) : ''}
                        onChange={(e) => updateTerm(term.id, 'halfTermEnd', e.target.value ? new Date(e.target.value) : undefined)}
                        className="w-full bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.1] rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white"
                        disabled={isReadOnly}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {!isReadOnly && (
                <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                  <button onClick={handleSaveTerms} className="flex items-center gap-2 bg-primary-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors">
                    <Save size={18} /> Save Terms
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'timetables' && selectedAcademicYearId && (
             <div className="space-y-6">
                 {!isReadOnly && (
                 <div className="bg-primary-50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-800 p-4 rounded-xl">
                    <h4 className="font-semibold text-primary-800 dark:text-primary-300 mb-2 flex items-center gap-2">
                       <Upload size={18} /> Auto-Import Timetable & Terms via AI
                    </h4>
                    <p className="text-sm text-primary-700 dark:text-primary-400 mb-4">
                       Upload your school schedule, or paste it as text. The AI extracts the term dates and both weeks of your timetable — review below, then Save.
                    </p>
                    <div className="mb-4">
                      <ImportHelp
                        formats="photo or screenshot (PNG, JPG), PDF, Word (.docx), Excel (.xlsx), CSV or plain text"
                        tips={[
                          'A straight-on screenshot of the full grid works best — include the day and period headers.',
                          'PDF exports from SIMS, Bromcom or Arbor work well.',
                          'Pasting text? Copy the cells straight from Excel/your MIS, keeping the day and period labels.',
                        ]}
                      />
                    </div>

                    <div className="flex items-center gap-4 mb-4">
                       <button onClick={() => setImportMode('file')} className={`text-sm px-3 py-1 rounded-md font-medium ${importMode === 'file' ? 'bg-primary-600 text-white' : 'bg-white text-primary-600 border border-primary-200'}`}>File Upload</button>
                       <button onClick={() => setImportMode('text')} className={`text-sm px-3 py-1 rounded-md font-medium ${importMode === 'text' ? 'bg-primary-600 text-white' : 'bg-white text-primary-600 border border-primary-200'}`}>Paste Text</button>
                    </div>

                    {importMode === 'file' ? (
                       <label className={`cursor-pointer flex justify-center items-center h-24 border-2 border-dashed rounded-lg bg-white dark:bg-slate-800 transition-colors ${isImporting ? 'opacity-50 border-slate-300 cursor-not-allowed' : 'border-primary-300 hover:bg-primary-100/50'}`}>
                           <input type="file" className="hidden" accept={TIMETABLE_ACCEPT} onChange={handleFileUpload} disabled={isImporting} />
                           <span className="text-primary-600 dark:text-primary-400 font-medium flex items-center gap-2">
                               {isImporting ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                               {isImporting ? 'Analyzing document...' : 'Click to select a file'}
                           </span>
                       </label>
                    ) : (
                       <div className="flex flex-col gap-2">
                           <textarea
                              value={importText}
                              onChange={e => setImportText(e.target.value)}
                              placeholder="Paste your schedule as text — copy the cells straight from Excel or your MIS, keeping the day and period labels…"
                              className="w-full h-24 p-2 text-sm rounded-lg border border-primary-200 dark:bg-slate-800 dark:border-primary-800"
                              disabled={isImporting}
                           />
                           <button
                              onClick={() => handleAIImport(undefined, undefined, importText)}
                              disabled={isImporting || !importText.trim()}
                              className="self-end flex items-center gap-2 bg-primary-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                           >
                              {isImporting ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                              Analyze Text
                           </button>
                       </div>
                    )}

                    {importError && <p className="text-red-500 text-sm mt-2">{importError}</p>}
                    {importSuccess && <p className="text-primary-600 dark:text-primary-400 text-sm mt-2 flex items-center gap-1"><CheckCircle2 size={14}/> Successfully parsed and applied. Review below and save.</p>}
                 </div>
                 )}

                 <div className="flex justify-between items-center flex-wrap gap-4">
                    <div>
                       <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Master Timetables</h3>
                       <p className="text-sm text-slate-500">For Academic Year: {academicYears.find(y => y.id === selectedAcademicYearId)?.name}</p>
                    </div>
                    <select
                      value={selectedWeek}
                      onChange={(e) => setSelectedWeek(e.target.value as 'week1' | 'week2')}
                      className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-800 dark:text-white font-medium"
                    >
                      <option value="week1">Week 1</option>
                      <option value="week2">Week 2</option>
                    </select>
                 </div>

                 <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                   <table className="w-full text-left border-collapse min-w-[800px]">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                           <th className="p-3 font-semibold text-slate-600 dark:text-slate-300 text-sm w-32">Period</th>
                           {DAYS.map(day => (
                             <th key={day} className="p-3 font-semibold text-slate-600 dark:text-slate-300 text-sm">{day}</th>
                           ))}
                        </tr>
                      </thead>
                      <tbody>
                         {PERIOD_LABELS.map(period => (
                           <tr key={period} className="border-b border-slate-200 dark:border-slate-700 last:border-0 bg-white dark:bg-slate-900">
                              <td className="p-3 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-700">
                                {period}
                              </td>
                              {DAYS.map(day => {
                                 const entry = activeTimetable[day]?.[period];
                                 return (
                                   <td key={`${day}-${period}`} className="p-2 border-r border-slate-200 dark:border-slate-700 last:border-0">
                                      <div
                                        className={`flex flex-col gap-2 p-2 rounded-lg transition-colors ${getEntryClassName(entry)}`}
                                        style={getEntryStyle(entry)}
                                      >
                                         <input
                                           type="text"
                                           placeholder="Free / Admin"
                                           value={entry?.subject || ''}
                                           onChange={(e) => updateTimetableEntry(day, period, 'subject', e.target.value)}
                                           className="w-full text-sm font-bold bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal"
                                           disabled={isReadOnly}
                                         />
                                         <div className="flex flex-wrap gap-1">
                                           {TIMETABLE_PALETTE.map(c => {
                                             const selected = entry?.colorClass ? mapLegacyColor(entry.colorClass).startsWith(c.chipClass) : false;
                                             return (
                                               <button
                                                 key={c.id}
                                                 type="button"
                                                 title={c.name}
                                                 disabled={isReadOnly}
                                                 onClick={() => updateTimetableEntry(day, period, 'colorClass', c.chipClass)}
                                                 className={`h-4 w-4 rounded-full border border-black/10 transition-transform hover:scale-110 disabled:cursor-default ${selected ? 'ring-2 ring-slate-500 ring-offset-1 dark:ring-offset-slate-800' : ''}`}
                                                 style={{ backgroundColor: c.hex }}
                                               />
                                             );
                                           })}
                                         </div>
                                         {!isReadOnly && entry && (
                                            <button
                                              onClick={() => updateTimetableEntry(day, period, 'clear', null)}
                                              className="text-[10px] text-red-600 dark:text-red-400 hover:underline text-right w-full"
                                            >
                                              Clear
                                            </button>
                                         )}
                                      </div>
                                   </td>
                                 );
                              })}
                           </tr>
                         ))}
                      </tbody>
                   </table>
                 </div>

                 {!isReadOnly && (
                    <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                      <button onClick={handleSaveTimetables} className="flex items-center gap-2 bg-primary-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors">
                        <Save size={18} /> Save Timetables
                      </button>
                    </div>
                 )}
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;