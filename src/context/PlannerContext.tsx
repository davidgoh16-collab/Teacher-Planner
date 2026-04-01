import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AcademicYear, Term, WeeklyTimetable } from '../../types';
import { fetchAcademicYears, fetchTerms, fetchTimetables, migrateInitialDataIfNeeded } from '../../services/plannerDataService';
import { TERMS, TIMETABLE_WEEK_1, TIMETABLE_WEEK_2 } from '../../constants';
import { auth } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';

interface PlannerContextProps {
  academicYears: AcademicYear[];
  selectedAcademicYearId: string | null;
  setSelectedAcademicYearId: (id: string) => void;
  terms: Term[];
  timetableWeek1: WeeklyTimetable;
  timetableWeek2: WeeklyTimetable;
  isPlannerDataLoading: boolean;
  refreshPlannerData: () => Promise<void>;
}

const PlannerContext = createContext<PlannerContextProps | undefined>(undefined);

export const PlannerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string | null>(null);
  const [terms, setTerms] = useState<Term[]>(TERMS);
  const [timetableWeek1, setTimetableWeek1] = useState<WeeklyTimetable>(TIMETABLE_WEEK_1);
  const [timetableWeek2, setTimetableWeek2] = useState<WeeklyTimetable>(TIMETABLE_WEEK_2);
  const [isPlannerDataLoading, setIsPlannerDataLoading] = useState<boolean>(true);

  const loadData = async (yearIdToLoad?: string | null) => {
    setIsPlannerDataLoading(true);
    try {
      await migrateInitialDataIfNeeded();

      const fetchedYears = await fetchAcademicYears();
      setAcademicYears(fetchedYears);

      let targetYearId = yearIdToLoad;
      if (!targetYearId && fetchedYears.length > 0) {
        // default to active/first
        const defaultYear = fetchedYears.find(y => y.isDefault) || fetchedYears[0];
        targetYearId = defaultYear.id;
        setSelectedAcademicYearId(targetYearId);
      }

      if (targetYearId) {
        const [fetchedTerms, fetchedTimetables] = await Promise.all([
          fetchTerms(targetYearId),
          fetchTimetables(targetYearId),
        ]);

        setTerms(fetchedTerms);
        setTimetableWeek1(fetchedTimetables.week1 || TIMETABLE_WEEK_1);
        setTimetableWeek2(fetchedTimetables.week2 || TIMETABLE_WEEK_2);
      }

    } catch (error) {
      console.error('Failed to fetch dynamic planner data:', error);
    } finally {
      setIsPlannerDataLoading(false);
    }
  };

  useEffect(() => {
    // If not using auth/bypass, trigger initial load
    const isTestBypass = window.location.search.includes('bypass_login=true');
    if (isTestBypass) {
        loadData(selectedAcademicYearId);
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        loadData(selectedAcademicYearId);
      } else if (!isTestBypass) {
        setIsPlannerDataLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // When selected year changes via UI, reload data for that year
  useEffect(() => {
     if (selectedAcademicYearId && !isPlannerDataLoading) {
         loadData(selectedAcademicYearId);
     }
  }, [selectedAcademicYearId, isPlannerDataLoading]);

  return (
    <PlannerContext.Provider
      value={{
        academicYears,
        selectedAcademicYearId,
        setSelectedAcademicYearId,
        terms,
        timetableWeek1,
        timetableWeek2,
        isPlannerDataLoading,
        refreshPlannerData: () => loadData(selectedAcademicYearId),
      }}
    >
      {children}
    </PlannerContext.Provider>
  );
};

export const usePlannerData = () => {
  const context = useContext(PlannerContext);
  if (!context) {
    throw new Error('usePlannerData must be used within a PlannerProvider');
  }
  return context;
};
