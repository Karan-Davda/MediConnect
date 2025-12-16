// Jenkinsfile — MediConnect (Multibranch) with NVM + Slack + Deploy to Dev/QA

@Library('mediconnectLib') _

pipeline {
  agent any

  options {
    timestamps()
    ansiColor('xterm')
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 30, unit: 'MINUTES')
  }

  parameters {
    booleanParam(
      name: 'RUN_DEPLOY',
      defaultValue: true,
      description: 'Run deploy step when the branch matches an environment (main→Dev, QA→QA)'
    )
    choice(
      name: 'FORCE_ENV',
      choices: ['AUTO','DEV','QA'],
      description: 'AUTO = derive from branch (main→DEV, QA→QA). Override only if needed.'
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
          env.GIT_COMMIT_SUBJECT = sh(script: 'git log -1 --pretty=%s',     returnStdout: true).trim()
          env.GIT_COMMIT_MSG     = sh(
            script: "git log -1 --pretty=%B | tr -d '\\000-\\031\\177'",
            returnStdout: true
          ).trim()

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

  echo "Installing backend dependencies for packaging..."
  npm ci || npm install

  tar -czf "\$WORKSPACE/backend.tgz" \\
    package.json package-lock.json \\
    server.js \\
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
            DEV: [
              branch: 'main',
              host:   '3.142.45.51',
              cred:   'aws-deploy-key',
              webroot:'/var/www/mediconnect'
            ],
            QA : [
              branch: 'QA',
              host:   '18.218.76.209',
              cred:   'aws-deploy-key',
              webroot:'/var/www/mediconnect-qa'
            ]
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
        script {
          // call shared library global step
          mcDeploy(this)
        }
      }
    }
  } // stages

  post {
    success {
      echo "✅ ${env.BRANCH_NAME}@${env.GIT_COMMIT_SHORT} deployed to ${env.TARGET_ENV}"
      script {
        try {
          mcSlack.notifySuccess(commitSubject: env.GIT_COMMIT_SUBJECT)
        } catch (e) {
          echo "Slack not configured: ${e.message}"
        }
      }
    }
    failure {
      echo "❌ ${env.BRANCH_NAME}@${env.GIT_COMMIT_SHORT} failed (env=${env.TARGET_ENV})"
      script {
        try {
          mcSlack.notifyFailure(commitSubject: env.GIT_COMMIT_SUBJECT)
        } catch (e) {
          echo "Slack not configured: ${e.message}"
        }
      }
    }
    always {
      archiveArtifacts allowEmptyArchive: true, artifacts: "build_out.env,backend.tgz,**/dist/**"
      echo "Build URL: ${env.BUILD_URL}"
    }
  }
}
