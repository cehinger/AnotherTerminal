import { ipcMain, dialog, BrowserWindow } from 'electron';
import { IPC_CHANNELS, ServerConfig, ServerGroup } from '../shared/types';
import * as store from './store';
import * as ssh from './ssh';

export function registerIPC(mainWindow: BrowserWindow): void {
  // Server management
  ipcMain.handle(IPC_CHANNELS.GET_SERVERS, () => {
    return store.getServers();
  });

  ipcMain.handle(IPC_CHANNELS.ADD_SERVER, (_, server: ServerConfig) => {
    return store.addServer(server);
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_SERVER, (_, server: ServerConfig) => {
    return store.updateServer(server);
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_SERVER, (_, id: string) => {
    store.deleteServer(id);
    return true;
  });

  // Group management
  ipcMain.handle(IPC_CHANNELS.GET_GROUPS, () => {
    return store.getGroups();
  });

  ipcMain.handle(IPC_CHANNELS.ADD_GROUP, (_, group: ServerGroup) => {
    return store.addGroup(group);
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_GROUP, (_, oldName: string, group: ServerGroup) => {
    return store.updateGroup(oldName, group);
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_GROUP, (_, name: string) => {
    return store.deleteGroup(name);
  });

  // SSH connections
  ipcMain.handle(IPC_CHANNELS.SSH_CONNECT, async (_, sessionId: string, serverId: string) => {
    console.log(`[IPC] SSH_CONNECT request: session=${sessionId}, server=${serverId}`);
    const server = store.getServerForConnection(serverId);
    if (!server) {
      console.error(`[IPC] Server not found: ${serverId}`);
      throw new Error('Server not found');
    }
    console.log(`[IPC] Connecting to ${server.alias} (${server.host})`);
    await ssh.connectSSH(sessionId, server);
    console.log(`[IPC] SSH connection established for session ${sessionId}`);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.SSH_DISCONNECT, (_, sessionId: string) => {
    ssh.disconnectSSH(sessionId);
    return true;
  });

  ipcMain.on(IPC_CHANNELS.SSH_DATA, (_, sessionId: string, data: string) => {
    ssh.writeToSSH(sessionId, data);
  });

  ipcMain.on(IPC_CHANNELS.SSH_RESIZE, (_, sessionId: string, cols: number, rows: number) => {
    ssh.resizeSSH(sessionId, cols, rows);
  });

  // SSH events -> Renderer
  ssh.setOnData((sessionId, data) => {
    console.log(`[IPC] Sending SSH data to renderer: session=${sessionId}, bytes=${data.length}`);
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.SSH_DATA, sessionId, data);
    }
  });

  ssh.setOnStatus((sessionId, status, error) => {
    console.log(`[IPC] Sending SSH status to renderer: session=${sessionId}, status=${status}`);
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.SSH_STATUS, sessionId, status, error);
    }
  });

  // Master password
  ipcMain.handle(IPC_CHANNELS.HAS_MASTER_PASSWORD, () => {
    return store.hasMasterPassword();
  });

  ipcMain.handle(IPC_CHANNELS.SET_MASTER_PASSWORD, (_, password: string) => {
    try {
      store.setMasterPasswordHash(password);
      return true;
    } catch (err) {
      console.error('[IPC] SET_MASTER_PASSWORD error:', err);
      throw err;
    }
  });

  ipcMain.handle(IPC_CHANNELS.VERIFY_MASTER_PASSWORD, (_, password: string) => {
    return store.verifyMasterPassword(password);
  });

  ipcMain.handle(IPC_CHANNELS.CHANGE_MASTER_PASSWORD, async (_, oldPassword: string, newPassword: string) => {
    return new Promise<boolean>((resolve, reject) => {
      try {
        const result = store.changeMasterPassword(oldPassword, newPassword);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
  });

  ipcMain.handle(IPC_CHANNELS.REMOVE_MASTER_PASSWORD, () => {
    store.removeMasterPassword();
    return true;
  });

  // App
  ipcMain.handle(IPC_CHANNELS.GET_APP_CONFIG, () => {
    return store.getAppConfig();
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_APP_CONFIG, (_, config) => {
    store.saveAppConfig(config);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.SELECT_FILE, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'SSH Keys', extensions: ['pem', 'key', 'pub', 'ppk'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle(IPC_CHANNELS.GET_PLATFORM, () => {
    return process.platform;
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
    mainWindow.minimize();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, () => {
    mainWindow.close();
  });
}
