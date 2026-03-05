import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { AppItem, AppCategory } from '../types';

const APPS_COLLECTION = 'teacher_planner_apps';
const APP_CATEGORIES_COLLECTION = 'teacher_planner_app_categories';

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

export const fetchAppCategories = async (): Promise<AppCategory[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, APP_CATEGORIES_COLLECTION));
        return querySnapshot.docs.map(docSnap => docSnap.data() as AppCategory);
    } catch (e) {
        console.error("Error fetching app categories", e);
        return [];
    }
};

export const saveAppCategory = async (category: AppCategory): Promise<void> => {
    try {
        await setDoc(doc(db, APP_CATEGORIES_COLLECTION, category.id), category);
    } catch (e) {
        console.error("Error saving app category", e);
        throw e;
    }
};

export const deleteAppCategory = async (id: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, APP_CATEGORIES_COLLECTION, id));
    } catch (e) {
        console.error("Error deleting app category", e);
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
