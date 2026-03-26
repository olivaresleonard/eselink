#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${BASH_VERSION:-}" ]]; then
  echo "Este script debe ejecutarse con bash: bash eselink-repos.sh"
  exit 1
fi

REPO_URL="https://github.com/olivaresleonard/eselink.git"
SCRIPT_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMIT_MESSAGE=""

for cmd in git; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: falta comando requerido: $cmd"
    exit 1
  fi
done

ask_commit_message() {
  read -r -p "Mensaje de commit (default: chore: sync local changes): " COMMIT_MESSAGE
  if [[ -z "$COMMIT_MESSAGE" ]]; then
    COMMIT_MESSAGE="chore: sync local changes"
  fi
}

get_current_branch() {
  local branch
  branch="$(git branch --show-current)"

  if [[ -z "$branch" ]]; then
    branch="$(git remote show origin 2>/dev/null | sed -n '/HEAD branch/s/.*: //p')"
  fi

  if [[ -z "$branch" ]]; then
    branch="main"
  fi

  printf '%s\n' "$branch"
}

main() {
  cd "$SCRIPT_DIR"

  if [[ ! -d .git ]]; then
    echo "Error: ${SCRIPT_DIR} no es un repositorio git."
    exit 1
  fi

  git remote set-url origin "$REPO_URL"

  ask_commit_message

  current_branch="$(get_current_branch)"

  echo "Usando rama: ${current_branch}"
  git checkout "$current_branch"

  git add -A
  if ! git diff --cached --quiet; then
    git commit -m "$COMMIT_MESSAGE"
    echo "Commit creado."
  else
    echo "Sin cambios para commit."
  fi

  git pull --rebase origin "$current_branch"
  git push origin "$current_branch"

  echo "Listo. Commit, pull y push completados en ${current_branch}."
}

main "$@"
