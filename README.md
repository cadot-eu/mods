# mods

Un framework modulaire pour créer facilement des applications web avec Node.js, Bootstrap, Alpine.js et Fastify.

## Présentation

**mods** est une architecture légère et flexible qui permet de créer des applications web en assemblant des plugins. Chaque plugin ajoute des fonctionnalités spécifiques à votre application.

### Architecture

- **Fastify** : Serveur web performant
- **Plugins** : Modules indépendants dans `/app/plugins/`
- **HotConfig** : Configuration dynamique avec surcharge
- **SQLite** : Base de données légère
- **Bootstrap + Alpine.js** : Interface utilisateur réactive
- **Docker** : Déploiement simplifié

## Créer un Plugin

Un plugin est simplement un fichier JavaScript dans `/app/plugins/` qui exporte une fonction Fastify.

### Structure de base

```javascript
import fp from 'fastify-plugin'

export default fp(async function (fastify) {
  // Votre logique ici
  
  // Exemple de route
  fastify.get('/api/ma-route', async (request, reply) => {
    return { message: 'Hello from plugin!' }
  })
  
  // Exemple d'accès à la configuration
  const config = fastify.configs.get('nom-du-fichier')
  
  // Exemple d'accès à SQLite par exemple
  if (fastify.sqlite) {
    const data = fastify.sqlite.findAll('ma_table')
  }
}, { name: 'nom-du-plugin' })
```
### Création d'un fichier config

Ce fichier peut-être appelé par n'importe quel module avec
``` fastify.configs.get('...') ```
Le format yaml ou json peut-être utilisé, l'avantage de yaml est de pouvoir ajouter des commentaires

### Prompt pour IA

Pour créer un plugin avec une IA, utilisez ce format de prompt avec l'exemple de code minimal :

```
Créer un plugin mods appelé [NOM_PLUGIN] qui [BUT_DU_PLUGIN]. 

Structure de base du plugin :

```javascript
import fp from 'fastify-plugin'

export default fp(async function (fastify) {
  // Routes du plugin
  fastify.get('/api/[endpoint1]', async (request, reply) => {
    // Logique de la route
    return { message: 'Réponse de l\'endpoint' }
  })
  
  // Accès à la configuration
  const config = fastify.configs.get('[fichier-config]')
  
  fastify.log.info('Plugin [NOM_PLUGIN] chargé')
}, { name: '[nom-plugin]' })
```

Le plugin doit exposer les routes suivantes :
- GET /api/[endpoint1] : [description]
- POST /api/[endpoint2] : [description]

```

### Enregistrer le plugin

Ajoutez votre plugin dans `config/order.yaml` :

```yaml
order:
  - env
  - sqlite
  - db
  - votre-plugin
```

## Prochaines étapes

Consultez [INSTALL.md](./INSTALL.md) pour :
- Installer et configurer mods
- Créer votre premier plugin
- Comprendre la configuration
- Déployer avec Docker

Ou suivez l'exemple complet dans [EXAMPLE.md](./EXAMPLE.md) pour créer un plugin timezone pas à pas.
