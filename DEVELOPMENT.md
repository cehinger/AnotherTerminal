# Guide de développement AnotherTerminal

## Démarrage en mode dev

```bash
npm run dev
```

Ceci lance simultanément :
- **Vite** (renderer) sur `http://localhost:5173`
- **Electron** (main process) après 3 secondes

Les DevTools s'ouvrent automatiquement pour le debugging.

## Debugging

### Vérifier que l'API Electron est chargée

Ouvrez la console DevTools et tapez :
```javascript
window.electronAPI
```

Si c'est `undefined`, le preload script n'est pas chargé correctement.

### Logs de connexion SSH

- **Console DevTools** (Renderer) : Logs de l'interface React
- **Terminal** (Main process) : Logs SSH et IPC
  - `[SSH] Connecting to...` — Début de connexion
  - `[IPC] SSH_CONNECT request` — Requête IPC reçue

### Problèmes courants

#### Terminal noir / rien ne s'affiche

1. Vérifiez que `window.electronAPI` existe (voir ci-dessus)
2. Regardez les erreurs dans la console DevTools
3. Vérifiez les logs du terminal Node.js
4. Si authType = 'key', vérifiez que le chemin de la clé est correct et accessible

#### Fenêtre ne se lance pas

- Attendez 3-5 secondes que Vite démarre complètement
- Vérifiez que le port 5173 n'est pas utilisé par un autre process

#### Erreur "Cannot read key file"

Le chemin de la clé SSH est incorrect ou le fichier n'est pas accessible.
- Utilisez un chemin absolu : `/Users/vous/.ssh/id_rsa`
- Vérifiez les permissions du fichier

## Structure des logs

```
window.electronAPI available: true   ← preload chargé ✓
[IPC] SSH_CONNECT request: ...       ← requête IPC reçue
[SSH] Connecting to user@host:22     ← début connexion
SSH connection initiated successfully ← connexion réussie
```

## Rebuild après modifications

- **Renderer uniquement** : Vite recharge automatiquement
- **Main process** : Arrêter (Ctrl+C) et relancer `npm run dev`

## Production

```bash
npm run build    # Compile tout
npm start        # Lance l'app compilée
npm run dist:mac # Crée le .dmg macOS
```
