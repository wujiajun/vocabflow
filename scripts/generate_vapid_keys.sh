#!/bin/sh
# Makes the VAPID key pair that daily reminders (Web Push) need and adds it to .env.
#
#   scripts/generate_vapid_keys.sh [mailto:you@example.com]
#
# It writes VOCABFLOW_PUSH_PUBLIC_KEY, VOCABFLOW_PUSH_PRIVATE_KEY and VOCABFLOW_PUSH_SUBJECT to
# .env and prints only the names it wrote, never the private key. It refuses to replace keys that are
# already there: new keys would silently end every existing reminder subscription.
set -eu

cd "$(dirname "$0")/.."
subject="${1:-}"
[ -f .env ] || { echo ".env not found: copy .env.example to .env first." >&2; exit 1; }
if grep -Eq '^VOCABFLOW_PUSH_PRIVATE_KEY=.+' .env; then
  echo "VOCABFLOW_PUSH_PRIVATE_KEY is already set in .env; leaving it alone." >&2
  exit 1
fi
if [ -z "$subject" ]; then
  echo "Give a contact for the push services, for example: $0 mailto:you@example.com" >&2
  exit 1
fi
case "$subject" in mailto:*|https:*) ;; *) echo "The contact must start with mailto: or https:" >&2; exit 1;; esac

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
openssl ecparam -name prime256v1 -genkey -noout -outform DER > "$tmp/key.der" 2>/dev/null
b64url() { base64 | tr -d '=\n' | tr '+/' '-_'; }
# A P-256 key in this DER form: 7 bytes of header, the 32-byte private number, ..., the 65-byte public point last.
private="$(tail -c +8 "$tmp/key.der" | head -c 32 | b64url)"
public="$(tail -c 65 "$tmp/key.der" | b64url)"

# Replace the empty placeholder lines, or add the lines when .env predates them.
set_value() {
  name="$1"; value="$2"
  if grep -Eq "^${name}=" .env; then
    awk -v n="$name" -v v="$value" 'BEGIN{FS=OFS="="} $1==n{print n "=" v; next} {print}' .env > "$tmp/env" && cat "$tmp/env" > .env
  else
    printf '%s=%s\n' "$name" "$value" >> .env
  fi
}
set_value VOCABFLOW_PUSH_PUBLIC_KEY "$public"
set_value VOCABFLOW_PUSH_PRIVATE_KEY "$private"
set_value VOCABFLOW_PUSH_SUBJECT "$subject"
echo "Wrote VOCABFLOW_PUSH_PUBLIC_KEY, VOCABFLOW_PUSH_PRIVATE_KEY and VOCABFLOW_PUSH_SUBJECT to .env."
echo "Rebuild to use them: docker compose up -d --build --wait"
