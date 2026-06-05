#!/bin/bash

echo "🚀 Deploying to GitHub..."

# Push to the configured remote origin
git push origin main

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
else
    echo "❌ Deployment failed."
fi
