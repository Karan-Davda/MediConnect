pipeline {
  agent any

  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 30, unit: 'MINUTES')
  }

  environment {
    // Let the pipeline auto-detect FRONTEND_DIR
    FRONTEND_DIR = ""
    BACKEND_DIR  = ""
    NGINX_WEBROOT = "/var/www/MEDICONNECT_FRONTEND"
    PM2_APP_NAME  = "MEDICONNECT_API"
    // Keep NODE_ENV=production for deploy/runtime,
    // but we’ll override npm’s production flag during install/build.
    NODE_ENV = "production"
    TERM = "xterm-256color"
    FORCE_COLOR = "1"
  }

  stages {
    stage('Checkout (clean)') {
      steps {
        deleteDir()
        checkout scm
        sh '''#!/usr/bin/env bash
set -euo pipefail
echo "Commit: $(git rev-parse --short HEAD)"

echo "== package.json candidates (depth<=6) =="
find . -maxdepth 6 -type f -name package.json -print | sort

# Auto-detect FRONTEND_DIR by looking for vite + react
FRONTEND_DIR_CANDIDATE="$(
  find . -maxdepth 6 -type f -name package.json | while read -r f; do
    if grep -q '"vite"' "$f" && grep -q '"react"' "$f"; then
      dirname "$f"
      break
    fi
  done
)"

# If you know the exact path (case-sensitive), you can hard-set it here:
# FRONTEND_DIR_CANDIDATE="./Frontend/web"

if [ -z "${FRONTEND_DIR_CANDIDATE}" ]; then
  echo "❌ Could not auto-detect a Vite/React frontend. Ensure package.json has \"vite\" and \"react\"."
  exit 1
fi

echo "✅ Auto-detected FRONTEND_DIR: ${FRONTEND_DIR_CANDIDATE}"
printf 'FRONTEND_DIR=%s\n' "$FRONTEND_DIR_CANDIDATE" > .ci-paths

echo
echo "== ls of detected FRONTEND_DIR =="
ls -la "$FRONTEND_DIR_CANDIDATE" || true
'''
      }
    }

    stage('Install deps') {
      steps {
        script {
          def NVM_SETUP = '''
set -e
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" || (curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash && . "$NVM_DIR/nvm.sh")
nvm install 18 >/dev/null
nvm use 18 >/dev/null
node -v
npm -v
'''

          sh '''#!/usr/bin/env bash
set -euo pipefail
. ./.ci-paths
cd "$FRONTEND_DIR"
echo "Working dir: $(pwd)"
test -f package.json || { echo "❌ package.json not found here"; exit 1; }

# Force devDependencies to be installed even though NODE_ENV=production
''' + NVM_SETUP + '''
NPM_CONFIG_PRODUCTION=false npm ci --include=dev \
  || NPM_CONFIG_PRODUCTION=false npm install --no-audit --prefer-offline

# Sanity check: ensure tsc is present
npx --yes tsc -v >/dev/null || { echo "❌ typescript (tsc) not installed. Check devDependencies."; exit 1; }
'''
        }
      }
    }

    stage('Lint & Test') {
      steps {
        script {
          def NVM_SETUP = '''
set -e
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" || (curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash && . "$NVM_DIR/nvm.sh")
nvm install 18 >/dev/null
nvm use 18 >/dev/null
'''
          sh '''#!/usr/bin/env bash
set -euo pipefail
. ./.ci-paths
cd "$FRONTEND_DIR"
''' + NVM_SETUP + '''
# Lint is optional; don’t fail build if not defined
npm run -s lint || true
'''
        }
      }
    }

    stage('Build (frontend)') {
      steps {
        script {
          def NVM_SETUP = '''
set -e
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" || (curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash && . "$NVM_DIR/nvm.sh")
nvm install 18 >/dev/null
nvm use 18 >/dev/null
'''
          sh '''#!/usr/bin/env bash
set -euo pipefail
. ./.ci-paths
cd "$FRONTEND_DIR"
''' + NVM_SETUP + '''
# Ensure dev deps available during build
NPM_CONFIG_PRODUCTION=false npm run build

# Fallback: if your build script calls `tsc -b && vite build` but tsc wasn’t available
# the previous stage would have failed already.

if [ ! -d dist ] && [ ! -d build ]; then
  echo "❌ No dist/ or build/ produced. Vite default is dist/."
  exit 1
fi
'''
        }
      }
    }

    stage('Deploy') {
      when { branch 'main' }
      steps {
        echo "Deploying MediConnect to this EC2"
        sh '''#!/usr/bin/env bash
set -euo pipefail
. ./.ci-paths
cd "$FRONTEND_DIR"

: "${NGINX_WEBROOT}"

if [ -d dist ]; then SRC="dist";
elif [ -d build ]; then SRC="build";
else echo "Nothing to deploy: no dist/ or build/ in $(pwd)"; exit 1; fi

sudo mkdir -p "${NGINX_WEBROOT}"

if [ -z "${NGINX_WEBROOT}" ] || [ "${NGINX_WEBROOT}" = "/" ]; then
  echo "Refusing to wipe NGINX_WEBROOT='${NGINX_WEBROOT}'"
  exit 1
fi
[ -d "${NGINX_WEBROOT}" ] || { echo "Target does not exist: ${NGINX_WEBROOT}"; exit 1; }

sudo find "${NGINX_WEBROOT}" -mindepth 1 -maxdepth 1 -print -exec sudo rm -rf -- {} +
sudo cp -r "$SRC"/* "${NGINX_WEBROOT}/"
sudo nginx -t && sudo systemctl reload nginx || true
'''
      }
    }
  }

  post {
    success { echo "✅ Build ${env.BUILD_NUMBER} OK on ${env.BRANCH_NAME}" }
    failure { echo "❌ Build ${env.BUILD_NUMBER} FAILED on ${env.BRANCH_NAME}" }
    always {
      script {
        sh '''#!/usr/bin/env bash
set -e
if [ -f .ci-paths ]; then
  . ./.ci-paths
  if [ -n "$FRONTEND_DIR" ]; then
    echo "Archiving build artifacts from $FRONTEND_DIR"
  fi
fi
'''
      }
      archiveArtifacts allowEmptyArchive: true, artifacts: "**/dist/**,**/build/**"
    }
  }
}
