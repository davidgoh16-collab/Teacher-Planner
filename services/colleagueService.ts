import { doc, getDocs, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { Colleague, WeeklyTimetable } from '../types';
import { userCol, userDocRef } from './userScope';

const COLLECTION_NAME = 'colleagues';

export const fetchColleagues = async (): Promise<Colleague[]> => {
  const colleagues: Colleague[] = [];
  try {
    const querySnapshot = await getDocs(userCol(COLLECTION_NAME));
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      colleagues.push({
        id: docSnap.id,
        name: data.name,
        type: data.type === 'student' ? 'student' : 'staff',
        week1: data.week1 as WeeklyTimetable,
        week2: data.week2 as WeeklyTimetable,
        timetableImage: data.timetableImage,
        timetableMimeType: data.timetableMimeType,
      });
    });
  } catch (error) {
    console.error("Error fetching colleagues:", error);
  }
  return colleagues;
};

export const saveColleague = async (colleague: Omit<Colleague, 'id'>): Promise<void> => {
  try {
    const dataToSave: any = {
      name: colleague.name,
      type: colleague.type || 'staff',
      week1: colleague.week1,
      week2: colleague.week2,
    };
    if (colleague.timetableImage) dataToSave.timetableImage = colleague.timetableImage;
    if (colleague.timetableMimeType) dataToSave.timetableMimeType = colleague.timetableMimeType;

    await addDoc(userCol(COLLECTION_NAME), dataToSave);
  } catch (error) {
    console.error("Error saving colleague:", error);
    throw error;
  }
};

export const deleteColleague = async (id: string): Promise<void> => {
  try {
    await deleteDoc(userDocRef(COLLECTION_NAME, id));
  } catch (error) {
    console.error("Error deleting colleague:", error);
    throw error;
  }
};
