#!/usr/bin/env sh
set -eu

base_url="${1:-http://127.0.0.1:8888}"
base_url="${base_url%/}"

for resource in \
  satelliteDataPool \
  satelliteMetadata \
  satelliteDataCatalog \
  satelliteDataQuery \
  satelliteDataShare
do
  url="$base_url/api/data-management/ai2/$resource/list?pageNo=1&pageSize=1"
  response="$(curl --fail --silent --show-error --max-time 20 "$url")" || {
    echo "FAILED $resource" >&2
    exit 1
  }
  compact="$(printf '%s' "$response" | tr -d '[:space:]')"
  case "$compact" in
    *'"success":true'*'"records":['*) echo "OK $resource" ;;
    *) echo "FAILED $resource: unexpected Jeecg response" >&2; exit 1 ;;
  esac
done

echo 'All five data-management endpoints are reachable.'
