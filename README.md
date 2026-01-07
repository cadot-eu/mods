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

Pour créer un plugin avec une IA, utilisez ce format de prompt complet et détaillé :

```
Crée un plugin Fastify nommé [NOM_PLUGIN].
Le fichier JS principal est dans plugins/[nom-plugin].js.
Les assets sont dans plugins/[nom-plugin]/ et contiennent les fichiers nécessaires

Le plugin charge la configuration via fastify.configs.get('NOM_PLUGIN').
Le YAML définit [description des éléments de configuration].

Le plugin doit exposer :
GET /api/[nom-plugin] -> interface HTML
GET /api/[nom-plugin]/[endpoint] -> pour retourner les données au format texte ou JSON
L'interface utilise Bootstrap (Bootswatch au choix), Bootstrap Icons et Alpine.js, avec un layout basé sur d-flex et sans conflit Bootstrap / Alpine.

L'utilisateur peut [décrire l'interaction principale de l'interface].

Le code doit être propre, modulaire et conforme aux bonnes pratiques Fastify.

Je peux installer des librairies pour simplifier le code au besoin par npm

Exemple de structure de base :

```javascript
import fp from 'fastify-plugin'
import path from 'path'

export default fp(async function (fastify) {
  // Accès à la configuration
  const config = fastify.configs.get('NOM_PLUGIN')
  
  // Exemple de route API
  fastify.get('/api/[nom-plugin]', async (request, reply) => {
    // Logique de traitement
    return { message: 'Données du plugin' }
  })
  
  // Exemple de route avec paramètre
  fastify.get('/api/[nom-plugin]/:param', async (request, reply) => {
    const { param } = request.params
    // Traitement avec le paramètre
    return { result: param }
  })
  
  // Exemple de route HTML
  fastify.get('/[nom-plugin]', async (request, reply) => {
    const htmlPath = path.join(__dirname, '[nom-plugin]/index.html')
    return reply.sendFile('index.html', htmlPath)
  })
  
  fastify.log.info('Plugin [NOM_PLUGIN] chargé')
}, { name: '[nom-plugin]' })
```

Le plugin doit respecter les bonnes pratiques suivantes :
- Utiliser les CDN Bootstrap et Bootstrap Icons
- Choisir un template Bootswatch approprié
- Utiliser Alpine.js pour l'interactivité
- Éviter les conflits entre Bootstrap et Alpine.js
- Structurer le code de manière modulaire
- Ajouter une gestion appropriée des erreurs
```

### Enregistrer le plugin

Ajoutez votre plugin dans `app/config/order.yaml` :

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
