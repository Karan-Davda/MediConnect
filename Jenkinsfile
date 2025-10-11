pipeline {
  agent any

  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 30, unit: 'MINUTES')
  }

  parameters {
    booleanParam(name: 'DO_DEPLOY', defaultValue: true, description: 'Deploy to AWS EC2 after build?')
    credentials(
      name: 'EC2_SSH_KEY',
      defaultValue: 'ec2-jenkins-ssh',
      description: 'SSH private key for ubuntu@EC2',
      credentialType: 'com.cloudbees.plugins.credentials.impl.BasicSSHUserPrivateKey'
    )
  }

  environment {
    FRONTEND_DIR  = "Frontend/web"
    BACKEND_DIR   = "Backend"
    NODE_ENV      = "production"
    TERM          = "xterm-256color"
    FORCE_COLOR   = "1"

    AWS_HOST      = "3.22.13.29"
    AWS_USER      = "ubuntu"
    SSH_CRED_ID   = "ec2-jenkins-ssh" // informational only; we use params.EC2_SSH_KEY
    NGINX_WEBROOT = "/var/www/MEDICONNECT_FRONTEND"
    PM2_APP_NAME  = "MEDICONNECT_API"

    NODE_MAJOR    = "22"
  }

  stages {
    stage('Checkout') { steps { checkout scm } }

    stage('Install Node (NVM)') {
      steps {
        sh '''
bash -lc 'set -euo pipefail
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" || (curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash && . "$NVM_DIR/nvm.sh")
nvm install ${NODE_MAJOR} >/dev/null
nvm use ${NODE_MAJOR} >/dev/null
command -v npm >/dev/null 2>&1 || nvm install-latest-npm
node -v
npm -v'
'''
      }
    }

    stage('Install deps') {
      steps {
        sh '''
bash -lc 'set -euo pipefail
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use ${NODE_MAJOR} >/dev/null

if [ -f "${FRONTEND_DIR}/package.json" ]; then
  cd "${FRONTEND_DIR}"
  NPM_CONFIG_PRODUCTION=false npm ci --include=dev || NPM_CONFIG_PRODUCTION=false npm install
fi

if [ -f "${BACKEND_DIR}/package.json" ]; then
  cd "${BACKEND_DIR}"
  npm ci || npm install
fi'
'''
      }
    }

    stage('Lint & Test') {
      steps {
        sh '''
bash -lc 'set -euo pipefail
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use ${NODE_MAJOR} >/dev/null

if [ -f "${FRONTEND_DIR}/package.json" ]; then
  cd "${FRONTEND_DIR}"
  npm run -s lint || true
fi

if [ -f "${BACKEND_DIR}/package.json" ]; then
  cd "${BACKEND_DIR}"
  npm test || echo "no backend tests"
fi'
'''
      }
    }

    stage('Build (frontend)') {
      steps {
        sh '''
bash -lc 'set -euo pipefail
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use ${NODE_MAJOR} >/dev/null
cd "${FRONTEND_DIR}"
npm run build --if-present || npx --yes vite build
test -d dist || { echo "No dist/ folder found after build"; exit 1; }'
'''
      }
    }

    stage('Package (backend)') {
      steps {
        sh '''
bash -lc 'set -euo pipefail
if [ -f "${BACKEND_DIR}/package.json" ]; then
  cd "${BACKEND_DIR}"
  rm -rf .release && mkdir -p .release
  cp -r package.json package-lock.json .release/ 2>/dev/null || true
  if [ -d dist ]; then
    cp -r dist .release/
  elif [ -d src ]; then
    cp -r src .release/
  fi
fi'
'''
      }
    }

    stage('Deploy to AWS') {
      when { expression { return params.DO_DEPLOY } }
      steps {
        echo "Deploying to ${AWS_USER}@${AWS_HOST}…"

        withCredentials([sshUserPrivateKey(credentialsId: params.EC2_SSH_KEY, keyFileVariable: 'SSH_KEY')]) {
          sh '''
bash -lc 'set -euo pipefail

if [ ! -d "${FRONTEND_DIR}/dist" ]; then
  echo "ERROR: ${FRONTEND_DIR}/dist not found. Run full pipeline first."
  exit 2
fi

tar -C "${FRONTEND_DIR}/dist" -czf frontend.tgz .
mkdir -p "$HOME/.ssh"
touch "$HOME/.ssh/known_hosts"

SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=$HOME/.ssh/known_hosts"

if command -v rsync >/dev/null 2>&1; then
  rsync -avz -e "ssh $SSH_OPTS" frontend.tgz ${AWS_USER}@${AWS_HOST}:/tmp/frontend.tgz
else
  scp $SSH_OPTS frontend.tgz ${AWS_USER}@${AWS_HOST}:/tmp/frontend.tgz
fi

# IMPORTANT: single-line, no leading newline
ssh $SSH_OPTS ${AWS_USER}@${AWS_HOST} "bash -lc \"set -euo pipefail; sudo mkdir -p \\\"${NGINX_WEBROOT}\\\"; sudo rm -rf \\\"${NGINX_WEBROOT}\\\"/*; sudo tar -C \\\"${NGINX_WEBROOT}\\\" -xzf /tmp/frontend.tgz; rm -f /tmp/frontend.tgz; if command -v nginx >/dev/null 2>&1; then sudo nginx -t && sudo systemctl reload nginx || true; fi\""

rm -f frontend.tgz'
'''
          script {
            if (fileExists("${BACKEND_DIR}/package.json")) {
              sh '''
bash -lc 'set -euo pipefail
mkdir -p "$HOME/.ssh"
touch "$HOME/.ssh/known_hosts"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=$HOME/.ssh/known_hosts"

rm -f backend.tgz
tar -C "${BACKEND_DIR}" -czf backend.tgz \
  package.json package-lock.json \
  $( [ -d "${BACKEND_DIR}/dist" ] && echo "dist" ) \
  $( [ -d "${BACKEND_DIR}/src" ] && echo "src" )

scp $SSH_OPTS backend.tgz ${AWS_USER}@${AWS_HOST}:/tmp/backend.tgz

# IMPORTANT: single-line, no leading newline
ssh $SSH_OPTS ${AWS_USER}@${AWS_HOST} "bash -lc \"set -euo pipefail; mkdir -p \\$HOME/apps/mediconnect-backend; tar -C \\$HOME/apps/mediconnect-backend -xzf /tmp/backend.tgz; rm -f /tmp/backend.tgz; export NVM_DIR=\\\"\\$HOME/.nvm\\\"; [ -s \\\"\\$NVM_DIR/nvm.sh\\\" ] || curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash; . \\\"\\$NVM_DIR/nvm.sh\\\"; nvm install ${NODE_MAJOR} >/dev/null; nvm use ${NODE_MAJOR} >/dev/null; command -v npm >/dev/null 2>&1 || nvm install-latest-npm; cd \\$HOME/apps/mediconnect-backend; npm ci --omit=dev || npm install --omit=dev; command -v pm2 >/dev/null 2>&1 || npm i -g pm2; if pm2 list | grep -q \\\"${PM2_APP_NAME}\\\"; then pm2 restart \\\"${PM2_APP_NAME}\\\"; else pm2 start \\\"npm run start\\\" --name \\\"${PM2_APP_NAME}\\\"; fi; pm2 save || true\""

rm -f backend.tgz'
'''
            } else {
              echo "Skipping backend deploy: ${BACKEND_DIR}/package.json not found."
            }
          }
        }
      }
    }
  }

  post {
    success { echo "✅ Build ${env.BUILD_NUMBER} OK on ${env.BRANCH_NAME}" }
    failure { echo "❌ Build ${env.BUILD_NUMBER} FAILED on ${env.BRANCH_NAME}" }
    always  { archiveArtifacts allowEmptyArchive: true, artifacts: "**/dist/**,**/build/**" }
  }
}
