const fs = require('fs');

let rt = fs.readFileSync('components/RoutineTasksView.tsx', 'utf8');

// Update button from blue to green.
rt = rt.replace(/bg-blue-600 hover:bg-blue-700/g, 'bg-green-600 hover:bg-green-700');
rt = rt.replace(/focus:ring-blue-500/g, 'focus:ring-green-500');

// Update the header icon text color to match the UI scheme
rt = rt.replace(/text-blue-500/g, 'text-green-500');

// Update the header bg color
rt = rt.replace(/bg-blue-50\/50 dark:bg-blue-900\/10/g, 'bg-green-50/50 dark:bg-green-900/10');

fs.writeFileSync('components/RoutineTasksView.tsx', rt);
