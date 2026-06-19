#!/usr/bin/env bash
# Exit on error
set -o errexit

cd backend
python -m uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
