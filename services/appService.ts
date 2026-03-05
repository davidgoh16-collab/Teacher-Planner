import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { AppItem } from '../types';

const APPS_COLLECTION = 'teacher_planner_apps';

export const fetchApps = async (): Promise<AppItem[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, APPS_COLLECTION));
        return querySnapshot.docs.map(docSnap => docSnap.data() as AppItem).sort((a, b) => b.createdAt - a.createdAt);
    } catch (e) {
        console.error("Error fetching apps", e);
        return [];
    }
};

export const saveApp = async (app: AppItem): Promise<void> => {
    try {
        await setDoc(doc(db, APPS_COLLECTION, app.id), app);
    } catch (e) {
        console.error("Error saving app", e);
        throw e;
    }
};

export const deleteApp = async (id: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, APPS_COLLECTION, id));
    } catch (e) {
        console.error("Error deleting app", e);
        throw e;
    }
};
