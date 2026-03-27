#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${BASH_VERSION:-}" ]]; then
  echo "Este script debe ejecutarse con bash: bash dev-up.sh"
  exit 1
fi

# ======= CONFIG =======
ROOT_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_SCRIPT="dev"
INSTALL_DEPS="false"
DOCKER_COMPOSE_FILE="setup/docker-compose.yml"
PROJECTS=(
  "api"
  "web"
)
PROJECT_PORTS=(
  "4000"
  "3000"
)
PROJECT_COLORS=(
  "cyan"
  "magenta"
)
# ======================

command -v pnpm >/dev/null 2>&1 || { echo "Error: pnpm no esta instalado."; exit 1; }
command -v lsof >/dev/null 2>&1 || { echo "Error: lsof no esta instalado."; exit 1; }
command -v concurrently >/dev/null 2>&1 || {
  echo "Instalando 'concurrently' global..."
  npm i -g concurrently
}

kill_listener() {
  local port="$1"
  local pids

  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "Matando procesos en puerto $port: $pids"
    kill $pids 2>/dev/null || true
    sleep 1
    pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      kill -9 $pids 2>/dev/null || true
    fi
  fi
}

docker_compose() {
  docker compose -f "$ROOT_DIR/$DOCKER_COMPOSE_FILE" "$@"
}

cd "$ROOT_DIR"

read -r -p "Reiniciar infraestructura Docker? (S/N): " RESTART_DOCKER
RESTART_DOCKER="$(printf '%s' "$RESTART_DOCKER" | tr '[:lower:]' '[:upper:]')"

if [[ "$RESTART_DOCKER" == "S" ]]; then
  command -v docker >/dev/null 2>&1 || { echo "Error: docker no esta instalado."; exit 1; }
  echo "Reiniciando infraestructura Docker..."
  docker_compose down --remove-orphans || true
elif [[ "$RESTART_DOCKER" != "N" ]]; then
  echo "Opcion invalida. Usa S o N."
  exit 1
fi

for PORT in "${PROJECT_PORTS[@]}"; do
  kill_listener "$PORT"
done

if [[ "$RESTART_DOCKER" == "S" ]]; then
  docker_compose up -d
  echo
fi

NAMES=()
CMDS=()
COLORS=()

for i in "${!PROJECTS[@]}"; do
  PROJECT="${PROJECTS[$i]}"
  DIR="$ROOT_DIR/$PROJECT"
  PORT="${PROJECT_PORTS[$i]}"

  if [[ ! -f "$DIR/package.json" ]]; then
    echo "No se encontro package.json en $DIR, saltando..."
    continue
  fi

  if [[ "$INSTALL_DEPS" == "true" ]]; then
    CMD="cd \"$DIR\" && pnpm install && pnpm $RUN_SCRIPT"
  else
    CMD="cd \"$DIR\" && pnpm $RUN_SCRIPT"
  fi

  NAMES+=("$PROJECT")
  CMDS+=("$CMD")
  COLORS+=("${PROJECT_COLORS[$i]}")
done

if [[ ${#CMDS[@]} -eq 0 ]]; then
  echo "No se encontraron proyectos validos."
  exit 1
fi

NAMES_ARG=$(IFS=,; echo "${NAMES[*]}")
COLORS_ARG=$(IFS=,; echo "${COLORS[*]}")

echo "Proyectos a levantar:"
printf '  - %s\n' "${NAMES[@]}"
echo

concurrently -k -n "$NAMES_ARG" -c "$COLORS_ARG" "${CMDS[@]}"
