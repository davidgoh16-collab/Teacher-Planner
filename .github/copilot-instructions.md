# Teacher Planner — Project Guidelines & Memory

## Overview & Architecture
Teacher lesson planning, timetable management, and AI agent platform.
- **Tech Stack**: React, TypeScript, Capacitor Android, Sage UI

## Key Technical Constraints & Rules
- **UI**: Full Sage UI redesign.
- **Android / Capacitor**: Native auth with Microsoft custom-token bridge, offline timetable access.
- **Agent Platform**: Teacher agent platform integrations.

## Universal Safety & Workflow Directives
1. **Protect User API Credit**:
   - App API keys are strictly for live student/production budgets.
   - NEVER make paid API calls or run automated tasks consuming David's API credit during development or testing. Prefer build-time generation or local mocking.
2. **Verify Project Before Firebase Deployment**:
   - Always confirm the currently active project (`firebase use`) before executing any deployment. Never trust a failed `firebase use` switch.
3. **Safeguarding Integrity**:
   - Client-side distress and safeguarding screens must never be disabled, weakened, or bypassed in school/student applications.
4. **Testing Rules**:
   - Test Firestore rules using the local emulator rather than relying solely on the live Rules API.
5. **Cross-Device Handovers**:
   - When concluding a major session, summarize status in `docs/handovers/latest-handover.md` and commit alongside code changes.
