# GitHub Actions Keep-Alive Setup

This is the **easiest and most cost-effective** solution to keep your Metropoly server awake!

## 🚀 How It Works

GitHub Actions will automatically run every 10 minutes to ping your Render server, preventing it from sleeping.

## ✅ What You Need to Do

1. **Commit and push these files to your GitHub repository:**
   - `.github/workflows/keep-alive.yml` (the workflow file)
   - `keep-alive.js` (the keep-alive script)

2. **That's it!** GitHub Actions will automatically start running.

## 🔍 How to Check It's Working

1. **Go to your GitHub repository**
2. **Click on "Actions" tab**
3. **You should see "Keep-Alive Service" workflow**
4. **It will run every 10 minutes automatically**

## 🧪 Test It Manually

1. **Go to Actions tab**
2. **Click "Keep-Alive Service"**
3. **Click "Run workflow" button**
4. **Watch it execute in real-time**

## 📊 Expected Results

- **Before**: Server sleeps after 15 minutes, 5-10 minute cold starts
- **After**: Server stays awake 24/7, instant connections
- **Cost**: $0 (completely free on GitHub)

## 🚨 Troubleshooting

### Workflow not running
- Check if `.github/workflows/keep-alive.yml` is in your repo
- Verify the file is committed and pushed
- Check GitHub Actions is enabled for your repository

### Server still sleeping
- Wait a few minutes for the first ping to happen
- Check the Actions tab to see if it's running
- Verify the SERVER_URL in the workflow matches your Render URL

## 💡 Pro Tips

1. **GitHub Actions is completely free** for public repositories
2. **Runs every 10 minutes automatically** - no manual intervention needed
3. **Uses GitHub's servers** - no additional hosting costs
4. **Can be manually triggered** for testing

## 🔗 Your Current Setup

- **Game**: Deployed on Netlify ✅
- **Server**: Deployed on Render ✅
- **Keep-Alive**: GitHub Actions (this solution) ✅

Perfect combination! Your server will never sleep again.
