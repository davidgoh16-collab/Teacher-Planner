const fs = require('fs');

// Ah, wait. Does routine tasks view show its own spinner?
let rt = fs.readFileSync('components/RoutineTasksView.tsx', 'utf8');
if (rt.includes('setLoading(false)')) {
    console.log('RT has setLoading false');
}

// But in my Playwright script, when does the app fail to show the view?
// Actually, `test_routine5.py` showed the main view WITH the spinner instead of rendering the Projects!
// Wait. The screenshot `routines5.png` from Playwright showed the main app layout but NO project cards and JUST A SPINNER.
// So `ProjectPlanner`'s `loading` state must be true!
// Oh, `fetchProjects` returns `[]`.
// Wait, the spinner is small and green.
// Is it the AIInsightsPanel?
// Let's check AIInsightsPanel.tsx
let ai = fs.readFileSync('components/AIInsightsPanel.tsx', 'utf8');
if (ai.includes('animate-spin') || ai.includes('Loader2')) {
    console.log('AI has a spinner');
}
