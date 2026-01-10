#!/bin/sh

# Script pour générer un hash bcrypt via Docker

if [ -z "$1" ]; then
  echo "❌ Erreur: Vous devez fournir un mot de passe"
  echo "Usage: npm run hash <mot-de-passe>"
  echo "Exemple: npm run hash admin123"
  exit 1
fi

# Exécuter du JavaScript inline dans le conteneur Docker
docker exec mods node --input-type=module -e "
import bcrypt from 'bcrypt';

const password = '$1';

console.log('🔐 Génération du hash pour le mot de passe...');
console.log('');

try {
  const hash = await bcrypt.hash(password, 10);
  
  console.log('✅ Hash généré avec succès!');
  console.log('');
  console.log('📋 Copiez ce hash dans votre fichier auth.yaml:');
  console.log('─'.repeat(80));
  console.log(hash);
  console.log('─'.repeat(80));
  console.log('');
  
  const isValid = await bcrypt.compare(password, hash);
  console.log(\`🔍 Test de vérification: \${isValid ? '✓ VALIDE' : '✗ INVALIDE'}\`);
  console.log('');
  
  console.log('📝 Exemple de configuration auth.yaml:');
  console.log('─'.repeat(80));
  console.log('users:');
  console.log('  admin:');
  console.log(\`    password: \\\"\${hash}\\\"\`);
  console.log('    role: admin');
  console.log('session:');
  console.log('  maxAge: 86400000');
  console.log('─'.repeat(80));
  
} catch (error) {
  console.error('❌ Erreur:', error.message);
  process.exit(1);
}
"
