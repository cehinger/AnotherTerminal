import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, ServerConfig, ServerGroup } from '../shared/types';

const api = {
  // Servers
  getServers: (): Promise<ServerConfig[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SERVERS),
  addServer: (server: ServerConfig): Promise<ServerConfig> =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_SERVER, server),
  updateServer: (server: ServerConfig): Promise<ServerConfig> =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_SERVER, server),
  deleteServer: (id: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_SERVER, id),

  // Groups
  getGroups: (): Promise<ServerGroup[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_GROUPS),
  addGroup: (group: ServerGroup): Promise<ServerGroup[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_GROUP, group),
  updateGroup: (oldName: string, group: ServerGroup): Promise<ServerGroup[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_GROUP, oldName, group),
  deleteGroup: (name: string): Promise<ServerGroup[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_GROUP, name),

  // SSH
  sshConnect: (sessionId: string, serverId: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.SSH_CONNECT, sessionId, serverId),
  sshDisconnect: (sessionId: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.SSH_DISCONNECT, sessionId),
  sshWrite: (sessionId: string, data: string): void =>
    ipcRenderer.send(IPC_CHANNELS.SSH_DATA, sessionId, data),
  sshResize: (sessionId: string, cols: number, rows: number): void =>
    ipcRenderer.send(IPC_CHANNELS.SSH_RESIZE, sessionId, cols, rows),
  onSSHData: (callback: (sessionId: string, data: string) => void) => {
    const handler = (_: any, sessionId: string, data: string) => callback(sessionId, data);
    ipcRenderer.on(IPC_CHANNELS.SSH_DATA, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SSH_DATA, handler);
  },
  onSSHStatus: (callback: (sessionId: string, status: string, error?: string) => void) => {
    const handler = (_: any, sessionId: string, status: string, error?: string) =>
      callback(sessionId, status, error);
    ipcRenderer.on(IPC_CHANNELS.SSH_STATUS, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.SSH_STATUS, handler);
  },

  // Master password
  hasMasterPassword: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.HAS_MASTER_PASSWORD),
  setMasterPassword: (password: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_MASTER_PASSWORD, password),
  verifyMasterPassword: (password: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.VERIFY_MASTER_PASSWORD, password),
  changeMasterPassword: (oldPassword: string, newPassword: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.CHANGE_MASTER_PASSWORD, oldPassword, newPassword),
  removeMasterPassword: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOVE_MASTER_PASSWORD),

  // App
  getAppConfig: () => ipcRenderer.invoke(IPC_CHANNELS.GET_APP_CONFIG),
  saveAppConfig: (config: any) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_APP_CONFIG, config),
  selectFile: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.SELECT_FILE),
  getPlatform: (): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_PLATFORM),
  windowMinimize: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
  windowMaximize: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),
  windowClose: (): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
