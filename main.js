const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, globalShortcut, nativeImage } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store();
let mainWindow;
let settingsWindow;
let tray;

const createMainWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
};

const createSettingsWindow = () => {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 600,
    height: 500,
    parent: mainWindow,
    modal: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    resizable: false
  });

  settingsWindow.loadFile('settings.html');

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
};

const createTray = () => {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  const trayIcon = nativeImage.createFromPath(iconPath);
  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        mainWindow.show();
      }
    },
    {
      label: 'Settings',
      click: () => {
        createSettingsWindow();
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip('Wituz Webcam');

  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
};

const registerGlobalShortcuts = () => {
  const shortcut = store.get('globalShortcut', 'CommandOrControl+Shift+R');
  
  if (globalShortcut.isRegistered(shortcut)) {
    globalShortcut.unregister(shortcut);
  }

  const registered = globalShortcut.register(shortcut, () => {
    mainWindow.webContents.send('toggle-recording');
  });

  if (!registered) {
    console.log('Global shortcut registration failed');
  }
};

app.whenReady().then(() => {
  createMainWindow();
  createTray();
  registerGlobalShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// IPC handlers
ipcMain.handle('get-settings', () => {
  return {
    outputPath: store.get('outputPath', app.getPath('videos')),
    selectedDevice: store.get('selectedDevice', ''),
    resolution: store.get('resolution', '1280x720'),
    frameRate: store.get('frameRate', 30),
    globalShortcut: store.get('globalShortcut', 'CommandOrControl+Shift+R'),
    recordAudio: store.get('recordAudio', true)
  };
});

ipcMain.handle('save-settings', (event, settings) => {
  store.set('outputPath', settings.outputPath);
  store.set('selectedDevice', settings.selectedDevice);
  store.set('resolution', settings.resolution);
  store.set('frameRate', settings.frameRate);
  store.set('globalShortcut', settings.globalShortcut);
  store.set('recordAudio', settings.recordAudio);
  
  // Re-register global shortcut if it changed
  registerGlobalShortcuts();
  
  // Notify main window that settings changed
  if (mainWindow) {
    mainWindow.webContents.send('settings-changed');
  }
  
  return true;
});

ipcMain.handle('select-output-folder', async () => {
  const result = await dialog.showOpenDialog(settingsWindow || mainWindow, {
    properties: ['openDirectory'],
    defaultPath: store.get('outputPath', app.getPath('videos'))
  });
  
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('open-settings', () => {
  createSettingsWindow();
});

ipcMain.handle('save-recording', async (event, buffer, filename) => {
  const outputPath = store.get('outputPath', app.getPath('videos'));
  const filePath = path.join(outputPath, filename);
  
  try {
    const fs = require('fs');
    fs.writeFileSync(filePath, buffer);
    return filePath;
  } catch (error) {
    console.error('Error saving recording:', error);
    throw error;
  }
});