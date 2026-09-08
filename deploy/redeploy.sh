#!/usr/bin/env bash
# Fast redeploy (assumes deploy.sh has run once: APIs, secret, IAM already in place).
set -euo pipefail
PROJECT="${GOOGLE_CLOUD_PROJECT:?set GOOGLE_CLOUD_PROJECT}"
REGION="${GOOGLE_CLOUD_LOCATION:-us-central1}"
SERVICE="${SERVICE:-greenlight}"

gcloud run deploy "$SERVICE" --project "$PROJECT" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --min-instances 0 --max-instances 2 \
  --memory 2Gi --cpu 2 --timeout 600 --concurrency 4 \
  --set-env-vars "GOOGLE_GENAI_USE_ENTERPRISE=1,GOOGLE_GENAI_USE_VERTEXAI=1,GOOGLE_CLOUD_PROJECT=${PROJECT},GOOGLE_CLOUD_LOCATION=${REGION},GEMINI_MODEL=${GEMINI_MODEL:-gemini-2.5-flash}" \
  --set-secrets "PARALLEL_API_KEY=parallel-api-key:latest" \
  --quiet

gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='value(status.url)'
