import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { AppData, ServerConfig, ServerGroup, AppConfig } from '../shared/types';
import { encrypt, decrypt, hashPassword, verifyPassword } from './crypto';

const DATA_FILE = 'servers.json';

function getDataPath(): string {
  return path.join(app.getPath('userData'), DATA_FILE);
}

function getDefaultData(): AppData {
  return {
    version: '1.0.0',
    config: {
      groups: [{ name: 'Par défaut', color: '#6366f1' }],
    },
    servers: [],
  };
}

let cachedData: AppData | null = null;
let masterPassword: string | undefined;

export function setMasterPassword(password: string | undefined): void {
  masterPassword = password;
}

export function getMasterPassword(): string | undefined {
  return masterPassword;
}

function loadData(): AppData {
  if (cachedData) return cachedData;

  const filePath = getDataPath();
  if (!fs.existsSync(filePath)) {
    cachedData = getDefaultData();
    saveData(cachedData);
    return cachedData;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    cachedData = JSON.parse(raw) as AppData;
    return cachedData;
  } catch {
    cachedData = getDefaultData();
    return cachedData;
  }
}

function saveData(data: AppData): void {
  const filePath = getDataPath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  cachedData = data;
}

function invalidateCache(): void {
  cachedData = null;
}

// Encrypt sensitive fields before saving
function encryptServer(server: ServerConfig): ServerConfig {
  const encrypted = { ...server };
  if (encrypted.password) {
    encrypted.password = encrypt(encrypted.password, masterPassword);
  }
  if (encrypted.passphrase) {
    encrypted.passphrase = encrypt(encrypted.passphrase, masterPassword);
  }
  return encrypted;
}

// Decrypt sensitive fields after loading
function decryptServer(server: ServerConfig): ServerConfig {
  const decrypted = { ...server };
  
  // Migration: add default connectionType for existing servers
  if (!decrypted.connectionType) {
    decrypted.connectionType = 'ssh';
  }
  
  try {
    if (decrypted.password) {
      decrypted.password = decrypt(decrypted.password, masterPassword);
    }
    if (decrypted.passphrase) {
      decrypted.passphrase = decrypt(decrypted.passphrase, masterPassword);
    }
  } catch (err) {
    // If decryption fails, return as-is (wrong master password scenario)
    console.error(`[store] decryptServer failed for "${decrypted.alias}" (${decrypted.id}):`, err);
  }
  return decrypted;
}

// Server operations
export function getServers(): ServerConfig[] {
  const data = loadData();
  return data.servers.map(s => {
    const decrypted = decryptServer(s);
    // Don't send actual passwords to renderer, just indicate if set
    return {
      ...decrypted,
      password: decrypted.password ? '••••••••' : undefined,
      passphrase: decrypted.passphrase ? '••••••••' : undefined,
    };
  });
}

export function getServerForConnection(id: string): ServerConfig | undefined {
  const data = loadData();
  const server = data.servers.find(s => s.id === id);
  if (!server) return undefined;
  return decryptServer(server);
}

export function addServer(server: ServerConfig): ServerConfig {
  const data = loadData();
  const encrypted = encryptServer(server);
  data.servers.push(encrypted);
  saveData(data);
  return server;
}

export function updateServer(server: ServerConfig): ServerConfig {
  const data = loadData();
  const index = data.servers.findIndex(s => s.id === server.id);
  if (index === -1) throw new Error('Server not found');

  // If password fields are masked, keep the existing encrypted values
  const existing = data.servers[index];
  const toSave = { ...server };
  if (toSave.password === '••••••••') {
    toSave.password = existing.password;
  } else if (toSave.password) {
    toSave.password = encrypt(toSave.password, masterPassword);
  }
  if (toSave.passphrase === '••••••••') {
    toSave.passphrase = existing.passphrase;
  } else if (toSave.passphrase) {
    toSave.passphrase = encrypt(toSave.passphrase, masterPassword);
  }

  data.servers[index] = toSave;
  saveData(data);
  return server;
}

export function deleteServer(id: string): void {
  const data = loadData();
  data.servers = data.servers.filter(s => s.id !== id);
  saveData(data);
}

// Group operations
export function getGroups(): ServerGroup[] {
  const data = loadData();
  return data.config.groups;
}

export function addGroup(group: ServerGroup): ServerGroup[] {
  const data = loadData();
  if (!data.config.groups.find(g => g.name === group.name)) {
    data.config.groups.push(group);
    saveData(data);
  }
  return data.config.groups;
}

export function updateGroup(oldName: string, group: ServerGroup): ServerGroup[] {
  const data = loadData();
  const index = data.config.groups.findIndex(g => g.name === oldName);
  if (index >= 0) {
    data.config.groups[index] = group;
    // Update all servers in this group
    if (oldName !== group.name) {
      data.servers.forEach(s => {
        if (s.group === oldName) s.group = group.name;
      });
    }
    saveData(data);
  }
  return data.config.groups;
}

export function deleteGroup(name: string): ServerGroup[] {
  const data = loadData();
  data.config.groups = data.config.groups.filter(g => g.name !== name);
  // Move servers to default group
  data.servers.forEach(s => {
    if (s.group === name) s.group = 'Par défaut';
  });
  saveData(data);
  return data.config.groups;
}

// App config
export function getAppConfig(): AppConfig {
  const data = loadData();
  return data.config;
}

export function saveAppConfig(config: Partial<AppConfig>): void {
  const data = loadData();
  data.config = { ...data.config, ...config };
  saveData(data);
}

// Master password
export function setMasterPasswordHash(password: string): void {
  const data = loadData();

  // 1. Decrypt all servers with the CURRENT (old) master password
  const decryptedServers = data.servers.map(s => decryptServer(s));

  // 2. Compute new hash (does NOT change masterPassword yet)
  const { hash, salt } = hashPassword(password);
  data.config.masterPasswordHash = hash;
  data.config.masterPasswordSalt = salt;

  // 3. Re-encrypt all servers with the new master password
  //    Temporarily set masterPassword so encryptServer uses it
  const previousMasterPassword = masterPassword;
  masterPassword = password;
  try {
    data.servers = decryptedServers.map(s => encryptServer(s));
    saveData(data);
  } catch (err) {
    // Rollback: restore previous master password so future calls still work
    masterPassword = previousMasterPassword;
    throw err;
  }
}

export function changeMasterPassword(oldPassword: string, newPassword: string): boolean {
  // Verify old password (also sets masterPassword in memory if valid)
  const valid = verifyMasterPassword(oldPassword);
  if (!valid) return false;
  setMasterPasswordHash(newPassword);
  return true;
}

export function verifyMasterPassword(password: string): boolean {
  const data = loadData();
  if (!data.config.masterPasswordHash || !data.config.masterPasswordSalt) {
    return false;
  }
  const valid = verifyPassword(password, data.config.masterPasswordHash, data.config.masterPasswordSalt);
  if (valid) {
    masterPassword = password;
  }
  return valid;
}

export function hasMasterPassword(): boolean {
  const data = loadData();
  return !!(data.config.masterPasswordHash && data.config.masterPasswordSalt);
}

export function removeMasterPassword(): void {
  // Decrypt all with current master password, then re-encrypt without
  const data = loadData();
  const decryptedServers = data.servers.map(s => decryptServer(s));
  
  masterPassword = undefined;
  data.config.masterPasswordHash = undefined;
  data.config.masterPasswordSalt = undefined;
  
  // Re-encrypt with default key
  data.servers = decryptedServers.map(s => encryptServer(s));
  saveData(data);
}


