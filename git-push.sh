#!/bin/bash

# Usage: ./git-push.sh "Commit message"

if [ -z "$1" ]; then
  echo "Please provide a commit message."
  exit 1
fi

git add .
git commit -m "$1"
git push origin main
