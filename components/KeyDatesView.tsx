import React, { useState, useMemo } from 'react';
import { KeyDate, Category } from '../types';
import { Plus, Edit2, Trash2, Calendar, List, Sparkles, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { generateContentFromAction } from '../services/aiService';
import AIContentModal from './AIContentModal';

interface KeyDatesViewProps {
  keyDates: KeyDate[];
  categories: Category[];
  onAddKeyDate: (date: KeyDate) => void;
  onEditKeyDate: (date: KeyDate) => void;
  onDeleteKeyDate: (id: string) => void;
}

const KeyDatesView: React.FC<KeyDatesViewProps> = ({
  keyDates,
  categories,
  onAddKeyDate,
  onEditKeyDate,
  onDeleteKeyDate,
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDate, setEditingDate] = useState<KeyDate | null>(null);

  const [showPastDates, setShowPastDates] = useState(false);

  // AI "Draft note" state
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiContent, setAiContent] = useState<string | null>(null);
  const [aiTitle, setAiTitle] = useState('');
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);

  const handleDraftNote = async (date: KeyDate) => {
    setAiLoadingId(date.id);
    setAiContent(null);
    setAiTitle(`Draft for "${date.title}"`);
    try {
      const prettyDate = new Date(date.dateStr).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const prompt = `You are a teacher's assistant. Draft a brief, friendly note/reminder for the following event.\n\nEvent: ${date.title}\nDate: ${prettyDate}${date.time ? ` at ${date.time}` : ''}${date.notes ? `\nContext notes: ${date.notes}` : ''}\n\nKeep it concise and ready to send to colleagues or parents. Use clear, warm, professional language.`;
      const content = await generateContentFromAction(prompt);
      setAiContent(content);
      setAiModalOpen(true);
    } catch (e) {
      console.error('Failed to draft note', e);
      setAiContent('Failed to generate a draft. Please try again.');
      setAiModalOpen(true);
    } finally {
      setAiLoadingId(null);
    }
  };

  // Form State
  const [title, setTitle] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [time, setTime] = useState('');
  const [isAllDay, setIsAllDay] = useState(true);
  const [notes, setNotes] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');

  const resetForm = () => {
    setTitle('');
    setDateStr('');
    setTime('');
    setIsAllDay(true);
    setNotes('');
    setCategoryId('');
    setEditingDate(null);
  };

  const handleOpenModal = (date?: KeyDate) => {
    if (date) {
      setEditingDate(date);
      setTitle(date.title);
      setDateStr(date.dateStr);
      setTime(date.time || '');
      setIsAllDay(date.isAllDay !== false); // default true
      setNotes(date.notes || '');
      setCategoryId(date.categoryId || '');
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!title.trim() || !dateStr) return;

    let colorClass = 'bg-slate-200';
    if (categoryId) {
      const cat = categories.find(c => c.id === categoryId);
      if (cat) colorClass = cat.colorClass;
    }

    if (editingDate) {
      onEditKeyDate({
        ...editingDate,
        title,
        dateStr,
        time: isAllDay ? undefined : time,
        isAllDay,
        notes,
        categoryId,
        colorClass
      });
    } else {
      onAddKeyDate({
        id: uuidv4(),
        title,
        dateStr,
        time: isAllDay ? undefined : time,
        isAllDay,
        notes,
        categoryId,
        colorClass,
        createdAt: Date.now()
      });
    }

    setIsModalOpen(false);
    resetForm();
  };

  const sortedDates = useMemo(() => {
    return [...keyDates].sort((a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime());
  }, [keyDates]);

  // Countdowns
  const getCountdown = (dStr: string) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const target = new Date(dStr);
    target.setHours(0,0,0,0);

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
    return `In ${diffDays} days`;
  };

  const isPast = (dStr: string) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const target = new Date(dStr);
    target.setHours(0,0,0,0);
    return target.getTime() < today.getTime();
  };

  const upcomingDates = sortedDates.filter(d => !isPast(d.dateStr));
  const pastDates = sortedDates.filter(d => isPast(d.dateStr)).sort((a, b) => new Date(b.dateStr).getTime() - new Date(a.dateStr).getTime());

  // Calendar View Prep
  const currentMonthDates = useMemo(() => {
     // A simple visual map grouped by month/year just to demonstrate the calendar mode
     const map = new Map<string, KeyDate[]>();
     sortedDates.forEach(kd => {
         const d = new Date(kd.dateStr);
         const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
         if(!map.has(key)) map.set(key, []);
         map.get(key)!.push(kd);
     });
     return map;
  }, [sortedDates]);

  const DateCard = ({ date }: { date: KeyDate }) => (
    <div key={date.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
       <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-lg dark:text-white">{date.title}</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-1 flex items-center space-x-2">
              <span>{new Date(date.dateStr).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              {!date.isAllDay && date.time && (
                <>
                  <span>•</span>
                  <span>{date.time}</span>
                </>
              )}
            </p>
            {date.notes && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 line-clamp-2">{date.notes}</p>
            )}
          </div>
          <div className="flex space-x-2">
             <button
                onClick={() => handleDraftNote(date)}
                disabled={aiLoadingId === date.id}
                className="p-1 text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                title="Draft a note with AI"
             >
                {aiLoadingId === date.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
             </button>
             <button onClick={() => handleOpenModal(date)} className="p-1 text-slate-400 hover:text-blue-600 transition-colors"><Edit2 className="w-4 h-4" /></button>
             <button onClick={() => onDeleteKeyDate(date.id)} className="p-1 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
          </div>
       </div>
       <div className="mt-4 flex justify-between items-center">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${date.colorClass.replace('bg-', 'text-').replace('500', '700')} bg-opacity-20 ${date.colorClass}`}>
             {getCountdown(date.dateStr)}
          </div>
          {date.categoryId && categories.find(c => c.id === date.categoryId) && (
             <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                {categories.find(c => c.id === date.categoryId)?.name}
             </span>
          )}
       </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold dark:text-white">Key Dates</h2>
        <div className="flex space-x-4">
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
             <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md flex items-center transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
             >
                <List className="w-4 h-4 mr-2" /> List
             </button>
             <button
                onClick={() => setViewMode('calendar')}
                className={`p-2 rounded-md flex items-center transition-colors ${viewMode === 'calendar' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
             >
                <Calendar className="w-4 h-4 mr-2" /> Calendar
             </button>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Key Date
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingDates.map(date => <DateCard key={date.id} date={date} />)}
            {upcomingDates.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                    No upcoming key dates. Click 'Add Key Date' to get started!
                </div>
            )}
            </div>

            {pastDates.length > 0 && (
                <div>
                    <button
                        onClick={() => setShowPastDates(!showPastDates)}
                        className="flex items-center text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors mb-4"
                    >
                        <span className="font-semibold">Past Dates ({pastDates.length})</span>
                        <span className={`ml-2 transform transition-transform ${showPastDates ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {showPastDates && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-75">
                            {pastDates.map(date => <DateCard key={date.id} date={date} />)}
                        </div>
                    )}
                </div>
            )}
        </div>
      ) : (
        <div className="space-y-8">
           {Array.from(currentMonthDates.entries()).sort().map(([monthKey, datesInMonth]) => {
              const [year, month] = monthKey.split('-');
              const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', { month: 'long' });
              return (
                 <div key={monthKey} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="bg-slate-50 dark:bg-slate-900 px-6 py-3 border-b border-slate-200 dark:border-slate-700">
                       <h3 className="font-semibold text-lg dark:text-white">{monthName} {year}</h3>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                       {datesInMonth.map(date => (
                          <div key={date.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                             <div className="flex items-center space-x-4">
                                <div className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center text-white ${date.colorClass}`}>
                                   <span className="text-xs font-semibold uppercase">{new Date(date.dateStr).toLocaleString('default', { weekday: 'short' })}</span>
                                   <span className="text-lg font-bold leading-none">{new Date(date.dateStr).getDate()}</span>
                                </div>
                                <div>
                                   <h4 className="font-medium dark:text-white">{date.title}</h4>
                                   <span className="text-sm text-slate-500 dark:text-slate-400">{getCountdown(date.dateStr)}</span>
                                </div>
                             </div>
                             <div className="flex items-center space-x-3">
                                {date.categoryId && categories.find(c => c.id === date.categoryId) && (
                                   <span className="hidden sm:inline-block text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                                      {categories.find(c => c.id === date.categoryId)?.name}
                                   </span>
                                )}
                                <button onClick={() => handleOpenModal(date)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={() => onDeleteKeyDate(date.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                             </div>
                          </div>
                       ))}
                    </div>
                 </div>
              )
           })}
           {currentMonthDates.size === 0 && (
               <div className="py-12 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
               No key dates added yet. Click 'Add Key Date' to get started!
            </div>
           )}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold dark:text-white">
                {editingDate ? 'Edit Key Date' : 'Add Key Date'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="keyDateTitle" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Title
                </label>
                <input
                  id="keyDateTitle"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-slate-700 dark:text-white"
                  placeholder="e.g., Parent Teacher Evening"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="keyDateDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Date
                  </label>
                  <input
                    id="keyDateDate"
                    type="date"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-slate-700 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="keyDateTime" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Time (Optional)
                  </label>
                  <input
                    id="keyDateTime"
                    type="time"
                    value={time}
                    onChange={(e) => {
                       setTime(e.target.value);
                       if(e.target.value) setIsAllDay(false);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-slate-700 dark:text-white disabled:opacity-50"
                    disabled={isAllDay}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="keyDateAllDay"
                  checked={isAllDay}
                  onChange={(e) => {
                     setIsAllDay(e.target.checked);
                     if(e.target.checked) setTime('');
                  }}
                  className="rounded text-primary-600 focus:ring-primary-500 bg-slate-100 border-slate-300 dark:border-slate-600 dark:bg-slate-700"
                />
                <label htmlFor="keyDateAllDay" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  All Day Event
                </label>
              </div>

              <div>
                <label htmlFor="keyDateNotes" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  id="keyDateNotes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-slate-700 dark:text-white min-h-[80px]"
                  placeholder="Additional details..."
                />
              </div>

              <div>
                <label htmlFor="keyDateCategory" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Category (Optional)
                </label>
                <select
                  id="keyDateCategory"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-slate-700 dark:text-white"
                >
                  <option value="">None</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-end space-x-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!title.trim() || !dateStr}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <AIContentModal
        isOpen={aiModalOpen && aiContent !== null}
        onClose={() => { setAiModalOpen(false); setAiContent(null); }}
        content={aiContent}
        title={aiTitle}
      />
    </div>
  );
};

export default KeyDatesView;
