#!/bin/bash

# Railway CLI Deployment Script

echo "🚂 Railway CLI Deployment"
echo "========================"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI is not installed."
    echo ""
    echo "📦 Installing Railway CLI..."
    echo "npm install -g @railway/cli"
    echo ""
    echo "After installation, run this script again."
    exit 1
fi

echo "✅ Railway CLI is installed"

# Check if user is logged in
if ! railway whoami &> /dev/null; then
    echo "❌ Not logged in to Railway."
    echo ""
    echo "🔐 Please login to Railway:"
    echo "railway login"
    echo ""
    echo "After logging in, run this script again."
    exit 1
fi

echo "✅ Logged in to Railway"

# Deploy the backend
echo ""
echo "🚀 Deploying backend to Railway..."
echo ""

# Change to server directory
cd server

# Deploy using Railway CLI
railway up

echo ""
echo "🎉 Deployment completed!"
echo ""
echo "📋 Next steps:"
echo "1. Get your Railway URL from the dashboard"
echo "2. Update your frontend configuration"
echo "3. Test the full system"
