#!/usr/bin/env bash
set -euo pipefail

# Script to release Node.js project similar to Maven release process
# 1. Remove -SNAPSHOT from version
# 2. Tag and push the release version
# 3. Bump patch version and add -SNAPSHOT back
# 4. Push to main

echo "Starting release process..."

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"

# Check if version contains SNAPSHOT
if [[ ! "$CURRENT_VERSION" =~ -SNAPSHOT$ ]]; then
    echo "Error: Current version does not contain -SNAPSHOT"
    exit 1
fi

# Remove -SNAPSHOT to get release version
RELEASE_VERSION="${CURRENT_VERSION%-SNAPSHOT}"
echo "Release version: $RELEASE_VERSION"

# Update package.json with release version using Node.js for cross-platform compatibility
node -e "const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); pkg.version = '$RELEASE_VERSION'; fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');"

# Commit the release version
git add package.json
git commit -m "Release version $RELEASE_VERSION" || {
    echo "Error: Failed to commit release version"
    exit 1
}

# Create and push tag
echo "Creating tag v$RELEASE_VERSION..."
git tag -a "v$RELEASE_VERSION" -m "Release version $RELEASE_VERSION"
git push origin "v$RELEASE_VERSION"

# Bump patch version
IFS='.' read -ra VERSION_PARTS <<< "$RELEASE_VERSION"
MAJOR="${VERSION_PARTS[0]}"
MINOR="${VERSION_PARTS[1]}"
PATCH="${VERSION_PARTS[2]}"

# Increment patch version
NEW_PATCH=$((PATCH + 1))
NEW_SNAPSHOT_VERSION="$MAJOR.$MINOR.$NEW_PATCH-SNAPSHOT"
echo "New snapshot version: $NEW_SNAPSHOT_VERSION"

# Update package.json with new snapshot version using Node.js for cross-platform compatibility
node -e "const fs = require('fs'); const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); pkg.version = '$NEW_SNAPSHOT_VERSION'; fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');"

# Commit the new snapshot version
git add package.json
git commit -m "Bump version to $NEW_SNAPSHOT_VERSION"
git push origin main

echo "Release process completed successfully!"
echo "Released: $RELEASE_VERSION (tagged as v$RELEASE_VERSION)"
echo "Next development version: $NEW_SNAPSHOT_VERSION"
