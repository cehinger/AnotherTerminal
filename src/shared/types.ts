// Shared types between main and renderer processes

export interface ServerConfig {
  id: string;
  alias: string;
  host: string;
  port: number;
  username: string;
  connectionType: 'ssh' | 'sftp';
  authType: 'password' | 'key';
  password?: string;       // Encrypted at rest
  privateKeyPath?: string;
  passphrase?: string;     // Encrypted at rest
  group: string;
  notes: string;
  color?: string;
  icon?: string;           // Emoji or icon
  createdAt: string;
  updatedAt: string;
}

export interface ServerGroup {
  name: string;
  color?: string;
  collapsed?: boolean;
}

export interface AppConfig {
  masterPasswordHash?: string;
  masterPasswordSalt?: string;
  groups: ServerGroup[];
  windowBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface AppData {
  config: AppConfig;
  servers: ServerConfig[];
  version: string;
}

// IPC Channel names
export const IPC_CHANNELS = {
  // Server management
  GET_SERVERS: 'servers:get-all',
  ADD_SERVER: 'servers:add',
  UPDATE_SERVER: 'servers:update',
  DELETE_SERVER: 'servers:delete',

  // Group management
  GET_GROUPS: 'groups:get-all',
  ADD_GROUP: 'groups:add',
  UPDATE_GROUP: 'groups:update',
  DELETE_GROUP: 'groups:delete',

  // SSH
  SSH_CONNECT: 'ssh:connect',
  SSH_DISCONNECT: 'ssh:disconnect',
  SSH_DATA: 'ssh:data',
  SSH_RESIZE: 'ssh:resize',
  SSH_STATUS: 'ssh:status',

  // Master password
  SET_MASTER_PASSWORD: 'master:set',
  CHANGE_MASTER_PASSWORD: 'master:change',
  VERIFY_MASTER_PASSWORD: 'master:verify',
  HAS_MASTER_PASSWORD: 'master:has',
  REMOVE_MASTER_PASSWORD: 'master:remove',

  // App
  GET_APP_CONFIG: 'app:get-config',
  SAVE_APP_CONFIG: 'app:save-config',
  SELECT_FILE: 'app:select-file',
  GET_PLATFORM: 'app:get-platform',
  WINDOW_MINIMIZE: 'app:window-minimize',
  WINDOW_MAXIMIZE: 'app:window-maximize',
  WINDOW_CLOSE: 'app:window-close',
} as const;

export type SSHConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface SSHStatusEvent {
  sessionId: string;
  status: SSHConnectionStatus;
  error?: string;
}
