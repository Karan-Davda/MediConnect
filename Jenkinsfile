// Jenkinsfile — MediConnect (Multibranch) with NVM + Slack + Deploy to Dev Env - AWS EC2

pipeline {
  agent any

  options {
    timestamps()
    ansiColor('xterm')
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 30, unit: 'MINUTES')
  }

  environment {
    // --- Paths in repo ---
    FRONTEND_DIR  = 'Frontend/web'
    BACKEND_DIR   = 'Backend'

    // --- Remote deploy target (Nginx serves this) ---
    APP_DIR       = '/var/www/mediconnect'

    // --- EC2 SSH for deploy ---
    EC2_HOST = 'ec2-3-22-13-29.us-east-2.compute.amazonaws.com'
    SSH_USER = 'ubuntu'
    EC2_CRED = 'aws-deploy-key' // Jenkins "SSH Username with private key" credentials ID

    // --- Node runtime on agent ---
    NODE_MAJOR = '22'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        sh """#!/usr/bin/env bash
set -e
git rev-parse --short HEAD > .git/short
cat .git/short
"""
      }
    }

    stage('Install Node (NVM)') {
      steps {
        sh """#!/usr/bin/env bash
set -euo pipefail
export NVM_DIR="\$HOME/.nvm"
if [ ! -s "\$NVM_DIR/nvm.sh" ]; then
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
. "\$NVM_DIR/nvm.sh"
nvm install ${NODE_MAJOR} >/dev/null
nvm use ${NODE_MAJOR}    >/dev/null
node -v
npm -v
"""
      }
    }

    stage('Install deps') {
      steps {
        sh """#!/usr/bin/env bash
set -euo pipefail
export NVM_DIR="\$HOME/.nvm"; . "\$NVM_DIR/nvm.sh"; nvm use ${NODE_MAJOR} >/dev/null

if [ -f "${FRONTEND_DIR}/package.json" ]; then
  pushd "${FRONTEND_DIR}" >/dev/null
  NPM_CONFIG_PRODUCTION=false npm ci --include=dev || NPM_CONFIG_PRODUCTION=false npm install
  popd >/dev/null
else
  echo "No ${FRONTEND_DIR}/package.json — skipping FE deps"
fi

if [ -f "${BACKEND_DIR}/package.json" ]; then
  pushd "${BACKEND_DIR}" >/dev/null
  npm ci || npm install
  popd >/dev/null
else
  echo "No ${BACKEND_DIR}/package.json — skipping BE deps"
fi
"""
      }
    }

    stage('Build (frontend)') {
      steps {
        sh """#!/usr/bin/env bash
set -euo pipefail
export NVM_DIR="\$HOME/.nvm"; . "\$NVM_DIR/nvm.sh"; nvm use ${NODE_MAJOR} >/dev/null

test -d "${FRONTEND_DIR}" || { echo "::error::${FRONTEND_DIR} not found"; exit 1; }
pushd "${FRONTEND_DIR}" >/dev/null
npm run build --if-present || npx --yes vite build
test -d dist || { echo "::error::No dist/ folder found"; exit 1; }
echo "BUILD_OUT=\$(pwd)/dist" > "\$WORKSPACE/build_out.env"
popd >/dev/null
"""
      }
    }

    stage('Package (backend)') {
      steps {
        sh """#!/usr/bin/env bash
set -euo pipefail
export NVM_DIR="\$HOME/.nvm"; . "\$NVM_DIR/nvm.sh"; nvm use ${NODE_MAJOR} >/dev/null

rm -f backend.tgz || true
if [ -f "${BACKEND_DIR}/package.json" ]; then
  pushd "${BACKEND_DIR}" >/dev/null
  tar -czf "\$WORKSPACE/backend.tgz" \\
    package.json package-lock.json \\
    \$( [ -d dist ] && echo dist ) \\
    \$( [ -d src ]  && echo src ) || true
  popd >/dev/null
  ls -lh backend.tgz || true
else
  echo "::notice::Skipping backend package (no ${BACKEND_DIR}/package.json)"
fi
"""
      }
    }

    // -------- YOUR DEPLOY STAGE (verbatim, with double quotes) --------
    stage('Deploy to Dev Env - AWS EC2') {
      when { branch 'main' } // deploy only from main
      steps {
        withCredentials([sshUserPrivateKey(credentialsId: env.EC2_CRED, keyFileVariable: 'KEYFILE')]) {
          sh """#!/bin/bash
set -euo pipefail

source "\$WORKSPACE/build_out.env"

# Prepare a single archive to upload
rm -f mediconnect-dist.zip mediconnect-dist.tar.gz || true
if command -v zip >/dev/null 2>&1; then
  (cd "\$BUILD_OUT" && zip -r "\$WORKSPACE/mediconnect-dist.zip" .)
  ART="mediconnect-dist.zip"
else
  (cd "\$BUILD_OUT" && tar -czf "\$WORKSPACE/mediconnect-dist.tar.gz" .)
  ART="mediconnect-dist.tar.gz"
fi
ls -lh "\$WORKSPACE/\$ART"

# Upload to /tmp on the instance
scp -i "\$KEYFILE" -o StrictHostKeyChecking=no "\$WORKSPACE/\$ART" "${SSH_USER}@${EC2_HOST}:/tmp/\$ART"

# Run the remote deploy via heredoc (avoids quoting issues)
ssh -i "\$KEYFILE" -o StrictHostKeyChecking=no "${SSH_USER}@${EC2_HOST}" 'bash -s' <<'REMOTE'
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
"""
        }
      }
    }
  } // stages

  post {
    success {
      echo "✅ ${env.BRANCH_NAME}@${readFile('.git/short').trim()} deployed OK"
      slackSend(color: '#2EB67D',
        message: "✅ *Build Succeeded* — `${env.JOB_NAME}` #${env.BUILD_NUMBER}\\nBranch: *${env.BRANCH_NAME}*\\nCommit: `${readFile('.git/short').trim()}`\\n<${env.BUILD_URL}|View Console Output>")
    }
    failure {
      echo "❌ ${env.BRANCH_NAME} failed"
      slackSend(color: '#E01E5A',
        message: "❌ *Build Failed* — `${env.JOB_NAME}` #${env.BUILD_NUMBER}\\nBranch: *${env.BRANCH_NAME}*\\n<${env.BUILD_URL}|View Console Output>")
    }
    always {
      archiveArtifacts allowEmptyArchive: true, artifacts: "build_out.env,backend.tgz,**/dist/**"
    }
  }
}
