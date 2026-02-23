#!/bin/bash

# Configuration
PROJECT_REF="rwjhpfghhgstvplmggks"
FUNCTION_NAME="approval-reminder"

# Ensure supabase is installed
if ! command -v supabase &> /dev/null; then
    echo "Supabase CLI not found. Please install it first using setup_wsl.sh or via your package manager."
    exit 1
fi

# Deploy the function
echo "Deploying edge function: $FUNCTION_NAME to project: $PROJECT_REF..."
supabase functions deploy $FUNCTION_NAME --project-ref $PROJECT_REF --no-verify-jwt

if [ $? -eq 0 ]; then
    echo "Deployment successful!"
else
    echo "Deployment failed."
    exit 1
fi
