#!/usr/bin/env bash
# One-time cloud setup (idempotent-ish). No Terraform: plain yc commands.
# Usage: YC_FOLDER_ID=... BUCKET=... ./infra/setup.sh
set -euo pipefail
: "${YC_FOLDER_ID:?}" "${BUCKET:?}"
F=$YC_FOLDER_ID

# 1. Private bucket for the static build.
yc storage bucket get "$BUCKET" >/dev/null 2>&1 || yc storage bucket create --name "$BUCKET" --folder-id "$F" --default-storage-class standard
yc storage bucket update --name "$BUCKET" --public-read=false --public-list=false >/dev/null

# 2. Service accounts: deployer (writes this bucket only) and gateway (reads it).
for sa in ai-finder-deployer ai-finder-gateway; do
  yc iam service-account get --name "$sa" --folder-id "$F" >/dev/null 2>&1 || yc iam service-account create --name "$sa" --folder-id "$F" >/dev/null
done
DEP=$(yc iam service-account get --name ai-finder-deployer --folder-id "$F" --format json | jq -r .id)
GW=$(yc iam service-account get --name ai-finder-gateway --folder-id "$F" --format json | jq -r .id)
yc storage bucket update --name "$BUCKET" \
  --grants grant-type=grant-type-account,grantee-id="$DEP",permission=permission-full-control \
  --grants grant-type=grant-type-account,grantee-id="$GW",permission=permission-read >/dev/null

# 3. API Gateway: single public entry point with SPA fallback.
SPEC=$(mktemp)
BUCKET=$BUCKET SA_ID=$GW envsubst '${BUCKET} ${SA_ID}' < "$(dirname "$0")/apigw.yaml" > "$SPEC"
if yc serverless api-gateway get --name ai-finder --folder-id "$F" >/dev/null 2>&1; then
  yc serverless api-gateway update --name ai-finder --folder-id "$F" --spec "$SPEC" >/dev/null
else
  yc serverless api-gateway create --name ai-finder --folder-id "$F" --spec "$SPEC" >/dev/null
fi
echo "Gateway: https://$(yc serverless api-gateway get --name ai-finder --folder-id "$F" --format json | jq -r .domain)"
echo "Create the deploy key with: yc iam access-key create --service-account-id $DEP"
