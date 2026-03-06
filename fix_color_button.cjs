const fs = require('fs');

let pp = fs.readFileSync('components/ProjectPlanner.tsx', 'utf8');

// The active tab button for routines has blue text, we need it to be green.
pp = pp.replace(/text-blue-700 dark:text-blue-300 shadow-sm/g, 'text-green-700 dark:text-green-300 shadow-sm');
fs.writeFileSync('components/ProjectPlanner.tsx', pp);
