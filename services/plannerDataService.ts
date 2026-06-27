import { getDocs, deleteDoc, setDoc } from 'firebase/firestore';
import { AcademicYear, Term, WeeklyTimetable } from '../types';
import { userCol, userDocRef } from './userScope';

const ACADEMIC_YEARS_COLLECTION = 'teacher_planner_academic_years';
const TERMS_COLLECTION = 'teacher_planner_terms';
const TIMETABLES_COLLECTION = 'teacher_planner_timetables';

export const fetchAcademicYears = async (): Promise<AcademicYear[]> => {
  const years: AcademicYear[] = [];
  try {
    const querySnapshot = await getDocs(userCol(ACADEMIC_YEARS_COLLECTION));
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      years.push({
        id: docSnap.id,
        name: data.name,
        isDefault: data.isDefault || false,
      });
    });
  } catch (error) {
    console.error("Error fetching academic years:", error);
  }
  return years.sort((a, b) => b.name.localeCompare(a.name));
};

export const saveAcademicYear = async (year: AcademicYear): Promise<void> => {
  try {
    await setDoc(userDocRef(ACADEMIC_YEARS_COLLECTION, year.id), {
      name: year.name,
      isDefault: year.isDefault
    });
  } catch (error) {
    console.error("Error saving academic year:", error);
    throw error;
  }
};

export const deleteAcademicYear = async (id: string): Promise<void> => {
  try {
    await deleteDoc(userDocRef(ACADEMIC_YEARS_COLLECTION, id));
  } catch (error) {
    console.error("Error deleting academic year:", error);
    throw error;
  }
};


export const fetchTerms = async (academicYearId: string): Promise<Term[]> => {
  const terms: Term[] = [];
  try {
    const querySnapshot = await getDocs(userCol(ACADEMIC_YEARS_COLLECTION, academicYearId, TERMS_COLLECTION));
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      terms.push({
        id: docSnap.id,
        academicYearId,
        name: data.name,
        startDate: data.startDate.toDate(),
        endDate: data.endDate.toDate(),
        halfTermStart: data.halfTermStart ? data.halfTermStart.toDate() : undefined,
        halfTermEnd: data.halfTermEnd ? data.halfTermEnd.toDate() : undefined,
      });
    });
  } catch (error) {
    console.error("Error fetching terms:", error);
  }
  return terms.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
};

export const saveTerm = async (term: Term): Promise<void> => {
  try {
    const dataToSave = {
      name: term.name,
      startDate: term.startDate,
      endDate: term.endDate,
      halfTermStart: term.halfTermStart || null,
      halfTermEnd: term.halfTermEnd || null,
    };
    await setDoc(userDocRef(ACADEMIC_YEARS_COLLECTION, term.academicYearId, TERMS_COLLECTION, term.id), dataToSave);
  } catch (error) {
    console.error("Error saving term:", error);
    throw error;
  }
};

export const deleteTerm = async (academicYearId: string, id: string): Promise<void> => {
  try {
    await deleteDoc(userDocRef(ACADEMIC_YEARS_COLLECTION, academicYearId, TERMS_COLLECTION, id));
  } catch (error) {
    console.error("Error deleting term:", error);
    throw error;
  }
};

export const fetchTimetables = async (academicYearId: string): Promise<{ week1: WeeklyTimetable | null, week2: WeeklyTimetable | null }> => {
  let week1: WeeklyTimetable | null = null;
  let week2: WeeklyTimetable | null = null;
  try {
    const querySnapshot = await getDocs(userCol(ACADEMIC_YEARS_COLLECTION, academicYearId, TIMETABLES_COLLECTION));
    querySnapshot.forEach((docSnap) => {
      if (docSnap.id === 'week1') {
        week1 = docSnap.data() as WeeklyTimetable;
      } else if (docSnap.id === 'week2') {
        week2 = docSnap.data() as WeeklyTimetable;
      }
    });
  } catch (error) {
    console.error("Error fetching timetables:", error);
  }
  return { week1, week2 };
};

export const saveTimetable = async (academicYearId: string, weekId: 'week1' | 'week2', timetable: WeeklyTimetable): Promise<void> => {
  try {
    await setDoc(userDocRef(ACADEMIC_YEARS_COLLECTION, academicYearId, TIMETABLES_COLLECTION, weekId), timetable);
  } catch (error) {
    console.error(`Error saving timetable ${weekId}:`, error);
    throw error;
  }
};

/**
 * New users start with a completely empty planner — no academic year, terms, or timetables are
 * seeded. They create these during onboarding (or in Settings); the migrated original owner keeps
 * their real data via migrationService. Kept as a no-op so PlannerContext's call site is unchanged.
 */
export const migrateInitialDataIfNeeded = async (): Promise<boolean> => false;
