#!/bin/zsh
# Puts Dealt With's server functions and website live, from the Mac (docs/SHARED-SERVER.md).
#   zsh scripts/deploy-shared.sh
# 1. The helper and read aloud functions go to the shared Life Regulation Lab server, exactly as
#    they are in this folder. 2. The website is built and sent to Firebase Hosting.
# It asks you to sign in to Supabase or Firebase in the browser the first time, and never asks for
# or prints a key.
set -e
cd "$(dirname "$0")/.."
PROJECT=xgeacgbeiivcbrgdfpbf
print "== The functions"
for fn in dealt-with-helper dealt-with-voice; do
  npx -y supabase functions deploy $fn --project-ref $PROJECT --no-verify-jwt
done
print "\n== The website"
npm ci --no-audit --no-fund
npm run build
npx -y firebase-tools deploy --only hosting --project dealt-with-lrl
print "\nDone. Open https://dealt-with-lrl.web.app and sign in."
