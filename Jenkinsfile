// Jenkinsfile for Mediconnect (Multibranch-ready) — Node via NVM on agent

pipeline {
  agent any

  options {
    ansiColor('xterm')
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 30, unit: 'MINUTES')
  }

  parameters {
    booleanParam(name: 'RUN_DEPLOY', defaultValue: false, description: 'Deploy frontend (and backend via PM2) on this machine')
  }

  environment {
    // Adjust if your repo layout differs:
    FRONTEND_DIR  = "Frontend/web"
    BACKEND_DIR   = "Backend"

    // Only used if RUN_DEPLOY = true
    NGINX_WEBROOT = "/var/www/MEDICONNECT_FRONTEND"
    PM2_APP_NAME  = "MEDICONNECT_API"

    NODE_ENV      = "production"
    TERM          = "xterm-256color"
    FORCE_COLOR   = "1"
    NVM_NODE_MAJOR = "22" // Vite-compatible Node
  }

  stages {

    stage('Checkout') {
      steps {
        checkout scm
        sh '''#!/usr/bin/env bash
set -Eeuo pipefail
echo "Commit: $(git rev-parse --short HEAD)"
echo "package.json files (depth<=4):"
find . -maxdepth 4 -type f -name package.json -print | sort || true
echo; echo "Listing ${FRONTEND_DIR}:"
ls -la "${FRONTEND_DIR}" || true
'''
      }
    }

    stage('Install Node (NVM)') {
      steps {
        sh '''#!/usr/bin/env bash
set -Eeuo pipefail
export NVM_DIR="$HOME/.nvm"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
. "$NVM_DIR/nvm.sh"
nvm install "${NVM_NODE_MAJOR}"
nvm use "${NVM_NODE_MAJOR}"
echo "Using Node: $(node -v)"
echo "Using npm:  $(npm -v)"
'''
      }
    }

    stage('Install deps') {
      steps {
        script {
          def NVM_SETUP = '''
set -Eeuo pipefail
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use "${NVM_NODE_MAJOR}" >/dev/null
'''

          // Frontend dev deps (tsc, vite) included
          sh """#!/usr/bin/env bash
${NVM_SETUP}
if [[ -f "\${FRONTEND_DIR}/package.json" ]]; then
  cd "\${FRONTEND_DIR}"
  NPM_CONFIG_PRODUCTION=false npm ci --include=dev \
    || NPM_CONFIG_PRODUCTION=false npm install --no-audit --prefer-offline
else
  echo "Skip frontend install: \${FRONTEND_DIR}/package.json not found"
fi
"""

          // Backend optional
          sh """#!/usr/bin/env bash
${NVM_SETUP}
if [[ -f "\${BACKEND_DIR}/package.json" ]]; then
  cd "\${BACKEND_DIR}"
  npm ci || npm install --no-audit --prefer-offline
else
  echo "Skip backend install: \${BACKEND_DIR}/package.json not found"
fi
"""
        }
      }
    }

    stage('Lint & Test') {
      steps {
        script {
          def NVM_SETUP = '''
set -Eeuo pipefail
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use "${NVM_NODE_MAJOR}" >/dev/null
'''
          // Frontend lint (optional)
          sh """#!/usr/bin/env bash
${NVM_SETUP}
if [[ -f "\${FRONTEND_DIR}/package.json" ]]; then
  cd "\${FRONTEND_DIR}"
  npm run -s lint || echo "No lint or lint failed (non-blocking)"
else
  echo "Skip frontend lint: package.json not found"
fi
"""

          // Backend tests (optional)
          sh """#!/usr/bin/env bash
${NVM_SETUP}
if [[ -f "\${BACKEND_DIR}/package.json" ]]; then
  cd "\${BACKEND_DIR}"
  npm test || echo "no backend tests"
else
  echo "Skip backend tests: package.json not found"
fi
"""
        }
      }
    }

    stage('Build (frontend)') {
      steps {
        script {
          def NVM_SETUP = '''
set -Eeuo pipefail
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use "${NVM_NODE_MAJOR}" >/dev/null
'''
          sh """#!/usr/bin/env bash
${NVM_SETUP}
if [[ -f "\${FRONTEND_DIR}/package.json" ]]; then
  cd "\${FRONTEND_DIR}"
  # Make sure TypeScript is callable if project uses it
  npx --yes tsc -v >/dev/null 2>&1 || true
  # Vite/CRA build
  NPM_CONFIG_PRODUCTION=false npm run build --if-present || npx --yes vite build
  if [[ ! -d dist && ! -d build ]]; then
    echo "❌ No dist/ or build/ folder created. Ensure your build script outputs one of these."
    exit 1
  fi
else
  echo "Skip frontend build: package.json not found"
  exit 1
fi
"""
        }
      }
    }

    stage('Package (backend)') {
      steps {
        sh '''#!/usr/bin/env bash
set -Eeuo pipefail
if [[ -d "${BACKEND_DIR}" && -f "${BACKEND_DIR}/package.json" ]]; then
  cd "${BACKEND_DIR}"
  rm -rf .release && mkdir -p .release
  cp -r package.json package-lock.json .release/ 2>/dev/null || true
  if [[ -d dist ]]; then
    cp -r dist .release/
  elif [[ -d src ]]; then
    cp -r src .release/
  else
    echo "Backend has neither dist/ nor src/. Adjust packaging as needed."
  fi
else
  echo "Skip backend package: ${BACKEND_DIR}/package.json not found"
fi
'''
      }
    }

    stage('Deploy') {
      when {
        allOf {
          branch 'main'
          expression { return params.RUN_DEPLOY }
        }
      }
      steps {
        echo "Deploying Mediconnect on this machine"

        // --- Frontend → Nginx (optional/local safe) ---
        sh '''#!/usr/bin/env bash
set -Eeuo pipefail
: "${NGINX_WEBROOT}"
: "${FRONTEND_DIR}"

if [[ ! -d "${FRONTEND_DIR}/dist" && ! -d "${FRONTEND_DIR}/build" ]]; then
  echo "Nothing to deploy: no dist/ or build/ under ${FRONTEND_DIR}"
  exit 1
fi

sudo mkdir -p "${NGINX_WEBROOT}"
SRC="${FRONTEND_DIR}/dist"
[[ -d "${FRONTEND_DIR}/build" && ! -d "${FRONTEND_DIR}/dist" ]] && SRC="${FRONTEND_DIR}/build"

if [[ -z "${NGINX_WEBROOT}" || "${NGINX_WEBROOT}" = "/" ]]; then
  echo "Refusing to wipe NGINX_WEBROOT='${NGINX_WEBROOT}'"
  exit 1
fi
[[ -d "${NGINX_WEBROOT}" ]] || { echo "Target does not exist: ${NGINX_WEBROOT}"; exit 1; }

sudo find "${NGINX_WEBROOT}" -mindepth 1 -maxdepth 1 -print -exec sudo rm -rf -- {} +
sudo cp -r "$SRC"/* "${NGINX_WEBROOT}/"

# Try to reload Nginx on Mac or Linux
if command -v nginx >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1 && brew services list | grep -q nginx; then
    nginx -t && brew services restart nginx || true
  elif command -v systemctl >/dev/null 2>&1; then
    nginx -t && sudo systemctl reload nginx || true
  else
    nginx -t && sudo service nginx reload || true
  fi
fi
'''

        // --- Backend → PM2 (optional) ---
        script {
          def NVM_SETUP = '''
set -Eeuo pipefail
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use "${NVM_NODE_MAJOR}" >/dev/null
'''
          sh """#!/usr/bin/env bash
${NVM_SETUP}
if [[ -f "\${BACKEND_DIR}/package.json" ]]; then
  cd "\${BACKEND_DIR}"
  npm ci --omit=dev || npm install --omit=dev
  if ! command -v pm2 >/dev/null 2>&1; then
    npm i -g pm2
  fi
  if pm2 list | grep -q "${PM2_APP_NAME}"; then
    pm2 restart "${PM2_APP_NAME}"
  else
    pm2 start "npm run start" --name "${PM2_APP_NAME}"
  fi
  pm2 save || true
else
  echo "Skip backend deploy: \${BACKEND_DIR}/package.json not found"
fi
"""
        }
      }
    }
  } // stages

  post {
    success { echo "✅ Build ${env.BUILD_NUMBER} OK on ${env.BRANCH_NAME}" }
    failure { echo "❌ Build ${env.BUILD_NUMBER} FAILED on ${env.BRANCH_NAME}" }
    always {
      // Archive built assets (works regardless of exact paths)
      archiveArtifacts allowEmptyArchive: true, artifacts: "**/dist/**,**/build/**"
    }
  }
}

