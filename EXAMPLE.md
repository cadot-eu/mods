# Exemple complet : Plugin Timezone

Guide pas à pas pour créer un plugin timezone complet avec interface utilisateur.

## Objectif

Créer un plugin qui affiche l'heure actuelle dans différents fuseaux horaires sélectionnés par l'utilisateur.

## Prérequis

- mods installé et fonctionnel
- Node.js et npm
- Docker

## Base: Cloner le dépot

```bash  git clone https://github.com/cadot-eu/mods.git example
mv app/config/order.yaml.example app/config/order.yaml
mv app/config/sqlite.yaml.example app/config/sqlite.yaml
```

Si vous regardez les logs de docker vous pourrez voir
INFO: [HOT-CONFIG] Configs loaded: order
INFO: [PLUGIN-LOADER] 0 plugins chargés


## Étape 1 : Installer la dépendance

Installez le package @arc-js/timez :

```bash
cd app
npm run d:npm install @arc-js/timez
```
## Étape 2 : Générer prompt IA par le plugins propmt-generator

Allez sur http://localhost/generator

Remplissez les champs :

- **Nom du plugin** : "timezone"
- **But** : "gérer l'affichage de l'heure dans différents fuseaux horaires en utilisant une liste de pays définis dans timezone.yaml"
- **Commentaires** : "Utiliser @arc-js/timez pour la gestion des fuseaux horaires"

> **Note** : Les sections "Routes" et "API partagées" sont optionnelles et peuvent être laissées vides. L'IA générera automatiquement les routes et API appropriées selon le but du plugin.




## Étape 3 : Créer le plugin avec une IA

Utilisez ce prompt pour créer le plugin avec une IA

## Étape 4 : Mettre à jour l'ordre des plugins

Ajoutez votre plugin dans `config/order.yaml` :

```yaml
order:
  - env
  - sqlite
  - timezone
```

## Étape 6 : Redémarrer l'application

```bash
docker-compose restart
```

## Étape 7 : Accéder à l'application

Ouvrez votre navigateur et allez sur : `http://localhost/timezone`

## Étape 8 : Utiliser le plugin comme API

En plus de l'interface utilisateur, votre plugin timezone peut être utilisé comme une API REST. Voici comment accéder aux différentes fonctionnalités :

### API de consultation des fuseaux horaires

```bash
# Lister tous les fuseaux horaires disponibles
curl http://localhost/api/timezone/list

# Exemple de réponse :
[
  {
    "name": "Paris",
    "city": "Paris", 
    "country": "France",
    "timezone": "Europe/Paris"
  },
  {
    "name": "New York",
    "city": "New York",
    "country": "USA", 
    "timezone": "America/New_York"
  }
]
```

### API de consultation de l'heure

```bash
# Obtenir l'heure actuelle pour un fuseau horaire spécifique
curl http://localhost/api/timezone/Europe/Paris

# Exemple de réponse :
{
  "timezone": "Europe/Paris",
  "time": "2026-01-07 16:45:30",
  "date": "jeudi 7 janvier 2026",
  "timezoneName": "Central European Standard Time"
}

# Pour un fuseau horaire non valide
curl http://localhost/api/timezone/Fuseau/Invalide
# Réponse : {"error": "Fuseau horaire invalide"}
```

### Intégration dans d'autres applications

Vous pouvez facilement intégrer cette API dans d'autres applications :

```javascript
// Exemple d'intégration dans une autre application
async function getCurrentTime(timezone) {
  try {
    const response = await fetch(`/api/timezone/${encodeURIComponent(timezone)}`);
    if (response.ok) {
      const data = await response.json();
      return data.time;
    } else {
      console.error('Erreur API timezone');
      return null;
    }
  } catch (error) {
    console.error('Erreur réseau:', error);
    return null;
  }
}

// Utilisation
const parisTime = await getCurrentTime('Europe/Paris');
console.log('Heure à Paris:', parisTime);
```

### Exemples d'utilisation en tant qu'API

1. **Dashboard météo** : Afficher l'heure locale pour chaque ville
2. **Application de gestion de projet** : Afficher les fuseaux horaires des membres d'équipe
3. **Système de réservation** : Vérifier les disponibilités selon les fuseaux horaires
4. **Application de chat** : Afficher l'heure locale de chaque utilisateur

### Sécurité et bonnes pratiques

- **Validation** : L'API valide automatiquement les fuseaux horaires
- **Erreurs** : Les erreurs sont gérées avec des codes HTTP appropriés
- **Logs** : Toutes les requêtes sont logguées pour le monitoring
- **Performance** : Les réponses sont générées en temps réel sans cache

## Fonctionnalités de l'application

### Interface utilisateur
- **Dropdown** pour sélectionner un fuseau horaire
- **Boutons rapides** pour les fuseaux horaires les plus courants
- **Affichage en temps réel** de l'heure et de la date
- **Liste complète** des fuseaux horaires disponibles

### Comportement
- L'heure se met à jour automatiquement chaque seconde
- Affichage du nom complet du fuseau horaire
- Format de date en français
- Design responsive avec Bootstrap

## Personnalisation

### Ajouter des fuseaux horaires

Modifiez `config/timezone.yaml` :

```yaml
timezones:
  - name: "Los Angeles"
    city: "Los Angeles"
    country: "USA"
    timezone: "America/Los_Angeles"
  # Ajoutez d'autres fuseaux horaires ici
```

### Modifier le style

Créez un fichier CSS dans `app/static/timezone.css` et importez-le dans votre HTML.

### Ajouter des fonctionnalités

- **Fuseau horaire local** : détecter automatiquement le fuseau de l'utilisateur
- **Comparaison** : afficher plusieurs fuseaux horaires simultanément
- **Historique** : enregistrer les consultations dans SQLite

## Dépannage

### Problème : Package @arc-js/timez non trouvé

Vérifiez que le package est installé :
```bash
cd app
npm list @arc-js/timez
```

Si non installé :
```bash
npm install @arc-js/timez
```

### Problème : Plugin non chargé

Vérifiez que :
1. Le plugin est dans `app/plugins/timezone.js`
2. Il est ajouté dans `config/order.yaml`
3. L'application a été redémarrée

### Problème : Interface non affichée

Vérifiez que :
1. Le fichier `index.html` est dans `app/plugins/timezone/`
2. La route `/timezone` est accessible
3. Les logs ne montrent pas d'erreur

## Prochaines étapes

- Ajouter un plugin météo utilisant les mêmes principes
- Créer un plugin de gestion de tâches avec SQLite
- Intégrer des notifications en temps réel avec WebSocket

## Conclusion

Ce plugin timezone montre comment combiner :
- **Fastify** pour les routes API
- **Alpine.js** pour l'interface réactive
- **Bootstrap** pour le style
- **Configuration dynamique** avec HotConfig
- **Package npm** pour les fonctionnalités externes

Vous pouvez maintenant créer des plugins similaires pour d'autres fonctionnalités !
Vous pouvez maintenant créer des plugins similaires pour d'autres fonctionnalités !
