const fs = require('fs');

let rt = fs.readFileSync('components/RoutineTasksView.tsx', 'utf8');
rt = rt.replace(/const data = await fetchRoutineTasks\(\);/, 'const data = await fetchRoutineTasks() || [];');
fs.writeFileSync('components/RoutineTasksView.tsx', rt);
