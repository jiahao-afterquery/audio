#!/bin/bash

# Conversation Platform Deployment Script
# This script helps deploy the conversation platform to the web

echo "🎙️ Conversation Platform Deployment Script"
echo "=========================================="

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

# Function to deploy backend
deploy_backend() {
    echo "🚀 Deploying Backend..."
    
    cd server
    
    # Install dependencies
    echo "📦 Installing server dependencies..."
    npm install
    
    # Check if Railway CLI is installed
    if ! command -v railway &> /dev/null; then
        echo "📥 Installing Railway CLI..."
        npm install -g @railway/cli
    fi
    
    # Deploy to Railway
    echo "🚂 Deploying to Railway..."
    railway login
    railway up
    
    echo "✅ Backend deployed successfully!"
    echo "🔗 Your backend URL will be shown above"
    
    cd ..
}

# Function to deploy frontend
deploy_frontend() {
    echo "🌐 Deploying Frontend..."
    
    # Check if Vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
        echo "📥 Installing Vercel CLI..."
        npm install -g vercel
    fi
    
    # Deploy to Vercel
    echo "🚀 Deploying to Vercel..."
    vercel --prod
    
    echo "✅ Frontend deployed successfully!"
    echo "🔗 Your frontend URL will be shown above"
}

# Function to setup GitHub Pages
setup_github_pages() {
    echo "📚 Setting up GitHub Pages..."
    
    # Check if git is installed
    if ! command -v git &> /dev/null; then
        echo "❌ Git is not installed. Please install Git first."
        exit 1
    fi
    
    # Initialize git if not already done
    if [ ! -d ".git" ]; then
        git init
        git add .
        git commit -m "Initial commit"
    fi
    
    echo "📝 Please create a GitHub repository and push your code:"
    echo "   git remote add origin https://github.com/yourusername/conversation-platform.git"
    echo "   git push -u origin main"
    echo ""
    echo "🔧 Then enable GitHub Pages in your repository settings"
}

# Main menu
echo ""
echo "Choose deployment option:"
echo "1. Deploy Backend (Railway)"
echo "2. Deploy Frontend (Vercel)"
echo "3. Setup GitHub Pages"
echo "4. Deploy Everything (Backend + Frontend)"
echo "5. Exit"

read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        deploy_backend
        ;;
    2)
        deploy_frontend
        ;;
    3)
        setup_github_pages
        ;;
    4)
        deploy_backend
        echo ""
        deploy_frontend
        ;;
    5)
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "🎉 Deployment completed!"
echo ""
echo "📋 Next steps:"
echo "1. Update your Agora credentials in the setup page"
echo "2. Update the backend URL in your frontend configuration"
echo "3. Test the conversation platform"
echo "4. Monitor the application for any issues"
echo ""
echo "📖 For detailed instructions, see DEPLOYMENT.md"
