import React, { useState } from 'react';

type SettingsView = 'menu' | 'set' | 'change' | 'remove-confirm';

interface MasterPasswordModalProps {
  mode: 'unlock' | 'settings';
  hasMasterPassword?: boolean;
  onSubmit: (password: string) => Promise<boolean>;
  onChangeMasterPassword?: (oldPassword: string, newPassword: string) => Promise<boolean>;
  onRemove?: () => Promise<void>;
  onClose: () => void;
}

export default function MasterPasswordModal({
  mode,
  hasMasterPassword = false,
  onSubmit,
  onChangeMasterPassword,
  onRemove,
  onClose,
}: MasterPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [settingsView, setSettingsView] = useState<SettingsView>('menu');

  const resetForm = () => {
    setPassword('');
    setConfirmPassword('');
    setOldPassword('');
    setError('');
  };

  const goTo = (view: SettingsView) => {
    resetForm();
    setSettingsView(view);
  };

  const handleUnlock = async () => {
    if (!password) return;
    setLoading(true);
    setError('');
    const success = await onSubmit(password);
    if (!success) {
      setError('Mot de passe incorrect');
    }
    setLoading(false);
  };

  const handleSetPassword = async () => {
    if (!password) return;
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    if (password.length < 4) {
      setError('Le mot de passe doit faire au moins 4 caractères');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSubmit(password);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !password) return;
    if (password !== confirmPassword) {
      setError('Les nouveaux mots de passe ne correspondent pas');
      return;
    }
    if (password.length < 4) {
      setError('Le mot de passe doit faire au moins 4 caractères');
      return;
    }
    if (oldPassword === password) {
      setError('Le nouveau mot de passe doit être différent de l\'ancien');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const ok = await onChangeMasterPassword?.(oldPassword, password);
      if (ok === false) {
        setError('Ancien mot de passe incorrect');
      } else {
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (onRemove) {
      setLoading(true);
      try {
        await onRemove();
        onClose();
      } catch (err: any) {
        setError(err?.message || 'Une erreur est survenue');
      } finally {
        setLoading(false);
      }
    }
  };

  if (mode === 'unlock') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark-950">
        <div className="bg-dark-900 border border-dark-700 rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 animate-slide-in">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-dark-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-100">AnotherTerminal</h2>
            <p className="text-sm text-gray-500 mt-1">Entrez votre mot de passe maître</p>
          </div>

          <div className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUnlock()}
              placeholder="Mot de passe maître"
              className="w-full px-4 py-3 bg-dark-800 border border-dark-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-accent transition-colors text-center"
              autoFocus
            />
            {error && (
              <p className="text-xs text-red-400 text-center">{error}</p>
            )}
            <button
              onClick={handleUnlock}
              disabled={loading || !password}
              className="w-full px-4 py-3 rounded-lg text-sm font-medium text-white bg-accent hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {loading ? 'Vérification...' : 'Déverrouiller'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Settings mode
  const settingsTitle = {
    menu: 'Mot de passe maître',
    set: 'Définir un mot de passe maître',
    change: 'Changer le mot de passe maître',
    'remove-confirm': 'Supprimer le mot de passe maître',
  }[settingsView];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in">
      <div className="bg-dark-900 border border-dark-700 rounded-xl shadow-2xl w-full max-w-sm mx-4 animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700">
          <div className="flex items-center gap-2">
            {settingsView !== 'menu' && (
              <button
                onClick={() => goTo('menu')}
                className="p-1 rounded hover:bg-dark-700 text-gray-400 hover:text-gray-200 transition-colors"
                title="Retour"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-lg font-semibold text-gray-100">{settingsTitle}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-dark-700 text-gray-400 hover:text-gray-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Menu principal */}
          {settingsView === 'menu' && (
            <>
              <p className="text-sm text-gray-400">
                Le mot de passe maître protège l'accès à l'application et chiffre vos identifiants.
              </p>
              <div className="space-y-2">
                {hasMasterPassword ? (
                  <>
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                      <span className="text-xs text-green-400">Mot de passe maître actif</span>
                    </div>
                    <button
                      onClick={() => goTo('change')}
                      className="w-full px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-accent hover:bg-accent-hover transition-colors"
                    >
                      🔄 Changer le mot de passe
                    </button>
                    {onRemove && (
                      <button
                        onClick={() => goTo('remove-confirm')}
                        className="w-full px-4 py-2.5 rounded-lg text-sm text-red-400 hover:bg-dark-800 border border-transparent hover:border-red-900 transition-colors"
                      >
                        🗑️ Supprimer le mot de passe
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <div className="w-2 h-2 rounded-full bg-gray-500" />
                      <span className="text-xs text-gray-500">Aucun mot de passe maître défini</span>
                    </div>
                    <button
                      onClick={() => goTo('set')}
                      className="w-full px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-accent hover:bg-accent-hover transition-colors"
                    >
                      🔑 Définir un mot de passe maître
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          {/* Définir */}
          {settingsView === 'set' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">Minimum 4 caractères. Ce mot de passe chiffrera tous vos identifiants.</p>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Nouveau mot de passe"
                className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-accent transition-colors"
                autoFocus
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSetPassword()}
                placeholder="Confirmer le mot de passe"
                className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-accent transition-colors"
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => goTo('menu')}
                  className="flex-1 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-dark-700 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSetPassword}
                  disabled={loading || !password || !confirmPassword}
                  className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-white bg-accent hover:bg-accent-hover disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Définition...' : 'Définir'}
                </button>
              </div>
            </div>
          )}

          {/* Changer */}
          {settingsView === 'change' && (
            <div className="space-y-3">
              <input
                type="password"
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                placeholder="Ancien mot de passe"
                className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-accent transition-colors"
                autoFocus
              />
              <div className="border-t border-dark-700 pt-3 space-y-3">
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Nouveau mot de passe"
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-accent transition-colors"
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
                  placeholder="Confirmer le nouveau mot de passe"
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => goTo('menu')}
                  className="flex-1 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-dark-700 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={loading || !oldPassword || !password || !confirmPassword}
                  className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-white bg-accent hover:bg-accent-hover disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Changement...' : 'Changer'}
                </button>
              </div>
            </div>
          )}

          {/* Confirmation suppression */}
          {settingsView === 'remove-confirm' && (
            <div className="space-y-4">
              <div className="bg-red-950/40 border border-red-900/50 rounded-lg px-4 py-3 text-sm text-red-300">
                ⚠️ Tous vos identifiants seront rechiffrés avec la clé machine. Vous ne pourrez plus verrouiller l'application.
              </div>
              <p className="text-sm text-gray-400">Êtes-vous sûr de vouloir supprimer le mot de passe maître ?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => goTo('menu')}
                  className="flex-1 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-dark-700 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleRemove}
                  disabled={loading}
                  className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Suppression...' : 'Supprimer'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
