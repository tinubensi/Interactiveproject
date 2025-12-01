#!/bin/bash

echo "🔍 Current remote configuration:"
git remote -v
echo ""

read -p "Enter new repository URL: " NEW_REPO_URL

if [ -z "$NEW_REPO_URL" ]; then
    echo "❌ No URL provided. Exiting."
    exit 1
fi

echo ""
echo "🔄 Removing old remote..."
git remote remove origin 2>/dev/null || echo "No existing 'origin' remote found"

echo ""
echo "➕ Adding new remote..."
git remote add origin "$NEW_REPO_URL"

echo ""
echo "✅ New remote configuration:"
git remote -v

echo ""
read -p "Do you want to push to the new repository now? (y/n): " PUSH_NOW

if [ "$PUSH_NOW" = "y" ] || [ "$PUSH_NOW" = "Y" ]; then
    BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
    echo ""
    echo "📤 Pushing to new repository..."
    git push -u origin "$BRANCH"
else
    echo ""
    echo "💡 To push later, run:"
    echo "   git push -u origin $(git branch --show-current 2>/dev/null || echo 'main')"
fi
