#!/bin/sh
set -e

echo "==> [1/4] Checking dependencies..."
if [ ! -f node_modules/.package-lock.json ] || [ package.json -nt node_modules/.package-lock.json ]; then
  echo "    Installing dependencies (npm ci)..."
  npm ci
  echo "    Clearing stale .next cache..."
  rm -rf .next/*
else
  echo "    Dependencies up to date, skipping."
fi

echo "==> [2/5] Regenerating Payload import map..."
npx payload generate:importmap

echo "==> [3/5] Running migrations..."
npx payload migrate || echo "    Migration skipped (schema may auto-push in dev)."

echo "==> [4/5] Seeding database..."
if [ ! -f node_modules/.seed-done ]; then
  npx tsx src/seed.ts && touch node_modules/.seed-done
  echo "    Seed complete."
else
  echo "    Already seeded, skipping."
fi

echo "==> [5/5] Starting dev server..."
exec npm run dev
