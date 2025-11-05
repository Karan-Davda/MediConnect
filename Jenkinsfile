// Jenkinsfile — MediConnect (Multibranch) with NVM + Slack + Deploy to Dev/QA

pipeline {
  agent any

  options {
    timestamps()
    ansiColor('xterm')
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 30, unit: 'MINUTES')
  }

  parameters {
    booleanParam(name: 'RUN_DEPLOY', defaultValue: true, description: 'Run deploy step when the branch matches an environment (main→Dev, qa→QA)')
    choice(
      name: 'FORCE_ENV',
      choices: ['AUTO','DEV','QA'],
      description: 'AUTO = derive from branch (main→DEV, qa→QA). Override only if needed.'
    )
  }

  environment {
    FRONTEND_DIR  = 'Frontend/web'
    BACKEND_DIR   = 'Backend'
    SSH_USER      = 'ubuntu'
    NODE_MAJOR    = '22'
    // Will set later: GIT_COMMIT_SHORT, GIT_COMMIT_SUBJECT, GIT_COMMIT_MSG, TARGET_ENV, EC2_HOST, EC2_CRED, APP_DIR
  }

  stages {

    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.GIT_COMMIT_SHORT   = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
          // subject (single line)
          env.GIT_COMMIT_SUBJECT = sh(script: 'git log -1 --pretty=%s',     returnStdout: true).trim()
          // full body (sanitize control chars to be safe for Slack)
          env.GIT_COMMIT_MSG     = sh(script: "git log -1 --pretty=%B | tr -d '\\000-\\031\\177'", returnStdout: true).trim()

          echo "Commit: ${env.GIT_COMMIT_SHORT}"
          echo "Subject: ${env.GIT_COMMIT_SUBJECT}"
        }
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

# Frontend deps
if [ -f "${FRONTEND_DIR}/package.json" ]; then
  pushd "${FRONTEND_DIR}" >/dev/null
  NPM_CONFIG_PRODUCTION=false npm ci --include=dev || NPM_CONFIG_PRODUCTION=false npm install
  popd >/dev/null
else
  echo "No ${FRONTEND_DIR}/package.json — skipping FE deps"
fi

# Backend deps (optional)
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

    stage('Package and Build (backend)') {
      steps {
        sh """#!/usr/bin/env bash
set -euo pipefail
export NVM_DIR="\$HOME/.nvm"; . "\$NVM_DIR/nvm.sh"; nvm use ${NODE_MAJOR} >/dev/null

rm -f backend.tgz || true
if [ -f "${BACKEND_DIR}/package.json" ]; then
  pushd "${BACKEND_DIR}" >/dev/null
  
  # Ensure dependencies are installed before packaging
  echo "📥 Installing backend dependencies for packaging..."
  npm ci || npm install
  
  # Package backend
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

    stage('Select Environment') {
      steps {
        script {
          def CFG = [
            DEV: [ branch: 'main',
                   host:   'ec2-3-22-13-29.us-east-2.compute.amazonaws.com',
                   cred:   'aws-deploy-key',
                   webroot:'/var/www/mediconnect' ],
            QA : [ branch: 'QA',
                   host:   'ec2-3-144-150-239.us-east-2.compute.amazonaws.com',
                   cred:   'aws-qa-key',
                   webroot:'/var/www/mediconnect-qa' ]
          ]

          def t = params.FORCE_ENV
          if (t == 'AUTO') {
            t = (env.BRANCH_NAME == CFG.QA.branch) ? 'QA'
                : (env.BRANCH_NAME == CFG.DEV.branch) ? 'DEV'
                : 'NONE'
          }

          env.TARGET_ENV = t
          if (t == 'NONE') {
            echo "No matching environment for branch '${env.BRANCH_NAME}'. Deploy will be skipped."
          } else {
            env.EC2_HOST = CFG[t].host
            env.EC2_CRED = CFG[t].cred
            env.APP_DIR  = CFG[t].webroot
            echo "Target environment: ${env.TARGET_ENV} → ${env.EC2_HOST} (${env.APP_DIR})"
          }
        }
      }
    }

    stage('Deploy to AWS') {
      when {
        allOf {
          expression { return params.RUN_DEPLOY }
          expression { return env.TARGET_ENV && env.TARGET_ENV != 'NONE' }
        }
      }
      steps {
        withCredentials([sshUserPrivateKey(credentialsId: env.EC2_CRED, keyFileVariable: 'KEYFILE')]) {
          sh '''#!/usr/bin/env bash
set -euo pipefail
source "$WORKSPACE/build_out.env"

# Deploy Frontend
rm -f mediconnect-dist.zip mediconnect-dist.tar.gz || true
if command -v zip >/dev/null 2>&1; then
  (cd "$BUILD_OUT" && zip -r "$WORKSPACE/mediconnect-dist.zip" .)
  ART="mediconnect-dist.zip"
else
  (cd "$BUILD_OUT" && tar -czf "$WORKSPACE/mediconnect-dist.tar.gz" .)
  ART="mediconnect-dist.tar.gz"
fi
ls -lh "$WORKSPACE/$ART"

scp -i "$KEYFILE" -o StrictHostKeyChecking=no "$WORKSPACE/$ART" "$SSH_USER@$EC2_HOST:/tmp/$ART"

APP_DIR_SAFE="${APP_DIR}"
ssh -i "$KEYFILE" -o StrictHostKeyChecking=no "$SSH_USER@$EC2_HOST" "APP_DIR=\"$APP_DIR_SAFE\" bash -s" <<'REMOTE'
set -euo pipefail
ART_ZIP="/tmp/mediconnect-dist.zip"
ART_TAR="/tmp/mediconnect-dist.tar.gz"

sudo apt-get update -y >/dev/null 2>&1 || true
sudo apt-get install -y unzip >/dev/null 2>&1 || true

TMPD="$(mktemp -d /tmp/mediconnect.XXXX)"
if [ -f "$ART_ZIP" ]; then
  sudo unzip -q "$ART_ZIP" -d "$TMPD"
else
  sudo tar -xzf "$ART_TAR" -C "$TMPD"
fi

TS="$(date +%s)"
if [ -d "$APP_DIR" ]; then
  sudo mv "$APP_DIR" "${APP_DIR}.bak.$TS"
fi
sudo mkdir -p "$(dirname "$APP_DIR")"
sudo mv "$TMPD" "$APP_DIR"

sudo chown -R www-data:www-data "$APP_DIR"
sudo find "$APP_DIR" -type d -exec chmod 755 {} +
sudo find "$APP_DIR" -type f -exec chmod 644 {} +

sudo systemctl reload nginx || true
sudo rm -f "$ART_ZIP" "$ART_TAR" || true
echo "✅ Deployed static frontend to $APP_DIR"
REMOTE

# Deploy Backend
if [ -f "$WORKSPACE/backend.tgz" ]; then
  echo "📦 Deploying backend..."
  scp -i "$KEYFILE" -o StrictHostKeyChecking=no "$WORKSPACE/backend.tgz" "$SSH_USER@$EC2_HOST:/tmp/backend.tgz"

  BACKEND_DIR="/opt/mediconnect-backend"
  ssh -i "$KEYFILE" -o StrictHostKeyChecking=no "$SSH_USER@$EC2_HOST" "BACKEND_DIR=\"$BACKEND_DIR\" bash -s" <<'REMOTE_BACKEND'
set -euo pipefail
BACKEND_TGZ="/tmp/backend.tgz"

# Create backend directory
sudo mkdir -p "$BACKEND_DIR"
sudo chown ubuntu:ubuntu "$BACKEND_DIR"

# Extract backend
cd "$BACKEND_DIR"
if [ -f "$BACKEND_TGZ" ]; then
  echo "📦 Extracting backend..."
  sudo tar -xzf "$BACKEND_TGZ"
  sudo chown -R ubuntu:ubuntu "$BACKEND_DIR"
else
  echo "❌ Backend tarball not found"
  exit 1
fi

# Fix the getUsers() error if it exists
if [ -f "src/routes/access-control.js" ]; then
  echo "🔧 Fixing access-control.js if needed..."
  sed -i 's/let usersList = getUsers();/let usersList = users;/g' src/routes/access-control.js || true
fi

# Install Node.js if not available (use system-wide installation)
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
  echo "📦 Installing Node.js 22.x..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# Verify Node.js and npm are available
echo "🔍 Node.js version: $(node --version 2>&1)"
echo "🔍 npm version: $(npm --version 2>&1)"

# Install dependencies
echo "📥 Installing backend dependencies..."
npm install --production || npm install

# Install PM2 globally if not installed
if ! command -v pm2 &> /dev/null; then
  echo "📦 Installing PM2..."
  sudo npm install -g pm2
fi

# Stop existing backend if running
pm2 stop mediconnect-backend 2>/dev/null || true
pm2 delete mediconnect-backend 2>/dev/null || true

# Start backend with PM2
echo "🚀 Starting backend..."
cd "$BACKEND_DIR"
pm2 start server.js --name mediconnect-backend
pm2 save

# Setup PM2 startup (run once)
pm2 startup systemd -u ubuntu --hp /home/ubuntu 2>/dev/null || true

# Cleanup
sudo rm -f "$BACKEND_TGZ"

echo "✅ Backend deployed and started at $BACKEND_DIR"
echo "🔍 Backend status:"
pm2 list
REMOTE_BACKEND
else
  echo "⚠️ backend.tgz not found, skipping backend deployment"
fi
'''
        }
      }
    }
  } // stages

  post {
    success {
      echo "✅ ${env.BRANCH_NAME}@${env.GIT_COMMIT_SHORT} deployed to ${env.TARGET_ENV}"
      script {
        try {
          slackSend(
            color: '#2EB67D',
            message:
              "*${env.GIT_COMMIT_SUBJECT}*\n" + // commit subject on top
              "✅ *Build Succeeded* — `${env.JOB_NAME}` #${env.BUILD_NUMBER}\n" +
              (env.TARGET_ENV ? "Env: *${env.TARGET_ENV}*\n" : "") +
              "Branch: *${env.BRANCH_NAME}*\n" +
              "Commit: `${env.GIT_COMMIT_SHORT}`\n" +
              "<${env.BUILD_URL}|View Console Output>"
          )
        } catch (e) { echo "Slack not configured: ${e.message}" }
      }
    }
    failure {
      echo "❌ ${env.BRANCH_NAME}@${env.GIT_COMMIT_SHORT} failed (env=${env.TARGET_ENV})"
      script {
        try {
          slackSend(
            color: '#E01E5A',
            message:
              "*${env.GIT_COMMIT_SUBJECT ?: 'Build failed'}*\n" +
              "❌ *Build Failed* — `${env.JOB_NAME}` #${env.BUILD_NUMBER}\n" +
              (env.TARGET_ENV ? "Env: *${env.TARGET_ENV}*\n" : "") +
              "Branch: *${env.BRANCH_NAME}*\n" +
              "Commit: `${env.GIT_COMMIT_SHORT}`\n" +
              "<${env.BUILD_URL}console|View Console Output>"
          )
        } catch (e) { echo "Slack not configured: ${e.message}" }
      }
    }
    always {
      archiveArtifacts allowEmptyArchive: true, artifacts: "build_out.env,backend.tgz,**/dist/**"
      echo "Build URL: ${env.BUILD_URL}"
    }
  }
}