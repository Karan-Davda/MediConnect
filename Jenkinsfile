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
    // --- repo layout ---
    FRONTEND_DIR  = 'Frontend/web'
    BACKEND_DIR   = 'Backend'

    // --- SSH user for all EC2 boxes ---
    SSH_USER      = 'ubuntu'

    // --- Node runtime on agent ---
    NODE_MAJOR    = '22'
    // Will set: GIT_COMMIT_SHORT, TARGET_ENV, EC2_HOST, EC2_CRED, APP_DIR
  }

  stages {

    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.GIT_COMMIT_SHORT = sh(script: "git rev-parse --short HEAD", returnStdout: true).trim()
          echo "Commit: ${env.GIT_COMMIT_SHORT}"
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

    // ---------------- Env selection (Dev/QA) ----------------
    stage('Select Environment') {
      steps {
        script {
          // EDIT these QA values to your real QA host + credential + webroot
          def CFG = [
            DEV: [ branch: 'main',
                   host:   'ec2-3-22-13-29.us-east-2.compute.amazonaws.com',
                   cred:   'aws-deploy-key',
                   webroot:'/var/www/mediconnect' ],
            QA : [ branch: 'QA',
                   host:   'ec2-3-144-150-239.us-east-2.compute.amazonaws.com', // TODO change to QA host
                   cred:   'aws-qa-key',                                      // TODO create Jenkins SSH cred
                   webroot:'/var/www/mediconnect-qa' ]                        // TODO QA nginx root
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

    // ---------------- Deploy (runs for Dev or QA) ----------------
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
scp -i "$KEYFILE" -o StrictHostKeyChecking=no "$WORKSPACE/$ART" "$SSH_USER@$EC2_HOST:/tmp/$ART"

# Pass APP_DIR into remote environment and run remote deploy
APP_DIR_SAFE="${APP_DIR}"
ssh -i "$KEYFILE" -o StrictHostKeyChecking=no "$SSH_USER@$EC2_HOST" "APP_DIR=\"$APP_DIR_SAFE\" bash -s" <<'REMOTE'
set -euo pipefail

ART_ZIP="/tmp/mediconnect-dist.zip"
ART_TAR="/tmp/mediconnect-dist.tar.gz"

# Install tools we may need
sudo apt-get update -y >/dev/null 2>&1 || true
sudo apt-get install -y unzip >/dev/null 2>&1 || true

# Extract into a temp directory
TMPD="$(mktemp -d /tmp/mediconnect.XXXX)"
if [ -f "$ART_ZIP" ]; then
  sudo unzip -q "$ART_ZIP" -d "$TMPD"
else
  sudo tar -xzf "$ART_TAR" -C "$TMPD"
fi

# Atomic swap
TS="$(date +%s)"
if [ -d "$APP_DIR" ]; then
  sudo mv "$APP_DIR" "${APP_DIR}.bak.$TS"
fi
sudo mkdir -p "$(dirname "$APP_DIR")"
sudo mv "$TMPD" "$APP_DIR"

# Permissions for nginx
sudo chown -R www-data:www-data "$APP_DIR"
sudo find "$APP_DIR" -type d -exec chmod 755 {} +
sudo find "$APP_DIR" -type f -exec chmod 644 {} +

# Reload nginx and clean up
sudo systemctl reload nginx || true
sudo rm -f "$ART_ZIP" "$ART_TAR" || true

echo "✅ Deployed static frontend to $APP_DIR"
REMOTE
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
            message: "✅ *Build Succeeded* — `${env.JOB_NAME}` #${env.BUILD_NUMBER}\nEnv: *${env.TARGET_ENV}*\nBranch: *${env.BRANCH_NAME}*\nCommit: `${env.GIT_COMMIT_SHORT}`\n<${env.BUILD_URL}|View Console Output>"
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
            message: "❌ *Build Failed* — `${env.JOB_NAME}` #${env.BUILD_NUMBER}\nEnv: *${env.TARGET_ENV ?: 'N/A'}*\nBranch: *${env.BRANCH_NAME}*\nCommit: `${env.GIT_COMMIT_SHORT}`\n<${env.BUILD_URL}console|View Console Output>"
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
