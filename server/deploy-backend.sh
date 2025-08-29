#!/bin/bash

# Backend Deployment Script for Conversation Platform

echo "🎙️ Backend Deployment for Conversation Platform"
echo "=============================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are installed"

# Get GitHub username
read -p "Enter your GitHub username: " github_username

if [ -z "$github_username" ]; then
    echo "❌ GitHub username is required."
    exit 1
fi

# Get repository name
read -p "Enter your backend repository name (e.g., conversation-backend): " repo_name

if [ -z "$repo_name" ]; then
    echo "❌ Repository name is required."
    exit 1
fi

echo ""
echo "📋 Next Steps:"
echo "=============="
echo ""
echo "1. Go to https://github.com/new"
echo "2. Repository name: $repo_name"
echo "3. Description: Conversation Platform Backend - Recording Server"
echo "4. Make it Public (required for free Railway deployment)"
echo "5. Don't initialize with README (we already have one)"
echo "6. Click 'Create repository'"
echo ""
echo "After creating the repository, run these commands:"
echo ""

# Generate the commands
echo "git remote add origin https://github.com/$github_username/$repo_name.git"
echo "git branch -M main"
echo "git push -u origin main"
echo ""
echo "Then deploy to Railway:"
echo "1. Go to https://railway.app/"
echo "2. Sign up with GitHub"
echo "3. Click 'New Project'"
echo "4. Select 'Deploy from GitHub repo'"
echo "5. Choose your repository: $github_username/$repo_name"
echo "6. Railway will automatically deploy"
echo ""
echo "Your backend will be available at:"
echo "https://your-app-name.railway.app"
echo ""
echo "🎉 That's it! Your backend will be live on Railway!"

# Ask if user wants to proceed with the git commands
read -p "Have you created the GitHub repository? (y/n): " proceed

if [ "$proceed" = "y" ] || [ "$proceed" = "Y" ]; then
    echo ""
    echo "🚀 Setting up remote repository..."
    
    # Add remote origin
    git remote add origin https://github.com/$github_username/$repo_name.git
    
    # Set branch to main
    git branch -M main
    
    # Push to GitHub
    echo "📤 Pushing code to GitHub..."
    git push -u origin main
    
    echo ""
    echo "✅ Code pushed successfully!"
    echo ""
    echo "🔧 Now deploy to Railway:"
    echo "1. Go to https://railway.app/"
    echo "2. Sign up with GitHub"
    echo "3. Click 'New Project'"
    echo "4. Select 'Deploy from GitHub repo'"
    echo "5. Choose your repository: $github_username/$repo_name"
    echo "6. Railway will automatically deploy"
    echo ""
    echo "🌐 Your backend will be live at:"
    echo "https://your-app-name.railway.app"
    echo ""
    echo "⏳ It may take a few minutes for the deployment to complete."
    echo ""
    echo "📝 After deployment, update your frontend config with the Railway URL!"
else
    echo ""
    echo "📝 Please create the GitHub repository first, then run this script again."
fi
