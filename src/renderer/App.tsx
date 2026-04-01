import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import SplitPaneContainer from './components/SplitPaneContainer';
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

export interface Pane {
  id: string;
  tabs: TerminalTab[];
  activeTabId: string | null;
}

// ─── Arbre de panes ───────────────────────────────────────────────────────────

export type SplitDirection = 'horizontal' | 'vertical';

export type PaneNode =
  | { type: 'leaf'; pane: Pane }
  | { type: 'split'; direction: SplitDirection; ratio: number; first: PaneNode; second: PaneNode };

/** Collecte tous les panes feuille dans l'ordre de parcours */
export function collectPanes(node: PaneNode): Pane[] {
  if (node.type === 'leaf') return [node.pane];
  return [...collectPanes(node.first), ...collectPanes(node.second)];
}

/** Trouve un pane par id */
export function findPane(node: PaneNode, paneId: string): Pane | null {
  if (node.type === 'leaf') return node.pane.id === paneId ? node.pane : null;
  return findPane(node.first, paneId) ?? findPane(node.second, paneId);
}

/** Met à jour un pane dans l'arbre */
export function updatePane(node: PaneNode, paneId: string, updater: (p: Pane) => Pane): PaneNode {
  if (node.type === 'leaf') return node.pane.id === paneId ? { type: 'leaf', pane: updater(node.pane) } : node;
  return { ...node, first: updatePane(node.first, paneId, updater), second: updatePane(node.second, paneId, updater) };
}

/** Applique un updater à tous les panes */
export function updateAllPanes(node: PaneNode, updater: (p: Pane) => Pane): PaneNode {
  if (node.type === 'leaf') return { type: 'leaf', pane: updater(node.pane) };
  return { ...node, first: updateAllPanes(node.first, updater), second: updateAllPanes(node.second, updater) };
}

/** Supprime un pane (remplace le parent split par le frère survivant) — retourne null si c'est le dernier */
export function removePane(node: PaneNode, paneId: string): PaneNode | null {
  if (node.type === 'leaf') return node.pane.id === paneId ? null : node;
  const newFirst = removePane(node.first, paneId);
  const newSecond = removePane(node.second, paneId);
  if (newFirst === null) return newSecond;
  if (newSecond === null) return newFirst;
  return { ...node, first: newFirst, second: newSecond };
}

/** Supprime les panes vides (sans onglets) */
export function pruneEmptyPanes(node: PaneNode): PaneNode | null {
  if (node.type === 'leaf') return node.pane.tabs.length === 0 ? null : node;
  const newFirst = pruneEmptyPanes(node.first);
  const newSecond = pruneEmptyPanes(node.second);
  if (newFirst === null) return newSecond;
  if (newSecond === null) return newFirst;
  return { ...node, first: newFirst, second: newSecond };
}

/** Insère un nouveau pane adjacent à refPaneId dans la direction donnée */
export function splitPane(
  node: PaneNode,
  refPaneId: string,
  newPane: Pane,
  direction: SplitDirection,
  position: 'before' | 'after',
): PaneNode {
  if (node.type === 'leaf') {
    if (node.pane.id !== refPaneId) return node;
    const first: PaneNode = position === 'before' ? { type: 'leaf', pane: newPane } : node;
    const second: PaneNode = position === 'before' ? node : { type: 'leaf', pane: newPane };
    return { type: 'split', direction, ratio: 0.5, first, second };
  }
  return { ...node, first: splitPane(node.first, refPaneId, newPane, direction, position), second: splitPane(node.second, refPaneId, newPane, direction, position) };
}

/** Met à jour le ratio d'un split dont les enfants correspondent à first/second */
export function updateRatio(node: PaneNode, firstId: string, secondId: string, ratio: number): PaneNode {
  if (node.type === 'leaf') return node;
  const firstLeaves = collectPanes(node.first).map(p => p.id);
  const secondLeaves = collectPanes(node.second).map(p => p.id);
  if (firstLeaves.includes(firstId) && secondLeaves.includes(secondId)) {
    return { ...node, ratio };
  }
  return { ...node, first: updateRatio(node.first, firstId, secondId, ratio), second: updateRatio(node.second, firstId, secondId, ratio) };
}

const INITIAL_PANE_ID = 'pane-initial';

export default function App() {
  const [servers, setServers] = useState<ServerConfig[]>([]);
  const [groups, setGroups] = useState<ServerGroup[]>([]);
  const [root, setRoot] = useState<PaneNode>({
    type: 'leaf',
    pane: { id: INITIAL_PANE_ID, tabs: [], activeTabId: null },
  });
  const [activePaneId, setActivePaneId] = useState<string>(INITIAL_PANE_ID);
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
      setRoot(prev => updateAllPanes(prev, pane => ({
        ...pane,
        tabs: pane.tabs.map(tab =>
          tab.id === sessionId
            ? { ...tab, status: status as TerminalTab['status'], error }
            : tab
        ),
      })));
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

    const targetId = activePaneId;
    setRoot(prev => {
      const pane = findPane(prev, targetId);
      const realTargetId = pane ? targetId : collectPanes(prev)[0]?.id ?? targetId;
      return updatePane(prev, realTargetId, p => ({ ...p, tabs: [...p.tabs, newTab], activeTabId: sessionId }));
    });

    console.log('Calling sshConnect for session:', sessionId);
    window.electronAPI.sshConnect(sessionId, server.id)
      .then(() => { console.log('SSH connection initiated successfully'); })
      .catch((err: unknown) => {
        console.error('SSH connection error:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        setRoot(prev => updateAllPanes(prev, p => ({
          ...p,
          tabs: p.tabs.map(tab => tab.id === sessionId ? { ...tab, status: 'error' as const, error: errorMessage } : tab),
        })));
      });
  }, [activePaneId]);

  const handleCloseTab = useCallback((paneId: string, tabId: string) => {
    window.electronAPI.sshDisconnect(tabId);
    setRoot(prev => {
      const updated = updatePane(prev, paneId, pane => {
        const filtered = pane.tabs.filter(t => t.id !== tabId);
        const newActiveTabId = pane.activeTabId === tabId
          ? (filtered.length > 0 ? filtered[filtered.length - 1].id : null)
          : pane.activeTabId;
        return { ...pane, tabs: filtered, activeTabId: newActiveTabId };
      });
      return pruneEmptyPanes(updated) ?? updated;
    });
  }, []);

  const handleSelectTab = useCallback((paneId: string, tabId: string) => {
    setActivePaneId(paneId);
    setRoot(prev => updatePane(prev, paneId, p => ({ ...p, activeTabId: tabId })));
  }, []);

  const handleReorderTab = useCallback((paneId: string, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setRoot(prev => updatePane(prev, paneId, pane => {
      const tabs = [...pane.tabs];
      const [moved] = tabs.splice(fromIndex, 1);
      tabs.splice(toIndex, 0, moved);
      return { ...pane, tabs };
    }));
  }, []);

  const handleMoveTab = useCallback((sourcePaneId: string, tabId: string, targetPaneId: string, insertIndex: number) => {
    if (sourcePaneId === targetPaneId) return;
    setRoot(prev => {
      const tab = findPane(prev, sourcePaneId)?.tabs.find(t => t.id === tabId);
      if (!tab) return prev;
      let updated = updatePane(prev, sourcePaneId, pane => {
        const tabs = pane.tabs.filter(t => t.id !== tabId);
        const newActiveTabId = pane.activeTabId === tabId
          ? (tabs.length > 0 ? tabs[tabs.length - 1].id : null)
          : pane.activeTabId;
        return { ...pane, tabs, activeTabId: newActiveTabId };
      });
      updated = updatePane(updated, targetPaneId, pane => {
        const tabs = [...pane.tabs];
        tabs.splice(Math.min(insertIndex, tabs.length), 0, tab);
        return { ...pane, tabs, activeTabId: tabId };
      });
      return pruneEmptyPanes(updated) ?? updated;
    });
    setActivePaneId(targetPaneId);
  }, []);

  const handleSplitWithTab = useCallback((
    sourcePaneId: string,
    tabId: string,
    refPaneId: string,
    position: 'before' | 'after',
    direction: SplitDirection,
  ) => {
    const newPaneId = `pane-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    setRoot(prev => {
      const panes = collectPanes(prev);
      if (panes.length === 1 && panes[0].tabs.length === 1) return prev;
      const tab = findPane(prev, sourcePaneId)?.tabs.find(t => t.id === tabId);
      if (!tab) return prev;
      const newPane: Pane = { id: newPaneId, tabs: [tab], activeTabId: tabId };
      // Retire l'onglet du pane source
      let updated = updatePane(prev, sourcePaneId, pane => {
        const tabs = pane.tabs.filter(t => t.id !== tabId);
        const newActiveTabId = pane.activeTabId === tabId
          ? (tabs.length > 0 ? tabs[tabs.length - 1].id : null)
          : pane.activeTabId;
        return { ...pane, tabs, activeTabId: newActiveTabId };
      });
      // Élagage si le source est vide
      updated = pruneEmptyPanes(updated) ?? { type: 'leaf', pane: newPane };
      // Si le source a été élagué, refPaneId peut avoir disparu ; on cherche la nouvelle cible
      const targetExists = !!findPane(updated, refPaneId);
      const actualRef = targetExists ? refPaneId : (collectPanes(updated)[0]?.id ?? refPaneId);
      return splitPane(updated, actualRef, newPane, direction, position);
    });
    setActivePaneId(newPaneId);
  }, []);

  const handleSplitRootWithTab = useCallback((
    sourcePaneId: string,
    tabId: string,
    position: 'before' | 'after',
    direction: SplitDirection,
  ) => {
    const newPaneId = `pane-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    setRoot(prev => {
      const panes = collectPanes(prev);
      if (panes.length === 1 && panes[0].tabs.length === 1) return prev;
      const tab = findPane(prev, sourcePaneId)?.tabs.find(t => t.id === tabId);
      if (!tab) return prev;
      const newPane: Pane = { id: newPaneId, tabs: [tab], activeTabId: tabId };
      let updated = updatePane(prev, sourcePaneId, pane => {
        const tabs = pane.tabs.filter(t => t.id !== tabId);
        const newActiveTabId = pane.activeTabId === tabId
          ? (tabs.length > 0 ? tabs[tabs.length - 1].id : null)
          : pane.activeTabId;
        return { ...pane, tabs, activeTabId: newActiveTabId };
      });
      updated = pruneEmptyPanes(updated) ?? { type: 'leaf', pane: newPane };
      const newLeaf: PaneNode = { type: 'leaf', pane: newPane };
      return position === 'after'
        ? { type: 'split', direction, ratio: 0.5, first: updated, second: newLeaf }
        : { type: 'split', direction, ratio: 0.5, first: newLeaf, second: updated };
    });
    setActivePaneId(newPaneId);
  }, []);

  const handleClosePane = useCallback((paneId: string) => {
    setRoot(prev => {
      const panes = collectPanes(prev);
      if (panes.length <= 1) return prev;
      const index = panes.findIndex(p => p.id === paneId);
      if (index === -1) return prev;
      panes[index].tabs.forEach(tab => window.electronAPI.sshDisconnect(tab.id));
      const result = removePane(prev, paneId);
      if (!result) return prev;
      if (activePaneId === paneId) {
        const remaining = collectPanes(result);
        setActivePaneId(remaining[Math.min(index, remaining.length - 1)].id);
      }
      return result;
    });
  }, [activePaneId]);

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
          <SplitPaneContainer
            root={root}
            activePaneId={activePaneId}
            onSelectPane={setActivePaneId}
            onSelectTab={handleSelectTab}
            onCloseTab={handleCloseTab}
            onClosePane={handleClosePane}
            onReorderTab={handleReorderTab}
            onMoveTab={handleMoveTab}
            onSplitWithTab={handleSplitWithTab}
            onSplitRootWithTab={handleSplitRootWithTab}
            onRatioChange={(firstId, secondId, ratio) =>
              setRoot(prev => updateRatio(prev, firstId, secondId, ratio))
            }
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
