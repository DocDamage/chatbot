#!/usr/bin/env bash
set -euo pipefail

image_name="${CONTAINER_IMAGE:-ai-chatbot-hub:ci}"
container_name="${CONTAINER_NAME:-ai-chatbot-hub-ci-smoke}"
host_port="${CONTAINER_PORT:-3101}"

cleanup() {
  docker logs "$container_name" > /tmp/chatbot-container-smoke.log 2>&1 || true
  docker rm -f "$container_name" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker build --pull --tag "$image_name" .
docker rm -f "$container_name" >/dev/null 2>&1 || true

docker run --detach \
  --name "$container_name" \
  --publish "127.0.0.1:${host_port}:3001" \
  --env NODE_ENV=test \
  --env DEPLOYMENT_MODE=test \
  --env PORT=3001 \
  --env JWT_SECRET=ci-container-smoke-jwt-secret-32-characters-minimum \
  --env LLM_PROVIDER=template \
  --env USE_OLLAMA=false \
  --env USE_HUGGINGFACE=false \
  --env EMBEDDING_USE_TRANSFORMERS=false \
  --env ENABLE_RAG=false \
  --env RAG_PERSISTENCE=false \
  --env RAG_GENERATE_EMBEDDINGS=false \
  --env ENABLE_REDIS_CACHE=false \
  --env ENABLE_DISK_CACHE=false \
  --env ENABLE_MODEL_ROUTING=false \
  --env ENABLE_ENSEMBLE=false \
  --env ENABLE_SEMANTIC_CACHE=false \
  --env ENABLE_WEBSOCKET=false \
  --env ENABLE_TOOL_CALLING=false \
  --env ENABLE_BASH_EXECUTOR=false \
  --env ENABLE_LOCAL_TOOLS=false \
  --env LOCAL_EXECUTION_ENABLED=false \
  --env ENABLE_FL_STUDIO_MCP=false \
  "$image_name" >/dev/null

ready=false
for attempt in $(seq 1 45); do
  if curl --fail --silent --show-error "http://127.0.0.1:${host_port}/health/live" >/dev/null; then
    ready=true
    break
  fi

  if [[ "$(docker inspect --format '{{.State.Running}}' "$container_name" 2>/dev/null || true)" != "true" ]]; then
    echo "Container exited before the liveness endpoint became available." >&2
    docker logs "$container_name" >&2 || true
    exit 1
  fi

  sleep 2
done

if [[ "$ready" != "true" ]]; then
  echo "Container did not become live within 90 seconds." >&2
  docker logs "$container_name" >&2 || true
  exit 1
fi

curl --fail --silent --show-error "http://127.0.0.1:${host_port}/health/live"
echo "Container build and liveness smoke passed."
