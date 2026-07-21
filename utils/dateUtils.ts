import { Term, WeekData } from '../types';

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

export const toISODate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Key for a lesson plan slot — full period label, e.g. "2026-09-01_Period 2". */
export const getLessonKey = (dateStr: string, periodLabel: string): string => `${dateStr}_${periodLabel}`;

export const getMonday = (d: Date): Date => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  return new Date(date.setDate(diff));
};

export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const generateWeeksForTerm = (term: Term): WeekData[] => {
  const weeks: WeekData[] = [];
  let currentMonday = getMonday(term.startDate);
  
  // Adjust if term starts mid-week, though typical academic years align well.
  // We'll iterate week by week.
  
  // Simple heuristic for Week 1 vs Week 2:
  // Week 1 starts on the first week of Autumn term.
  // Then it alternates.
  // Ideally, we reset week numbering or continue it. 
  // For this app, we will assume the first week of the academic year is Week 1, 
  // and we just toggle. 
  
  // Reset simulation for 2025:
  // Sept 2 2025 is a Tuesday. So Week starting Sep 1 is Week 1.
  
  // We need to maintain a continuous counter from the very first term start to determine parity correctly across half terms
  // However, most schools freeze the week type during holidays or reset. 
  // Let's assume a standard: First week of term is Week 1, unless otherwise specified.
  // Actually, usually it continues. 
  // For simplicity in this UI, we will alternate based on the index in the term, 
  // BUT we need to handle half-terms.
  // Let's just generate strictly sequential weeks for the term and let the user override if needed, 
  // but by default: Week 1, Week 2, Week 1...
  
  let weekCounter = 1; // 1 or 2
  
  // Limit loop to avoid infinite in case of error
  let safeGuard = 0;
  
  while (currentMonday <= term.endDate && safeGuard < 50) {
    const endOfWeek = addDays(currentMonday, 4); // Friday
    
    // Check if this week is a half-term or holiday
    // If the entire week is within the half-term/holiday break, skip adding it to planner
    // or mark it as holiday.
    // Based on user request, they want to plan lessons.
    
    let isHoliday = false;
    if (term.halfTermStart && term.halfTermEnd) {
        if (currentMonday >= term.halfTermStart && currentMonday <= term.halfTermEnd) {
            isHoliday = true;
        }
    }

    if (!isHoliday) {
       weeks.push({
        weekNumber: weekCounter === 1 ? 1 : 2,
        startDate: new Date(currentMonday),
        displayString: `${formatDate(currentMonday)} - ${formatDate(endOfWeek)}`
      });

      // Toggle week type for next week
      weekCounter = weekCounter === 1 ? 2 : 1;
    } else {
      // Returning from the half-term break restarts the cycle at Week 1.
      weekCounter = 1;
    }

    // Move to next week
    currentMonday = addDays(currentMonday, 7);
    safeGuard++;
  }
  
  return weeks;
};