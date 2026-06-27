import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { AcademicYear, Term, WeeklyTimetable } from '../../types';
import { fetchAcademicYears, fetchTerms, fetchTimetables, migrateInitialDataIfNeeded } from '../../services/plannerDataService';
import { bootstrapUser } from '../../services/migrationService';
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
  const [terms, setTerms] = useState<Term[]>([]);
  const [timetableWeek1, setTimetableWeek1] = useState<WeeklyTimetable>({});
  const [timetableWeek2, setTimetableWeek2] = useState<WeeklyTimetable>({});
  const [isPlannerDataLoading, setIsPlannerDataLoading] = useState<boolean>(true);

  const lastFetchedYearId = useRef<string | null>(null);

  const loadData = async (yearIdToLoad?: string | null) => {
    const user = auth.currentUser;
    if (!user) {
      setIsPlannerDataLoading(false);
      return;
    }
    setIsPlannerDataLoading(true);
    try {
      // Ensure the profile exists + any one-time migration has run before touching planner data.
      await bootstrapUser(user);
      await migrateInitialDataIfNeeded();

      const fetchedYears = await fetchAcademicYears();
      setAcademicYears(fetchedYears);

      let targetYearId = yearIdToLoad;
      if (!targetYearId && fetchedYears.length > 0) {
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
        setTimetableWeek1(fetchedTimetables.week1 || {});
        setTimetableWeek2(fetchedTimetables.week2 || {});
      }

    } catch (error) {
      console.error('Failed to fetch dynamic planner data:', error);
    } finally {
      setIsPlannerDataLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        loadData(selectedAcademicYearId);
      } else {
        // Signed out: clear any previous user's data and stop loading.
        setAcademicYears([]);
        setTerms([]);
        setTimetableWeek1({});
        setTimetableWeek2({});
        setSelectedAcademicYearId(null);
        lastFetchedYearId.current = null;
        setIsPlannerDataLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // When selected year changes via UI, reload data for that year
  useEffect(() => {
     if (selectedAcademicYearId && selectedAcademicYearId !== lastFetchedYearId.current) {
         lastFetchedYearId.current = selectedAcademicYearId;
         loadData(selectedAcademicYearId);
     }
  }, [selectedAcademicYearId]);

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
