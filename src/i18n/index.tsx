/* ================================================================
   Fit — i18n System
   Lightweight translation layer with React Context.
   ================================================================ */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type Lang = 'en' | 'it' | 'es' | 'fr' | 'de';

const STORAGE_KEY = 'fit_language';

/* ── Translation Dictionary ────────────────────────────────────── */
const translations: Record<Lang, Record<string, string>> = {
  en: {
    'app.name': 'Fit',
    'app.description': 'Your personal, lightweight agentic development environment.',

    // Welcome
    'welcome.noProject': 'No Project Open',
    'welcome.subtitle': 'Open a Project to Get Started',
    'welcome.openProject': 'Open Project',
    'welcome.recentProjects': 'Recent Projects',
    'dialog.openWorkspace': 'Open Workspace Folder',

    // MainContent
    'main.welcome': 'Welcome to Fit',
    'main.subtitle': 'Add a workspace and create a session to get started.',

    // SessionPanel
    'session.newSession': 'New session',
    'session.workspaceOptions': 'Workspace options',
    'session.archive': 'Archive session',
    'session.renameHint': 'Double click to rename',
    'session.empty': 'No terminals in this session',
    'session.addTerminal': 'Add Terminal',

    // FileDrawer
    'drawer.allFiles': 'All files',
    'drawer.files': 'Files',
    'drawer.sourceControl': 'Source Control',
    'drawer.noWorkspace': 'No workspace selected',
    'drawer.loading': 'Loading...',
    'drawer.emptyWorkspace': 'Workspace is empty',

    // Git
    'git.noActiveWorkspace': 'No active workspace',
    'git.loading': 'Loading Git status...',
    'git.noRepo': 'No repository',
    'git.noRepoSubtitle': 'The active workspace is not inside a Git repository.',
    'git.currentBranch': 'Current branch',
    'git.pull': 'Pull from remote',
    'git.fetch': 'Fetch from remote',
    'git.refresh': 'Refresh status',
    'git.commitMessage': 'Commit message',
    'git.commitHint': 'Ctrl+Enter to commit',
    'git.staged': '{count} file staged',
    'git.staged_plural': '{count} files staged',
    'git.noStaged': 'No files staged',
    'git.committing': 'Committing...',
    'git.commit': 'Commit',
    'git.pushing': 'Pushing...',
    'git.push': 'Push',
    'git.stagedChanges': 'STAGED CHANGES',
    'git.changes': 'CHANGES',
    'git.all': 'All',
    'git.unstageAll': 'Unstage all files',
    'git.unstage': 'Unstage change',
    'git.stageAll': 'Stage all changes',
    'git.stage': 'Stage change',
    'git.noChanges': 'No changes detected',
    'git.unsyncedCommits': 'UNSYNCED COMMITS ({count})',
    'git.discard': 'Discard changes',
    'git.openFile': 'Open file',


    // TitleBar / TabBar
    'title.sourceControl': 'Source Control',
    'title.toggleFiles': 'Toggle All Files',
    'title.settings': 'Settings',
    'title.minimize': 'Minimize',
    'title.maximize': 'Maximize',
    'title.close': 'Close',
    'title.closeTab': 'Close tab',
    'title.preview': 'Preview',
    'toolbar.openPreview': 'Open Live Preview',

    // Preview
    'preview.nothing': 'Nothing to preview yet',
    'preview.subtitle': 'Type a URL above, or open the {ports} dropdown to jump straight to your running dev server.',
    'preview.ports': 'Ports',
    'preview.checking': 'checking...',
    'preview.refresh': 'Refresh',
    'preview.openBrowser': 'Open in browser',
    'preview.placeholder': 'http://localhost:3000',
    'preview.portUnreachable': 'Port Unreachable',
    'preview.noServer': 'No active server was detected on port :{port}. Please start your development server on this port and try again.',
    'preview.errorVerify': 'An error occurred while verifying port :{port}.',
    'preview.recursive': 'Cannot load the Fit application recursively inside the preview frame.',
    'preview.dismiss': 'Dismiss',

    // Settings
    'settings.general': 'General',
    'settings.shortcuts': 'Shortcuts',
    'settings.desktop': 'Fit Desktop',
    'settings.version': 'v1.0.0',
    'settings.language': 'Language',
    'settings.languageDesc': 'Change the display language for Fit',
    'settings.webgl': 'Use WebGL renderer',
    'settings.webglDesc': 'Hardware-accelerated rendering. Turn off if text shows corruption or blank tiles.',
    'settings.updates': 'Updates',
    'settings.checkOnStartup': 'Check for updates on startup',
    'settings.checkOnStartupDesc': 'Automatically check for new versions when the app launches',
    'settings.releaseNotes': 'Show release notes',
    'settings.releaseNotesDesc': 'Display release notes after updating to a new version',
    'settings.checkUpdates': 'Check for updates',
    'settings.checkUpdatesDesc': 'Manually check if a newer version is available',
    'settings.checkNow': 'Check now',
    'settings.latest': 'You are on the latest version.',
    'settings.shortcutsSoon': 'Keyboard shortcuts configuration coming soon.',
    'settings.updater.downloading': 'Downloading update...',
    'settings.updater.install': 'Install & Restart',
    'settings.updater.available': 'Update {version} is available.',
    'settings.updater.devMode': 'Update check is not available in development mode.',

    // Workspace
    'workspace.edit': 'Edit',
    'workspace.closeProject': 'Close project',
    'workspace.editTitle': 'Edit project',
    'workspace.name': 'Name',
    'workspace.namePlaceholder': 'Project name...',
    'workspace.icon': 'Icon',
    'workspace.iconHint': 'Click or drag an image',
    'workspace.iconSize': 'Recommended: 128x128px',
    'workspace.color': 'Color',
    'workspace.cancel': 'Cancel',
    'workspace.save': 'Save',

    // Terminal
    'terminal.splitRight': 'Split terminal right',
    'terminal.splitDown': 'Split terminal down',
    'terminal.togglePreview': 'Toggle Live Preview',
    'terminal.close': 'Close terminal',
  },
  it: {
    'app.name': 'Fit',
    'app.description': 'Il tuo ambiente di sviluppo agentico, leggero e personale.',

    'welcome.noProject': 'Nessun progetto aperto',
    'welcome.subtitle': 'Apri un progetto per iniziare',
    'welcome.openProject': 'Apri progetto',
    'welcome.recentProjects': 'Progetti recenti',
    'dialog.openWorkspace': 'Apri cartella workspace',

    'main.welcome': 'Benvenuto in Fit',
    'main.subtitle': 'Aggiungi un workspace e crea una sessione per iniziare.',

    'session.newSession': 'Nuova sessione',
    'session.workspaceOptions': 'Opzioni workspace',
    'session.archive': 'Archivia sessione',
    'session.renameHint': 'Doppio clic per rinominare',
    'session.empty': 'Nessun terminale in questa sessione',
    'session.addTerminal': 'Aggiungi terminale',

    'drawer.allFiles': 'Tutti i file',
    'drawer.files': 'File',
    'drawer.sourceControl': 'Controllo versione',
    'drawer.noWorkspace': 'Nessun workspace selezionato',
    'drawer.loading': 'Caricamento...',
    'drawer.emptyWorkspace': 'Il workspace è vuoto',

    'git.noActiveWorkspace': 'Nessun workspace attivo',
    'git.loading': 'Caricamento stato Git...',
    'git.noRepo': 'Nessun repository',
    'git.noRepoSubtitle': 'Il workspace attivo non è all\'interno di un repository Git.',
    'git.currentBranch': 'Branch corrente',
    'git.pull': 'Pull da remoto',
    'git.fetch': 'Fetch da remoto',
    'git.refresh': 'Aggiorna stato',
    'git.commitMessage': 'Messaggio di commit',
    'git.commitHint': 'Ctrl+Enter per committare',
    'git.staged': '{count} file in stage',
    'git.staged_plural': '{count} file in stage',
    'git.noStaged': 'Nessun file in stage',
    'git.committing': 'Commit in corso...',
    'git.commit': 'Commit',
    'git.pushing': 'Push in corso...',
    'git.push': 'Push',
    'git.stagedChanges': 'MODIFICHE IN STAGE',
    'git.changes': 'MODIFICHE',
    'git.all': 'Tutti',
    'git.unstageAll': 'Rimuovi tutti dallo stage',
    'git.unstage': 'Rimuovi dallo stage',
    'git.stageAll': 'Metti tutti in stage',
    'git.stage': 'Metti in stage',
    'git.noChanges': 'Nessuna modifica rilevata',
    'git.unsyncedCommits': 'COMMIT NON SINCRONIZZATI ({count})',
    'git.discard': 'Annulla modifiche',
    'git.openFile': 'Apri file',


    'title.sourceControl': 'Controllo versione',
    'title.toggleFiles': 'Mostra tutti i file',
    'title.settings': 'Impostazioni',
    'title.minimize': 'Minimizza',
    'title.maximize': 'Massimizza',
    'title.close': 'Chiudi',
    'title.closeTab': 'Chiudi tab',
    'title.preview': 'Anteprima',
    'toolbar.openPreview': 'Apri anteprima live',

    'preview.nothing': 'Niente da visualizzare',
    'preview.subtitle': 'Scrivi un URL sopra, o apri il menu {ports} per saltare direttamente al tuo server di sviluppo attivo.',
    'preview.ports': 'Porte',
    'preview.checking': 'verifica...',
    'preview.refresh': 'Aggiorna',
    'preview.openBrowser': 'Apri nel browser',
    'preview.placeholder': 'http://localhost:3000',
    'preview.portUnreachable': 'Porta irraggiungibile',
    'preview.noServer': 'Nessun server attivo rilevato sulla porta :{port}. Avvia il tuo server di sviluppo su questa porta e riprova.',
    'preview.errorVerify': 'Si è verificato un errore durante la verifica della porta :{port}.',
    'preview.recursive': 'Impossibile caricare l\'app Fit ricorsivamente all\'interno del frame di anteprima.',
    'preview.dismiss': 'Chiudi',

    'settings.general': 'Generale',
    'settings.shortcuts': 'Scorciatoie',
    'settings.desktop': 'Fit Desktop',
    'settings.version': 'v1.0.0',
    'settings.language': 'Lingua',
    'settings.languageDesc': 'Cambia la lingua di visualizzazione di Fit',
    'settings.webgl': 'Usa renderer WebGL',
    'settings.webglDesc': 'Rendering accelerato hardware. Disattiva se il testo mostra corruzione o tessere vuote.',
    'settings.updates': 'Aggiornamenti',
    'settings.checkOnStartup': 'Controlla aggiornamenti all\'avvio',
    'settings.checkOnStartupDesc': 'Controlla automaticamente la presenza di nuove versioni all\'avvio dell\'app',
    'settings.releaseNotes': 'Mostra note di rilascio',
    'settings.releaseNotesDesc': 'Visualizza le note di rilascio dopo l\'aggiornamento a una nuova versione',
    'settings.checkUpdates': 'Controlla aggiornamenti',
    'settings.checkUpdatesDesc': 'Controlla manualmente se è disponibile una versione più recente',
    'settings.checkNow': 'Controlla ora',
    'settings.latest': 'Sei sull\'ultima versione disponibile.',
    'settings.shortcutsSoon': 'La configurazione delle scorciatoie da tastiera arriverà presto.',
    'settings.updater.downloading': 'Download aggiornamento...',
    'settings.updater.install': 'Installa e riavvia',
    'settings.updater.available': 'Aggiornamento {version} disponibile.',
    'settings.updater.devMode': 'Il controllo aggiornamenti non è disponibile in modalità sviluppo.',

    // Workspace
    'workspace.edit': 'Modifica',
    'workspace.closeProject': 'Chiudi progetto',
    'workspace.editTitle': 'Modifica progetto',
    'workspace.name': 'Nome',
    'workspace.namePlaceholder': 'Nome progetto...',
    'workspace.icon': 'Icona',
    'workspace.iconHint': 'Clicca o trascina un\'immagine',
    'workspace.iconSize': 'Consigliato: 128x128px',
    'workspace.color': 'Colore',
    'workspace.cancel': 'Annulla',
    'workspace.save': 'Salva',

    'terminal.splitRight': 'Dividi terminale a destra',
    'terminal.splitDown': 'Dividi terminale in basso',
    'terminal.togglePreview': 'Attiva/disattiva anteprima live',
    'terminal.close': 'Chiudi terminale',
  },
  es: {
    'app.name': 'Fit',
    'app.description': 'Tu entorno de desarrollo agentico, ligero y personal.',

    'welcome.noProject': 'Ningún proyecto abierto',
    'welcome.subtitle': 'Abre un proyecto para empezar',
    'welcome.openProject': 'Abrir proyecto',
    'welcome.recentProjects': 'Proyectos recientes',
    'dialog.openWorkspace': 'Abrir carpeta del workspace',

    'main.welcome': 'Bienvenido a Fit',
    'main.subtitle': 'Agrega un workspace y crea una sesión para empezar.',

    'session.newSession': 'Nueva sesión',
    'session.workspaceOptions': 'Opciones del workspace',
    'session.archive': 'Archivar sesión',
    'session.renameHint': 'Doble clic para renombrar',
    'session.empty': 'No hay terminales en esta sesión',
    'session.addTerminal': 'Agregar terminal',

    'drawer.allFiles': 'Todos los archivos',
    'drawer.files': 'Archivos',
    'drawer.sourceControl': 'Control de código',
    'drawer.noWorkspace': 'Ningún workspace seleccionado',
    'drawer.loading': 'Cargando...',
    'drawer.emptyWorkspace': 'El workspace está vacío',

    'git.noActiveWorkspace': 'Ningún workspace activo',
    'git.loading': 'Cargando estado de Git...',
    'git.noRepo': 'Ningún repositorio',
    'git.noRepoSubtitle': 'El workspace activo no está dentro de un repositorio Git.',
    'git.currentBranch': 'Rama actual',
    'git.pull': 'Pull desde remoto',
    'git.fetch': 'Fetch desde remoto',
    'git.refresh': 'Actualizar estado',
    'git.commitMessage': 'Mensaje de commit',
    'git.commitHint': 'Ctrl+Enter para hacer commit',
    'git.staged': '{count} archivo en stage',
    'git.staged_plural': '{count} archivos en stage',
    'git.noStaged': 'Ningún archivo en stage',
    'git.committing': 'Haciendo commit...',
    'git.commit': 'Commit',
    'git.pushing': 'Haciendo push...',
    'git.push': 'Push',
    'git.stagedChanges': 'CAMBIOS EN STAGE',
    'git.changes': 'CAMBIOS',
    'git.all': 'Todos',
    'git.unstageAll': 'Quitar todos del stage',
    'git.unstage': 'Quitar del stage',
    'git.stageAll': 'Poner todos en stage',
    'git.stage': 'Poner en stage',
    'git.noChanges': 'No se detectaron cambios',
    'git.unsyncedCommits': 'COMMITS NO SINCRONIZADOS ({count})',
    'git.discard': 'Descartar cambios',
    'git.openFile': 'Abrir archivo',


    'title.sourceControl': 'Control de código',
    'title.toggleFiles': 'Mostrar todos los archivos',
    'title.settings': 'Configuración',
    'title.minimize': 'Minimizar',
    'title.maximize': 'Maximizar',
    'title.close': 'Cerrar',
    'title.closeTab': 'Cerrar pestaña',
    'title.preview': 'Vista previa',
    'toolbar.openPreview': 'Abrir vista previa',

    'preview.nothing': 'Nada para visualizar',
    'preview.subtitle': 'Escribe una URL arriba, o abre el menú {ports} para ir directamente a tu servidor de desarrollo activo.',
    'preview.ports': 'Puertos',
    'preview.checking': 'verificando...',
    'preview.refresh': 'Actualizar',
    'preview.openBrowser': 'Abrir en el navegador',
    'preview.placeholder': 'http://localhost:3000',
    'preview.portUnreachable': 'Puerto inaccesible',
    'preview.noServer': 'No se detectó ningún servidor activo en el puerto :{port}. Inicia tu servidor de desarrollo en este puerto e inténtalo de nuevo.',
    'preview.errorVerify': 'Ocurrió un error al verificar el puerto :{port}.',
    'preview.recursive': 'No se puede cargar la aplicación Fit recursivamente dentro del marco de vista previa.',
    'preview.dismiss': 'Descartar',

    'settings.general': 'General',
    'settings.shortcuts': 'Atajos',
    'settings.desktop': 'Fit Desktop',
    'settings.version': 'v1.0.0',
    'settings.language': 'Idioma',
    'settings.languageDesc': 'Cambia el idioma de visualización de Fit',
    'settings.webgl': 'Usar renderizador WebGL',
    'settings.webglDesc': 'Renderizado acelerado por hardware. Desactívalo si el texto muestra corrupción o mosaicos en blanco.',
    'settings.updates': 'Actualizaciones',
    'settings.checkOnStartup': 'Buscar actualizaciones al iniciar',
    'settings.checkOnStartupDesc': 'Buscar automáticamente nuevas versiones cuando se inicia la aplicación',
    'settings.releaseNotes': 'Mostrar notas de versión',
    'settings.releaseNotesDesc': 'Mostrar notas de versión después de actualizar a una nueva versión',
    'settings.checkUpdates': 'Buscar actualizaciones',
    'settings.checkUpdatesDesc': 'Comprobar manualmente si hay una versión más reciente disponible',
    'settings.checkNow': 'Buscar ahora',
    'settings.latest': 'Estás en la última versión.',
    'settings.shortcutsSoon': 'La configuración de atajos de teclado llegará pronto.',
    'settings.updater.downloading': 'Descargando actualización...',
    'settings.updater.install': 'Instalar y reiniciar',
    'settings.updater.available': 'Actualización {version} disponible.',
    'settings.updater.devMode': 'La verificación de actualizaciones no está disponible en modo desarrollo.',

    // Workspace
    'workspace.edit': 'Editar',
    'workspace.closeProject': 'Cerrar proyecto',
    'workspace.editTitle': 'Editar proyecto',
    'workspace.name': 'Nombre',
    'workspace.namePlaceholder': 'Nombre del proyecto...',
    'workspace.icon': 'Icono',
    'workspace.iconHint': 'Haz clic o arrastra una imagen',
    'workspace.iconSize': 'Recomendado: 128x128px',
    'workspace.color': 'Color',
    'workspace.cancel': 'Cancelar',
    'workspace.save': 'Guardar',

    'terminal.splitRight': 'Dividir terminal a la derecha',
    'terminal.splitDown': 'Dividir terminal hacia abajo',
    'terminal.togglePreview': 'Alternar vista previa',
    'terminal.close': 'Cerrar terminal',
  },
  fr: {
    'app.name': 'Fit',
    'app.description': 'Votre environnement de développement agentique, léger et personnel.',

    'welcome.noProject': 'Aucun projet ouvert',
    'welcome.subtitle': 'Ouvrez un projet pour commencer',
    'welcome.openProject': 'Ouvrir un projet',
    'welcome.recentProjects': 'Projets récents',
    'dialog.openWorkspace': 'Ouvrir le dossier du workspace',

    'main.welcome': 'Bienvenue dans Fit',
    'main.subtitle': 'Ajoutez un workspace et créez une session pour commencer.',

    'session.newSession': 'Nouvelle session',
    'session.workspaceOptions': 'Options du workspace',
    'session.archive': 'Archiver la session',
    'session.renameHint': 'Double-cliquez pour renommer',
    'session.empty': 'Aucun terminal dans cette session',
    'session.addTerminal': 'Ajouter un terminal',

    'drawer.allFiles': 'Tous les fichiers',
    'drawer.files': 'Fichiers',
    'drawer.sourceControl': 'Contrôle de version',
    'drawer.noWorkspace': 'Aucun workspace sélectionné',
    'drawer.loading': 'Chargement...',
    'drawer.emptyWorkspace': 'Le workspace est vide',

    'git.noActiveWorkspace': 'Aucun workspace actif',
    'git.loading': 'Chargement du statut Git...',
    'git.noRepo': 'Aucun dépôt',
    'git.noRepoSubtitle': 'Le workspace actif n\'est pas dans un dépôt Git.',
    'git.currentBranch': 'Branche actuelle',
    'git.pull': 'Pull depuis le remote',
    'git.fetch': 'Fetch depuis le remote',
    'git.refresh': 'Actualiser le statut',
    'git.commitMessage': 'Message de commit',
    'git.commitHint': 'Ctrl+Enter pour commit',
    'git.staged': '{count} fichier en stage',
    'git.staged_plural': '{count} fichiers en stage',
    'git.noStaged': 'Aucun fichier en stage',
    'git.committing': 'Commit en cours...',
    'git.commit': 'Commit',
    'git.pushing': 'Push en cours...',
    'git.push': 'Push',
    'git.stagedChanges': 'MODIFICATIONS EN STAGE',
    'git.changes': 'MODIFICATIONS',
    'git.all': 'Tous',
    'git.unstageAll': 'Retirer tout du stage',
    'git.unstage': 'Retirer du stage',
    'git.stageAll': 'Mettre tout en stage',
    'git.stage': 'Mettre en stage',
    'git.noChanges': 'Aucune modification détectée',
    'git.unsyncedCommits': 'COMMITS NON SYNCHRONISÉS ({count})',
    'git.discard': 'Abandonner les modifications',
    'git.openFile': 'Ouvrir le fichier',


    'title.sourceControl': 'Contrôle de version',
    'title.toggleFiles': 'Afficher tous les fichiers',
    'title.settings': 'Paramètres',
    'title.minimize': 'Réduire',
    'title.maximize': 'Agrandir',
    'title.close': 'Fermer',
    'title.closeTab': 'Fermer l\'onglet',
    'title.preview': 'Aperçu',
    'toolbar.openPreview': 'Ouvrir l\'aperçu',

    'preview.nothing': 'Rien à prévisualiser',
    'preview.subtitle': 'Tapez une URL ci-dessus, ou ouvrez le menu {ports} pour accéder directement à votre serveur de développement actif.',
    'preview.ports': 'Ports',
    'preview.checking': 'vérification...',
    'preview.refresh': 'Actualiser',
    'preview.openBrowser': 'Ouvrir dans le navigateur',
    'preview.placeholder': 'http://localhost:3000',
    'preview.portUnreachable': 'Port inaccessible',
    'preview.noServer': 'Aucun serveur actif détecté sur le port :{port}. Démarrez votre serveur de développement sur ce port et réessayez.',
    'preview.errorVerify': 'Une erreur s\'est produite lors de la vérification du port :{port}.',
    'preview.recursive': 'Impossible de charger l\'application Fit de manière récursive dans le cadre d\'aperçu.',
    'preview.dismiss': 'Ignorer',

    'settings.general': 'Général',
    'settings.shortcuts': 'Raccourcis',
    'settings.desktop': 'Fit Desktop',
    'settings.version': 'v1.0.0',
    'settings.language': 'Langue',
    'settings.languageDesc': 'Changer la langue d\'affichage de Fit',
    'settings.webgl': 'Utiliser le rendu WebGL',
    'settings.webglDesc': 'Rendu accéléré matériellement. Désactivez si le texte montre de la corruption ou des tuiles vides.',
    'settings.updates': 'Mises à jour',
    'settings.checkOnStartup': 'Rechercher des mises à jour au démarrage',
    'settings.checkOnStartupDesc': 'Rechercher automatiquement de nouvelles versions au lancement de l\'application',
    'settings.releaseNotes': 'Afficher les notes de version',
    'settings.releaseNotesDesc': 'Afficher les notes de version après la mise à jour vers une nouvelle version',
    'settings.checkUpdates': 'Rechercher des mises à jour',
    'settings.checkUpdatesDesc': 'Vérifier manuellement si une version plus récente est disponible',
    'settings.checkNow': 'Rechercher',
    'settings.latest': 'Vous êtes sur la dernière version.',
    'settings.shortcutsSoon': 'La configuration des raccourcis clavier arrivera bientôt.',
    'settings.updater.downloading': 'Téléchargement de la mise à jour...',
    'settings.updater.install': 'Installer et redémarrer',
    'settings.updater.available': 'Mise à jour {version} disponible.',
    'settings.updater.devMode': 'La vérification des mises à jour n\'est pas disponible en mode développement.',

    // Workspace
    'workspace.edit': 'Modifier',
    'workspace.closeProject': 'Fermer le projet',
    'workspace.editTitle': 'Modifier le projet',
    'workspace.name': 'Nom',
    'workspace.namePlaceholder': 'Nom du projet...',
    'workspace.icon': 'Icône',
    'workspace.iconHint': 'Cliquez ou faites glisser une image',
    'workspace.iconSize': 'Recommandé : 128x128px',
    'workspace.color': 'Couleur',
    'workspace.cancel': 'Annuler',
    'workspace.save': 'Enregistrer',

    'terminal.splitRight': 'Diviser le terminal à droite',
    'terminal.splitDown': 'Diviser le terminal vers le bas',
    'terminal.togglePreview': 'Basculer l\'aperçu',
    'terminal.close': 'Fermer le terminal',
  },
  de: {
    'app.name': 'Fit',
    'app.description': 'Ihre persönliche, leichtgewichtige agentische Entwicklungsumgebung.',

    'welcome.noProject': 'Kein Projekt geöffnet',
    'welcome.subtitle': 'Öffnen Sie ein Projekt, um zu beginnen',
    'welcome.openProject': 'Projekt öffnen',
    'welcome.recentProjects': 'Kürzliche Projekte',
    'dialog.openWorkspace': 'Workspace-Ordner öffnen',

    'main.welcome': 'Willkommen bei Fit',
    'main.subtitle': 'Fügen Sie einen Workspace hinzu und erstellen Sie eine Sitzung, um zu beginnen.',

    'session.newSession': 'Neue Sitzung',
    'session.workspaceOptions': 'Workspace-Optionen',
    'session.archive': 'Sitzung archivieren',
    'session.renameHint': 'Doppelklick zum Umbenennen',
    'session.empty': 'Keine Terminals in dieser Sitzung',
    'session.addTerminal': 'Terminal hinzufügen',

    'drawer.allFiles': 'Alle Dateien',
    'drawer.files': 'Dateien',
    'drawer.sourceControl': 'Versionskontrolle',
    'drawer.noWorkspace': 'Kein Workspace ausgewählt',
    'drawer.loading': 'Laden...',
    'drawer.emptyWorkspace': 'Workspace ist leer',

    'git.noActiveWorkspace': 'Kein aktiver Workspace',
    'git.loading': 'Git-Status wird geladen...',
    'git.noRepo': 'Kein Repository',
    'git.noRepoSubtitle': 'Der aktive Workspace befindet sich nicht in einem Git-Repository.',
    'git.currentBranch': 'Aktueller Branch',
    'git.pull': 'Pull von Remote',
    'git.fetch': 'Fetch von Remote',
    'git.refresh': 'Status aktualisieren',
    'git.commitMessage': 'Commit-Nachricht',
    'git.commitHint': 'Ctrl+Enter zum Commit',
    'git.staged': '{count} Datei staged',
    'git.staged_plural': '{count} Dateien staged',
    'git.noStaged': 'Keine Dateien staged',
    'git.committing': 'Commit läuft...',
    'git.commit': 'Commit',
    'git.pushing': 'Push läuft...',
    'git.push': 'Push',
    'git.stagedChanges': 'STAGED ÄNDERUNGEN',
    'git.changes': 'ÄNDERUNGEN',
    'git.all': 'Alle',
    'git.unstageAll': 'Alle aus Stage entfernen',
    'git.unstage': 'Aus Stage entfernen',
    'git.stageAll': 'Alle in Stage versetzen',
    'git.stage': 'In Stage versetzen',
    'git.noChanges': 'Keine Änderungen erkannt',
    'git.unsyncedCommits': 'NICHT SYNCHRONISIERTE COMMITS ({count})',
    'git.discard': 'Änderungen verwerfen',
    'git.openFile': 'Datei öffnen',


    'title.sourceControl': 'Versionskontrolle',
    'title.toggleFiles': 'Alle Dateien anzeigen',
    'title.settings': 'Einstellungen',
    'title.minimize': 'Minimieren',
    'title.maximize': 'Maximieren',
    'title.close': 'Schließen',
    'title.closeTab': 'Tab schließen',
    'title.preview': 'Vorschau',
    'toolbar.openPreview': 'Live-Vorschau öffnen',

    'preview.nothing': 'Noch nichts zur Vorschau',
    'preview.subtitle': 'Geben Sie oben eine URL ein, oder öffnen Sie das {ports}-Menü, um direkt zu Ihrem laufenden Entwicklungsserver zu springen.',
    'preview.ports': 'Ports',
    'preview.checking': 'prüfe...',
    'preview.refresh': 'Aktualisieren',
    'preview.openBrowser': 'Im Browser öffnen',
    'preview.placeholder': 'http://localhost:3000',
    'preview.portUnreachable': 'Port nicht erreichbar',
    'preview.noServer': 'Kein aktiver Server auf Port :{port} erkannt. Bitte starten Sie Ihren Entwicklungsserver auf diesem Port und versuchen Sie es erneut.',
    'preview.errorVerify': 'Bei der Überprüfung von Port :{port} ist ein Fehler aufgetreten.',
    'preview.recursive': 'Die Fit-Anwendung kann nicht rekursiv im Vorschau-Frame geladen werden.',
    'preview.dismiss': 'Schließen',

    'settings.general': 'Allgemein',
    'settings.shortcuts': 'Tastenkürzel',
    'settings.desktop': 'Fit Desktop',
    'settings.version': 'v1.0.0',
    'settings.language': 'Sprache',
    'settings.languageDesc': 'Ändern Sie die Anzeigesprache für Fit',
    'settings.webgl': 'WebGL-Renderer verwenden',
    'settings.webglDesc': 'Hardwarebeschleunigtes Rendering. Deaktivieren, wenn Text Korruption oder leere Kacheln zeigt.',
    'settings.updates': 'Updates',
    'settings.checkOnStartup': 'Beim Start nach Updates suchen',
    'settings.checkOnStartupDesc': 'Automatisch nach neuen Versionen suchen, wenn die App startet',
    'settings.releaseNotes': 'Versionshinweise anzeigen',
    'settings.releaseNotesDesc': 'Versionshinweise nach dem Update auf eine neue Version anzeigen',
    'settings.checkUpdates': 'Nach Updates suchen',
    'settings.checkUpdatesDesc': 'Manuell prüfen, ob eine neuere Version verfügbar ist',
    'settings.checkNow': 'Jetzt prüfen',
    'settings.latest': 'Sie befinden sich auf der neuesten Version.',
    'settings.shortcutsSoon': 'Die Konfiguration der Tastenkürzel kommt bald.',
    'settings.updater.downloading': 'Update wird heruntergeladen...',
    'settings.updater.install': 'Installieren und neu starten',
    'settings.updater.available': 'Update {version} verfügbar.',
    'settings.updater.devMode': 'Die Update-Prüfung ist im Entwicklungsmodus nicht verfügbar.',

    // Workspace
    'workspace.edit': 'Bearbeiten',
    'workspace.closeProject': 'Projekt schließen',
    'workspace.editTitle': 'Projekt bearbeiten',
    'workspace.name': 'Name',
    'workspace.namePlaceholder': 'Projektname...',
    'workspace.icon': 'Symbol',
    'workspace.iconHint': 'Klicken oder ziehen Sie ein Bild',
    'workspace.iconSize': 'Empfohlen: 128x128px',
    'workspace.color': 'Farbe',
    'workspace.cancel': 'Abbrechen',
    'workspace.save': 'Speichern',

    'terminal.splitRight': 'Terminal rechts teilen',
    'terminal.splitDown': 'Terminal nach unten teilen',
    'terminal.togglePreview': 'Vorschau umschalten',
    'terminal.close': 'Terminal schließen',
  },
};

/* ── Context ────────────────────────────────────────────────────── */
interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (key: string) => key,
});

function getStoredLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (stored && translations[stored]) return stored;
  } catch {}
  return 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getStoredLang);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
    } catch {}
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const dict = translations[lang] || translations.en;
      let text = dict[key] ?? translations.en[key] ?? key;
      if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
          text = text.replace(new RegExp(`{${k}}`, 'g'), String(v));
        });
      }
      return text;
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}
