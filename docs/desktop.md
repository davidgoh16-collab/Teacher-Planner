# Teacher Planner on the Mac

A thin Electron wrapper around the deployed web app.

```bash
npm run desktop         # run the wrapper against the deployed app
npm run desktop:build   # build release/Teacher Planner-<version>-arm64.dmg
```

The DMG is **unsigned** (`identity: null`), so the first launch needs right-click → Open → Open.
Signing would need a Developer ID certificate; that's only worth doing if the desktop app is ever
distributed to schools rather than used personally.

## It loads the deployed URL, not `dist/`

`electron/main.cjs` points at `https://teacher-planner-982739442942.europe-west2.run.app`.

That is deliberate. Firebase only accepts sign-in from an authorised domain and a `file://` page
isn't one, so a local build would need a system-browser OAuth loopback flow and a Desktop OAuth
client that doesn't exist. Loading the real origin also means the `/api` routes the agent depends
on work unchanged, and the app is never out of date — a web deploy updates the desktop app too,
with no new DMG.

The cost is that it needs a connection to start; after that Firestore's offline cache takes over.
Override the URL with `TEACHER_PLANNER_DESKTOP_URL` to point at a different deployment.

Because the app is loaded over HTTP from the real origin, the DMG ships only the wrapper
(`files` excludes `node_modules` and `dist`), which is why it is mostly just Electron itself.

## The parts that are load-bearing

**Popup origins.** Sign-in opens a real popup that Firebase talks to by `postMessage`; sending it
to the system browser leaves the app waiting forever. `POPUP_ORIGINS` allows exactly the auth
origins to open as windows and pushes everything else to the browser. Teacher Planner offers
Microsoft SSO, so `login.microsoftonline.com` and `login.live.com` are in that list alongside the
Firebase handler and Google — the popup starts at Firebase and then navigates to Microsoft, so
without them sign-in breaks halfway through.

**Separate dev user-data directory.** Two copies sharing one user-data directory is not a
near-miss: Chromium's IndexedDB lock is held by whichever started first, and the second sits on a
loading spinner forever with nothing in the console, because Firebase Auth stores its session in
IndexedDB. Unpackaged runs get a `-dev` suffix so a dev run and the installed app can coexist.

**Single-instance lock.** A second launch focuses the existing window instead of starting a rival
process that would hit the same IndexedDB problem.

## Testing it from a terminal

If you launch the app from a shell inside VS Code (or any Electron-hosted terminal), it may exit
immediately with code 0 and no error, or fail with `Cannot read properties of undefined (reading
'isPackaged')`. That is the host's `ELECTRON_RUN_AS_NODE=1` leaking into the environment, which
makes any Electron binary behave as plain Node — so there is no `app` module and no window. It is
not a bug in the wrapper:

```bash
env -u ELECTRON_RUN_AS_NODE npm run desktop
```

Launching from Finder is unaffected.
