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

# Frontend
if [ -f "$FRONTEND_DIR/package.json" ]; then
  pushd "$FRONTEND_DIR" >/dev/null
  npm run lint --if-present
  npm test --if-present
  popd >/dev/null
fi

# Backend
if [ -f "$BACKEND_DIR/package.json" ]; then
  pushd "$BACKEND_DIR" >/dev/null
  npm run lint --if-present
  npm test --if-present
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

# compress dist to a single artifact
rm -f mediconnect-dist.zip mediconnect-dist.tar.gz || true
if command -v zip >/dev/null 2>&1; then
  (cd "$BUILD_OUT" && zip -r "$WORKSPACE/mediconnect-dist.zip" .)
  ART="mediconnect-dist.zip"
else
  (cd "$BUILD_OUT" && tar -czf "$WORKSPACE/mediconnect-dist.tar.gz" .)
  ART="mediconnect-dist.tar.gz"
fi
ls -lh "$WORKSPACE/$ART"

# upload
scp -i "$KEYFILE" -o StrictHostKeyChecking=no "$WORKSPACE/$ART" ${SSH_USER}@${EC2_HOST}:/tmp/$ART

# remote deploy (atomic swap) + nginx reload
ssh -i "$KEYFILE" -o StrictHostKeyChecking=no ${SSH_USER}@${EC2_HOST} 'bash -lc "
  set -e
  sudo apt-get update -y >/dev/null 2>&1 || true
  sudo apt-get install -y unzip >/dev/null 2>&1 || true

  sudo rm -rf '${APP_DIR}.new'
  sudo mkdir -p '${APP_DIR}.new'
  sudo chown -R appuser:appuser '${APP_DIR}.new'

  sudo -u appuser bash -lc \"
    cd '${APP_DIR}.new'
    if [ -f /tmp/mediconnect-dist.zip ]; then
      unzip -q /tmp/mediconnect-dist.zip
    else
      tar -xzf /tmp/mediconnect-dist.tar.gz
    fi
  \"

  if [ -d '${APP_DIR}' ]; then
    sudo mv '${APP_DIR}' '${APP_DIR}.bak.'$(date +%s)
  fi
  sudo mv '${APP_DIR}.new' '${APP_DIR}'

  sudo systemctl reload nginx || true
  rm -f /tmp/mediconnect-dist.zip /tmp/mediconnect-dist.tar.gz || true
  echo '✅ Deployed static frontend to ${APP_DIR}'
"'
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
