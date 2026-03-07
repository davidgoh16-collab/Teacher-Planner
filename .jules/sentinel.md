## 2023-10-27 - Hardcoded Firebase API Key
**Vulnerability:** Found a hardcoded Firebase API Key in `firebase.ts`.
**Learning:** Hardcoding credentials in source code exposes them to anyone with access to the codebase, including version control history. It allows unauthorized access and potential abuse of the service.
**Prevention:** Always use environment variables (`import.meta.env.VITE_FIREBASE_API_KEY` in Vite or `process.env.FIREBASE_API_KEY` in Node.js) to store secrets and inject them securely at runtime. Make sure `.env` files are added to `.gitignore`.
