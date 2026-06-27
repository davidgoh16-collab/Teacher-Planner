import { LessonPlan } from '../types';
import { getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { userCol, userDocRef } from './userScope';

const COLLECTION_NAME = 'lessonPlans';

/**
 * Fetches all lesson plans for the current user.
 */
export const fetchLessonPlans = async (): Promise<Record<string, LessonPlan>> => {
  const plans: Record<string, LessonPlan> = {};

  try {
    const querySnapshot = await getDocs(userCol(COLLECTION_NAME));
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();

      // Backward compatibility: Handle legacy 'link' field
      let links: string[] = [];
      if (Array.isArray(data.links)) {
        links = data.links;
      } else if (data.link && typeof data.link === 'string') {
        links = [data.link];
      }

      const plan: LessonPlan = {
        id: docSnap.id,
        dateStr: data.dateStr,
        periodLabel: data.periodLabel,
        title: data.title || '',
        links: links,
        notes: data.notes || '',
        completed: !!data.completed,
        type: data.type || 'lesson'
      };

      // The document ID is the key (e.g. "2025-09-02_Period 2")
      plans[docSnap.id] = plan;
    });
  } catch (error) {
    console.error("Error fetching lesson plans from Firebase:", error);
  }

  return plans;
};

/**
 * Saves or updates a single lesson plan for the current user.
 */
export const saveLessonPlan = async (lesson: LessonPlan): Promise<void> => {
  try {
    const dataToSave = {
        id: lesson.id,
        dateStr: lesson.dateStr,
        periodLabel: lesson.periodLabel,
        title: lesson.title || '',
        links: lesson.links || [],
        notes: lesson.notes || '',
        completed: !!lesson.completed,
        type: lesson.type || 'lesson'
    };

    await setDoc(userDocRef(COLLECTION_NAME, lesson.id), dataToSave);
  } catch (error) {
    console.error("Error saving lesson plan to Firebase:", error);
    throw error;
  }
};

/**
 * Deletes a lesson plan for the current user.
 */
export const deleteLessonPlan = async (id: string): Promise<void> => {
  try {
    await deleteDoc(userDocRef(COLLECTION_NAME, id));
  } catch (error) {
    console.error("Error deleting lesson plan from Firebase:", error);
    throw error;
  }
};
