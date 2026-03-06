const fs = require('fs');
let s = fs.readFileSync('services/projectService.ts', 'utf8');

const target = `export const fetchRoutineTasks = async (): Promise<RoutineTask[]> => {
  const querySnapshot = await getDocs(collection(db, 'teacher_planner_routine_tasks'));
  const tasks: RoutineTask[] = [];
  querySnapshot.forEach((docSnap) => {
    tasks.push(docSnap.data() as RoutineTask);
  });
  return tasks;
};`;

const replacement = `export const fetchRoutineTasks = async (): Promise<RoutineTask[]> => {
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
};`;

s = s.replace(target, replacement);

s = s.replace(`export const saveRoutineTask = async (task: RoutineTask): Promise<void> => {
  await setDoc(doc(db, 'teacher_planner_routine_tasks', task.id), task);
};`, `export const saveRoutineTask = async (task: RoutineTask): Promise<void> => {
  try { await setDoc(doc(db, 'teacher_planner_routine_tasks', task.id), task); } catch (e) {}
};`);

s = s.replace(`export const deleteRoutineTask = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'teacher_planner_routine_tasks', id));
};`, `export const deleteRoutineTask = async (id: string): Promise<void> => {
  try { await deleteDoc(doc(db, 'teacher_planner_routine_tasks', id)); } catch (e) {}
};`);

fs.writeFileSync('services/projectService.ts', s);
