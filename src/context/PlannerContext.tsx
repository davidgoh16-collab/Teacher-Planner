import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Term, WeeklyTimetable } from '../../types';
import { fetchTerms, fetchTimetables, migrateInitialDataIfNeeded } from '../../services/plannerDataService';
import { TERMS, TIMETABLE_WEEK_1, TIMETABLE_WEEK_2 } from '../../constants';
import { auth } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';

interface PlannerContextProps {
  terms: Term[];
  timetableWeek1: WeeklyTimetable;
  timetableWeek2: WeeklyTimetable;
  isPlannerDataLoading: boolean;
  refreshPlannerData: () => Promise<void>;
}

const PlannerContext = createContext<PlannerContextProps | undefined>(undefined);

export const PlannerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [terms, setTerms] = useState<Term[]>(TERMS);
  const [timetableWeek1, setTimetableWeek1] = useState<WeeklyTimetable>(TIMETABLE_WEEK_1);
  const [timetableWeek2, setTimetableWeek2] = useState<WeeklyTimetable>(TIMETABLE_WEEK_2);
  const [isPlannerDataLoading, setIsPlannerDataLoading] = useState<boolean>(true);

  const loadData = async () => {
    setIsPlannerDataLoading(true);
    try {
      await migrateInitialDataIfNeeded();

      const [fetchedTerms, fetchedTimetables] = await Promise.all([
        fetchTerms(),
        fetchTimetables(),
      ]);

      if (fetchedTerms.length > 0) {
        setTerms(fetchedTerms);
      }
      if (fetchedTimetables.week1) {
        setTimetableWeek1(fetchedTimetables.week1);
      }
      if (fetchedTimetables.week2) {
        setTimetableWeek2(fetchedTimetables.week2);
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
        loadData();
      } else {
        setIsPlannerDataLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <PlannerContext.Provider
      value={{
        terms,
        timetableWeek1,
        timetableWeek2,
        isPlannerDataLoading,
        refreshPlannerData: loadData,
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
