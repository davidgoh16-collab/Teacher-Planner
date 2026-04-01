import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { Term, WeeklyTimetable } from '../types';
import { TERMS, TIMETABLE_WEEK_1, TIMETABLE_WEEK_2 } from '../constants';

const TERMS_COLLECTION = 'teacher_planner_terms';
const TIMETABLES_COLLECTION = 'teacher_planner_timetables';

export const fetchTerms = async (): Promise<Term[]> => {
  const terms: Term[] = [];
  try {
    const querySnapshot = await getDocs(collection(db, TERMS_COLLECTION));
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      terms.push({
        id: docSnap.id,
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
    await setDoc(doc(db, TERMS_COLLECTION, term.id), dataToSave);
  } catch (error) {
    console.error("Error saving term:", error);
    throw error;
  }
};

export const deleteTerm = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, TERMS_COLLECTION, id));
  } catch (error) {
    console.error("Error deleting term:", error);
    throw error;
  }
};

export const fetchTimetables = async (): Promise<{ week1: WeeklyTimetable | null, week2: WeeklyTimetable | null }> => {
  let week1: WeeklyTimetable | null = null;
  let week2: WeeklyTimetable | null = null;
  try {
    const querySnapshot = await getDocs(collection(db, TIMETABLES_COLLECTION));
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

export const saveTimetable = async (weekId: 'week1' | 'week2', timetable: WeeklyTimetable): Promise<void> => {
  try {
    await setDoc(doc(db, TIMETABLES_COLLECTION, weekId), timetable);
  } catch (error) {
    console.error(`Error saving timetable ${weekId}:`, error);
    throw error;
  }
};

export const migrateInitialDataIfNeeded = async (): Promise<boolean> => {
  try {
    const [terms, timetables] = await Promise.all([
      fetchTerms(),
      fetchTimetables()
    ]);

    let migrated = false;
    const batch = writeBatch(db);

    // Migrate Terms if none exist
    if (terms.length === 0) {
      console.log("Migrating static TERMS to Firestore...");
      TERMS.forEach(term => {
        const termRef = doc(db, TERMS_COLLECTION, term.id);
        batch.set(termRef, {
          name: term.name,
          startDate: term.startDate,
          endDate: term.endDate,
          halfTermStart: term.halfTermStart || null,
          halfTermEnd: term.halfTermEnd || null,
        });
      });
      migrated = true;
    }

    // Migrate Timetables if they don't exist
    if (!timetables.week1) {
      console.log("Migrating static TIMETABLE_WEEK_1 to Firestore...");
      const week1Ref = doc(db, TIMETABLES_COLLECTION, 'week1');
      batch.set(week1Ref, TIMETABLE_WEEK_1);
      migrated = true;
    }

    if (!timetables.week2) {
      console.log("Migrating static TIMETABLE_WEEK_2 to Firestore...");
      const week2Ref = doc(db, TIMETABLES_COLLECTION, 'week2');
      batch.set(week2Ref, TIMETABLE_WEEK_2);
      migrated = true;
    }

    if (migrated) {
      await batch.commit();
      console.log("Migration complete.");
    }

    return migrated;
  } catch (error) {
    console.error("Error during initial data migration:", error);
    return false;
  }
};