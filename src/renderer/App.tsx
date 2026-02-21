import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import TerminalTabs from './components/TerminalTabs';
import ServerModal from './components/ServerModal';
import MasterPasswordModal from './components/MasterPasswordModal';
import { TitleBar } from './components/TitleBar';
import { ServerConfig, ServerGroup } from '../shared/types';

export interface TerminalTab {
  id: string;
  serverId: string;
  serverAlias: string;
  serverHost: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  error?: string;
}

export default function App() {
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [groups, setGroups] = useState<ServerGroup[]>([]);
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showServerModal, setShowServerModal] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerConfig | null>(null);
  const [showMasterPassword, setShowMasterPassword] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [hasMasterPasswordSet, setHasMasterPasswordSet] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [platform, setPlatform] = useState<string>('');

  // Check if Electron API is available
  if (!window.electronAPI) {
    return (
      <div className="flex items-center justify-center h-screen bg-dark-950 text-red-400">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Erreur de chargement</h1>
          <p className="text-sm">L'API Electron n'est pas disponible.</p>
          <p className="text-sm text-gray-500 mt-2">Assurez-vous que le preload script est correctement chargé.</p>
        </div>
      </div>
    );
  }

  // Load platform on mount
  useEffect(() => {
    window.electronAPI.getPlatform().then(setPlatform);
  }, []);

  // Load servers and groups on mount
  const loadData = useCallback(async () => {
    try {
      const [serversData, groupsData, hasMaster] = await Promise.all([
        window.electronAPI.getServers(),
        window.electronAPI.getGroups(),
        window.electronAPI.hasMasterPassword(),
      ]);
      setServers(serversData);
      setGroups(groupsData);
      setHasMasterPasswordSet(hasMaster);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  }, []);

  useEffect(() => {
    // Check master password on startup
    const checkMasterPassword = async () => {
      const hasMaster = await window.electronAPI.hasMasterPassword();
      if (hasMaster) {
        setIsLocked(true);
      } else {
        loadData();
      }
    };
    checkMasterPassword();
  }, [loadData]);

  // Listen for SSH events
  useEffect(() => {
    console.log('[App] Setting up SSH event listeners');
    const cleanupData = window.electronAPI.onSSHData((sessionId: string, data: string) => {
      // Data is handled directly by XTerm component
      console.log(`[App] Received SSH data for ${sessionId}:`, data.length, 'bytes');
      const event = new CustomEvent(`ssh-data-${sessionId}`, { detail: data });
      window.dispatchEvent(event);
      console.log(`[App] Dispatched custom event: ssh-data-${sessionId}`);
    });

    const cleanupStatus = window.electronAPI.onSSHStatus((sessionId: string, status: string, error?: string) => {
      console.log(`[App] SSH status update: ${sessionId} -> ${status}`, error || '');
      setTabs(prev =>
        prev.map(tab =>
          tab.id === sessionId
            ? { ...tab, status: status as TerminalTab['status'], error }
            : tab
        )
      );
    });

    return () => {
      cleanupData();
      cleanupStatus();
    };
  }, []);

  const handleConnect = useCallback((server: ServerConfig) => {
    console.log('Connecting to server:', server.alias, server.host);
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newTab: TerminalTab = {
      id: sessionId,
      serverId: server.id,
      serverAlias: server.alias,
      serverHost: server.host,
      status: 'connecting',
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(sessionId);

    // Initiate SSH connection
    console.log('Calling sshConnect for session:', sessionId);
    window.electronAPI.sshConnect(sessionId, server.id)
      .then(() => {
        console.log('SSH connection initiated successfully');
      })
      .catch((err: unknown) => {
        console.error('SSH connection error:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        setTabs(prev =>
          prev.map(tab =>
            tab.id === sessionId
              ? { ...tab, status: 'error', error: errorMessage }
              : tab
          )
        );
      });
  }, []);

  const handleCloseTab = useCallback((tabId: string) => {
    window.electronAPI.sshDisconnect(tabId);
    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId) {
        setActiveTabId(filtered.length > 0 ? filtered[filtered.length - 1].id : null);
      }
      return filtered;
    });
  }, [activeTabId]);

  const handleAddServer = () => {
    setEditingServer(null);
    setShowServerModal(true);
  };

  const handleEditServer = (server: ServerConfig) => {
    setEditingServer(server);
    setShowServerModal(true);
  };

  const handleDeleteServer = async (id: string) => {
    await window.electronAPI.deleteServer(id);
    loadData();
  };

  const handleSaveServer = async (server: ServerConfig) => {
    if (editingServer) {
      await window.electronAPI.updateServer(server);
    } else {
      await window.electronAPI.addServer(server);
    }
    setShowServerModal(false);
    loadData();
  };

  const handleUnlock = async (password: string): Promise<boolean> => {
    const valid = await window.electronAPI.verifyMasterPassword(password);
    if (valid) {
      setIsLocked(false);
      loadData();
    }
    return valid;
  };

  if (isLocked) {
    return (
      <MasterPasswordModal
        mode="unlock"
        onSubmit={handleUnlock}
        onClose={() => {}}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-dark-950 select-none">
      {/* Title bar - always shown, adapts to platform */}
      <TitleBar />
      
      {/* Main content area */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <Sidebar
        servers={servers}
        groups={groups}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onConnect={handleConnect}
        onAddServer={handleAddServer}
        onEditServer={handleEditServer}
        onDeleteServer={handleDeleteServer}
        onAddGroup={async (group) => {
          const updated = await window.electronAPI.addGroup(group);
          setGroups(updated);
        }}
        onDeleteGroup={async (name) => {
          const updated = await window.electronAPI.deleteGroup(name);
          setGroups(updated);
          loadData();
        }}
        onOpenSettings={() => setShowMasterPassword(true)}
      />

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          <TerminalTabs
            tabs={tabs}
            activeTabId={activeTabId}
            onSelectTab={setActiveTabId}
            onCloseTab={handleCloseTab}
          />
        </div>
      </div>

      {/* Modals */}
      {showServerModal && (
        <ServerModal
          server={editingServer}
          groups={groups}
          onSave={handleSaveServer}
          onClose={() => setShowServerModal(false)}
        />
      )}

      {showMasterPassword && (
        <MasterPasswordModal
          mode="settings"
          hasMasterPassword={hasMasterPasswordSet}
          onSubmit={async (password) => {
            await window.electronAPI.setMasterPassword(password);
            setHasMasterPasswordSet(true);
            return true;
          }}
          onChangeMasterPassword={async (oldPassword, newPassword) => {
            const ok = await window.electronAPI.changeMasterPassword(oldPassword, newPassword);
            return ok;
          }}
          onRemove={async () => {
            await window.electronAPI.removeMasterPassword();
            setHasMasterPasswordSet(false);
          }}
          onClose={() => setShowMasterPassword(false)}
        />
      )}
    </div>
  );
}
