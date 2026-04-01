import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { usePlannerData } from '../src/context/PlannerContext';
import { saveTerm, deleteTerm, saveTimetable } from '../services/plannerDataService';
import { Term, WeeklyTimetable, TimetableEntry } from '../types';
import { toISODate } from '../utils/dateUtils';
import { PERIOD_LABELS, DAYS, COLORS } from '../constants';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isReadOnly?: boolean;
}

const colorOptions = [
  { label: 'None', class: '' },
  ...Object.entries(COLORS).map(([key, val]) => ({ label: key, class: val }))
];

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, isReadOnly }) => {
  const { terms, timetableWeek1, timetableWeek2, refreshPlannerData } = usePlannerData();
  const [activeTab, setActiveTab] = useState<'terms' | 'timetables'>('terms');

  // Terms state
  const [localTerms, setLocalTerms] = useState<Term[]>([]);

  // Timetables state
  const [localTimetableW1, setLocalTimetableW1] = useState<WeeklyTimetable>(timetableWeek1);
  const [localTimetableW2, setLocalTimetableW2] = useState<WeeklyTimetable>(timetableWeek2);
  const [selectedWeek, setSelectedWeek] = useState<'week1' | 'week2'>('week1');

  useEffect(() => {
    if (isOpen) {
      setLocalTerms(JSON.parse(JSON.stringify(terms)).map((t: any) => ({
        ...t,
        startDate: new Date(t.startDate),
        endDate: new Date(t.endDate),
        halfTermStart: t.halfTermStart ? new Date(t.halfTermStart) : undefined,
        halfTermEnd: t.halfTermEnd ? new Date(t.halfTermEnd) : undefined,
      })));
      setLocalTimetableW1(JSON.parse(JSON.stringify(timetableWeek1)));
      setLocalTimetableW2(JSON.parse(JSON.stringify(timetableWeek2)));
    }
  }, [isOpen, terms, timetableWeek1, timetableWeek2]);

  if (!isOpen) return null;

  const handleSaveTerms = async () => {
    if (isReadOnly) return;
    try {
      // First, delete any terms that were removed locally
      const localIds = localTerms.map(t => t.id);
      for (const t of terms) {
        if (!localIds.includes(t.id)) {
          await deleteTerm(t.id);
        }
      }

      // Then save all local terms
      for (const t of localTerms) {
        await saveTerm(t);
      }

      await refreshPlannerData();
    } catch (e) {
      console.error("Failed to save terms:", e);
    }
  };

  const handleSaveTimetables = async () => {
    if (isReadOnly) return;
    try {
      await saveTimetable('week1', localTimetableW1);
      await saveTimetable('week2', localTimetableW2);
      await refreshPlannerData();
    } catch (e) {
      console.error("Failed to save timetables:", e);
    }
  };

  const addTerm = () => {
    setLocalTerms([...localTerms, {
      id: `term_${Date.now()}`,
      name: 'New Term',
      startDate: new Date(),
      endDate: new Date(),
    }]);
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">

        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-800 shrink-0">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="flex border-b border-gray-200 dark:border-slate-800 shrink-0">
          <button
            onClick={() => setActiveTab('terms')}
            className={`px-6 py-3 text-sm font-medium border-b-2 ${activeTab === 'terms' ? 'border-green-500 text-green-600 dark:text-green-400' : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            Academic Terms
          </button>
          <button
            onClick={() => setActiveTab('timetables')}
            className={`px-6 py-3 text-sm font-medium border-b-2 ${activeTab === 'timetables' ? 'border-green-500 text-green-600 dark:text-green-400' : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            My Timetables
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {activeTab === 'terms' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Manage Terms</h3>
                {!isReadOnly && (
                  <button onClick={addTerm} className="flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors">
                    <Plus size={16} /> Add Term
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {localTerms.map((term, idx) => (
                  <div key={term.id} className="bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-1 md:col-span-2 flex justify-between items-center mb-2">
                       <input
                         type="text"
                         value={term.name}
                         onChange={(e) => updateTerm(term.id, 'name', e.target.value)}
                         className="font-bold text-lg bg-transparent border-b border-dashed border-gray-300 dark:border-slate-600 focus:border-green-500 outline-none w-full max-w-xs text-slate-800 dark:text-white"
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
                        className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white"
                        disabled={isReadOnly}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">End Date</label>
                      <input
                        type="date"
                        value={toISODate(term.endDate)}
                        onChange={(e) => updateTerm(term.id, 'endDate', new Date(e.target.value))}
                        className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white"
                        disabled={isReadOnly}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Half Term Start (Optional)</label>
                      <input
                        type="date"
                        value={term.halfTermStart ? toISODate(term.halfTermStart) : ''}
                        onChange={(e) => updateTerm(term.id, 'halfTermStart', e.target.value ? new Date(e.target.value) : undefined)}
                        className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white"
                        disabled={isReadOnly}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Half Term End (Optional)</label>
                      <input
                        type="date"
                        value={term.halfTermEnd ? toISODate(term.halfTermEnd) : ''}
                        onChange={(e) => updateTerm(term.id, 'halfTermEnd', e.target.value ? new Date(e.target.value) : undefined)}
                        className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white"
                        disabled={isReadOnly}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {!isReadOnly && (
                <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-slate-800">
                  <button onClick={handleSaveTerms} className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors">
                    <Save size={18} /> Save Terms
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'timetables' && (
             <div className="space-y-6">
                 <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Master Timetables</h3>
                    <select
                      value={selectedWeek}
                      onChange={(e) => setSelectedWeek(e.target.value as 'week1' | 'week2')}
                      className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-800 dark:text-white font-medium"
                    >
                      <option value="week1">Week 1</option>
                      <option value="week2">Week 2</option>
                    </select>
                 </div>

                 <div className="overflow-x-auto border border-gray-200 dark:border-slate-700 rounded-xl">
                   <table className="w-full text-left border-collapse min-w-[800px]">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
                           <th className="p-3 font-semibold text-slate-600 dark:text-slate-300 text-sm w-32">Period</th>
                           {DAYS.map(day => (
                             <th key={day} className="p-3 font-semibold text-slate-600 dark:text-slate-300 text-sm">{day}</th>
                           ))}
                        </tr>
                      </thead>
                      <tbody>
                         {PERIOD_LABELS.map(period => (
                           <tr key={period} className="border-b border-gray-200 dark:border-slate-700 last:border-0 bg-white dark:bg-slate-900">
                              <td className="p-3 text-sm font-medium text-slate-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-800/50 border-r border-gray-200 dark:border-slate-700">
                                {period}
                              </td>
                              {DAYS.map(day => {
                                 const entry = activeTimetable[day]?.[period];
                                 return (
                                   <td key={`${day}-${period}`} className="p-2 border-r border-gray-200 dark:border-slate-700 last:border-0">
                                      <div className={`flex flex-col gap-2 p-2 rounded-lg border border-dashed transition-colors ${entry?.colorClass ? entry.colorClass : 'bg-gray-50 dark:bg-slate-800/50 border-gray-300 dark:border-slate-600'}`}>
                                         <input
                                           type="text"
                                           placeholder="Free / Admin"
                                           value={entry?.subject || ''}
                                           onChange={(e) => updateTimetableEntry(day, period, 'subject', e.target.value)}
                                           className="w-full text-sm font-bold bg-transparent outline-none placeholder:text-gray-400 dark:placeholder:text-slate-500 placeholder:font-normal"
                                           disabled={isReadOnly}
                                         />
                                         <select
                                           value={entry?.colorClass || ''}
                                           onChange={(e) => updateTimetableEntry(day, period, 'colorClass', e.target.value)}
                                           className="w-full text-xs bg-white/50 dark:bg-black/20 border border-black/10 dark:border-white/10 rounded px-1 py-1 outline-none"
                                           disabled={isReadOnly}
                                         >
                                            {colorOptions.map(opt => (
                                              <option key={opt.label} value={opt.class}>{opt.label}</option>
                                            ))}
                                         </select>
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
                    <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-slate-800">
                      <button onClick={handleSaveTimetables} className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors">
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