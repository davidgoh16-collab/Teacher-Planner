import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Save, Trash2, Link as LinkIcon, ExternalLink, BookOpen, Users, 
  Plus, MinusCircle, Copy, ArrowRight, CheckSquare, Square, 
  Filter, ChevronDown, Lock, Repeat, CalendarRange, RotateCw
} from 'lucide-react';
import { LessonPlan, WeekData } from '../types';
import { PERIOD_LABELS, TIMETABLE_WEEK_1, TIMETABLE_WEEK_2, DAYS, TERMS } from '../constants';
import { toISODate, addDays, formatDate, generateWeeksForTerm } from '../utils/dateUtils';

interface LessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (lesson: LessonPlan) => void;
  onBatchSave?: (lessons: LessonPlan[]) => void;
  onDelete: (lessonId: string) => void;
  initialData: LessonPlan;
  subjectName: string;
  weeksInTerm?: WeekData[];
  currentWeekIndex?: number;
  isReadOnly?: boolean;
  allLessonPlans?: Record<string, LessonPlan>;
}

const LessonModal: React.FC<LessonModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  onBatchSave,
  onDelete, 
  initialData,
  subjectName,
  weeksInTerm = [],
  currentWeekIndex = 0,
  isReadOnly = false,
  allLessonPlans = {}
}) => {
  const [title, setTitle] = useState(initialData.title);
  const [links, setLinks] = useState<string[]>(initialData.links || []);
  const [currentLinkInput, setCurrentLinkInput] = useState('');
  const [notes, setNotes] = useState(initialData.notes);
  const [type, setType] = useState<'lesson' | 'meeting'>(initialData.type || 'lesson');

  // Duplication State
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]); // Array of "YYYY-MM-DD_PeriodLabel"
  const [classFilter, setClassFilter] = useState<string>('All');
  const [monthFilter, setMonthFilter] = useState<string>('All');

  // Recurring State
  const [isRecurringMode, setIsRecurringMode] = useState(false);
  const [recurrenceScope, setRecurrenceScope] = useState<'term' | 'year'>('term');
  const [recurrencePattern, setRecurrencePattern] = useState<'cycle' | 'every'>('cycle');

  // Generate available slots for duplication (All weeks in term)
  const availableSlots = useMemo(() => {
    if (!isOpen || !isDuplicating || weeksInTerm.length === 0) return [];
    
    const slots = [];
    
    for (let i = 0; i < weeksInTerm.length; i++) {
        const week = weeksInTerm[i];
        const timetable = week.weekNumber === 1 ? TIMETABLE_WEEK_1 : TIMETABLE_WEEK_2;
        
        // Iterate days
        for (let d = 0; d < DAYS.length; d++) {
            const dayName = DAYS[d];
            const date = addDays(week.startDate, d);
            const dateStr = toISODate(date);
            const daySchedule = timetable[dayName];
            
            // Iterate periods
            for (const period of PERIOD_LABELS) {
                const entry = daySchedule[period];
                const subject = entry ? entry.subject : 'Free Period';
                const id = `${dateStr}_${period}`;
                
                // Exclude the current lesson slot itself
                if (id !== initialData.id) {
                     slots.push({
                        id,
                        date,
                        dateStr,
                        dayName,
                        period,
                        subject,
                        weekNum: week.weekNumber
                    });
                }
            }
        }
    }
    // Sort slots by date string to ensure a logical chronological list
    return slots.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [isOpen, isDuplicating, weeksInTerm, initialData.id]);

  // Derive unique subjects for the filter dropdown
  const uniqueSubjects = useMemo(() => {
    const subjects = new Set(availableSlots.map(s => s.subject));
    return Array.from(subjects).sort();
  }, [availableSlots]);

  // Derive unique months for the filter dropdown
  const uniqueMonths = useMemo(() => {
    const months: string[] = [];
    availableSlots.forEach(s => {
        const m = s.date.toLocaleString('default', { month: 'long' });
        if (!months.includes(m)) {
            months.push(m);
        }
    });
    return months;
  }, [availableSlots]);

  // Apply the filter
  const filteredSlots = useMemo(() => {
    return availableSlots.filter(s => {
        const matchesClass = classFilter === 'All' || s.subject === classFilter;
        const matchesMonth = monthFilter === 'All' || s.date.toLocaleString('default', { month: 'long' }) === monthFilter;
        return matchesClass && matchesMonth;
    });
  }, [availableSlots, classFilter, monthFilter]);

  // Recurrence Logic
  const recurrencePreview = useMemo(() => {
    if (!isRecurringMode || !initialData.dateStr) return [];

    const currentDate = new Date(initialData.dateStr);
    const dayIndex = currentDate.getDay(); // 0=Sun, 1=Mon...
    // Adjust for Monday-based index if needed, but our utils use Date objects directly which is fine.
    // However, our DAYS array is ['Monday', ...]. 1=Mon.
    // Ensure we are operating on a valid weekday (1-5).
    if (dayIndex === 0 || dayIndex === 6) return []; // Weekend check safety

    const currentWeekNum = weeksInTerm.find(w => {
       const start = w.startDate;
       const end = addDays(start, 6);
       return currentDate >= start && currentDate <= end;
    })?.weekNumber || 1;

    const targetWeeks: WeekData[] = [];
    
    if (recurrenceScope === 'term') {
       // Just use weeksInTerm, filtering out past weeks relative to current lesson?
       // Or include all? Typically recurrence implies "from now on" or "all matching in this scope".
       // Let's assume "All matching in this scope including current".
       targetWeeks.push(...weeksInTerm);
    } else {
       // Generate all weeks for all terms
       TERMS.forEach(t => {
           targetWeeks.push(...generateWeeksForTerm(t));
       });
    }

    // Filter weeks based on pattern and start date
    const generatedSlots: { dateStr: string, weekNum: number, displayDate: string }[] = [];

    targetWeeks.forEach(week => {
        // Skip if date is before the initial lesson date (optional, but good UX to not create back-dated recurring events if editing a future one)
        // Let's assume we want to fill the whole selected scope regardless of start, 
        // OR strictly follow "from this date forward".
        // Let's do "from this date forward" (inclusive).
        
        // Calculate the specific date for this week
        // week.startDate is Monday.
        // We need the date that matches the dayIndex.
        // Monday is dayIndex 1. 
        // If week.startDate is Monday (1), then target is startDate + (dayIndex - 1).
        
        // However, our getMonday returns the Monday of the week.
        const monday = week.startDate;
        // Adjust: dayIndex of Monday is 1.
        // If initialData is Tuesday (2), we add 1 day.
        // offset = dayIndex - 1.
        
        // Wait, getDay() returns 0 for Sunday, 1 for Monday.
        const offset = dayIndex - 1; 
        if (offset < 0) return; // Sunday safety

        const targetDate = addDays(monday, offset);
        
        // Check if date is before initial date (ignore past)
        // Compare using strings to avoid time issues
        if (toISODate(targetDate) < initialData.dateStr) return;

        // Check Pattern
        if (recurrencePattern === 'cycle') {
            if (week.weekNumber !== currentWeekNum) return;
        }

        generatedSlots.push({
            dateStr: toISODate(targetDate),
            weekNum: week.weekNumber,
            displayDate: formatDate(targetDate)
        });
    });

    return generatedSlots;

  }, [isRecurringMode, recurrenceScope, recurrencePattern, initialData.dateStr, weeksInTerm]);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialData.title);
      setLinks(initialData.links || []);
      setCurrentLinkInput('');
      setNotes(initialData.notes);
      setType(initialData.type || 'lesson');
      
      // Reset duplication state
      setIsDuplicating(false);
      setSelectedSlots([]);
      setClassFilter('All');
      setMonthFilter('All');
      
      // Reset recurring state
      setIsRecurringMode(false);
      setRecurrenceScope('term');
      setRecurrencePattern('cycle');
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({
      ...initialData,
      title,
      links,
      notes,
      type
    });
    onClose();
  };

  const handleDuplicate = () => {
    if (selectedSlots.length === 0) return;

    if (onBatchSave) {
        const newLessons: LessonPlan[] = selectedSlots.map(slotId => {
            const dateStr = slotId.substring(0, 10);
            const periodLabel = slotId.substring(11);
            
            return {
                id: slotId,
                dateStr,
                periodLabel,
                title,
                links,
                notes,
                type,
                completed: false
            };
        });
        onBatchSave(newLessons);
    } else {
        console.warn("Batch save not supported");
    }
    
    onClose();
  };

  const handleRecurringSave = () => {
      if (recurrencePreview.length === 0 || !onBatchSave) return;

      const newLessons: LessonPlan[] = recurrencePreview.map(slot => ({
          id: `${slot.dateStr}_${initialData.periodLabel}`,
          dateStr: slot.dateStr,
          periodLabel: initialData.periodLabel,
          title,
          links,
          notes,
          type,
          completed: false
      }));

      onBatchSave(newLessons);
      onClose();
  };

  const toggleSlotSelection = (slotId: string) => {
      setSelectedSlots(prev => 
         prev.includes(slotId) ? prev.filter(id => id !== slotId) : [...prev, slotId]
      );
  };

  const handleToggleSelectAllVisible = () => {
      const visibleIds = filteredSlots.map(s => s.id);
      if (visibleIds.length === 0) return;

      const allVisibleSelected = visibleIds.every(id => selectedSlots.includes(id));
      
      if (allVisibleSelected) {
          // Deselect only the visible ones
          setSelectedSlots(prev => prev.filter(id => !visibleIds.includes(id)));
      } else {
          // Select all visible ones
          setSelectedSlots(prev => [...new Set([...prev, ...visibleIds])]);
      }
  };

  const isLinkValid = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const addLink = () => {
    if (currentLinkInput.trim()) {
        let urlToAdd = currentLinkInput.trim();
        if (!/^https?:\/\//i.test(urlToAdd)) {
            urlToAdd = 'https://' + urlToAdd;
        }
        if (isLinkValid(urlToAdd)) {
            setLinks([...links, urlToAdd]);
            setCurrentLinkInput('');
        }
    }
  };

  const removeLink = (index: number) => {
    const newLinks = [...links];
    newLinks.splice(index, 1);
    setLinks(newLinks);
  };

  const handleLinkInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        addLink();
    }
  };

  const headerBgColor = type === 'meeting' ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-800 dark:bg-slate-950 border-slate-700';

  // Identify the last lesson
  const lastLessonInfo = useMemo(() => {
    if (!isOpen || !initialData.dateStr || !subjectName || subjectName === 'Free Period' || weeksInTerm.length === 0) return null;

    const currentLessonDate = new Date(initialData.dateStr);

    // We cannot rely on `availableSlots` because it only generates slots when `isDuplicating` is true.
    // Instead, we dynamically recreate the timetable mapping for the term to find previous lessons.
    const termSlots = new Map<string, string>(); // Map of id -> subject

    for (let i = 0; i < weeksInTerm.length; i++) {
        const week = weeksInTerm[i];
        const timetable = week.weekNumber === 1 ? TIMETABLE_WEEK_1 : TIMETABLE_WEEK_2;

        for (let d = 0; d < DAYS.length; d++) {
            const dayName = DAYS[d];
            const date = addDays(week.startDate, d);

            // Only care about dates before the current lesson date to save processing
            if (date >= currentLessonDate) continue;

            const dateStr = toISODate(date);
            const daySchedule = timetable[dayName];

            for (const period of PERIOD_LABELS) {
                const entry = daySchedule[period];
                if (entry && entry.subject === subjectName) {
                     const id = `${dateStr}_${period}`;
                     termSlots.set(id, entry.subject);
                }
            }
        }
    }

    // Filter all lesson plans to find matching previous ones
    const previousLessons = Object.values(allLessonPlans).filter(lesson => {
      // Check if this lesson ID was mapped to the current subject in our term mapping
      if (!termSlots.has(lesson.id)) return false;

      const lessonDate = new Date(lesson.dateStr);
      // Lesson date must be strictly before current lesson date
      if (lessonDate >= currentLessonDate) return false;

      // Must have some content (notes or title)
      if (!lesson.title && !lesson.notes) return false;

      return true;
    }).sort((a, b) => new Date(b.dateStr).getTime() - new Date(a.dateStr).getTime());

    if (previousLessons.length > 0) {
      return previousLessons[0];
    }
    return null;
  }, [isOpen, initialData.dateStr, subjectName, allLessonPlans, weeksInTerm]);

  // Determine modal title
  let modalTitle = subjectName;
  let modalSubtitle = `${initialData.dateStr} • ${initialData.periodLabel}`;
  if (isDuplicating) {
      modalTitle = 'Copy Lesson';
      modalSubtitle = `Select sessions to copy "${title || 'Untitled'}" to`;
  } else if (isRecurringMode) {
      modalTitle = 'Make Recurring';
      modalSubtitle = `Repeat "${title || 'Untitled'}"`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] transition-colors duration-200">
        
        {/* Header */}
        <div className={`px-6 py-4 flex justify-between items-center text-white border-b transition-colors ${headerBgColor}`}>
          <div>
            <div className="flex items-center gap-2 mb-1">
               {type === 'meeting' ? <Users size={18} className="text-indigo-200" /> : <BookOpen size={18} className="text-slate-400" />}
               <span className="text-xs font-semibold uppercase tracking-wider opacity-80">
                   {isDuplicating ? 'Duplicate' : isRecurringMode ? 'Recurring' : type}
               </span>
               {isReadOnly && <span className="bg-black/20 text-white/90 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ml-2"><Lock size={10} /> Read Only</span>}
            </div>
            <h2 className="text-xl font-bold text-white">{modalTitle}</h2>
            <p className="text-white/70 text-sm">{modalSubtitle}</p>
          </div>
          <button onClick={onClose} className="hover:bg-white/10 p-2 rounded-full transition-colors text-white">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          
          {isDuplicating ? (
              // DUPLICATION FORM
              <div className="space-y-4 h-full flex flex-col">
                  {/* Filter Header */}
                  <div className="flex flex-col gap-2 pb-3 border-b border-gray-100 dark:border-slate-800">
                      <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-500 dark:text-slate-400">
                             Copy to any session in this term
                          </span>
                      </div>
                      
                      <div className="flex gap-2">
                          <div className="relative flex-1">
                              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                  <Filter size={14} />
                              </div>
                              <select 
                                  value={classFilter} 
                                  onChange={(e) => setClassFilter(e.target.value)}
                                  className="w-full pl-9 pr-8 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 rounded-lg text-sm appearance-none cursor-pointer focus:ring-2 focus:ring-green-500 outline-none transition-colors"
                              >
                                  <option value="All">All Classes</option>
                                  {uniqueSubjects.map(subj => (
                                      <option key={subj} value={subj}>{subj}</option>
                                  ))}
                              </select>
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                  <ChevronDown size={14} />
                              </div>
                          </div>

                          <div className="relative flex-1">
                              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                  <CalendarRange size={14} />
                              </div>
                              <select 
                                  value={monthFilter} 
                                  onChange={(e) => setMonthFilter(e.target.value)}
                                  className="w-full pl-9 pr-8 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 rounded-lg text-sm appearance-none cursor-pointer focus:ring-2 focus:ring-green-500 outline-none transition-colors"
                              >
                                  <option value="All">All Months</option>
                                  {uniqueMonths.map(m => (
                                      <option key={m} value={m}>{m}</option>
                                  ))}
                              </select>
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                  <ChevronDown size={14} />
                              </div>
                          </div>

                          <button 
                             onClick={handleToggleSelectAllVisible}
                             disabled={filteredSlots.length === 0}
                             className="px-3 py-2 bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50 rounded-lg text-sm font-medium transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                             {filteredSlots.length > 0 && filteredSlots.every(s => selectedSlots.includes(s.id)) ? 'Deselect All' : 'Select All'}
                          </button>
                      </div>
                  </div>

                  {/* Slots List */}
                  <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                      {filteredSlots.length === 0 && (
                          <div className="text-center py-10 text-gray-400 flex flex-col items-center">
                              <Filter size={32} className="mb-2 opacity-20" />
                              <p>No slots found for this filter.</p>
                          </div>
                      )}
                      
                      {filteredSlots.map(slot => {
                          const isSelected = selectedSlots.includes(slot.id);
                          const isSameSubject = slot.subject === subjectName;
                          
                          return (
                              <div 
                                key={slot.id}
                                onClick={() => toggleSlotSelection(slot.id)}
                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                    isSelected 
                                    ? 'bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700'
                                    : 'bg-white border-gray-200 hover:bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700'
                                }`}
                              >
                                  <div className={`shrink-0 ${isSelected ? 'text-green-600 dark:text-green-400' : 'text-gray-300 dark:text-slate-600'}`}>
                                      {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                                  </div>
                                  <div className="flex-1">
                                      <div className="flex justify-between">
                                          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                              {slot.dayName} {formatDate(slot.date)}
                                          </span>
                                          <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                                              Week {slot.weekNum}
                                          </span>
                                      </div>
                                      <div className="flex justify-between items-center mt-0.5">
                                          <span className={`text-xs font-medium ${isSameSubject ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                              {slot.subject}
                                          </span>
                                          <span className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 px-1.5 rounded">
                                              {slot.period}
                                          </span>
                                      </div>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              </div>
          ) : isRecurringMode ? (
              // RECURRING FORM
              <div className="space-y-6">
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-sm text-green-800 dark:text-green-200">
                      <p>Create repeating events for <strong>{initialData.periodLabel}</strong> on <strong>{new Date(initialData.dateStr).toLocaleDateString('en-GB', {weekday: 'long'})}s</strong>.</p>
                  </div>

                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                              Duration (Scope)
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                              <button 
                                onClick={() => setRecurrenceScope('term')}
                                className={`p-3 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                                    recurrenceScope === 'term' 
                                    ? 'bg-green-50 border-green-500 text-green-700 dark:bg-green-900/40 dark:border-green-400 dark:text-green-200'
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                                }`}
                              >
                                <CalendarRange size={16} /> This Term Only
                              </button>
                              <button 
                                onClick={() => setRecurrenceScope('year')}
                                className={`p-3 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                                    recurrenceScope === 'year' 
                                    ? 'bg-green-50 border-green-500 text-green-700 dark:bg-green-900/40 dark:border-green-400 dark:text-green-200'
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                                }`}
                              >
                                <CalendarRange size={16} /> Whole Year
                              </button>
                          </div>
                      </div>

                      <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                              Frequency
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                              <button 
                                onClick={() => setRecurrencePattern('cycle')}
                                className={`p-3 rounded-lg border text-sm font-medium flex flex-col items-center justify-center gap-1 transition-all ${
                                    recurrencePattern === 'cycle' 
                                    ? 'bg-green-50 border-green-500 text-green-700 dark:bg-green-900/40 dark:border-green-400 dark:text-green-200'
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                                }`}
                              >
                                <div className="flex items-center gap-2"><RotateCw size={16} /> Fortnightly</div>
                                <span className="text-xs opacity-75 font-normal">Only Week {weeksInTerm[currentWeekIndex]?.weekNumber || '?'}s</span>
                              </button>
                              <button 
                                onClick={() => setRecurrencePattern('every')}
                                className={`p-3 rounded-lg border text-sm font-medium flex flex-col items-center justify-center gap-1 transition-all ${
                                    recurrencePattern === 'every' 
                                    ? 'bg-green-50 border-green-500 text-green-700 dark:bg-green-900/40 dark:border-green-400 dark:text-green-200'
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                                }`}
                              >
                                <div className="flex items-center gap-2"><Repeat size={16} /> Weekly</div>
                                <span className="text-xs opacity-75 font-normal">Every Week (1 & 2)</span>
                              </button>
                          </div>
                      </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
                      <p className="text-sm text-gray-600 dark:text-slate-400 text-center">
                          This will create <strong>{recurrencePreview.length}</strong> lesson entries.
                      </p>
                  </div>
              </div>
          ) : (
              // STANDARD EDIT FORM
              <>
                {/* Type Toggle - Hide in Read Only mode */}
                {!isReadOnly && (
                    <div className="flex p-1 bg-gray-100 dark:bg-slate-800 rounded-lg">
                        <button
                        onClick={() => setType('lesson')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
                            type === 'lesson' 
                            ? 'bg-white dark:bg-slate-700 text-green-600 dark:text-green-400 shadow-sm'
                            : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'
                        }`}
                        >
                        <BookOpen size={16} /> Lesson
                        </button>
                        <button
                        onClick={() => setType('meeting')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
                            type === 'meeting' 
                            ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                            : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'
                        }`}
                        >
                        <Users size={16} /> Meeting
                        </button>
                    </div>
                )}

                {/* Title */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-200 mb-1">
                    {type === 'meeting' ? 'Meeting Agenda / Title' : 'Lesson Title / Topic'}
                    </label>
                    <input
                    type="text"
                    className={`w-full px-4 py-2 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg outline-none transition-all placeholder-gray-400 dark:placeholder-slate-500 ${isReadOnly ? 'bg-gray-50 text-gray-600 dark:text-gray-300' : 'focus:ring-2 focus:ring-green-500 focus:border-green-500'}`}
                    placeholder={type === 'meeting' ? "e.g. Dept Performance Review" : "e.g. Introduction to Coastal Erosion"}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    autoFocus={!isReadOnly}
                    readOnly={isReadOnly}
                    />
                </div>

                {/* Resource Links */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-200 mb-2 flex items-center gap-2">
                    <LinkIcon size={14} /> {type === 'meeting' ? 'Meeting Links / Docs' : 'Resource Links'}
                    </label>
                    
                    {/* Existing Links List */}
                    {links.length > 0 ? (
                        <div className="space-y-2 mb-3">
                            {links.map((link, idx) => (
                                <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-200 dark:border-slate-700 text-sm">
                                    <a 
                                        href={link} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex-1 truncate text-green-600 dark:text-green-400 hover:underline flex items-center gap-1.5"
                                    >
                                        <ExternalLink size={12} />
                                        {link}
                                    </a>
                                    {!isReadOnly && (
                                        <button 
                                            onClick={() => removeLink(idx)}
                                            className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                            title="Remove link"
                                        >
                                            <MinusCircle size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        isReadOnly && <p className="text-sm text-gray-400 italic">No links added.</p>
                    )}

                    {/* Add New Link Input - Hide in Read Only */}
                    {!isReadOnly && (
                        <div className="flex gap-2">
                            <input
                                type="url"
                                className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all text-sm placeholder-gray-400 dark:placeholder-slate-500"
                                placeholder="https://meet.google.com/..."
                                value={currentLinkInput}
                                onChange={(e) => setCurrentLinkInput(e.target.value)}
                                onKeyDown={handleLinkInputKeyDown}
                            />
                            <button 
                                onClick={addLink}
                                disabled={!currentLinkInput.trim()}
                                className="bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100 text-gray-700 px-3 py-2 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Add Link"
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Notes */}
                <div>
                    <div className="flex justify-between items-end mb-1">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-slate-200">
                        {type === 'meeting' ? 'Meeting Notes' : 'Notes / Homework'}
                        </label>
                    </div>

                    {/* Last Lesson Info Box */}
                    {lastLessonInfo && !isReadOnly && (
                        <div className="mb-3 p-3 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/50 rounded-lg text-sm">
                            <div className="flex items-center gap-1.5 text-blue-800 dark:text-blue-300 font-medium mb-1.5 text-xs uppercase tracking-wide">
                                <RotateCw size={12} /> Last {type === 'meeting' ? 'Meeting' : 'Lesson'} ({new Date(lastLessonInfo.dateStr).toLocaleDateString()})
                            </div>
                            <div className="text-slate-700 dark:text-slate-300">
                                {lastLessonInfo.title && <div className="font-medium mb-1">{lastLessonInfo.title}</div>}
                                {lastLessonInfo.notes ? (
                                    <div className="whitespace-pre-wrap text-xs opacity-90 line-clamp-3">{lastLessonInfo.notes}</div>
                                ) : (
                                    <div className="text-xs italic opacity-70">No notes recorded.</div>
                                )}
                            </div>
                        </div>
                    )}

                    <textarea
                    className={`w-full px-4 py-2 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg outline-none transition-all h-32 resize-none placeholder-gray-400 dark:placeholder-slate-500 ${isReadOnly ? 'bg-gray-50 text-gray-600 dark:text-gray-300' : 'focus:ring-2 focus:ring-green-500 focus:border-green-500'}`}
                    placeholder={type === 'meeting' ? "Minutes, action items..." : "Don't forget to collect homework..."}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    readOnly={isReadOnly}
                    />
                </div>
              </>
          )}

        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-slate-950 px-6 py-4 flex justify-between items-center border-t border-gray-100 dark:border-slate-800">
          
          {isDuplicating ? (
              // DUPLICATE MODE FOOTER
              <>
                 <button 
                    onClick={() => setIsDuplicating(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium"
                 >
                    Back to Edit
                 </button>
                 <button 
                    onClick={handleDuplicate}
                    disabled={selectedSlots.length === 0}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium shadow-lg shadow-green-200 dark:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                    Copy to {selectedSlots.length} Session{selectedSlots.length !== 1 ? 's' : ''} <ArrowRight size={16} />
                 </button>
              </>
          ) : isRecurringMode ? (
              // RECURRING MODE FOOTER
              <>
                 <button 
                    onClick={() => setIsRecurringMode(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium"
                 >
                    Back to Edit
                 </button>
                 <button 
                    onClick={handleRecurringSave}
                    disabled={recurrencePreview.length === 0}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium shadow-lg shadow-purple-200 dark:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                    <Repeat size={16} /> Create Recurring
                 </button>
              </>
          ) : (
              // STANDARD MODE FOOTER
              <>
                <div className="flex gap-2">
                    {!isReadOnly && (
                        <>
                            <button 
                                onClick={() => onDelete(initialData.id)}
                                className="flex items-center justify-center text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                                title="Delete Plan"
                            >
                                <Trash2 size={18} />
                            </button>
                            <button 
                                onClick={() => setIsDuplicating(true)}
                                className="flex items-center justify-center text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 p-2 rounded-lg transition-colors"
                                title="Duplicate Lesson"
                            >
                                <Copy size={18} />
                            </button>
                            <button 
                                onClick={() => setIsRecurringMode(true)}
                                className="flex items-center justify-center text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 p-2 rounded-lg transition-colors"
                                title="Make Recurring"
                            >
                                <Repeat size={18} />
                            </button>
                        </>
                    )}
                </div>
                
                <div className="flex gap-3">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium"
                    >
                        {isReadOnly ? 'Close' : 'Cancel'}
                    </button>
                    {!isReadOnly && (
                        <button 
                            onClick={handleSave}
                            className={`flex items-center gap-2 text-white px-6 py-2 rounded-lg font-medium shadow-lg transition-all transform active:scale-95 ${
                            type === 'meeting' 
                            ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 dark:shadow-none' 
                            : 'bg-slate-800 hover:bg-slate-900 dark:bg-green-600 dark:hover:bg-green-700 shadow-slate-300 dark:shadow-none'
                            }`}
                        >
                            <Save size={18} /> Save
                        </button>
                    )}
                </div>
              </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LessonModal;