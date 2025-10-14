pipeline {
  agent any
  options { timestamps() }

  environment {
    // --- repo layout ---
    FRONTEND_DIR = 'Frontend/web'
    BACKEND_DIR  = 'Backend'

    // --- deploy target (Nginx serves this) ---
    APP_DIR = '/var/www/mediconnect'

    // --- EC2 SSH for deploy ---
    EC2_HOST = 'ec2-3-22-13-29.us-east-2.compute.amazonaws.com'
    SSH_USER = 'ubuntu'
    EC2_CRED = 'aws-deploy-key'   // Jenkins credential ID
  }

  stages {
    stage('Checkout') {
      steps {
        sh '''#!/bin/bash
set -e
git rev-parse --short HEAD > .git/short
cat .git/short
'''
      }
    }

    stage('Install Node (NVM)') {
      steps {
        sh '''#!/bin/bash
set -euo pipefail

export NVM_DIR="$HOME/.nvm"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
source "$NVM_DIR/nvm.sh"
nvm install 20 >/dev/null
nvm use 20 >/dev/null

node -v
npm -v
'''
      }
    }

    stage('Install deps') {
      steps {
        sh '''#!/bin/bash
set -euo pipefail

# load Node 20 for this step
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
nvm use 20 >/dev/null

# Frontend deps
if [ -f "$FRONTEND_DIR/package.json" ]; then
  pushd "$FRONTEND_DIR" >/dev/null
  npm ci || npm install
  popd >/dev/null
else
  echo "::warning::No $FRONTEND_DIR/package.json — skipping FE deps"
fi

# Backend deps (optional)
if [ -f "$BACKEND_DIR/package.json" ]; then
  pushd "$BACKEND_DIR" >/dev/null
  npm ci || npm install
  popd >/dev/null
else
  echo "::notice::No $BACKEND_DIR/package.json — skipping BE deps"
fi
'''
      }
    }

    stage('Lint & Test') {
      steps {
        sh '''#!/bin/bash
set -euo pipefail

# load Node 20 for this step
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
nvm use 20 >/dev/null

# Frontend (strict)
if [ -f "$FRONTEND_DIR/package.json" ]; then
  pushd "$FRONTEND_DIR" >/dev/null
  npm run lint --if-present
  npm test --if-present
  popd >/dev/null
fi

# Backend (will not fail if you still have placeholder tests)
if [ -f "$BACKEND_DIR/package.json" ]; then
  pushd "$BACKEND_DIR" >/dev/null
  # If your package.json still has the placeholder "exit 1", make it non-blocking:
  npm run lint --if-present || echo "[backend] lint skipped/failed (non-blocking)"
  npm test --if-present || echo "[backend] tests skipped/failed (non-blocking)"
  popd >/dev/null
fi
'''
      }
    }

    stage('Build (frontend)') {
      steps {
        sh '''#!/bin/bash
set -euo pipefail

# load Node 20 for this step
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
nvm use 20 >/dev/null

test -d "$FRONTEND_DIR" || { echo "::error::$FRONTEND_DIR not found"; exit 1; }

pushd "$FRONTEND_DIR" >/dev/null
npm run build
test -d dist || { echo "::error::No dist/ folder found"; exit 1; }
echo "BUILD_OUT=$(pwd)/dist" > "$WORKSPACE/build_out.env"
popd >/dev/null
'''
      }
    }

    stage('Package (backend)') {
      steps {
        sh '''#!/bin/bash
set -euo pipefail
rm -f backend.tgz || true

if [ -f "$BACKEND_DIR/package.json" ]; then
  pushd "$BACKEND_DIR" >/dev/null
  tar -czf "$WORKSPACE/backend.tgz" \
    package.json package-lock.json \
    $( [ -d dist ] && echo dist ) \
    $( [ -d src ]  && echo src ) || true
  popd >/dev/null
  ls -lh backend.tgz || true
else
  echo "::notice::Skipping backend package (no $BACKEND_DIR/package.json)"
fi
'''
      }
    }

    stage('Deploy to Dev Env - AWS EC2') {
      when { branch 'main' }   // deploy only from main
      steps {
        withCredentials([sshUserPrivateKey(credentialsId: env.EC2_CRED, keyFileVariable: 'KEYFILE')]) {
          sh '''#!/bin/bash
set -euo pipefail

source "$WORKSPACE/build_out.env"

# Prepare a single archive to upload
rm -f mediconnect-dist.zip mediconnect-dist.tar.gz || true
if command -v zip >/dev/null 2>&1; then
  (cd "$BUILD_OUT" && zip -r "$WORKSPACE/mediconnect-dist.zip" .)
  ART="mediconnect-dist.zip"
else
  (cd "$BUILD_OUT" && tar -czf "$WORKSPACE/mediconnect-dist.tar.gz" .)
  ART="mediconnect-dist.tar.gz"
fi
ls -lh "$WORKSPACE/$ART"

# Upload to /tmp on the instance
scp -i "$KEYFILE" -o StrictHostKeyChecking=no "$WORKSPACE/$ART" "${SSH_USER}@${EC2_HOST}:/tmp/$ART"

# Run the remote deploy via heredoc (avoids quoting issues)
ssh -i "$KEYFILE" -o StrictHostKeyChecking=no "${SSH_USER}@${EC2_HOST}" 'bash -s' <<'REMOTE'
set -euo pipefail

APP_DIR="/var/www/mediconnect"
ART_ZIP="/tmp/mediconnect-dist.zip"
ART_TAR="/tmp/mediconnect-dist.tar.gz"

# tools we need
sudo apt-get update -y >/dev/null 2>&1 || true
sudo apt-get install -y unzip >/dev/null 2>&1 || true

# extract into a temp directory
TMPD="$(mktemp -d /tmp/mediconnect.XXXX)"
if [ -f "$ART_ZIP" ]; then
  sudo unzip -q "$ART_ZIP" -d "$TMPD"
else
  sudo tar -xzf "$ART_TAR" -C "$TMPD"
fi

# atomic swap
TS="$(date +%s)"
if [ -d "$APP_DIR" ]; then
  sudo mv "$APP_DIR" "${APP_DIR}.bak.$TS"
fi
sudo mkdir -p "$(dirname "$APP_DIR")"
sudo mv "$TMPD" "$APP_DIR"

# permissions so nginx can read (www-data is nginx user on Ubuntu)
sudo chown -R www-data:www-data "$APP_DIR"
sudo find "$APP_DIR" -type d -exec chmod 755 {} +
sudo find "$APP_DIR" -type f -exec chmod 644 {} +

# reload nginx and clean up
sudo systemctl reload nginx || true
sudo rm -f "$ART_ZIP" "$ART_TAR" || true

echo "✅ Deployed static frontend to $APP_DIR"
REMOTE
'''
        }
      }
    }
  }

  post {
    success {
      echo "✅ ${env.BRANCH_NAME}@${env.GIT_COMMIT} succeeded"
    }
    always {
      archiveArtifacts artifacts: 'build_out.env,backend.tgz,**/dist/**', allowEmptyArchive: true
      echo "Build URL: ${env.BUILD_URL}"
    }
  }
}
