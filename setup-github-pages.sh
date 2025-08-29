#!/bin/bash

# GitHub Pages Setup Script for Conversation Platform

echo "🎙️ GitHub Pages Setup for Conversation Platform"
echo "=============================================="

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install Git first."
    exit 1
fi

echo "✅ Git is installed"

# Get GitHub username
read -p "Enter your GitHub username: " github_username

if [ -z "$github_username" ]; then
    echo "❌ GitHub username is required."
    exit 1
fi

# Get repository name
read -p "Enter your repository name (e.g., conversation-platform): " repo_name

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
echo "3. Description: Agora Conversation Platform with separate user recordings"
echo "4. Make it Public (required for free GitHub Pages)"
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
echo "Then enable GitHub Pages:"
echo "1. Go to your repository on GitHub"
echo "2. Click 'Settings' tab"
echo "3. Scroll down to 'Pages' section"
echo "4. Source: 'Deploy from a branch'"
echo "5. Branch: 'main'"
echo "6. Folder: '/' (root)"
echo "7. Click 'Save'"
echo ""
echo "Your app will be available at:"
echo "https://$github_username.github.io/$repo_name/"
echo ""
echo "🎉 That's it! Your conversation platform will be live on GitHub Pages!"

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
    echo "🔧 Now enable GitHub Pages:"
    echo "1. Go to https://github.com/$github_username/$repo_name/settings/pages"
    echo "2. Source: 'Deploy from a branch'"
    echo "3. Branch: 'main'"
    echo "4. Folder: '/' (root)"
    echo "5. Click 'Save'"
    echo ""
    echo "🌐 Your app will be live at:"
    echo "https://$github_username.github.io/$repo_name/"
    echo ""
    echo "⏳ It may take a few minutes for the site to be available."
else
    echo ""
    echo "📝 Please create the GitHub repository first, then run this script again."
fi
