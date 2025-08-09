# Keep-Alive Service Deployment Guide

This guide explains how to deploy the keep-alive service to prevent your Metropoly server from sleeping.

## 🚀 Quick Start Options

### Option 1: Deploy to Render (Recommended - Free)

1. **Fork or clone this repository**
2. **Go to [Render.com](https://render.com) and create an account**
3. **Create a new Web Service**
4. **Connect your GitHub repository**
5. **Configure the service:**
   - **Name**: `metropoly-keep-alive`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`

6. **Add Environment Variables:**
   - `SERVER_URL`: `https://metropoly.onrender.com` (your main server URL)

7. **Deploy!**

### Option 2: Deploy to Railway (Alternative - Free)

1. **Go to [Railway.app](https://railway.app)**
2. **Create a new project**
3. **Deploy from GitHub**
4. **Set environment variable:**
   - `SERVER_URL`: `https://metropoly.onrender.com`

### Option 3: GitHub Actions (Free, runs on GitHub's servers)

1. **Create `.github/workflows/keep-alive.yml` in your repo:**

```yaml
name: Keep-Alive Service

on:
  schedule:
    - cron: '*/10 * * * *'  # Every 10 minutes
  workflow_dispatch:  # Manual trigger

jobs:
  keep-alive:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v3
      
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Run keep-alive
      run: node keep-alive.js
      env:
        SERVER_URL: https://metropoly.onrender.com
```

### Option 4: Run Locally (For testing)

```bash
# Clone the repository
git clone <your-repo>
cd metropoly-keep-alive

# Install dependencies
npm install

# Set environment variable
export SERVER_URL=https://metropoly.onrender.com

# Run the service
npm start
```

## 🔧 Configuration

### Environment Variables

- `SERVER_URL`: Your main Metropoly server URL (default: `https://metropoly.onrender.com`)
- `PING_INTERVAL`: How often to ping (default: 10 minutes)

### Customization

You can modify the ping interval by editing `keep-alive.js`:

```javascript
const PING_INTERVAL = 5 * 60 * 1000; // 5 minutes instead of 10
```

## 📊 Monitoring

The service will log:
- ✅ Successful pings
- ⚠️ Failed requests
- ❌ Connection errors
- 📊 Health check summaries

## 🚨 Troubleshooting

### Service not starting
- Check Node.js version (requires 14+)
- Verify environment variables
- Check console logs

### Server still sleeping
- Verify the keep-alive service is running
- Check if it's actually pinging your server
- Ensure the URLs are correct

### Too many requests
- Increase the ping interval
- Render allows 750 free tier requests per month

## 💡 Pro Tips

1. **Use Render's free tier** - It's perfect for this use case
2. **Monitor logs** - Check the service logs regularly
3. **Test locally first** - Make sure it works before deploying
4. **Backup plan** - Consider upgrading to a paid Render plan for 24/7 uptime

## 🔗 Links

- [Render.com](https://render.com) - Free hosting
- [Railway.app](https://railway.app) - Alternative hosting
- [GitHub Actions](https://github.com/features/actions) - Free automation

## 📝 License

MIT License - Feel free to modify and use as needed!
