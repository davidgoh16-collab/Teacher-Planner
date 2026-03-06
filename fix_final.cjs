const fs = require('fs');

let pv = fs.readFileSync('components/ProjectPlanner.tsx', 'utf8');
if (!pv.includes('import RoutineTasksView')) {
    // Add import for RoutineTasksView
    pv = pv.replace(/import TaskEditModal from '.\/TaskEditModal';/, `import TaskEditModal from './TaskEditModal';\nimport RoutineTasksView from './RoutineTasksView';`);
}
fs.writeFileSync('components/ProjectPlanner.tsx', pv);

let tm = fs.readFileSync('components/TaskEditModal.tsx', 'utf8');
if (!tm.includes('Project')) {
    tm = tm.replace(/import { Task, Category } from '..\/types';/, `import { Task, Category, Project } from '../types';`);
}
fs.writeFileSync('components/TaskEditModal.tsx', tm);
