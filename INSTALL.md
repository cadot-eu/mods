# Installation et Configuration de mods

Guide complet pour installer, configurer et développer avec le framework mods.

## Sommaire

1. [Installation](#installation)
2. [Structure du projet](#structure-du-projet)
3. [Créer un plugin](#créer-un-plugin)
4. [Configuration](#configuration)
5. [Variables d'environnement](#variables-denvironnement)
6. [Docker](#docker)
7. [Développement](#développement)

## Installation

### 1. Cloner le dépôt

```bash
git clone https://github.com/cadot-eu/mods.git
cd mods
mv app/config/order.yaml.example app/config/order.yaml
mv app/config/sqlite.yaml.example app/config/sqlite.yaml
```

### 2. Installer les dépendances

```bash
cd app
npm install
```

### 3. Lancer l'application

```bash
# En développement (avec hot-reload)
docker-compose up

# En production
docker-compose up -d
```


L'application sera accessible sur `http://localhost:80`

## Structure du projet

```
mods/
├── app/
│   ├── index.js              # Point d'entrée principal
│   ├── package.json          # Dépendances
│   ├── plugins/              # Dossiers des plugins
│   │   ├── env.js           # Variables d'environnement
│   │   ├── sqlite.js        # Base de données SQLite
│   │   └── db.js            # Plugin exemple
│   ├── core/                # Cœur du framework
│   │   ├── hot-config.js    # Configuration dynamique
│   │   ├── log.js           # Système de logs
│   │   └── plugin-loader.js # Chargeur de plugins
│   ├──static/              # Fichiers statiques (CSS, JS, images)
│   ├──config/                  # Fichiers de configuration
│   │   ├── order.yaml           # Ordre de chargement des plugins
│   │   ├── *.yaml               # Configurations spécifiques
├── compose.yaml             # Docker Compose principal
├── docker-compose.override.yml.example  # Exemple de surcharge
└── .env.local               # Variables d'environnement (optionnel)
```

## Créer un plugin

### 1. Créer le fichier du plugin

Créez un fichier dans `app/plugins/` :

```javascript
// app/plugins/mon-plugin.js
import fp from 'fastify-plugin'

export default fp(async function (fastify) {
  // Routes du plugin
  fastify.get('/api/mon-endpoint', async (request, reply) => {
    return { message: 'Hello from mon-plugin!' }
  })
  
  // Accès à la configuration
  const config = fastify.configs.get('mon-config')
  
  // Accès à SQLite (si disponible)
  if (fastify.sqlite) {
    const data = fastify.sqlite.findAll('ma_table')
  }
  
  fastify.log.info('Plugin mon-plugin chargé')
}, { name: 'mon-plugin' })
```

### 2. Créer la configuration

Créez un fichier YAML dans `config/` :

```yaml
# config/mon-config.yaml
parametre1: "valeur"
parametre2: 42
liste:
  - item1
  - item2
```

### 3. Enregistrer le plugin

Ajoutez votre plugin dans `config/order.yaml` :

```yaml
order:
  - env
  - sqlite
  - db
  - mon-plugin
```

### 4. Redémarrer l'application

```bash
docker-compose restart
```

Votre plugin sera automatiquement chargé et accessible.

## Configuration

### Fichiers de configuration

Les fichiers de configuration se trouvent dans `config/` et peuvent être au format :
- **YAML** (`.yaml`, `.yml`) - Format recommandé pour sa lisibilité et ses commentaires
- **JSON** (`.json`) - Pour les configurations simples
- **JavaScript** (`.js`, `.mjs`) - Pour des configurations dynamiques

**Avantages du YAML :**
- **Lisibilité** : Structure claire et hiérarchique
- **Commentaires** : Possibilité d'ajouter des explications directement dans les fichiers
- **Flexibilité** : Supporte les listes, objets imbriqués et valeurs scalaires
- **Maintenabilité** : Facile à modifier et comprendre

### Accéder à la configuration

Dans vos plugins :

```javascript
// Accès simple
const config = fastify.configs.get('nom-du-fichier')

// Accès à une sous-clé
const valeur = fastify.configs.get('nom-du-fichier', 'sous.cle')

// Liste des configs disponibles
const configs = fastify.configs.list()
```

### Surcharges de configuration

Créez un fichier avec le suffixe `-surcharge` pour modifier une configuration existante :

```yaml
# config/mon-config-surcharge.yaml
liste:
  - replace: { item1: "ancienne valeur" }
    with: { item1: "nouvelle valeur" }
```

**Note :** Les surcharges ne fonctionnent que sur les tableaux et permettent de remplacer des éléments spécifiques.

## Variables d'environnement

### Créer le fichier .env.local

```bash
# app/.env.local
NODE_ENV=development
PORT=3000
DEBUG=true
```

Les variables sont automatiquement chargées et accessibles via `fastify.env`.

### Variables système

Les variables d'environnement système sont également accessibles :

```javascript
const nodeEnv = fastify.env.NODE_ENV
const port = fastify.env.PORT
```

## Docker

### Docker Compose principal

Le fichier `compose.yaml` contient la configuration de base :

```yaml
services:
  mods:
    image: node:25-alpine
    container_name: mods
    working_dir: /app
    environment:
      - NODE_ENV=${NODE_ENV:-development}
    volumes:
      - ./app:/app
      - /app/node_modules
    ports:
      - "80:3000"
    restart: ${RESTART_POLICY:-no}
```

### Docker Compose Override

Utilisez `docker-compose.override.yml` pour surcharger la configuration en local :

```yaml
# docker-compose.override.yml
services:
  mosquitto:
    deploy:
      replicas: 0
    restart: "no"
```

**Utilité :** Désactiver des services que vous ne souhaitez pas lancer en local (comme Mosquitto dans l'exemple).

### Commandes Docker

```bash
# Lancer en développement
docker-compose up

# Lancer en production
docker-compose up -d

# Arrêter
docker-compose down

# Redémarrer
docker-compose restart

# Voir les logs
docker-compose logs -f mods
```

## Développement

### Hot Reload

En mode développement (`NODE_ENV=development`), l'application utilise **nodemon** pour le hot reload :

- Modifications des plugins → rechargement automatique
- Modifications de la configuration → mise à jour en temps réel
- Pas besoin de redémarrer Docker

### Logs

Les logs sont disponibles à deux endroits :

1. **Console Docker** : `docker-compose logs -f mods`
2. **Fichier** : `app/fastify.log`

Les logs incluent :
- Nom du plugin à l'origine du message
- Horodatage
- Niveau de log (info, warn, error)

### Accéder aux logs dans Docker Compose

Ajoutez cette configuration à votre `compose.yaml` pour voir les logs en direct :

```yaml
services:
  mods:
    # ... autres configurations
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Dossier Static

Le dossier `app/static/` sert à stocker les fichiers statiques :

- **CSS** : Styles personnalisés
- **JavaScript** : Scripts côté client
- **Images** : Assets visuels
- **Fichiers** : Tout contenu statique

Accès via : `http://localhost/static/nom-du-fichier.ext`

## SQLite

### Configuration

Créez un fichier `config/sqlite.yaml` :

```yaml
path: "./metrics.db"
tables:
  temperature:
    columns:
      device_id: TEXT
      value: REAL
  humidity:
    columns:
      device_id: TEXT
      value: REAL
```

### Utilisation dans les plugins

```javascript
// Écrire des données
await fastify.sqlite.writePoint('temperature', {
  device_id: 'capteur1',
  value: 23.5
})

// Lire des données
const data = fastify.sqlite.findAll('temperature', {
  limit: 100,
  order: 'desc'
})
```

### Accéder aux logs SQLite

Les logs SQLite sont inclus dans `app/fastify.log` et dans la console Docker.

## Prochaines étapes

Consultez [EXAMPLE.md](./EXAMPLE.md) pour un exemple complet de création d'un plugin timezone avec interface utilisateur.
