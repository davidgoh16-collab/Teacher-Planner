const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');

/**
 * Teacher Planner as a Mac app.
 *
 * It loads the deployed web app rather than the bundled build. That's a deliberate trade: Firebase
 * only accepts sign-in from an authorised domain, and a file:// page isn't one — signing in from a
 * local build needs a system-browser OAuth loopback flow and a Desktop OAuth client that doesn't
 * exist. Pointing at the real origin means sign-in works today, the app is never out of date, and
 * the agent's /api routes (which only exist on the server) work unchanged.
 *
 * The cost is that it needs a connection to start. Once it's open, Firestore's own cache covers
 * going offline.
 */
// Cloud Run answers on two hostnames for this service; only this one is in Firebase's
// authorised-domains list, and sign-in fails with auth/unauthorized-domain on the other.
// Don't "tidy" it to the shorter form.
const APP_URL = process.env.TEACHER_PLANNER_DESKTOP_URL
  || 'https://teacher-planner-982739442942.europe-west2.run.app';

// Signing in opens a real popup window. These are the only origins allowed to become one;
// everything else goes to the default browser. Microsoft is here because Teacher Planner offers
// Microsoft SSO — the popup starts at Firebase's handler and then navigates to Microsoft, so
// without that origin the popup gets punted to the browser mid-flow and sign-in hangs.
const POPUP_ORIGINS = [
  'https://school-apps-52c7d.firebaseapp.com', // Firebase's auth handler
  'https://accounts.google.com',
  'https://login.microsoftonline.com',
  'https://login.live.com',                    // personal Microsoft accounts redirect here
];

let mainWindow = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 420,
    minHeight: 600,
    title: 'Teacher Planner',
    backgroundColor: '#faf7f2',
    // A standard title bar, not hiddenInset: the page is a web layout that puts content at y=0,
    // and inset traffic lights would sit on top of it.

    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      // The renderer gets no Node and no direct access to this process.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(APP_URL).catch(showLoadFailure);

  mainWindow.webContents.on('did-fail-load', (_event, _code, description) => {
    showLoadFailure(new Error(description));
  });

  // The sign-in popup has to open here — Firebase talks to it by postMessage, so sending it to the
  // browser leaves the app waiting forever. Everything else is a link, and links belong in the
  // browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (POPUP_ORIGINS.some((origin) => url.startsWith(origin + '/'))) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520, height: 680, autoHideMenuBar: true,
          webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
        },
      };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(APP_URL)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
};

const showLoadFailure = (error) => {
  dialog.showMessageBox({
    type: 'warning',
    title: 'Teacher Planner',
    message: "Couldn't reach Teacher Planner",
    detail:
      `Teacher Planner needs a connection to start up, because signing in has to happen on its `
      + `real web address.\n\nOnce it's open, your planner keeps working offline.`
      + `\n\n(${error?.message ?? 'unknown error'})`,
    buttons: ['Try again', 'Quit'],
    defaultId: 0,
  }).then(({ response }) => {
    if (response === 0) mainWindow?.loadURL(APP_URL).catch(() => {});
    else app.quit();
  });
};

// Two copies sharing a user-data directory is not a near-miss — Chromium's IndexedDB lock is held
// by whichever started first, so the second one sits on the loading spinner forever with nothing
// in the console. Firebase Auth stores its session in IndexedDB (and Firestore its offline cache),
// so it simply never reports back.
if (!app.isPackaged) {
  // A dev run and the installed app would otherwise collide. Give the dev run its own directory
  // so both can be open at once.
  app.setPath('userData', `${app.getPath('userData')}-dev`);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
