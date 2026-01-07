#!/bin/sh
set -eu

# Racine du projet (là où est docker-compose.yml)
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

COMPOSE_FILE="$ROOT_DIR/compose.yaml"

cd "$ROOT_DIR"

SERVICE=${DOCKER_SERVICE:-mods}

exec docker compose -f "$COMPOSE_FILE" exec "$SERVICE" npm "$@"
