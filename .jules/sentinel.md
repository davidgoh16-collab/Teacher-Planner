## 2025-05-02 - Removed Hardcoded Firebase API Key
**Vulnerability:** A hardcoded Firebase API key was found in `firebase.ts`. This could expose the project's backend infrastructure to unauthorized access.
**Learning:** Even if the project seems to be a client-side application, embedding sensitive keys directly in the source code exposes them in version control.
**Prevention:** Always use environment variables (e.g., `VITE_FIREBASE_API_KEY`) to store sensitive keys, and ensure they are properly injected during build and deployment processes (e.g., via `start-nginx.sh`).

## 2025-05-02 - Stored XSS via un-sanitized user-provided URLs
**Vulnerability:** User-provided URLs for apps, lessons, and project links were directly rendered into `href` attributes in React components (e.g., `components/HomePage.tsx`, `components/AppsHub.tsx`, etc.) and `window.open` calls without protocol sanitization. This allowed execution of malicious scripts if a user submitted a URL starting with `javascript:`, `vbscript:`, or `data:`.
**Learning:** React's built-in XSS protection does not cover `href` attribute values containing `javascript:` URIs. Normalization logic (e.g., prepending `https://` if missing) must explicitly block dangerous protocols first.
**Prevention:** Always validate and sanitize user-provided URLs before rendering them into `href` attributes or passing them to `window.open`. Use a dedicated utility function (e.g., `sanitizeUrl`) that explicitly blocks dangerous protocols and normalizes safe ones.
