# AnotherTerminal

Un gestionnaire de connexions SSH léger, multiplateforme, minimaliste et open source, conçu pour les développeurs et administrateurs systèmes qui veulent gérer efficacement leurs serveurs depuis une interface moderne et intuitive. Il combine la puissance d’un terminal complet avec la simplicité d’un outil graphique, tout en mettant l’accent sur la sécurité, la performance et l’organisation des connexions.

![Electron](https://img.shields.io/badge/Electron-28-47848F?logo=electron)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript)
![Version](https://img.shields.io/badge/version-0.1.0--alpha.1-orange)
![License](https://img.shields.io/badge/License-GPL--3.0-blue)

## Fonctionnalités

### 🔐 Sécurité
- **Stockage chiffré** — Mots de passe et clés SSH chiffrés en AES-256-GCM au repos
- **Mot de passe maître** — Protection optionnelle de l'accès à l'application ⚠️ **Non récupérable en cas d'oubli**
- **Authentification SSH** — Support clé privée (avec passphrase optionnelle) ou mot de passe

### 📡 Gestion des connexions
- **SSH** — Shell interactif complet avec émulation xterm-256color
- **SFTP** — Navigation et gestion de fichiers en ligne de commande (`ls`, `cd`, `get`, `put`, `mkdir`, `rm`...)
- **Connexions multiples** — Chaque serveur s'ouvre dans un onglet indépendant
- **Terminal complet** — Émulation xterm.js (256 couleurs, copier/coller, liens cliquables)
- **Redimensionnement adaptatif** — Le terminal s'ajuste automatiquement à la fenêtre

### 🗂️ Organisation
- **Groupes personnalisables** — Organisez vos serveurs par catégories
- **Icônes personnalisées** — 24 emojis disponibles pour identifier visuellement vos serveurs (🖥️, 💻, 🌐, 🔧, ⚙️, 🚀, etc.)
- **Couleurs d'accent** — Personnalisez la couleur de chaque serveur
- **Recherche rapide** — Filtrez vos serveurs par nom, hôte ou notes
- **Notes** — Ajoutez des informations supplémentaires sur chaque serveur

### 🎨 Interface
- **UI native adaptative** — S'adapte automatiquement à chaque plateforme
  - macOS : Barre de titre native avec traffic lights
  - Windows/Linux : Barre de titre personnalisée avec contrôles
- **Sidebar collapsible** — Réduisez la barre latérale pour plus d'espace terminal
- **Dark mode** — Interface sombre optimisée pour de longues sessions
- **Animations fluides** — Transitions et feedbacks visuels soignés

### 🚀 Performance
- **Léger et rapide** — Application native Electron optimisée
- **Connexions persistantes** — Les sessions SSH restent actives en arrière-plan
- **Multiplateforme** — Un seul code source pour macOS, Linux et Windows

## Stack technique

| Composant | Technologie |
|-----------|------------|
| Framework | Electron 28 |
| Frontend | React 18 + TypeScript |
| Terminal | xterm.js 5 |
| SSH | ssh2 (natif Node.js) |
| Style | Tailwind CSS 3 |
| Build | Vite + electron-builder |
| Chiffrement | AES-256-GCM (crypto natif) |

## Prérequis

- **Node.js** ≥ 18
- **npm** ≥ 9

## Installation

### Pour les développeurs

```bash
# Cloner le dépôt
git clone https://github.com/votre-utilisateur/AnotherTerminal.git
cd AnotherTerminal

# Installer les dépendances
npm install

# Lancer en mode développement
npm run dev
```

## Développement

```bash
# Lancer en mode développement (renderer + main process)
npm run dev
```

Le renderer Vite démarre sur `http://localhost:5173` et Electron se connecte automatiquement.

## Build

```bash
# Build complet (renderer + main)
npm run build

# Lancer l'application compilée
npm start
```

## Distribution

Création d'installateurs natifs pour chaque plateforme :

```bash
# macOS (.dmg, .zip)
npm run dist:mac

# Linux (.AppImage, .deb)
npm run dist:linux

# Windows (.exe via NSIS, .zip)
npm run dist:win

# Toutes les plateformes
npm run dist
```

Les fichiers générés se trouvent dans le dossier `release/`.

## Architecture

```
src/
├── main/                  # Process principal Electron
│   ├── main.ts            # Point d'entrée Electron
│   ├── preload.ts         # Bridge sécurisé (contextBridge)
│   ├── ipc.ts             # Gestionnaires IPC
│   ├── ssh.ts             # Service SSH (ssh2)
│   ├── store.ts           # Stockage des données
│   └── crypto.ts          # Chiffrement AES-256-GCM
├── renderer/              # Interface React
│   ├── App.tsx             # Composant principal
│   ├── main.tsx            # Point d'entrée React
│   ├── components/
│   │   ├── Sidebar.tsx     # Barre latérale (liste serveurs)
│   │   ├── ServerModal.tsx # Formulaire ajout/modification
│   │   ├── TerminalTabs.tsx # Onglets + terminal xterm.js
│   │   └── MasterPasswordModal.tsx
│   ├── styles/
│   │   └── globals.css     # Styles globaux + Tailwind
│   └── types/
│       └── electron.d.ts   # Types pour l'API Electron
└── shared/
    └── types.ts            # Types partagés (main & renderer)
```

## Sécurité

- Les mots de passe et passphrases sont **chiffrés en AES-256-GCM** avant d'être stockés
- Le sel et le vecteur d'initialisation (IV) sont générés aléatoirement pour chaque valeur
- La clé de chiffrement est dérivée via **PBKDF2** (100 000 itérations, SHA-512)
- Le mot de passe maître (optionnel) remplace la clé machine par défaut
- **Aucune donnée sensible n'est transmise au renderer** en clair — les mots de passe sont masqués dans la liste
- Le `contextIsolation` est activé et le `nodeIntegration` est désactivé

## Raccourcis clavier

| Action | Raccourci |
|--------|-----------|
| Copier | `Cmd/Ctrl + C` (avec sélection) |
| Coller | `Cmd/Ctrl + V` |
| Nouvel onglet | Cliquer sur un serveur |
| Fermer l'onglet | Bouton × sur l'onglet |

## Données

Les configurations sont stockées dans :
- **macOS** : `~/Library/Application Support/another-terminal/servers.json`
- **Linux** : `~/.config/another-terminal/servers.json`
- **Windows** : `%APPDATA%/another-terminal/servers.json`

## 🛠️ Développement

### Structure du projet

Le projet utilise une architecture Electron classique avec séparation main/renderer :
- **Main process** : Gestion de la fenêtre, IPC handlers, logique SSH et chiffrement
- **Renderer process** : Interface React isolée avec accès contrôlé via `contextBridge`
- **Shared types** : Types TypeScript partagés entre les deux processus

### ✅ Scripts disponibles

```bash
npm run dev          # Développement (hot-reload activé)
npm run build        # Build production (renderer + main)
npm start            # Lancer l'app compilée
npm run dist         # Créer les installateurs pour toutes les plateformes
npm run dist:mac     # Créer .dmg/.zip pour macOS
npm run dist:linux   # Créer .AppImage/.deb pour Linux
npm run dist:win     # Créer .exe pour Windows
```

### Technologies clés

- **Electron 28** : Framework multiplateforme
- **React 18** : Interface utilisateur réactive
- **TypeScript 5.3** : Typage statique
- **Vite 5** : Build rapide pour le renderer
- **xterm.js 5** : Émulation terminal
- **ssh2** : Bibliothèque SSH native Node.js
- **Tailwind CSS 3** : Framework CSS utility-first
- **electron-builder** : Packaging multiplateforme

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
- Ouvrir une issue pour signaler un bug ou proposer une fonctionnalité
- Soumettre une pull request avec vos améliorations
- Améliorer la documentation

## 📋 Roadmap (par ordre de priorité)

### Majeur
- [ ] Split panes pour des terminaux côte à côté
- [ ] Recherche de chaîne de caractère dans le terminal (Ctrl+F)
- [ ] SFTP : interface visuelle de gestion de fichiers (au lieu du mode CLI actuel)

### Intermédiaires
- [ ] Reconnexion automatique en cas de déconnexion
- [ ] Historique des commandes
- [ ] Duplication de serveurs
- [ ] Bottombar de commandes personnalisées enregistrées par l'utilisateur
- [ ] Macros/Scripts pour une automatisation de séquences de commandes
- [ ] Import/export de configurations

### Mineures
- [ ] Glisser-déposer pour réordonner les serveurs & groupes
- [ ] Afficher la date et l'heure de la dernière connexion
- [ ] Ajustement de la taille de la police
- [ ] Thèmes personnalisables

## 📄 Licence

GPL-3.0 © 2026 — Logiciel libre sous licence GNU General Public License v3.0.

Vous êtes libre d'utiliser, modifier et distribuer ce logiciel. Toute distribution (modifiée ou non) doit inclure le code source et rester sous licence GPL-3.0. Cela empêche la vente propriétaire tout en préservant la liberté du logiciel.
