import React, { useState, useEffect } from 'react';
import { Colleague, WeeklyTimetable } from '../types';
import { fetchColleagues, saveColleague, deleteColleague } from '../services/colleagueService';
import { parseTimetableImage, parseTimetableText } from '../services/aiService';
import { PERIOD_LABELS, DAYS } from '../constants';
import { Users, Upload, Plus, Trash2, Check, X, Loader2, CheckCircle2, Eye, FileText } from 'lucide-react';

interface MeetingPlannerProps {
  initialWeekNumber: number; // 1 or 2
  userTimetableWeek1: WeeklyTimetable;
  userTimetableWeek2: WeeklyTimetable;
}

const MeetingPlanner: React.FC<MeetingPlannerProps> = ({ initialWeekNumber, userTimetableWeek1, userTimetableWeek2 }) => {
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [selectedColleagueIds, setSelectedColleagueIds] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentWeek, setCurrentWeek] = useState<number>(initialWeekNumber);

  // New Colleague Form State
  const [newName, setNewName] = useState('');
  const [parsedWeek1, setParsedWeek1] = useState<WeeklyTimetable | null>(null);
  const [parsedWeek2, setParsedWeek2] = useState<WeeklyTimetable | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFileBase64, setUploadedFileBase64] = useState<string | null>(null);
  const [uploadedFileMimeType, setUploadedFileMimeType] = useState<string | null>(null);
  const [timetableText, setTimetableText] = useState('');
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file');

  // Viewing Timetable State
  const [viewingColleague, setViewingColleague] = useState<Colleague | null>(null);

  useEffect(() => {
    loadColleagues();
  }, []);

  const loadColleagues = async () => {
    setLoading(true);
    const data = await fetchColleagues();
    setColleagues(data);
    setLoading(false);
  };

  const resetForm = () => {
    setNewName('');
    setParsedWeek1(null);
    setParsedWeek2(null);
    setUploadedFileBase64(null);
    setUploadedFileMimeType(null);
    setUploadError(null);
    setTimetableText('');
    setInputMode('file');
  };

  const handleDeleteColleague = async (id: string) => {
    if (confirm('Are you sure you want to remove this colleague?')) {
      await deleteColleague(id);
      loadColleagues();
      const newSelected = new Set(selectedColleagueIds);
      newSelected.delete(id);
      setSelectedColleagueIds(newSelected);
    }
  };

  const toggleColleagueSelection = (id: string) => {
    const newSelected = new Set(selectedColleagueIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedColleagueIds(newSelected);
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
        const MAX_WIDTH = 1024; // Resize to max width 1024px
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
        // Compress to JPEG with 0.7 quality
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(compressedDataUrl.split(',')[1]);
      };
      img.onerror = (err) => reject(err);
    });
  };

  const handleTextSubmit = async () => {
    if (!timetableText.trim()) return;

    setUploading(true);
    setUploadError(null);
    setParsedWeek1(null);
    setParsedWeek2(null);

    try {
      const result = await parseTimetableText(timetableText);

      setParsedWeek1(result.week1 || null);
      setParsedWeek2(result.week2 || null);

      if ((!result.week1 || Object.keys(result.week1).length === 0) && (!result.week2 || Object.keys(result.week2).length === 0)) {
         setUploadError("Could not detect any valid timetable data from the text. Please check the content.");
      }
    } catch (err) {
      console.error(err);
      setUploadError("Failed to parse timetable text. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    
    // CRITICAL: Clear previous data to ensure we don't mix timetables if the user uploads a new file
    setParsedWeek1(null);
    setParsedWeek2(null);
    setUploadedFileBase64(null);
    setUploadedFileMimeType(null);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        let base64Content = base64String.split(',')[1];
        let mimeType = file.type;
        
        // Compress if it's an image
        if (mimeType.startsWith('image/')) {
          try {
             base64Content = await compressImage(base64Content, mimeType);
             mimeType = 'image/jpeg'; // We convert to jpeg
          } catch (err) {
            console.warn("Image compression failed, using original", err);
          }
        }

        setUploadedFileBase64(base64Content);
        setUploadedFileMimeType(mimeType);

        try {
          const result = await parseTimetableImage(base64Content, mimeType);
          
          // Directly set the result, even if null, to ensure we reflect exactly what the AI found in THIS file
          setParsedWeek1(result.week1 || null);
          setParsedWeek2(result.week2 || null);

          if ((!result.week1 || Object.keys(result.week1).length === 0) && (!result.week2 || Object.keys(result.week2).length === 0)) {
             setUploadError("Could not detect any valid timetable data. Please check the file.");
          }

        } catch (err) {
          console.error(err);
          setUploadError("Failed to parse timetable. Please try again with a clearer file.");
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setUploadError("Error reading file.");
      setUploading(false);
    }
  };

  const handleSaveColleague = async () => {
    if (!newName || !parsedWeek1 || !parsedWeek2) return;

    setSaving(true);
    try {
      const newColleague: Omit<Colleague, 'id'> = {
        name: newName,
        type: 'staff',
        week1: parsedWeek1,
        week2: parsedWeek2,
        timetableImage: uploadedFileBase64 || undefined,
        timetableMimeType: uploadedFileMimeType || undefined,
      };

      await saveColleague(newColleague);
      resetForm();
      setIsModalOpen(false);
      loadColleagues();
    } catch (error) {
      console.error(error);
      setUploadError("Failed to save colleague. The file might be too large.");
    } finally {
      setSaving(false);
    }
  };

  const isSlotFree = (timetable: WeeklyTimetable | undefined | null, day: string, period: string) => {
    if (!timetable || Object.keys(timetable).length === 0) {
      return { status: 'unknown', subject: null };
    }

    const dayData = timetable[day];
    if (!dayData) {
       return { status: 'free', subject: null };
    }
    
    const entry = dayData[period];
    if (!entry) return { status: 'free', subject: null };
    
    const subject = entry.subject || '';
    const isPPA = subject.toUpperCase().includes('PPA');
    
    return { 
      status: isPPA ? 'free' : 'busy', 
      subject: subject 
    };
  };

  const getCommonFreeSlots = () => {
    const slots: { 
      day: string; 
      period: string; 
      everyoneFree: boolean; 
      participants: { name: string; subject: string | null, status: string }[], 
      isSplit: boolean 
    }[] = [];
    const userTimetable = currentWeek === 1 ? userTimetableWeek1 : userTimetableWeek2;

    DAYS.forEach(day => {
      PERIOD_LABELS.forEach(period => {
        // Skip meetings for now if user wants
        if (period.includes('Mtg')) return;

        const isSplit = period === 'Period 3' || period === 'Period 5';
        const userStatus = isSlotFree(userTimetable, day, period);
        
        const participants: { name: string; subject: string | null, status: string }[] = [
          { 
            name: 'You', 
            subject: userStatus.subject, 
            status: userStatus.status 
          }
        ];

        let everyoneFree = userStatus.status === 'free';

        selectedColleagueIds.forEach(id => {
          const colleague = colleagues.find(c => c.id === id);
          if (colleague) {
            const timetable = currentWeek === 1 ? colleague.week1 : colleague.week2;
            const status = isSlotFree(timetable, day, period);
            
            if (status.status !== 'free') {
              everyoneFree = false;
            }
            
            participants.push({ 
              name: colleague.name, 
              subject: status.subject,
              status: status.status
            });
          }
        });

        slots.push({ day, period, everyoneFree, participants, isSplit });
      });
    });

    return slots;
  };

  const comparisonSlots = getCommonFreeSlots();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Meeting Planner
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setCurrentWeek(1)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${currentWeek === 1 ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              Week 1
            </button>
            <button
              onClick={() => setCurrentWeek(2)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${currentWeek === 2 ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              Week 2
            </button>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Colleague
          </button>
        </div>
      </div>

      {/* Colleague Selection */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
          Select Colleagues to Compare
        </h3>
        <div className="flex flex-wrap gap-3">
          {colleagues.length === 0 && !loading && (
            <p className="text-sm text-gray-400 italic">No colleagues added yet.</p>
          )}
          {colleagues.map(colleague => (
            <div
              key={colleague.id}
              onClick={() => toggleColleagueSelection(colleague.id)}
              className={`
                cursor-pointer px-3 py-2 rounded-lg border flex items-center gap-2 transition-all
                ${selectedColleagueIds.has(colleague.id)
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-300'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'}
              `}
            >
              <span className="font-medium">{colleague.name}</span>
              {selectedColleagueIds.has(colleague.id) && <Check className="w-3 h-3" />}
              
              <div className="ml-auto flex items-center gap-1">
                {colleague.timetableImage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewingColleague(colleague);
                    }}
                    className="p-1 hover:bg-green-100 text-gray-400 hover:text-green-600 rounded-full dark:hover:bg-green-900/30"
                    title="View Timetable"
                  >
                    <Eye className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteColleague(colleague.id);
                  }}
                  className="p-1 hover:bg-red-100 text-gray-400 hover:text-red-600 rounded-full dark:hover:bg-red-900/30"
                  title="Remove Colleague"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Comparison Grid */}
      {selectedColleagueIds.size > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">
              Common Free Slots (Week {currentWeek})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-slate-900/50 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Period</th>
                  {DAYS.map(day => <th key={day} className="px-4 py-3">{day}</th>)}
                </tr>
              </thead>
              <tbody>
                {PERIOD_LABELS.filter(p => !p.includes('Mtg')).map(period => (
                  <tr key={period} className="border-b border-gray-100 dark:border-slate-700 last:border-0">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      {period}
                    </td>
                    {DAYS.map(day => {
                      const slot = comparisonSlots.find(s => s.day === day && s.period === period);
                      const isFree = slot?.everyoneFree;
                      const isSplit = slot?.isSplit;
                      const participants = slot?.participants || [];
                      
                      // For split periods, we highlight as free (green) even if busy, but show details
                      const showAsFree = isFree || isSplit;
                      
                      return (
                        <td key={day} className={`px-4 py-3 border-l border-gray-100 dark:border-slate-700 align-top ${showAsFree ? 'bg-green-50 dark:bg-green-900/20' : ''}`}>
                          <div className="flex flex-col gap-1.5">
                            {isSplit && (
                              <span className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wider mb-0.5">
                                Split Lunch/Break
                              </span>
                            )}
                            
                            {participants.map((person, idx) => {
                              const isPersonFree = person.status === 'free';
                              const isUnknown = person.status === 'unknown';
                              
                              return (
                                <div key={idx} className="flex items-start gap-1.5 min-w-0" title={`${person.name}: ${person.subject || (isPersonFree ? 'Free' : 'Busy')}`}>
                                  {isPersonFree ? (
                                    <Check className="w-3 h-3 mt-0.5 text-green-500 shrink-0" />
                                  ) : isUnknown ? (
                                    <Loader2 className="w-3 h-3 mt-0.5 text-gray-400 shrink-0" />
                                  ) : (
                                    <X className="w-3 h-3 mt-0.5 text-red-500 shrink-0" />
                                  )}
                                  
                                  <div className="flex flex-col min-w-0">
                                    <span className={`text-xs font-medium truncate ${isPersonFree ? 'text-gray-700 dark:text-gray-300' : isUnknown ? 'text-gray-400' : 'text-red-700 dark:text-red-400'}`}>
                                      {person.name}
                                    </span>
                                    {!isPersonFree && person.subject && (
                                      <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate italic">
                                        {person.subject}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            {isFree && participants.length > 1 && (
                              <div className="mt-1 pt-1 border-t border-green-200 dark:border-green-800/50">
                                <span className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase">
                                  Perfect Match
                                </span>
                              </div>
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
        </div>
      )}

      {/* View Timetable Modal */}
      {viewingColleague && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setViewingColleague(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <FileText size={20} className="text-green-600 dark:text-green-400" />
                Timetable: {viewingColleague.name}
              </h2>
              <button 
                onClick={() => setViewingColleague(null)} 
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500 dark:text-slate-400"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 bg-gray-100 dark:bg-slate-950 overflow-auto p-4 flex items-center justify-center">
              {viewingColleague.timetableMimeType === 'application/pdf' ? (
                <iframe 
                  src={`data:application/pdf;base64,${viewingColleague.timetableImage}`}
                  className="w-full h-full rounded-lg shadow-lg border border-gray-200 dark:border-slate-700"
                  title={`Timetable for ${viewingColleague.name}`}
                />
              ) : (
                <img 
                  src={`data:${viewingColleague.timetableMimeType || 'image/png'};base64,${viewingColleague.timetableImage}`}
                  alt={`Timetable for ${viewingColleague.name}`}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Colleague Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
              <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-100">Add New Colleague</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Mrs Smith"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Timetable Source
                  </label>
                  <div className="flex bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
                    <button
                      onClick={() => setInputMode('file')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${inputMode === 'file' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                      File/Image
                    </button>
                    <button
                      onClick={() => setInputMode('text')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${inputMode === 'text' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                      Text
                    </button>
                  </div>
                </div>

                {inputMode === 'file' ? (
                  <div className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors ${parsedWeek1 || parsedWeek2 ? 'border-green-300 bg-green-50 dark:bg-green-900/10' : 'border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700/50'}`}>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={handleFileChange}
                      className="hidden"
                      id="timetable-upload"
                      disabled={uploading}
                    />
                    <label htmlFor="timetable-upload" className="cursor-pointer flex flex-col items-center w-full">
                      {uploading ? (
                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-2" />
                      ) : (parsedWeek1 || parsedWeek2) ? (
                        <CheckCircle2 className="w-8 h-8 text-green-500 mb-2" />
                      ) : (
                        <Upload className="w-8 h-8 text-gray-400 mb-2" />
                      )}

                      <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                        {uploading ? "Analyzing document..." : (parsedWeek1 || parsedWeek2) ? "Timetable Loaded" : "Click to upload"}
                      </span>

                      {!uploading && (
                        <span className="text-xs text-gray-400 mt-1">
                          Supports PDF (multi-page) or Images (PNG/JPG)
                        </span>
                      )}

                      {(parsedWeek1 || parsedWeek2) && !uploading && (
                         <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                            {parsedWeek1 && parsedWeek2 ? "Found Week 1 & Week 2" : parsedWeek1 ? "Found Week 1 Only" : "Found Week 2 Only"}
                         </div>
                      )}
                    </label>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={timetableText}
                      onChange={(e) => setTimetableText(e.target.value)}
                      placeholder="Paste timetable text here..."
                      className="w-full h-32 px-3 py-2 text-sm text-gray-700 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:text-gray-300 dark:border-slate-700 custom-scrollbar"
                      disabled={uploading}
                    />
                    <button
                      onClick={handleTextSubmit}
                      disabled={uploading || !timetableText.trim()}
                      className="self-end px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 disabled:opacity-50 text-sm font-medium flex items-center gap-2 transition-colors"
                    >
                      {uploading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
                      ) : (
                        <><FileText className="w-4 h-4" /> Process Text</>
                      )}
                    </button>
                    {(parsedWeek1 || parsedWeek2) && !uploading && (
                       <div className="mt-1 text-xs text-green-600 dark:text-green-400 text-right">
                          {parsedWeek1 && parsedWeek2 ? "Found Week 1 & Week 2" : parsedWeek1 ? "Found Week 1 Only" : "Found Week 2 Only"}
                       </div>
                    )}
                  </div>
                )}

                {uploadError && (
                  <p className="text-sm text-red-500 mt-2 text-center">{uploadError}</p>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  resetForm();
                  setIsModalOpen(false);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveColleague}
                disabled={!newName || !parsedWeek1 || !parsedWeek2 || uploading || saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? "Saving..." : "Save Colleague"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingPlanner;
