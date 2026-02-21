import React, { useState, useEffect } from 'react';
import { ServerConfig, ServerGroup } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';

interface ServerModalProps {
  server: ServerConfig | null;
  groups: ServerGroup[];
  onSave: (server: ServerConfig) => void;
  onClose: () => void;
}

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#64748b', '#78716c',
];

const ICONS = [
  '🖥️', '💻', '🌐', '🔧', '⚙️', '🚀', '📡', '🔌',
  '💾', '🗄️', '☁️', '🌩️', '⚡', '🔥', '💡', '🎯',
  '🏠', '🏢', '🏭', '🏗️', '🐧', '🪟', '🍎', '🐳',
];

export default function ServerModal({ server, groups, onSave, onClose }: ServerModalProps) {
  const [form, setForm] = useState({
    alias: '',
    host: '',
    port: 22,
    username: 'root',
    connectionType: 'ssh' as 'ssh' | 'sftp',
    authType: 'key' as 'password' | 'key',
    password: '',
    privateKeyPath: '',
    passphrase: '',
    group: groups[0]?.name || 'Par défaut',
    notes: '',
    color: COLORS[0],
    icon: ICONS[0],
  });

  const isEditing = !!server;

  useEffect(() => {
    if (server) {
      setForm({
        alias: server.alias,
        host: server.host,
        port: server.port,
        username: server.username,
        connectionType: server.connectionType,
        authType: server.authType,
        password: server.password || '',
        privateKeyPath: server.privateKeyPath || '',
        passphrase: server.passphrase || '',
        group: server.group,
        notes: server.notes,
        color: server.color || COLORS[0],
        icon: server.icon || ICONS[0],
      });
    }
  }, [server]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    const serverConfig: ServerConfig = {
      id: server?.id || uuidv4(),
      alias: form.alias.trim(),
      host: form.host.trim(),
      port: form.port,
      username: form.username.trim(),
      connectionType: form.connectionType,
      authType: form.authType,
      password: form.authType === 'password' ? form.password : undefined,
      privateKeyPath: form.authType === 'key' ? form.privateKeyPath : undefined,
      passphrase: form.authType === 'key' ? form.passphrase || undefined : undefined,
      group: form.group,
      notes: form.notes,
      color: form.color,
      icon: form.icon,
      createdAt: server?.createdAt || now,
      updatedAt: now,
    };
    onSave(serverConfig);
  };

  const handleSelectKey = async () => {
    const filePath = await window.electronAPI.selectFile();
    if (filePath) {
      setForm(f => ({ ...f, privateKeyPath: filePath }));
    }
  };

  const isValid = form.alias.trim() && form.host.trim() && form.username.trim() &&
    (form.authType === 'password' ? (form.password || isEditing) : form.privateKeyPath);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in">
      <div className="bg-dark-900 border border-dark-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700">
          <h2 className="text-lg font-semibold text-gray-100">
            {isEditing ? 'Modifier le serveur' : 'Nouveau serveur'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-dark-700 text-gray-400 hover:text-gray-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Alias & Color */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-400 mb-1">Alias</label>
              <input
                type="text"
                value={form.alias}
                onChange={e => setForm(f => ({ ...f, alias: e.target.value }))}
                placeholder="Mon serveur"
                className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-accent transition-colors"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Couleur</label>
              <div className="flex gap-1 flex-wrap max-w-[120px]">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={`w-5 h-5 rounded-full transition-transform ${form.color === c ? 'ring-2 ring-white scale-125' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Icône</label>
              <div className="flex gap-1 flex-wrap max-w-[200px]">
                {ICONS.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, icon }))}
                    className={`w-8 h-8 text-lg flex items-center justify-center rounded-lg transition-all ${form.icon === icon ? 'bg-accent/20 ring-2 ring-accent scale-110' : 'hover:bg-dark-700 hover:scale-105'}`}
                    title={icon}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Host & Port */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-400 mb-1">Hôte / IP</label>
              <input
                type="text"
                value={form.host}
                onChange={e => setForm(f => ({ ...f, host: e.target.value }))}
                placeholder="192.168.1.100 ou serveur.com"
                className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-accent transition-colors"
                required
              />
            </div>
            <div className="w-20">
              <label className="block text-xs font-medium text-gray-400 mb-1">Port</label>
              <input
                type="number"
                value={form.port}
                onChange={e => setForm(f => ({ ...f, port: parseInt(e.target.value) || 22 }))}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Utilisateur</label>
            <input
              type="text"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              placeholder="root"
              className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-accent transition-colors"
              required
            />
          </div>

          {/* Connection type */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Type de connexion</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setForm(f => ({ 
                    ...f, 
                    connectionType: 'ssh',
                    port: f.connectionType !== 'ssh' ? 22 : f.port
                  }));
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  form.connectionType === 'ssh'
                    ? 'bg-accent text-white'
                    : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
                }`}
              >
                SSH
              </button>
              <button
                type="button"
                onClick={() => {
                  setForm(f => ({ 
                    ...f, 
                    connectionType: 'sftp',
                    port: f.connectionType !== 'sftp' ? 22 : f.port
                  }));
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  form.connectionType === 'sftp'
                    ? 'bg-accent text-white'
                    : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
                }`}
              >
                SFTP
              </button>

            </div>
          </div>

          {/* Auth type */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Authentification</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, authType: 'key' }))}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  form.authType === 'key'
                    ? 'bg-accent text-white'
                    : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
                }`}
              >
                🔑 Clé SSH
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, authType: 'password' }))}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  form.authType === 'password'
                    ? 'bg-accent text-white'
                    : 'bg-dark-800 text-gray-400 hover:bg-dark-700'
                }`}
              >
                🔒 Mot de passe
              </button>
            </div>
          </div>

          {/* Auth fields */}
          {form.authType === 'password' ? (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Mot de passe</label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={isEditing ? '••••••••' : 'Mot de passe SSH'}
                className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Clé privée</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.privateKeyPath}
                    onChange={e => setForm(f => ({ ...f, privateKeyPath: e.target.value }))}
                    placeholder="~/.ssh/id_rsa"
                    className="flex-1 px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-accent transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleSelectKey}
                    className="px-3 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-sm text-gray-300 transition-colors"
                  >
                    Parcourir
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Passphrase (optionnel)</label>
                <input
                  type="password"
                  value={form.passphrase}
                  onChange={e => setForm(f => ({ ...f, passphrase: e.target.value }))}
                  placeholder="Passphrase de la clé"
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>
          )}

          {/* Group */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Groupe</label>
            <select
              value={form.group}
              onChange={e => setForm(f => ({ ...f, group: e.target.value }))}
              className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-accent transition-colors"
            >
              {groups.map(g => (
                <option key={g.name} value={g.name}>{g.name}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Notes (optionnel)</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Description, version OS, rôle..."
              rows={2}
              className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-accent transition-colors resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-dark-700">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-dark-700 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit as any}
            disabled={!isValid}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isEditing ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}
