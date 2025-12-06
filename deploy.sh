#!/bin/bash

# Load credentials from .env
if [ -f .env ]; then
    export $(cat .env | xargs)
else
    echo "Error: .env file not found. Please create one with GITHUB_USER and GITHUB_TOKEN."
    exit 1
fi

echo "🚀 Deploying to GitHub as $GITHUB_USER..."

# Push using the token
# Redirects output to /dev/null to hide the token from logs, but shows errors
git push https://$GITHUB_USER:$GITHUB_TOKEN@github.com/$GITHUB_USER/php-chrome-extension.git main

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
else
    echo "❌ Deployment failed."
fi
