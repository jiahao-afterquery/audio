#!/bin/bash

# Script to update the backend URL in the frontend configuration for Render

echo "🔧 Render Backend URL Update Script"
echo "==================================="

# Check if URL is provided as argument
if [ -z "$1" ]; then
    echo ""
    echo "❌ Please provide your Render URL as an argument."
    echo ""
    echo "Usage: ./update-render-url.sh YOUR_RENDER_URL"
    echo ""
    echo "Example: ./update-render-url.sh conversation-backend.onrender.com"
    echo ""
    echo "🔍 To find your Render URL:"
    echo "1. Go to https://dashboard.render.com/"
    echo "2. Click on your conversation-backend service"
    echo "3. Copy the URL from the 'URL' section"
    echo ""
    exit 1
fi

RENDER_URL=$1

# Remove https:// if present
RENDER_URL=$(echo $RENDER_URL | sed 's|https://||')

# Remove trailing slash if present
RENDER_URL=$(echo $RENDER_URL | sed 's|/$||')

echo "🚀 Updating backend URL to: https://$RENDER_URL"

# Update the production config file
CONFIG_FILE="src/example/advanced/conversationPlatform/config.production.js"

if [ -f "$CONFIG_FILE" ]; then
    # Create backup
    cp "$CONFIG_FILE" "$CONFIG_FILE.backup"
    
    # Update the URL
    sed -i '' "s|YOUR_RAILWAY_URL|$RENDER_URL|g" "$CONFIG_FILE"
    
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
echo "1. Test your backend URL: https://$RENDER_URL/api/health"
echo "2. Deploy the updated frontend to GitHub Pages"
echo "3. Test a conversation - recordings should upload to your server"
echo ""
echo "🔍 To verify the update, check line 8 in $CONFIG_FILE"
