## 2025-05-02 - Removed Hardcoded Firebase API Key
**Vulnerability:** A hardcoded Firebase API key was found in `firebase.ts`. This could expose the project's backend infrastructure to unauthorized access.
**Learning:** Even if the project seems to be a client-side application, embedding sensitive keys directly in the source code exposes them in version control.
**Prevention:** Always use environment variables (e.g., `VITE_FIREBASE_API_KEY`) to store sensitive keys, and ensure they are properly injected during build and deployment processes (e.g., via `start-nginx.sh`).
