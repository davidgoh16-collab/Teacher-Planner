## 2025-03-28 - Removed Hardcoded Firebase API Key
**Vulnerability:** Found a hardcoded Firebase `apiKey` within `firebase.ts`. This exposes credentials publicly, potentially allowing unauthorized read/write access based on database rules.
**Learning:** Config files like `firebase.ts` should never hardcode secrets, even if they are meant for client-side applications. Although client-side Firebase keys are typically public, it is best practice to manage them through environment variables to allow key rotation and different environments (dev/prod).
**Prevention:** Always use `import.meta.env.VITE_VARIABLE` or a runtime injected config (`window.ENV`) for API keys to prevent them from being checked into version control.
