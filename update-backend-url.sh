#!/bin/bash

# Script to update the backend URL in the frontend configuration

echo "🔧 Backend URL Update Script"
echo "============================"

# Check if URL is provided as argument
if [ -z "$1" ]; then
    echo ""
    echo "❌ Please provide your Railway URL as an argument."
    echo ""
    echo "Usage: ./update-backend-url.sh YOUR_RAILWAY_URL"
    echo ""
    echo "Example: ./update-backend-url.sh conversation-backend-production-xxxx.up.railway.app"
    echo ""
    echo "🔍 To find your Railway URL:"
    echo "1. Go to https://railway.app/dashboard"
    echo "2. Click on your conversation-backend project"
    echo "3. Copy the URL from the 'Domains' section"
    echo ""
    exit 1
fi

RAILWAY_URL=$1

# Remove https:// if present
RAILWAY_URL=$(echo $RAILWAY_URL | sed 's|https://||')

# Remove trailing slash if present
RAILWAY_URL=$(echo $RAILWAY_URL | sed 's|/$||')

echo "🚀 Updating backend URL to: https://$RAILWAY_URL"

# Update the production config file
CONFIG_FILE="src/example/advanced/conversationPlatform/config.production.js"

if [ -f "$CONFIG_FILE" ]; then
    # Create backup
    cp "$CONFIG_FILE" "$CONFIG_FILE.backup"
    
    # Update the URL
    sed -i '' "s|YOUR_RAILWAY_URL|$RAILWAY_URL|g" "$CONFIG_FILE"
    
    echo "✅ Updated $CONFIG_FILE"
    echo "📁 Backup created as $CONFIG_FILE.backup"
else
    echo "❌ Config file not found: $CONFIG_FILE"
    exit 1
fi

echo ""
echo "🎉 Backend URL updated successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Test your backend URL: https://$RAILWAY_URL/api/health"
echo "2. Deploy the updated frontend to GitHub Pages"
echo "3. Test a conversation - recordings should upload to your server"
echo ""
echo "🔍 To verify the update, check line 8 in $CONFIG_FILE"
