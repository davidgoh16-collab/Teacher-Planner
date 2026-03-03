import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, addDoc, query, where } from 'firebase/firestore';
import { Colleague, WeeklyTimetable } from '../types';
import { INITIAL_COLLEAGUES } from '../src/data/initialColleagues';

const COLLECTION_NAME = 'colleagues';

export const seedDatabase = async (): Promise<void> => {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    
    for (const colleague of INITIAL_COLLEAGUES) {
        const exists = querySnapshot.docs.some(d => d.data().name === colleague.name);
        if (!exists) {
            console.log(`Adding missing hardcoded colleague: ${colleague.name}`);
            await addDoc(collection(db, COLLECTION_NAME), colleague);
        }
    }
  } catch (error) {
    console.error("Error seeding database:", error);
  }
};

export const fetchColleagues = async (): Promise<Colleague[]> => {
  const colleagues: Colleague[] = [];
  try {
    // Ensure seed is run or checked before fetching? 
    // Better to call seedDatabase explicitly in the component, but we can do a quick check here or just fetch.
    // Let's just fetch. The component will handle seeding on mount.
    
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      colleagues.push({
        id: docSnap.id,
        name: data.name,
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
      week1: colleague.week1,
      week2: colleague.week2,
    };
    
    if (colleague.timetableImage) {
      dataToSave.timetableImage = colleague.timetableImage;
    }
    if (colleague.timetableMimeType) {
      dataToSave.timetableMimeType = colleague.timetableMimeType;
    }

    // Use addDoc to let Firestore generate a unique ID
    await addDoc(collection(db, COLLECTION_NAME), dataToSave);
  } catch (error) {
    console.error("Error saving colleague:", error);
    throw error;
  }
};

export const deleteColleague = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  } catch (error) {
    console.error("Error deleting colleague:", error);
    throw error;
  }
};
