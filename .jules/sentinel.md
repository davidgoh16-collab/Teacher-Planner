## 2024-03-14 - Hardcoded Firebase API Key
**Vulnerability:** A hardcoded Firebase API key was found in `firebase.ts`. This configuration file is checked into source control, exposing the key to anyone with repository access.
**Learning:** This app uses `start-nginx.sh` to inject runtime variables into a globally accessible `window.ENV` object to solve configuration problems in direct git deployments. The missing environment variable pattern caused developers to hardcode keys instead.
**Prevention:** Always use environment variables for keys (e.g. `window.ENV?.VITE_FIREBASE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY`). Also remember to add new keys to the `types.ts` `window.ENV` interface and `start-nginx.sh` script to ensure they are available at runtime.
