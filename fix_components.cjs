const fs = require('fs');

// Ensure no error is causing the spinner to stay infinite.
// Ah, `fetchRoutineTasks` was added to projectService, but we must make sure projectService is correctly formatted.
// Wait, when I ran `npm run dev`, did the browser console log an error about missing `fetchRoutineTasks` from `../services/projectService`?

let app = fs.readFileSync('services/projectService.ts', 'utf8');
if (!app.includes('fetchRoutineTasks')) {
    console.log("fetchRoutineTasks is missing from projectService.ts!");
} else {
    console.log("fetchRoutineTasks is present in projectService.ts.");
}
