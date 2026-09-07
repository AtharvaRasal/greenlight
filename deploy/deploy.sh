#!/usr/bin/env bash
# Deploy Greenlight to Cloud Run (free-trial-safe: min-instances=0, small footprint).
# Prereqs: gcloud auth login; PARALLEL_API_KEY exported in your shell.
set -euo pipefail

PROJECT="${GOOGLE_CLOUD_PROJECT:?set GOOGLE_CLOUD_PROJECT}"
REGION="${GOOGLE_CLOUD_LOCATION:-us-central1}"
SERVICE="${SERVICE:-greenlight}"
: "${PARALLEL_API_KEY:?set PARALLEL_API_KEY}"

gcloud config set project "$PROJECT" >/dev/null

echo "▶ enabling APIs"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  aiplatform.googleapis.com secretmanager.googleapis.com

echo "▶ storing Parallel key in Secret Manager"
if ! gcloud secrets describe parallel-api-key >/dev/null 2>&1; then
  printf '%s' "$PARALLEL_API_KEY" | gcloud secrets create parallel-api-key --data-file=-
else
  printf '%s' "$PARALLEL_API_KEY" | gcloud secrets versions add parallel-api-key --data-file=-
fi

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo "▶ granting Vertex AI + secret access to $SA"
gcloud projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" --role=roles/aiplatform.user --condition=None >/dev/null
gcloud secrets add-iam-policy-binding parallel-api-key --member="serviceAccount:$SA" --role=roles/secretmanager.secretAccessor >/dev/null

echo "▶ deploying $SERVICE to Cloud Run ($REGION)"
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --min-instances 0 --max-instances 2 \
  --memory 1Gi --cpu 1 --timeout 300 --concurrency 8 \
  --set-env-vars "GOOGLE_GENAI_USE_ENTERPRISE=1,GOOGLE_GENAI_USE_VERTEXAI=1,GOOGLE_CLOUD_PROJECT=${PROJECT},GOOGLE_CLOUD_LOCATION=${REGION},GEMINI_MODEL=${GEMINI_MODEL:-gemini-2.5-flash}" \
  --set-secrets "PARALLEL_API_KEY=parallel-api-key:latest"

gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)'
