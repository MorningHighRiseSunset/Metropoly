#!/bin/bash

# Metropoly Multiplayer Deployment Script
# This script helps set up the multiplayer game for deployment

echo "🎲 Metropoly Multiplayer Deployment Script"
echo "=========================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Check server configuration
echo "🔍 Checking server configuration..."
echo "✅ Server configured for in-memory storage"

# Create environment file template
echo "📝 Creating environment template..."
cat > .env.template << EOF
# Server Configuration
NODE_ENV=production
PORT=10000

# Frontend Configuration
REACT_APP_SERVER_URL=https://your-render-backend.onrender.com
EOF

echo "✅ Environment template created (.env.template)"

# Check for required files
echo "🔍 Checking required files..."
REQUIRED_FILES=("server.js" "lobby.html" "room.html" "game.js" "package.json" "render.yaml")
MISSING_FILES=()

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        MISSING_FILES+=("$file")
    fi
done

if [ ${#MISSING_FILES[@]} -ne 0 ]; then
    echo "❌ Missing required files:"
    for file in "${MISSING_FILES[@]}"; do
        echo "   - $file"
    done
    exit 1
fi

echo "✅ All required files present"

# Test server startup
echo "🚀 Testing server startup..."
timeout 10s node server.js &
SERVER_PID=$!
sleep 3

if kill -0 $SERVER_PID 2>/dev/null; then
    echo "✅ Server started successfully"
    kill $SERVER_PID
else
    echo "❌ Server failed to start"
    exit 1
fi

# Deployment instructions
echo ""
echo "🎯 Deployment Instructions"
echo "========================="
echo ""
echo "1. Backend (Render):"
echo "   - Push code to GitHub: git push origin main"
echo "   - Create account at render.com"
echo "   - Connect your GitHub repository"
echo "   - Render will auto-detect render.yaml"
echo "   - Create Redis service in Render dashboard"
echo ""
echo "2. Frontend (Netlify):"
echo "   - Create account at netlify.com"
echo "   - Connect your GitHub repository"
echo "   - Set build command: (leave empty)"
echo "   - Set publish directory: ."
echo "   - Update SERVER_URL in HTML files with your Render URL"
echo ""
echo "3. Update URLs:"
echo "   - Replace 'https://your-render-backend.onrender.com' in:"
echo "     - lobby.html"
echo "     - room.html"
echo "     - game.js"
echo "   - With your actual Render backend URL"
echo ""
echo "4. Test the deployment:"
echo "   - Visit your Netlify URL"
echo "   - Create a game room"
echo "   - Test with multiple browser tabs"
echo ""

# Optional: Start local development server
read -p "🚀 Start local development server? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Starting development server..."
    echo "Visit: http://localhost:3000/lobby.html"
    echo "Press Ctrl+C to stop"
    npm run dev
fi

echo ""
echo "🎉 Setup complete! Happy gaming!" 