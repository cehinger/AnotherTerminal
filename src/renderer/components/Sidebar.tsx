import React, { useState } from 'react';
import { ServerConfig, ServerGroup } from '../../shared/types';

interface SidebarProps {
  servers: ServerConfig[];
  groups: ServerGroup[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onConnect: (server: ServerConfig) => void;
  onAddServer: () => void;
  onEditServer: (server: ServerConfig) => void;
  onDeleteServer: (id: string) => void;
  onAddGroup: (group: ServerGroup) => void;
  onDeleteGroup: (name: string) => void;
  onOpenSettings: () => void;
}

export default function Sidebar({
  servers,
  groups,
  collapsed,
  onToggleCollapse,
  onConnect,
  onAddServer,
  onEditServer,
  onDeleteServer,
  onAddGroup,
  onDeleteGroup,
  onOpenSettings,
}: SidebarProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showGroupInput, setShowGroupInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; server: ServerConfig } | null>(null);

  const toggleGroup = (name: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const filteredServers = servers.filter(s =>
    s.alias.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.host.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.notes?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const serversByGroup = groups.map(group => ({
    group,
    servers: filteredServers.filter(s => s.group === group.name),
  }));

  // Also include servers with no matching group
  const ungrouped = filteredServers.filter(s => !groups.some(g => g.name === s.group));

  const handleAddGroup = () => {
    if (newGroupName.trim()) {
      onAddGroup({ name: newGroupName.trim() });
      setNewGroupName('');
      setShowGroupInput(false);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, server: ServerConfig) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, server });
  };

  return (
    <>
      <div
        className={`flex flex-col bg-dark-900 border-r border-dark-700 transition-all duration-200 ${
          collapsed ? 'w-16' : 'w-72'
        }`}
      >
        {/* Header */}
        <div className="drag-region flex items-center gap-2 px-3 shrink-0 pt-2" style={{ minHeight: '40px' }}>
          {!collapsed && (
            <div className="relative flex-1 no-drag">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-dark-800 border border-dark-600 rounded-md text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          )}
          <button
            onClick={onToggleCollapse}
            className="no-drag p-1.5 rounded hover:bg-dark-700 text-gray-400 hover:text-gray-200 transition-colors shrink-0 ml-auto"
            title={collapsed ? 'Développer' : 'Réduire'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {collapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              )}
            </svg>
          </button>
        </div>

        {!collapsed && (
          <>
            {/* Server list */}
            <div className="flex-1 overflow-y-auto px-2">
              {serversByGroup.map(({ group, servers: groupServers }) => (
                <div key={group.name} className="mb-1">
                  {/* Group header */}
                  <div className="flex items-center justify-between px-2 py-1.5 group">
                    <button
                      onClick={() => toggleGroup(group.name)}
                      className="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider hover:text-gray-200 transition-colors"
                    >
                      <svg
                        className={`w-3 h-3 transition-transform ${collapsedGroups.has(group.name) ? '' : 'rotate-90'}`}
                        fill="currentColor" viewBox="0 0 24 24"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      <span style={{ color: group.color }}>{group.name}</span>
                      <span className="text-gray-600 ml-1">({groupServers.length})</span>
                    </button>
                    {group.name !== 'Par défaut' && (
                      <button
                        onClick={() => onDeleteGroup(group.name)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-dark-600 text-gray-500 hover:text-red-400 transition-all"
                        title="Supprimer le groupe"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Servers in group */}
                  {!collapsedGroups.has(group.name) && (
                    <div className="ml-2">
                      {groupServers.map(server => (
                        <ServerItem
                          key={server.id}
                          server={server}
                          onConnect={onConnect}
                          onContextMenu={handleContextMenu}
                        />
                      ))}
                      {groupServers.length === 0 && (
                        <p className="text-xs text-gray-600 px-3 py-2 italic">Aucun serveur</p>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Ungrouped servers */}
              {ungrouped.length > 0 && (
                <div className="mb-1">
                  <div className="px-2 py-1.5">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Non groupés ({ungrouped.length})
                    </span>
                  </div>
                  <div className="ml-2">
                    {ungrouped.map(server => (
                      <ServerItem
                        key={server.id}
                        server={server}
                        onConnect={onConnect}
                        onContextMenu={handleContextMenu}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom actions */}
            <div className="p-2 border-t border-dark-700 space-y-1.5 shrink-0">
              {showGroupInput ? (
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddGroup()}
                    placeholder="Nom du groupe"
                    className="flex-1 px-2 py-1 bg-dark-800 border border-dark-600 rounded text-xs text-gray-200 focus:outline-none focus:border-accent"
                    autoFocus
                  />
                  <button
                    onClick={handleAddGroup}
                    className="px-2 py-1 bg-accent rounded text-xs text-white hover:bg-accent-hover transition-colors"
                  >
                    OK
                  </button>
                  <button
                    onClick={() => { setShowGroupInput(false); setNewGroupName(''); }}
                    className="px-2 py-1 bg-dark-700 rounded text-xs text-gray-300 hover:bg-dark-600 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowGroupInput(true)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-gray-400 hover:text-gray-200 hover:bg-dark-700 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  Nouveau groupe
                </button>
              )}

              <button
                onClick={onAddServer}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-white bg-accent hover:bg-accent-hover transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Ajouter un serveur
              </button>

              <button
                onClick={onOpenSettings}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-gray-400 hover:text-gray-200 hover:bg-dark-700 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Mot de passe maître
              </button>
            </div>
          </>
        )}

        {/* Collapsed mode */}
        {collapsed && (
          <div className="flex-1 flex flex-col items-center py-3 gap-2">
            <button
              onClick={onAddServer}
              className="p-2 rounded-lg bg-accent hover:bg-accent-hover text-white transition-colors"
              title="Ajouter un serveur"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <div className="flex-1 overflow-y-auto flex flex-col items-center gap-1 w-full px-1.5">
              {servers.map(server => (
                <button
                  key={server.id}
                  onClick={() => onConnect(server)}
                  className="w-10 h-10 rounded-lg bg-dark-800 hover:bg-dark-700 flex items-center justify-center text-sm font-bold text-accent transition-colors"
                  title={`${server.alias} (${server.host})`}
                >
                  {server.alias.charAt(0).toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 bg-dark-800 border border-dark-600 rounded-lg shadow-xl py-1 min-w-[160px] animate-fade-in"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => { onConnect(contextMenu.server); setContextMenu(null); }}
              className="w-full px-3 py-1.5 text-left text-sm text-gray-200 hover:bg-dark-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Connecter
            </button>
            <button
              onClick={() => { onEditServer(contextMenu.server); setContextMenu(null); }}
              className="w-full px-3 py-1.5 text-left text-sm text-gray-200 hover:bg-dark-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Modifier
            </button>
            <div className="border-t border-dark-600 my-1" />
            <button
              onClick={() => { onDeleteServer(contextMenu.server.id); setContextMenu(null); }}
              className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-dark-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Supprimer
            </button>
          </div>
        </>
      )}
    </>
  );
}

// Individual server item
function ServerItem({
  server,
  onConnect,
  onContextMenu,
}: {
  server: ServerConfig;
  onConnect: (server: ServerConfig) => void;
  onContextMenu: (e: React.MouseEvent, server: ServerConfig) => void;
}) {
  return (
    <button
      onClick={() => onConnect(server)}
      onContextMenu={e => onContextMenu(e, server)}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-dark-800 group transition-colors text-left"
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
        style={{ backgroundColor: server.color || '#6366f1', color: 'white' }}
      >
        {server.icon || server.alias.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-200 truncate">{server.alias}</div>
        <div className="text-xs text-gray-500 truncate">
          {server.username}@{server.host}:{server.port}
        </div>
      </div>
      <svg
        className="w-4 h-4 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    </button>
  );
}
