import React, { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { TerminalTab } from '../App';

interface TerminalTabsProps {
  tabs: TerminalTab[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
}

export default function TerminalTabs({ tabs, activeTabId, onSelectTab, onCloseTab }: TerminalTabsProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      {tabs.length > 0 && (
        <div className="flex items-center bg-dark-900 border-b border-dark-700 shrink-0 overflow-x-auto">
          <div className="drag-region w-full flex items-center min-h-[40px]">
            {tabs.map(tab => (
              <TabButton
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onSelect={() => onSelectTab(tab.id)}
                onClose={() => onCloseTab(tab.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Terminal area */}
      <div className="flex-1 relative bg-dark-950" style={{ minHeight: 0 }}>
        {tabs.length === 0 ? (
          <EmptyState />
        ) : (
          tabs.map(tab => (
            <TerminalView
              key={tab.id}
              tab={tab}
              isVisible={tab.id === activeTabId}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TabButton({
  tab,
  isActive,
  onSelect,
  onClose,
}: {
  tab: TerminalTab;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}) {
  const statusColor = {
    connecting: 'bg-yellow-500',
    connected: 'bg-green-500',
    disconnected: 'bg-gray-500',
    error: 'bg-red-500',
  }[tab.status];

  return (
    <div
      className={`no-drag flex items-center gap-2 px-3 py-2 border-r border-dark-700 cursor-pointer group transition-colors min-w-0 max-w-[200px] ${
        isActive
          ? 'bg-dark-950 text-gray-100'
          : 'bg-dark-900 text-gray-400 hover:bg-dark-800 hover:text-gray-200'
      }`}
      onClick={onSelect}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${statusColor}`} />
      <span className="text-xs font-medium truncate">{tab.serverAlias}</span>
      <button
        onClick={e => { e.stopPropagation(); onClose(); }}
        className="ml-auto p-0.5 rounded hover:bg-dark-600 text-gray-500 hover:text-gray-200 opacity-0 group-hover:opacity-100 transition-all shrink-0"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function TerminalView({ tab, isVisible }: { tab: TerminalTab; isVisible: boolean }) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) {
      console.error(`[TerminalView] No container ref for ${tab.id}`);
      return;
    }

    console.log(`[TerminalView] Initializing terminal for ${tab.id}`);
    
    const terminal = new Terminal({
      theme: {
        background: '#1a1b1f',
        foreground: '#e2e3e5',
        cursor: '#6366f1',
        cursorAccent: '#1a1b1f',
        selectionBackground: '#6366f144',
        black: '#1a1b1f',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#8b5cf6',
        cyan: '#06b6d4',
        white: '#e2e3e5',
        brightBlack: '#4d4e58',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#a78bfa',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Cascadia Code", "Fira Code", Consolas, monospace',
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 10000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    
    terminal.open(terminalRef.current);
    console.log(`[TerminalView] ✅ Terminal opened for ${tab.id}`);
    
    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Fit to container
    setTimeout(() => {
      try {
        fitAddon.fit();
        console.log(`[TerminalView] Terminal fitted: ${terminal.cols}x${terminal.rows}`);
        window.electronAPI.sshResize(tab.id, terminal.cols, terminal.rows);
      } catch (err) {
        console.error('[TerminalView] Fit error:', err);
      }
    }, 100);

    // Send user input to SSH
    terminal.onData(data => {
      window.electronAPI.sshWrite(tab.id, data);
    });

    // Receive SSH data
    const handleSSHData = (e: Event) => {
      const data = (e as CustomEvent).detail;
      console.log(`[TerminalView] Received ${data.length} bytes for ${tab.id}`);
      terminal.write(data);
    };
    
    window.addEventListener(`ssh-data-${tab.id}`, handleSSHData);
    console.log(`[TerminalView] Listening for ssh-data-${tab.id}`);

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        window.electronAPI.sshResize(tab.id, terminal.cols, terminal.rows);
      } catch {}
    });
    resizeObserver.observe(terminalRef.current);

    // Initial message
    terminal.writeln(`\x1b[1;34m→ Connexion à ${tab.serverAlias} (${tab.serverHost})...\x1b[0m\r\n`);

    return () => {
      console.log(`[TerminalView] Cleaning up ${tab.id}`);
      window.removeEventListener(`ssh-data-${tab.id}`, handleSSHData);
      resizeObserver.disconnect();
      terminal.dispose();
    };
  }, [tab.id, tab.serverAlias, tab.serverHost]);

  // Re-fit when tab becomes visible
  useEffect(() => {
    if (isVisible && fitAddonRef.current) {
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
        } catch {}
      }, 50);
    }
  }, [isVisible]);

  // Show error messages
  useEffect(() => {
    if (tab.status === 'error' && tab.error && xtermRef.current) {
      xtermRef.current.writeln(`\r\n\x1b[1;31m✘ Erreur : ${tab.error}\x1b[0m\r\n`);
    }
    if (tab.status === 'disconnected' && xtermRef.current) {
      xtermRef.current.writeln(`\r\n\x1b[1;33m⚡ Déconnecté\x1b[0m\r\n`);
    }
    if (tab.status === 'connected' && xtermRef.current) {
      // Connection success is shown by the shell prompt
    }
  }, [tab.status, tab.error]);

  return (
    <div
      ref={terminalRef}
      className={`terminal-container ${isVisible ? 'block' : 'hidden'}`}
      style={{ 
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%', 
        height: '100%',
        overflow: 'hidden'
      }}
    />
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-500">
      <svg className="w-20 h-20 mb-4 text-dark-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <h2 className="text-lg font-medium text-gray-400 mb-2">Aucune connexion active</h2>
      <p className="text-sm text-gray-600 max-w-sm text-center">
        Sélectionnez un serveur dans la barre latérale pour ouvrir une connexion SSH dans un nouvel onglet.
      </p>
    </div>
  );
}
