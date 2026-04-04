## 2025-03-05 - Hardcoded Firebase API Key
**Vulnerability:** A hardcoded Firebase API Key (`AIza...`) was discovered directly in the `firebase.ts` configuration object.
**Learning:** This existed because standard Firebase initialization instructions from Google often suggest directly pasting configuration blocks containing the key into source files, lacking immediate emphasis on environmental segregation, particularly for single-page applications.
**Prevention:** Always verify that environment variables (e.g., `import.meta.env.VITE_FIREBASE_API_KEY` or custom runtime injection via `window.ENV`) are utilized for any keys, tokens, or credentials across the codebase instead of hardcoded strings. Expand this practice automatically to Dockerfiles and build scripts.
