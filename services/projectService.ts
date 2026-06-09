import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Project, Task, Category, Idea, KeyDate } from '../types';

const PROJECTS_COLLECTION = 'teacher_planner_projects';
const TASKS_COLLECTION = 'teacher_planner_tasks';
const KEY_DATES_COLLECTION = 'teacher_planner_key_dates';
const CATEGORIES_COLLECTION = 'teacher_planner_categories';
const IDEAS_COLLECTION = 'teacher_planner_ideas';

export const fetchCategories = async (): Promise<Category[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, CATEGORIES_COLLECTION));
        return querySnapshot.docs.map(docSnap => docSnap.data() as Category);
    } catch (e) {
        console.error("Error fetching categories", e);
        return [];
    }
};

export const saveCategory = async (category: Category): Promise<void> => {
    try {
        await setDoc(doc(db, CATEGORIES_COLLECTION, category.id), category);
    } catch (e) {
        console.error("Error saving category", e);
        throw e;
    }
};

export const deleteCategory = async (id: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, CATEGORIES_COLLECTION, id));
    } catch (e) {
        console.error("Error deleting category", e);
        throw e;
    }
};

export const fetchProjects = async (): Promise<Project[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, PROJECTS_COLLECTION));
        return querySnapshot.docs.map(docSnap => docSnap.data() as Project).sort((a, b) => b.createdAt - a.createdAt);
    } catch (e) {
        console.error("Error fetching projects", e);
        return [];
    }
};

export const saveProject = async (project: Project): Promise<void> => {
    try {
        await setDoc(doc(db, PROJECTS_COLLECTION, project.id), project);
    } catch (e) {
        console.error("Error saving project", e);
        throw e;
    }
};

export const deleteProject = async (id: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, PROJECTS_COLLECTION, id));
    } catch (e) {
        console.error("Error deleting project", e);
        throw e;
    }
};

export const fetchTasks = async (): Promise<Task[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, TASKS_COLLECTION));
        return querySnapshot.docs.map(docSnap => docSnap.data() as Task);
    } catch (e) {
        console.error("Error fetching tasks", e);
        return [];
    }
};

export const saveTask = async (task: Task): Promise<void> => {
    try {
        await setDoc(doc(db, TASKS_COLLECTION, task.id), task);
    } catch (e) {
        console.error("Error saving task", e);
        console.warn("Ignoring saveTask error for local testing.");
    }
};

export const deleteTask = async (id: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, TASKS_COLLECTION, id));
    } catch (e) {
        console.error("Error deleting task", e);
        console.warn("Ignoring deleteTask error for local testing.");
    }
};

// --- KEY DATES ---

export const fetchKeyDates = async (): Promise<KeyDate[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, KEY_DATES_COLLECTION));
    return querySnapshot.docs.map(docSnap => docSnap.data() as KeyDate);
  } catch (e) {
    console.error("Error fetching key dates", e);
    return [];
  }
};

export const saveKeyDate = async (keyDate: KeyDate): Promise<void> => {
  try {
    await setDoc(doc(db, KEY_DATES_COLLECTION, keyDate.id), keyDate);
  } catch (e) {
    console.error("Error saving key date", e);
  }
};

export const deleteKeyDate = async (keyDateId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, KEY_DATES_COLLECTION, keyDateId));
  } catch (e) {
    console.error("Error deleting key date", e);
  }
};

export const fetchIdeas = async (): Promise<Idea[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, IDEAS_COLLECTION));
        return querySnapshot.docs.map(docSnap => docSnap.data() as Idea).sort((a, b) => b.createdAt - a.createdAt);
    } catch (e) {
        console.error("Error fetching ideas", e);
        return [];
    }
};

export const saveIdea = async (idea: Idea): Promise<void> => {
    try {
        await setDoc(doc(db, IDEAS_COLLECTION, idea.id), idea);
    } catch (e) {
        console.error("Error saving idea", e);
        throw e;
    }
};

export const deleteIdea = async (id: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, IDEAS_COLLECTION, id));
    } catch (e) {
        console.error("Error deleting idea", e);
        throw e;
    }
};
import { RoutineTask } from '../types';

export const fetchRoutineTasks = async (): Promise<RoutineTask[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, 'teacher_planner_routine_tasks'));
    const tasks: RoutineTask[] = [];
    querySnapshot.forEach((docSnap) => {
      tasks.push(docSnap.data() as RoutineTask);
    });
    return tasks;
  } catch (e) {
    console.error("Error fetching routine tasks", e);
    return [];
  }
};

export const saveRoutineTask = async (task: RoutineTask): Promise<void> => {
  try { await setDoc(doc(db, 'teacher_planner_routine_tasks', task.id), task); } catch (e) {}
};

export const deleteRoutineTask = async (id: string): Promise<void> => {
  try { await deleteDoc(doc(db, 'teacher_planner_routine_tasks', id)); } catch (e) {}
};
