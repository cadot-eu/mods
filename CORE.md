# Dossier Core

Explication succincte des fichiers dans le dossier `/app/core/`.

## hot-config.js

**Fonction :** Configuration dynamique avec surveillance automatique

- **Chargement automatique** des fichiers de configuration
- **Formats supportés** : JSON, YAML, JavaScript
- **Surveillance en temps réel** : mise à jour sans redémarrage
- **Fusion de configurations** : base + surcharges avec suffixe `-surcharge`
- **Accès simple** : `fastify.configs.get('nom-fichier', 'chemin.optionel')`

## log.js

**Fonction :** Système de logging personnalisé

- **Format compact** : `[FICHIER] message`
- **Horodatage** : `YYYY-MM-DD HH:MM:ss`
- **Identification automatique** : nom du plugin à l'origine du log
- **Niveaux de log** : info, warn, error
- **Fichier de log** : `app/fastify.log`

## plugin-loader.js

**Fonction :** Chargement et ordonnancement des plugins

- **Ordre de chargement** : défini dans `config/order.yaml`
- **Dépendances** : respecte les dépendances entre plugins
- **Gestion d'erreurs** : continue le chargement même si un plugin échoue
- **API de modification** : `fastify.updatePluginOrder([nouvelOrdre])`
- **Détection automatique** : trouve tous les plugins `.js` dans `/app/plugins/`

## Fonctionnement global

1. **Démarrage** : `app/index.js` initialise Fastify
2. **Configuration** : `HotConfig` charge toutes les configurations
3. **Plugins** : `plugin-loader` charge les plugins dans l'ordre défini
4. **Logs** : `log.js` fournit un système de logging personnalisé
5. **Dépendances** : les plugins peuvent accéder à `fastify.configs`, `fastify.sqlite`, `fastify.env`

## Bonnes pratiques

- **Ordre des plugins** : Placez les plugins de base (env, sqlite) en premier
- **Configuration** : Utilisez les suffixes `-surcharge` pour modifier des configurations
- **Logs** : Utilisez toujours `fastify.log` pour les messages
- **Erreurs** : Gérez les erreurs avec try/catch pour éviter de bloquer l'application

## Dépendances

Tous les fichiers du core dépendent de :
- `fs` : Système de fichiers
- `path` : Manipulation de chemins
- `yaml` : Pour le fichier `order.yaml`

Le core fournit les fondations sur lesquelles s'appuient tous les plugins.
