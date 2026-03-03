import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Volume2, Loader2, X, Bot, Info, Monitor, MonitorOff } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { LessonPlan, WeekData, WeeklyTimetable } from '../types';
import { DAYS, PERIOD_LABELS, TIMETABLE_WEEK_1, TIMETABLE_WEEK_2, TERMS } from '../constants';
import { toISODate, addDays, generateWeeksForTerm } from '../utils/dateUtils';

interface LiveAssistantProps {
  currentWeekData: WeekData | undefined;
  lessonPlans: Record<string, LessonPlan>;
  onUpdateLesson: (lesson: LessonPlan) => Promise<void>;
  onAddRecurringLesson: (lessons: LessonPlan[]) => Promise<void>;
  isAdmin: boolean;
}

// Audio Utils as per guidelines
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const LiveAssistant: React.FC<LiveAssistantProps> = ({ 
  currentWeekData, 
  lessonPlans, 
  onUpdateLesson, 
  onAddRecurringLesson,
  isAdmin 
}) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'listening' | 'speaking'>('idle');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  const sessionRef = useRef<any>(null);
  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);
  
  // Screen Sharing Refs
  const screenStreamRef = useRef<MediaStream | null>(null);
  const videoIntervalRef = useRef<number | null>(null);

  const stopScreenShare = useCallback(() => {
    if (videoIntervalRef.current) {
        window.clearInterval(videoIntervalRef.current);
        videoIntervalRef.current = null;
    }
    if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
    }
    setIsScreenSharing(false);
  }, []);

  const stopSession = useCallback(() => {
    stopScreenShare();
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (audioContextInRef.current) {
      audioContextInRef.current.close();
      audioContextInRef.current = null;
    }
    if (audioContextOutRef.current) {
      audioContextOutRef.current.close();
      audioContextOutRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
    setIsActive(false);
    setIsConnecting(false);
    setStatus('idle');
  }, [stopScreenShare]);

  const startScreenShare = async () => {
    if (!sessionRef.current || !isActive) return;

    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 5 }
            },
            audio: false
        });
        
        screenStreamRef.current = stream;
        setIsScreenSharing(true);

        // Setup hidden video/canvas for frame extraction
        const videoEl = document.createElement('video');
        videoEl.srcObject = stream;
        videoEl.muted = true;
        await videoEl.play();

        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext('2d');

        const sendFrame = () => {
             if (!sessionRef.current || !screenStreamRef.current) return;
             
             if (ctx && videoEl.videoWidth > 0) {
                 // Draw video frame to canvas
                 ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
                 // Convert to base64 JPEG
                 const base64Data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
                 
                 sessionRef.current.sendRealtimeInput({
                     media: { mimeType: 'image/jpeg', data: base64Data }
                 });
             }
        };

        // Send frames at 1 FPS (adjust as needed for latency vs bandwidth)
        videoIntervalRef.current = window.setInterval(sendFrame, 1000);

        // Handle native stop button (browser UI)
        stream.getVideoTracks()[0].onended = () => {
            stopScreenShare();
        };

    } catch (e) {
        console.error("Failed to start screen share:", e);
        stopScreenShare();
    }
  };

  // Helper to query schedule for any date range
  const getScheduleForRange = (startDateStr: string, endDateStr: string) => {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    let current = start;
    let result = "";

    // Generate all weeks for the year to perform lookup
    const allWeeks: WeekData[] = [];
    TERMS.forEach(t => allWeeks.push(...generateWeeksForTerm(t)));

    // Safety break
    let daysCount = 0;
    while (current <= end && daysCount < 60) {
        const dateStr = toISODate(current);
        const dayIndex = current.getDay(); // 0-6
        const dayName = DAYS[dayIndex - 1]; // Convert 1(Mon)-5(Fri) to 0-4 index

        if (dayName) {
            // Find which week this date belongs to
            const week = allWeeks.find(w => {
                const wStart = w.startDate;
                const wEnd = addDays(w.startDate, 6);
                return current >= wStart && current <= wEnd;
            });

            if (week) {
                  const timetable = week.weekNumber === 1 ? TIMETABLE_WEEK_1 : TIMETABLE_WEEK_2;
                  result += `\nDate: ${dateStr} (${dayName}, Week ${week.weekNumber})\n`;
                  
                  PERIOD_LABELS.forEach(period => {
                      const staticEntry = timetable[dayName][period];
                      const planKey = `${dateStr}_${period}`;
                      const plan = lessonPlans[planKey];
                      
                      const subject = staticEntry ? staticEntry.subject : "Free/Admin";
                      
                      let details = "";
                      if (plan) {
                          details = ` [PLANNED: "${plan.title}" (${plan.type})]`;
                          if (plan.notes) details += ` Notes: ${plan.notes}`;
                      } else {
                          // Crucial: Distinguish between "Free" and "Scheduled but no plan"
                          details = staticEntry ? " [Scheduled Class - No Plan]" : " [Free]";
                      }
                      
                      result += `  - ${period}: ${subject}${details}\n`;
                  });
            } else {
                result += `\nDate: ${dateStr} (${dayName}) - No Term/Holiday\n`;
            }
        }
        current = addDays(current, 1);
        daysCount++;
    }
    return result || "No schedule data found for this range.";
  };

  const startSession = async () => {
    if (!currentWeekData) return;
    setIsConnecting(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextInRef.current = inputCtx;
      audioContextOutRef.current = outputCtx;

      // Build context from current week data and lesson plans for immediate context
      let plannerContext = "";
      const timetable = currentWeekData.weekNumber === 1 ? TIMETABLE_WEEK_1 : TIMETABLE_WEEK_2;

      DAYS.forEach((day, dayIndex) => {
          const date = addDays(currentWeekData.startDate, dayIndex);
          const dateStr = toISODate(date);
          plannerContext += `\n${day} (${dateStr}):\n`;

          PERIOD_LABELS.forEach(period => {
              const staticEntry = timetable[day][period];
              const lessonKey = `${dateStr}_${period}`;
              const plan = lessonPlans[lessonKey];

              const subject = staticEntry ? staticEntry.subject : "Free/Admin";
              
              if (plan) {
                  plannerContext += `  - ${period}: ${subject} [PLANNED] Title: "${plan.title}"`;
                  if (plan.type === 'meeting') plannerContext += " (Meeting)";
                  if (plan.notes) plannerContext += ` | Notes: ${plan.notes.substring(0, 100)}...`;
                  plannerContext += "\n";
              } else {
                  // Explicitly label scheduled classes found in timetable that have no plan
                  const status = staticEntry ? "[Scheduled Class - No Plan]" : "[Free/Admin]";
                  plannerContext += `  - ${period}: ${subject} ${status}\n`;
              }
          });
      });

      let contextString = `You are an expert Teaching Assistant called "June".
      Your goal is to help the teacher plan lessons, review materials, and manage their schedule.
      You have a British persona (use terms like 'maths', 'holiday', 'term').
      You have access to the teacher's planner and, if enabled, you can see their screen.

      CONTEXT:
      Current Week: ${currentWeekData.displayString} (Week ${currentWeekData.weekNumber}).
      Today: ${new Date().toDateString()}.

      CURRENT WEEK SNAPSHOT:
      ${plannerContext}

      CAPABILITIES:
      1. AUDIO & VISION: You can hear the teacher and see their screen if they share it. Use visual context to provide feedback.
      2. PLANNING: You can add/update lessons using 'updateLesson'.
      3. SCHEDULING: You can create recurring events with 'addRecurringLesson'.
      4. QUERYING: Use 'getSchedule' to check the planner for PAST or FUTURE dates not shown in the snapshot.

      GUIDELINES:
      - Be proactive. If you see a slide deck, offer feedback on clarity or engagement.
      - If the teacher asks "What do I have today?", read out the "Scheduled Class" entries even if there is no plan.
      - Distinguish between "Free" periods and "Scheduled Class - No Plan".
      - Keep responses conversational and concise.
      - Always confirm before making changes to the planner.
      `;

      // Define Tools
      const tools: any[] = [
          {
            functionDeclarations: [
                {
                    name: 'getSchedule',
                    description: 'Get the timetable and lesson plans for a specific date range (past or future).',
                    parameters: {
                        type: 'OBJECT' as any,
                        properties: {
                            startDate: { type: 'STRING' as any, description: 'YYYY-MM-DD' },
                            endDate: { type: 'STRING' as any, description: 'YYYY-MM-DD' }
                        },
                        required: ['startDate', 'endDate']
                    }
                }
            ]
          }
      ];

      // Add Write tools only if admin
      if (isAdmin) {
          tools[0].functionDeclarations.push(
              {
                name: 'updateLesson',
                description: 'Add or update a lesson plan for a specific date.',
                parameters: {
                  type: 'OBJECT' as any,
                  properties: {
                    dateStr: { type: 'STRING' as any, description: 'YYYY-MM-DD' },
                    periodLabel: { type: 'STRING' as any, description: 'e.g., Period 1' },
                    title: { type: 'STRING' as any },
                    type: { type: 'STRING' as any, enum: ['lesson', 'meeting'] },
                    notes: { type: 'STRING' as any },
                  },
                  required: ['dateStr', 'periodLabel', 'title'],
                },
              },
              {
                name: 'addRecurringLesson',
                description: 'Add a recurring lesson for the year.',
                parameters: {
                  type: 'OBJECT' as any,
                  properties: {
                    dayOfWeek: { type: 'STRING' as any, enum: DAYS },
                    periodLabel: { type: 'STRING' as any },
                    title: { type: 'STRING' as any },
                    weekCycle: { type: 'STRING' as any, enum: ['all', 'week1', 'week2'] },
                  },
                  required: ['dayOfWeek', 'periodLabel', 'title'],
                },
              }
          );
      }

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: contextString,
          tools: tools
        },
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsActive(true);
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
              
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Tool Calls
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                let result = "ok";
                try {
                  if (fc.name === 'getSchedule') {
                      const args = fc.args as any;
                      const scheduleText = getScheduleForRange(args.startDate, args.endDate);
                      result = scheduleText;
                  } else if (fc.name === 'updateLesson') {
                    const args = fc.args as any;
                    await onUpdateLesson({
                      id: `${args.dateStr}_${args.periodLabel}`,
                      dateStr: args.dateStr,
                      periodLabel: args.periodLabel,
                      title: args.title,
                      type: args.type || 'lesson',
                      notes: args.notes || "",
                      links: [],
                      completed: false
                    });
                  } else if (fc.name === 'addRecurringLesson') {
                    const args = fc.args as any;
                    const dayIndex = DAYS.indexOf(args.dayOfWeek);
                    const allWeeks: WeekData[] = [];
                    TERMS.forEach(t => allWeeks.push(...generateWeeksForTerm(t)));
                    
                    const batch: LessonPlan[] = allWeeks
                      .filter(w => !args.weekCycle || args.weekCycle === 'all' || (args.weekCycle === 'week1' && w.weekNumber === 1) || (args.weekCycle === 'week2' && w.weekNumber === 2))
                      .map(w => ({
                        id: `${toISODate(addDays(w.startDate, dayIndex))}_${args.periodLabel}`,
                        dateStr: toISODate(addDays(w.startDate, dayIndex)),
                        periodLabel: args.periodLabel,
                        title: args.title,
                        type: 'lesson',
                        notes: "",
                        links: [],
                        completed: false
                      }));
                    await onAddRecurringLesson(batch);
                  }
                } catch (e) {
                  result = "error: " + (e as Error).message;
                }
                
                sessionPromise.then(s => s.sendToolResponse({
                  functionResponses: { id: fc.id, name: fc.name, response: { result } }
                }));
              }
            }

            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              setStatus('speaking');
              const outCtx = audioContextOutRef.current;
              if (outCtx) {
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
                const audioBuffer = await decodeAudioData(decode(base64Audio), outCtx, 24000, 1);
                const source = outCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outCtx.destination);
                source.onended = () => {
                  sourcesRef.current.delete(source);
                  if (sourcesRef.current.size === 0) setStatus('listening');
                };
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
              }
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e) => {
            console.error("Live Error:", e);
            stopSession();
          },
          onclose: () => stopSession()
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error("Failed to start Live session:", err);
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed bottom-24 right-6 z-50 flex flex-col items-end gap-3">
      {isActive && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-4 border border-blue-100 dark:border-slate-800 animate-in slide-in-from-bottom-5 fade-in duration-300 w-72">
          <div className="flex items-center justify-between mb-3 border-b border-gray-100 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-tighter">Teaching Assistant</span>
            </div>
            <button onClick={stopSession} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
              <X size={14} className="text-slate-400" />
            </button>
          </div>
          
          <div className="flex flex-col items-center py-4 gap-3">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 relative ${
              status === 'speaking' 
                ? 'bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.4)]' 
                : 'bg-slate-100 dark:bg-slate-800'
            }`}>
              {status === 'speaking' ? <Volume2 className="text-white animate-bounce" /> : <Bot className="text-slate-400" />}
              
              {isScreenSharing && (
                  <div className="absolute -bottom-1 -right-1 bg-green-500 text-white p-1 rounded-full border-2 border-white dark:border-slate-900" title="Viewing Screen">
                      <Monitor size={10} />
                  </div>
              )}
            </div>
            <p className="text-sm font-medium dark:text-slate-200">
              {status === 'speaking' ? "June is speaking..." : "Listening..."}
            </p>
          </div>
          
          {/* Controls */}
          <div className="grid grid-cols-2 gap-2 mb-3">
             <button 
                onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isScreenSharing 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300'
                }`}
             >
                {isScreenSharing ? <MonitorOff size={14} /> : <Monitor size={14} />}
                {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
             </button>
             <button 
                onClick={stopSession}
                className="flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 transition-colors"
             >
                <X size={14} /> End Session
             </button>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg text-[10px] text-blue-700 dark:text-blue-300 flex items-start gap-2">
            <Info size={12} className="shrink-0 mt-0.5" />
            <span>"Share Screen" to let June review your resources, slides, or documents in real-time.</span>
          </div>
        </div>
      )}

      <button
        onClick={isActive ? stopSession : startSession}
        disabled={isConnecting}
        className={`group relative w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 transform active:scale-95 ${
          isActive 
            ? 'bg-slate-800 text-white' 
            : 'bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white hover:shadow-blue-500/20'
        }`}
      >
        {isConnecting ? (
          <Loader2 className="animate-spin" size={24} />
        ) : isActive ? (
          // Show active wave animation or icon when active
          <div className="relative">
             <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
             </span>
             <Bot size={24} />
          </div>
        ) : (
          <Mic size={24} />
        )}
        
        {!isActive && !isConnecting && (
          <span className="absolute right-16 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Teaching Assistant
          </span>
        )}
      </button>
    </div>
  );
};

export default LiveAssistant;