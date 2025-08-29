# Conversation Platform Deployment Guide

This guide will help you deploy the conversation platform to the web.

## 🚀 Quick Deployment Options

### Option 1: All-in-One (Recommended for Testing)
- **Frontend**: GitHub Pages (Free)
- **Backend**: Railway (Free tier)
- **Total Cost**: $0/month

### Option 2: Production Ready
- **Frontend**: Vercel (Free tier)
- **Backend**: DigitalOcean App Platform ($5/month)
- **Total Cost**: $5/month

### Option 3: Enterprise
- **Frontend**: AWS S3 + CloudFront
- **Backend**: AWS EC2 or Lambda
- **Database**: AWS RDS
- **Storage**: AWS S3

## 📋 Prerequisites

1. **Agora Account**: Get App ID and App Certificate from [Agora Console](https://console.agora.io/)
2. **GitHub Account**: For code hosting
3. **Node.js**: For local development

## 🔧 Step-by-Step Deployment

### Step 1: Prepare Your Code

1. **Update Agora Configuration**
   ```javascript
   // In src/common/utils.js, ensure your Agora credentials are set
   const AGORA_CONFIG = {
       appid: "YOUR_AGORA_APP_ID",
       certificate: "YOUR_AGORA_CERTIFICATE"
   };
   ```

2. **Update Production Config**
   ```javascript
   // In config.production.js, update the backend URL
   UPLOAD_URL: 'https://your-backend-domain.com/api/recordings/upload'
   ```

### Step 2: Deploy Backend (Recording Server)

#### Option A: Railway (Recommended)

1. **Create Railway Account**
   - Go to [railway.app](https://railway.app/)
   - Sign up with GitHub

2. **Deploy Backend**
   ```bash
   cd server
   npm install
   # Create a new repository for the server
   git init
   git add .
   git commit -m "Initial server commit"
   git remote add origin https://github.com/yourusername/conversation-server.git
   git push -u origin main
   ```

3. **Connect to Railway**
   - Go to Railway dashboard
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your server repository
   - Railway will automatically deploy

4. **Get Your Backend URL**
   - Railway will provide a URL like: `https://your-app-name.railway.app`
   - Copy this URL for the frontend configuration

#### Option B: Heroku

1. **Install Heroku CLI**
   ```bash
   npm install -g heroku
   ```

2. **Deploy to Heroku**
   ```bash
   cd server
   heroku create your-conversation-server
   git add .
   git commit -m "Add server"
   git push heroku main
   ```

3. **Get Your Backend URL**
   - Your app will be at: `https://your-conversation-server.herokuapp.com`

### Step 3: Deploy Frontend

#### Option A: Vercel (Recommended)

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy Frontend**
   ```bash
   # Update config.js with your backend URL
   # Then deploy
   vercel --prod
   ```

3. **Configure Domain**
   - Vercel will provide a URL like: `https://your-app.vercel.app`
   - You can add a custom domain in Vercel dashboard

#### Option B: Netlify

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Deploy**
   ```bash
   netlify deploy --prod --dir=src
   ```

#### Option C: GitHub Pages

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Add conversation platform"
   git push origin main
   ```

2. **Enable GitHub Pages**
   - Go to repository settings
   - Scroll to "GitHub Pages" section
   - Select "main" branch
   - Your app will be at: `https://yourusername.github.io/repository-name/`

### Step 4: Update Configuration

1. **Update Backend URL**
   ```javascript
   // In config.js or config.production.js
   UPLOAD_URL: 'https://your-backend-domain.com/api/recordings/upload'
   ```

2. **Test the Connection**
   - Open your deployed frontend
   - Try uploading a test recording
   - Check if it reaches your backend

## 🔒 Security Considerations

### Production Checklist

- [ ] **HTTPS**: Ensure both frontend and backend use HTTPS
- [ ] **CORS**: Configure CORS properly for your domain
- [ ] **Authentication**: Add authentication to admin endpoints
- [ ] **Rate Limiting**: Implement rate limiting on uploads
- [ ] **File Validation**: Ensure file type and size validation
- [ ] **Environment Variables**: Use environment variables for secrets

### Environment Variables

Create a `.env` file in your server directory:

```bash
# Server .env file
PORT=3002
NODE_ENV=production
UPLOAD_PATH=/app/recordings
MAX_FILE_SIZE=100000000
ALLOWED_ORIGINS=https://your-frontend-domain.com
```

## 📊 Monitoring & Analytics

### Health Checks

Your backend provides health check endpoints:
- `GET /api/health` - Server status
- `GET /api/recordings` - List recordings (admin)

### Logging

Consider adding logging services:
- **Vercel**: Built-in analytics
- **Railway**: Built-in logs
- **Heroku**: Built-in logging
- **Custom**: Winston or Bunyan

## 🚨 Troubleshooting

### Common Issues

1. **CORS Errors**
   ```javascript
   // In server/recording-server.js
   app.use(cors({
       origin: ['https://your-frontend-domain.com'],
       credentials: true
   }));
   ```

2. **File Upload Fails**
   - Check file size limits
   - Verify file type restrictions
   - Check network connectivity

3. **Agora Connection Issues**
   - Verify App ID and Certificate
   - Check browser console for errors
   - Ensure HTTPS is used

### Debug Mode

Enable debug logging:
```javascript
// In config.js
PRODUCTION: {
    ENABLED: false, // Set to false for debug mode
    LOG_LEVEL: 'debug'
}
```

## 💰 Cost Estimation

### Free Tier (Testing)
- **Frontend**: GitHub Pages (Free)
- **Backend**: Railway (Free tier)
- **Storage**: Railway provides 1GB
- **Total**: $0/month

### Production (Small Scale)
- **Frontend**: Vercel (Free tier)
- **Backend**: DigitalOcean App Platform ($5/month)
- **Storage**: DigitalOcean Spaces ($5/month)
- **Total**: $10/month

### Enterprise (Large Scale)
- **Frontend**: AWS S3 + CloudFront ($1-5/month)
- **Backend**: AWS EC2 ($20-100/month)
- **Database**: AWS RDS ($20-50/month)
- **Storage**: AWS S3 ($5-20/month)
- **Total**: $50-175/month

## 🎯 Next Steps

1. **Deploy your backend** using Railway or Heroku
2. **Deploy your frontend** using Vercel or Netlify
3. **Update the configuration** with your backend URL
4. **Test the full system** with a conversation
5. **Monitor and optimize** based on usage

Your conversation platform will be live on the web and ready for users!
