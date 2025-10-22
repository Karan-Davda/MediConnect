pipeline {
  agent any

  // If you have a NodeJS tool configured in Jenkins (Manage Jenkins → Global Tool Configuration),
  // set its name here. Otherwise comment 'tools' and it will still work using system node.
  tools { nodejs 'NodeJS-22' }

  environment {
    // ---- Servers ----
    DEV_SERVER  = '3.22.13.29'     // Development
    QA_SERVER   = '3.145.13.178'   // QA
    PROD_SERVER = '3.22.13.29'     // Production (same as current single box ok)

    // ---- Jenkins Credentials (SSH private keys) ----
    DEV_SSH_CRED  = 'ec2-jenkins-ssh'
    QA_SSH_CRED   = 'ec2-jenkins-ssh'
    PROD_SSH_CRED = 'ec2-jenkins-ssh'

    // ---- App layout ----
    FRONTEND_DIR  = 'Frontend/web'
    BACKEND_DIR   = 'Backend'
    NGINX_WEBROOT = '/var/www/MEDICONNECT_FRONTEND'
    PM2_APP_NAME  = 'MEDICONNECT_API'

    // ---- Remote user & runtime ----
    REMOTE_USER = 'ubuntu'
    NODE_MAJOR  = '22'
  }

  stages {

    // ---------------------- CHECKOUT ----------------------
    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.GIT_COMMIT_SHORT = sh(
            script: "git rev-parse --short HEAD",
            returnStdout: true
          ).trim()
        }
      }
    }

    // ---------------------- INSTALL DEPS ----------------------
    stage('Install Dependencies') {
      steps {
        sh """
          set -e
          if [ -f '${FRONTEND_DIR}/package.json' ]; then
            cd '${FRONTEND_DIR}'
            NPM_CONFIG_PRODUCTION=false npm ci --include=dev || NPM_CONFIG_PRODUCTION=false npm install
          fi

          if [ -f '${BACKEND_DIR}/package.json' ]; then
            cd '${BACKEND_DIR}'
            npm ci || npm install
          fi
        """
      }
    }

    // ---------------------- BUILD FRONTEND ----------------------
    stage('Build Frontend') {
      steps {
        sh """
          set -e
          cd '${FRONTEND_DIR}'
          npm run build --if-present || npx --yes vite build
          test -d dist || { echo 'No dist/ folder found after build'; exit 1; }
        """
      }
    }

    // ---------------------- PACKAGE BACKEND ----------------------
    stage('Package Backend') {
      steps {
        sh """
          set -e
          if [ -f '${BACKEND_DIR}/package.json' ]; then
            cd '${BACKEND_DIR}'
            rm -f ../backend.tgz
            # include package files and either dist/ or src/
            tar -czf ../backend.tgz \\
              package.json package-lock.json \\
              \$( [ -d dist ] && echo 'dist' ) \\
              \$( [ -d src ]  && echo 'src' )
          else
            echo 'No backend/package.json — skipping backend package'
          fi
        """
      }
    }

    // ---------------------- DEPLOY TO DEV ----------------------
    stage('Deploy to Development') {
      when { branch 'staging' }
      steps {
        script {
          deployToEnvironment('dev', env.DEV_SERVER, env.DEV_SSH_CRED)
        }
      }
    }

    // ---------------------- DEPLOY TO QA ----------------------
    stage('Deploy to QA') {
      when { branch 'QA' }
      steps {
        script {
          deployToEnvironment('qa', env.QA_SERVER, env.QA_SSH_CRED)
        }
      }
    }

    // ---------------------- PROD APPROVAL ----------------------
    stage('Production Approval') {
      when { branch 'main' }
      steps {
        input message: "Deploy ${env.GIT_COMMIT_SHORT} to Production?", ok: 'Deploy'
      }
    }

    // ---------------------- DEPLOY TO PROD ----------------------
    stage('Deploy to Production') {
      when { branch 'main' }
      steps {
        script {
          deployToEnvironment('prod', env.PROD_SERVER, env.PROD_SSH_CRED)
        }
      }
    }
  }

  // ---------------------- POST ACTIONS ----------------------
  post {
    success { echo "✅ ${env.BRANCH_NAME}@${env.GIT_COMMIT_SHORT} deployed OK" }
    failure { echo "❌ ${env.BRANCH_NAME}@${env.GIT_COMMIT_SHORT} failed" }
    always  { archiveArtifacts allowEmptyArchive: true, artifacts: "**/dist/**,backend.tgz" }
  }
}

// ---------------------- HELPER FUNCTION ----------------------
def deployToEnvironment(String envName, String server, String credId) {
  sshagent([credId]) {
    sh """
      set -e

      # ---- Prep artifacts ----
      rm -f frontend.tgz || true
      tar -C '${env.FRONTEND_DIR}/dist' -czf frontend.tgz .

      # ---- SSH setup ----
      mkdir -p "\$HOME/.ssh"
      touch "\$HOME/.ssh/known_hosts"
      SSH_OPTS="-o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=\$HOME/.ssh/known_hosts"

      echo "==> Uploading frontend to ${server}"
      rsync -avz -e "ssh \$SSH_OPTS" frontend.tgz ${env.REMOTE_USER}@${server}:/tmp/frontend.tgz

      if [ -f 'backend.tgz' ]; then
        echo "==> Uploading backend to ${server}"
        rsync -avz -e "ssh \$SSH_OPTS" backend.tgz ${env.REMOTE_USER}@${server}:/tmp/backend.tgz
      fi

      echo "==> Applying on remote ${server}"
      ssh \$SSH_OPTS ${env.REMOTE_USER}@${server} "bash -lc '
        set -e

        # --- Frontend ---
        sudo mkdir -p \"${env.NGINX_WEBROOT}\"
        sudo rm -rf \"${env.NGINX_WEBROOT}\"/*
        sudo tar -C \"${env.NGINX_WEBROOT}\" -xzf /tmp/frontend.tgz
        rm -f /tmp/frontend.tgz

        if command -v nginx >/dev/null 2>&1; then
          sudo nginx -t && sudo systemctl reload nginx || true
        fi

        # --- Backend (optional) ---
        if [ -f /tmp/backend.tgz ]; then
          mkdir -p \$HOME/apps/mediconnect-backend
          tar -C \$HOME/apps/mediconnect-backend -xzf /tmp/backend.tgz
          rm -f /tmp/backend.tgz

          # Ensure Node + npm via NVM for runtime
          export NVM_DIR=\"\$HOME/.nvm\"
          [ -s \"\$NVM_DIR/nvm.sh\" ] || curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
          . \"\$NVM_DIR/nvm.sh\"
          nvm install ${env.NODE_MAJOR} >/dev/null
          nvm use ${env.NODE_MAJOR} >/dev/null
          command -v npm >/dev/null 2>&1 || nvm install-latest-npm

          cd \$HOME/apps/mediconnect-backend
          npm ci --omit=dev || npm install --omit=dev

          # PM2 ensure + (re)start
          command -v pm2 >/dev/null 2>&1 || npm i -g pm2
          if pm2 list | grep -q \"${env.PM2_APP_NAME}\"; then
            pm2 restart \"${env.PM2_APP_NAME}\"
          else
            pm2 start npm --name \"${env.PM2_APP_NAME}\" -- run start
          fi
          pm2 save || true
        fi

        echo \"Remote deploy finished: ${envName}\"
      '"

      echo "==> Cleaning local artifacts"
      rm -f frontend.tgz || true
      # backend.tgz kept for archiving
    """
  }
}
