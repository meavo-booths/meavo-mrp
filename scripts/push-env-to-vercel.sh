#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${1:-$ROOT/.env.local}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy .env.example and fill in real values." >&2
  exit 1
fi

cd "$ROOT"

keys=(
  NEXT_PUBLIC_APP_URL
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  DATABASE_URL
  DIRECT_DATABASE_URL
  SUPABASE_BUCKET_ORIGINALS
  SUPABASE_BUCKET_THUMBNAILS
  GEMINI_API_KEY
  GEMINI_MODEL
  GEMINI_THINKING_BUDGET
  ZERON_ADAPTER
  NEXT_PUBLIC_DEFAULT_LOCALE
  ENABLE_INVOICE_SCANNER
  NEXT_PUBLIC_ENABLE_INVOICE_SCANNER
)

declare -A values=()
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%%#*}"
  line="${line#"${line%%[![:space:]]*}"}"
  [[ -z "$line" ]] && continue
  key="${line%%=*}"
  value="${line#*=}"
  value="${value%\"}"
  value="${value#\"}"
  values["$key"]="$value"
done < "$ENV_FILE"

for key in "${keys[@]}"; do
  value="${values[$key]:-}"
  if [[ -z "$value" || "$value" == YOUR_* || "$value" == *YOUR-* || "$value" == *YOUR_* ]]; then
    echo "Skipping $key (empty or placeholder)"
    continue
  fi
  echo "Setting $key on Vercel production..."
  vercel env rm "$key" production --yes 2>/dev/null || true
  if [[ "$key" == SUPABASE_SERVICE_ROLE_KEY || "$key" == DATABASE_URL || "$key" == DIRECT_DATABASE_URL || "$key" == GEMINI_API_KEY ]]; then
    vercel env add "$key" production --value "$value" --yes --sensitive
  else
    vercel env add "$key" production --value "$value" --yes
  fi
done

echo "Done. Run: vercel env ls"
