#!/bin/bash
# Patch seahub_settings.py to use HTTPS URLs and trust our domain for CSRF.
# Runs on every container start via phusion /etc/my_init.d/.
# Idempotent: only appends if the marker comment is absent.

SETTINGS=/opt/seafile/conf/seahub_settings.py

# Config is generated on first boot by start.py — wait for it
for i in $(seq 1 30); do
  [ -f "$SETTINGS" ] && break
  sleep 2
done

[ ! -f "$SETTINGS" ] && echo "seahub_settings.py not found, skipping HTTPS patch" && exit 0

grep -q '# popelec-https-patch' "$SETTINGS" && exit 0

cat >> "$SETTINGS" << 'PATCH'

# popelec-https-patch
SERVICE_URL = 'https://files.popelec.fr'
FILE_SERVER_ROOT = 'https://files.popelec.fr/seafhttp'
CSRF_TRUSTED_ORIGINS = ['https://files.popelec.fr']
PATCH

echo "seahub_settings.py patched for HTTPS"
