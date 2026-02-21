import { Client, ClientChannel, SFTPWrapper } from 'ssh2';
import { ServerConfig, SSHConnectionStatus } from '../shared/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface SSHSession {
  client: Client;
  stream: ClientChannel | null;
  sftp: SFTPWrapper | null;
  status: SSHConnectionStatus;
  serverId: string;
  connectionType: 'ssh' | 'sftp';
  currentPath?: string;
  sftpBuffer?: string;
}

const sessions: Map<string, SSHSession> = new Map();

type DataCallback = (sessionId: string, data: string) => void;
type StatusCallback = (sessionId: string, status: SSHConnectionStatus, error?: string) => void;

let onDataCallback: DataCallback | null = null;
let onStatusCallback: StatusCallback | null = null;

export function setOnData(cb: DataCallback): void {
  onDataCallback = cb;
}

export function setOnStatus(cb: StatusCallback): void {
  onStatusCallback = cb;
}

function emitStatus(sessionId: string, status: SSHConnectionStatus, error?: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.status = status;
  }
  onStatusCallback?.(sessionId, status, error);
}

export function connectSSH(sessionId: string, server: ServerConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`[${server.connectionType.toUpperCase()}] Connecting to ${server.username}@${server.host}:${server.port} (session: ${sessionId})`);
    const client = new Client();

    const session: SSHSession = {
      client,
      stream: null,
      sftp: null,
      status: 'connecting',
      serverId: server.id,
      connectionType: server.connectionType,
      currentPath: '.',
      sftpBuffer: '',
    };
    sessions.set(sessionId, session);
    emitStatus(sessionId, 'connecting');

    const connectConfig: any = {
      host: server.host,
      port: server.port || 22,
      username: server.username,
      readyTimeout: 10000,
      keepaliveInterval: 30000,
      keepaliveCountMax: 5,
    };

    if (server.authType === 'key' && server.privateKeyPath) {
      try {
        const expandedPath = server.privateKeyPath.replace(/^~(?=$|\/|\\)/, os.homedir());
        connectConfig.privateKey = fs.readFileSync(expandedPath);
        if (server.passphrase) {
          connectConfig.passphrase = server.passphrase;
        }
      } catch (err: any) {
        emitStatus(sessionId, 'error', `Cannot read key file: ${err.message}`);
        reject(err);
        return;
      }
    } else if (server.authType === 'password' && server.password) {
      connectConfig.password = server.password;
    }

    client.on('ready', () => {
      // Handle SFTP connections differently
      if (server.connectionType === 'sftp') {
        client.sftp((err, sftp) => {
          if (err) {
            emitStatus(sessionId, 'error', err.message);
            reject(err);
            return;
          }

          session.sftp = sftp;
          emitStatus(sessionId, 'connected');

          // Get initial working directory
          sftp.realpath('.', (err, absPath) => {
            if (!err && absPath) {
              session.currentPath = absPath;
            }
            
            // Send welcome message
            const welcomeMsg = `\x1b[32m✓ Connexion SFTP établie\x1b[0m\r\n` +
              `Répertoire: ${session.currentPath}\r\n` +
              `Commandes disponibles: ls, cd, pwd, get, put, mkdir, rm, help, exit\r\n\r\n` +
              `sftp> `;
            onDataCallback?.(sessionId, welcomeMsg);
          });

          resolve();
        });
      } else {
        // Standard SSH shell connection
        client.shell(
          {
            term: 'xterm-256color',
            cols: 120,
            rows: 30,
          },
          (err, stream) => {
            if (err) {
              emitStatus(sessionId, 'error', err.message);
              reject(err);
              return;
            }

            session.stream = stream;
            emitStatus(sessionId, 'connected');

            stream.on('data', (data: Buffer) => {
              const dataStr = data.toString('utf-8');
              console.log(`[SSH] Received data from ${sessionId}: ${dataStr.length} bytes`);
              onDataCallback?.(sessionId, dataStr);
            });

            stream.stderr.on('data', (data: Buffer) => {
              const dataStr = data.toString('utf-8');
              console.log(`[SSH] Received stderr from ${sessionId}: ${dataStr.length} bytes`);
              onDataCallback?.(sessionId, dataStr);
            });

            stream.on('close', () => {
              emitStatus(sessionId, 'disconnected');
              sessions.delete(sessionId);
            });

            resolve();
          }
        );
      }
    });

    client.on('error', (err) => {
      emitStatus(sessionId, 'error', err.message);
      sessions.delete(sessionId);
      reject(err);
    });

    client.on('end', () => {
      emitStatus(sessionId, 'disconnected');
      sessions.delete(sessionId);
    });

    client.on('close', () => {
      emitStatus(sessionId, 'disconnected');
      sessions.delete(sessionId);
    });

    client.connect(connectConfig);
  });
}

export function writeToSSH(sessionId: string, data: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  // Handle SFTP commands
  if (session.connectionType === 'sftp' && session.sftp) {
    handleSFTPCommand(sessionId, session, data);
  } else if (session.stream) {
    // Handle regular SSH
    session.stream.write(data);
  }
}

function handleSFTPCommand(sessionId: string, session: SSHSession, data: string): void {
  if (!session.sftp) return;

  // Accumulate input
  session.sftpBuffer = (session.sftpBuffer || '') + data;

  // Check if we have a complete command (ends with newline)
  if (!data.includes('\n') && !data.includes('\r')) {
    // Echo the character for visual feedback
    onDataCallback?.(sessionId, data);
    return;
  }

  // Handle backspace
  if (data === '\x7f' || data === '\x08') {
    if (session.sftpBuffer && session.sftpBuffer.length > 0) {
      session.sftpBuffer = session.sftpBuffer.slice(0, -1);
      onDataCallback?.(sessionId, '\b \b');
    }
    return;
  }

  const command = session.sftpBuffer.trim();
  session.sftpBuffer = '';

  if (!command) {
    onDataCallback?.(sessionId, '\r\nsftp> ');
    return;
  }

  // Echo the newline
  onDataCallback?.(sessionId, '\r\n');

  const parts = command.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  const sftp = session.sftp;

  switch (cmd) {
    case 'help':
      onDataCallback?.(sessionId, 
        'Commandes SFTP disponibles:\r\n' +
        '  ls [dir]       - Lister les fichiers\r\n' +
        '  cd <dir>       - Changer de répertoire\r\n' +
        '  pwd            - Afficher le répertoire courant\r\n' +
        '  mkdir <dir>    - Créer un répertoire\r\n' +
        '  rm <file>      - Supprimer un fichier\r\n' +
        '  rmdir <dir>    - Supprimer un répertoire\r\n' +
        '  get <file> [local_dest]   - Télécharger un fichier vers local\r\n' +
        '  put <local_file> [dest]   - Envoyer un fichier vers le serveur\r\n' +
        '  exit           - Fermer la connexion\r\n' +
        '\r\nsftp> '
      );
      break;

    case 'pwd':
      onDataCallback?.(sessionId, `${session.currentPath}\r\nsftp> `);
      break;

    case 'ls':
      const listPath = args[0] || session.currentPath || '.';
      sftp.readdir(listPath, (err, list) => {
        if (err) {
          onDataCallback?.(sessionId, `\x1b[31mErreur: ${err.message}\x1b[0m\r\nsftp> `);
        } else {
          let output = '';
          list.forEach(item => {
            const isDir = item.attrs.isDirectory();
            const color = isDir ? '\x1b[34m' : '\x1b[0m';
            const suffix = isDir ? '/' : '';
            output += `${color}${item.filename}${suffix}\x1b[0m\r\n`;
          });
          onDataCallback?.(sessionId, output + 'sftp> ');
        }
      });
      break;

    case 'cd':
      if (!args[0]) {
        onDataCallback?.(sessionId, '\x1b[31mUsage: cd <directory>\x1b[0m\r\nsftp> ');
        return;
      }
      const newPath = args[0];
      const targetPath = newPath.startsWith('/') ? newPath : `${session.currentPath}/${newPath}`;
      
      sftp.realpath(targetPath, (err, absPath) => {
        if (err) {
          onDataCallback?.(sessionId, `\x1b[31mErreur: ${err.message}\x1b[0m\r\nsftp> `);
        } else {
          session.currentPath = absPath;
          onDataCallback?.(sessionId, `${absPath}\r\nsftp> `);
        }
      });
      break;

    case 'mkdir':
      if (!args[0]) {
        onDataCallback?.(sessionId, '\x1b[31mUsage: mkdir <directory>\x1b[0m\r\nsftp> ');
        return;
      }
      const mkdirPath = args[0].startsWith('/') ? args[0] : `${session.currentPath}/${args[0]}`;
      sftp.mkdir(mkdirPath, (err) => {
        if (err) {
          onDataCallback?.(sessionId, `\x1b[31mErreur: ${err.message}\x1b[0m\r\nsftp> `);
        } else {
          onDataCallback?.(sessionId, `\x1b[32mRépertoire créé: ${args[0]}\x1b[0m\r\nsftp> `);
        }
      });
      break;

    case 'rm':
      if (!args[0]) {
        onDataCallback?.(sessionId, '\x1b[31mUsage: rm <file>\x1b[0m\r\nsftp> ');
        return;
      }
      const rmPath = args[0].startsWith('/') ? args[0] : `${session.currentPath}/${args[0]}`;
      sftp.unlink(rmPath, (err) => {
        if (err) {
          onDataCallback?.(sessionId, `\x1b[31mErreur: ${err.message}\x1b[0m\r\nsftp> `);
        } else {
          onDataCallback?.(sessionId, `\x1b[32mFichier supprimé: ${args[0]}\x1b[0m\r\nsftp> `);
        }
      });
      break;

    case 'rmdir':
      if (!args[0]) {
        onDataCallback?.(sessionId, '\x1b[31mUsage: rmdir <directory>\x1b[0m\r\nsftp> ');
        return;
      }
      const rmdirPath = args[0].startsWith('/') ? args[0] : `${session.currentPath}/${args[0]}`;
      sftp.rmdir(rmdirPath, (err) => {
        if (err) {
          onDataCallback?.(sessionId, `\x1b[31mErreur: ${err.message}\x1b[0m\r\nsftp> `);
        } else {
          onDataCallback?.(sessionId, `\x1b[32mRépertoire supprimé: ${args[0]}\x1b[0m\r\nsftp> `);
        }
      });
      break;

    case 'exit':
    case 'quit':
      disconnectSSH(sessionId);
      break;

    case 'get': {
      if (!args[0]) {
        onDataCallback?.(sessionId, '\x1b[31mUsage: get <remote_file> [local_dest]\x1b[0m\r\nsftp> ');
        return;
      }
      const remoteGetPath = args[0].startsWith('/') ? args[0] : `${session.currentPath}/${args[0]}`;
      const localGetBase = args[1] || path.join(os.homedir(), 'Downloads');
      const localGetPath = fs.existsSync(localGetBase) && fs.statSync(localGetBase).isDirectory()
        ? path.join(localGetBase, path.basename(remoteGetPath))
        : localGetBase;
      onDataCallback?.(sessionId, `Téléchargement de ${path.basename(remoteGetPath)}...\r\n`);
      sftp.fastGet(remoteGetPath, localGetPath, (err) => {
        if (err) {
          onDataCallback?.(sessionId, `\x1b[31mErreur: ${err.message}\x1b[0m\r\nsftp> `);
        } else {
          onDataCallback?.(sessionId, `\x1b[32m✓ Fichier téléchargé: ${localGetPath}\x1b[0m\r\nsftp> `);
        }
      });
      break;
    }

    case 'put': {
      if (!args[0]) {
        onDataCallback?.(sessionId, '\x1b[31mUsage: put <local_file> [remote_dest]\x1b[0m\r\nsftp> ');
        return;
      }
      const localPutPath = path.isAbsolute(args[0]) ? args[0] : path.join(os.homedir(), args[0]);
      const remotePutDest = args[1]
        ? (args[1].startsWith('/') ? args[1] : `${session.currentPath}/${args[1]}`)
        : `${session.currentPath}/${path.basename(args[0])}`;
      if (!fs.existsSync(localPutPath)) {
        onDataCallback?.(sessionId, `\x1b[31mFichier local introuvable: ${localPutPath}\x1b[0m\r\nsftp> `);
        return;
      }
      onDataCallback?.(sessionId, `Envoi de ${path.basename(localPutPath)}...\r\n`);
      sftp.fastPut(localPutPath, remotePutDest, (err) => {
        if (err) {
          onDataCallback?.(sessionId, `\x1b[31mErreur: ${err.message}\x1b[0m\r\nsftp> `);
        } else {
          onDataCallback?.(sessionId, `\x1b[32m✓ Fichier envoyé: ${remotePutDest}\x1b[0m\r\nsftp> `);
        }
      });
      break;
    }

    default:
      onDataCallback?.(sessionId, `\x1b[31mCommande inconnue: ${cmd}\x1b[0m\r\nTapez "help" pour voir les commandes disponibles.\r\nsftp> `);
      break;
  }
}

export function resizeSSH(sessionId: string, cols: number, rows: number): void {
  const session = sessions.get(sessionId);
  if (session?.stream && session.connectionType === 'ssh') {
    session.stream.setWindow(rows, cols, 0, 0);
  }
}

export function disconnectSSH(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    if (session.sftp) {
      session.sftp.end();
    }
    session.client.end();
    sessions.delete(sessionId);
  }
}

export function disconnectAll(): void {
  for (const [id, session] of sessions.entries()) {
    session.client.end();
    sessions.delete(id);
  }
}
