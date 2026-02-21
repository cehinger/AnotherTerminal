import React, { useEffect, useState } from 'react';

export function TitleBar() {
  const [platform, setPlatform] = useState<string>('');

  useEffect(() => {
    window.electronAPI.getPlatform().then(setPlatform);
  }, []);

  const handleMinimize = () => {
    window.electronAPI.windowMinimize();
  };

  const handleMaximize = () => {
    window.electronAPI.windowMaximize();
  };

  const handleClose = () => {
    window.electronAPI.windowClose();
  };

  const isMac = platform === 'darwin';

  return (
    <div className={`bg-dark-900 border-b border-dark-700 flex items-center select-none drag-region shrink-0 ${
      isMac ? 'h-11' : 'h-8'
    }`}>
      {/* Left spacer - reserves space for macOS traffic lights */}
      <div className={isMac ? 'w-20 shrink-0' : 'w-3 shrink-0'} />

      {/* Centered title */}
      <div className="flex-1 flex items-center justify-center">
        <span className={`font-medium text-gray-400 ${
          isMac ? 'text-xs' : 'text-sm'
        }`}>AnotherTerminal</span>
      </div>

      {/* Right side - window controls on Windows/Linux, spacer on macOS */}
      {isMac ? (
        <div className="w-20 shrink-0" />
      ) : (
        <div className="flex items-center no-drag shrink-0">
          <button
            onClick={handleMinimize}
            className="w-12 h-8 flex items-center justify-center hover:bg-dark-700 transition-colors group"
            title="R\u00e9duire"
          >
            <svg className="w-3 h-3 text-gray-400 group-hover:text-gray-200" fill="currentColor" viewBox="0 0 12 12">
              <rect x="0" y="5" width="12" height="2" />
            </svg>
          </button>
          <button
            onClick={handleMaximize}
            className="w-12 h-8 flex items-center justify-center hover:bg-dark-700 transition-colors group"
            title="Agrandir"
          >
            <svg className="w-3 h-3 text-gray-400 group-hover:text-gray-200" fill="currentColor" viewBox="0 0 12 12">
              <rect x="0" y="0" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          <button
            onClick={handleClose}
            className="w-12 h-8 flex items-center justify-center hover:bg-red-600 transition-colors group"
            title="Fermer"
          >
            <svg className="w-3 h-3 text-gray-400 group-hover:text-white" fill="currentColor" viewBox="0 0 12 12">
              <path d="M11.8 1.6L10.4 0.2 6 4.6 1.6 0.2 0.2 1.6 4.6 6 0.2 10.4 1.6 11.8 6 7.4 10.4 11.8 11.8 10.4 7.4 6z"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
