import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { AcademicYear, Term, WeeklyTimetable } from '../types';
import { TERMS, TIMETABLE_WEEK_1, TIMETABLE_WEEK_2 } from '../constants';

const ACADEMIC_YEARS_COLLECTION = 'teacher_planner_academic_years';
const TERMS_COLLECTION = 'teacher_planner_terms';
const TIMETABLES_COLLECTION = 'teacher_planner_timetables';

export const fetchAcademicYears = async (): Promise<AcademicYear[]> => {
  const years: AcademicYear[] = [];
  try {
    const querySnapshot = await getDocs(collection(db, ACADEMIC_YEARS_COLLECTION));
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
  // Sort alphabetically descending (e.g. 2026/2027 before 2025/2026) or ascending based on preference
  return years.sort((a, b) => b.name.localeCompare(a.name));
};

export const saveAcademicYear = async (year: AcademicYear): Promise<void> => {
  try {
    await setDoc(doc(db, ACADEMIC_YEARS_COLLECTION, year.id), {
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
    await deleteDoc(doc(db, ACADEMIC_YEARS_COLLECTION, id));
  } catch (error) {
    console.error("Error deleting academic year:", error);
    throw error;
  }
};


export const fetchTerms = async (academicYearId: string): Promise<Term[]> => {
  const terms: Term[] = [];
  try {
    // Ideally we should use query(collection, where('academicYearId', '==', academicYearId))
    // but a simple filter works since collection is small, or we can construct a path:
    const termsRef = collection(db, `${ACADEMIC_YEARS_COLLECTION}/${academicYearId}/${TERMS_COLLECTION}`);
    const querySnapshot = await getDocs(termsRef);
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
    const termRef = doc(db, `${ACADEMIC_YEARS_COLLECTION}/${term.academicYearId}/${TERMS_COLLECTION}`, term.id);
    await setDoc(termRef, dataToSave);
  } catch (error) {
    console.error("Error saving term:", error);
    throw error;
  }
};

export const deleteTerm = async (academicYearId: string, id: string): Promise<void> => {
  try {
    const termRef = doc(db, `${ACADEMIC_YEARS_COLLECTION}/${academicYearId}/${TERMS_COLLECTION}`, id);
    await deleteDoc(termRef);
  } catch (error) {
    console.error("Error deleting term:", error);
    throw error;
  }
};

export const fetchTimetables = async (academicYearId: string): Promise<{ week1: WeeklyTimetable | null, week2: WeeklyTimetable | null }> => {
  let week1: WeeklyTimetable | null = null;
  let week2: WeeklyTimetable | null = null;
  try {
    const tablesRef = collection(db, `${ACADEMIC_YEARS_COLLECTION}/${academicYearId}/${TIMETABLES_COLLECTION}`);
    const querySnapshot = await getDocs(tablesRef);
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
    const tableRef = doc(db, `${ACADEMIC_YEARS_COLLECTION}/${academicYearId}/${TIMETABLES_COLLECTION}`, weekId);
    await setDoc(tableRef, timetable);
  } catch (error) {
    console.error(`Error saving timetable ${weekId}:`, error);
    throw error;
  }
};

export const migrateInitialDataIfNeeded = async (): Promise<boolean> => {
  try {
    const academicYears = await fetchAcademicYears();

    if (academicYears.length > 0) return false;

    console.log("Migrating static Data to nested Firestore Academic Years...");

    const batch = writeBatch(db);
    const defaultYearId = 'academic_year_2025_2026';

    // 1. Create Default Academic Year
    const yearRef = doc(db, ACADEMIC_YEARS_COLLECTION, defaultYearId);
    batch.set(yearRef, {
        name: '2025/2026',
        isDefault: true
    });

    // 2. Migrate Terms into this Year
    TERMS.forEach(term => {
      const termRef = doc(db, `${ACADEMIC_YEARS_COLLECTION}/${defaultYearId}/${TERMS_COLLECTION}`, term.id);
      batch.set(termRef, {
        name: term.name,
        startDate: term.startDate,
        endDate: term.endDate,
        halfTermStart: term.halfTermStart || null,
        halfTermEnd: term.halfTermEnd || null,
      });
    });

    // 3. Migrate Timetables into this Year
    const week1Ref = doc(db, `${ACADEMIC_YEARS_COLLECTION}/${defaultYearId}/${TIMETABLES_COLLECTION}`, 'week1');
    batch.set(week1Ref, TIMETABLE_WEEK_1);

    const week2Ref = doc(db, `${ACADEMIC_YEARS_COLLECTION}/${defaultYearId}/${TIMETABLES_COLLECTION}`, 'week2');
    batch.set(week2Ref, TIMETABLE_WEEK_2);

    await batch.commit();
    console.log("Initial structure migration complete.");
    return true;
  } catch (error) {
    console.error("Error during initial data migration:", error);
    return false;
  }
};