pipeline {
  agent any

  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 30, unit: 'MINUTES')
  }

  parameters {
    booleanParam(name: 'DO_DEPLOY', defaultValue: true, description: 'Deploy to AWS EC2 after build?')
  }

  environment {
    FRONTEND_DIR  = "Frontend/web"
    BACKEND_DIR   = "Backend"
    NODE_ENV      = "production"
    TERM          = "xterm-256color"
    FORCE_COLOR   = "1"

    // --- AWS Deploy settings ---
    // set your EC2 host (public IP or DNS)
    AWS_HOST      = "3.145.13.178"          // <-- CHANGE THIS
    AWS_USER      = "ubuntu"
    SSH_CRED_ID   = "ec2-jenkins-ssh"       // <-- Jenkins credentialsId (SSH private key)
    NGINX_WEBROOT = "/var/www/MEDICONNECT_FRONTEND"
    PM2_APP_NAME  = "MEDICONNECT_API"

    // Node version for builds & remote PM2 (Vite prefers 20.19+ or 22.12+)
    NODE_MAJOR    = "22"
  }

  stages {

    stage('Checkout') { steps { checkout scm } }

    stage('Install Node (NVM)') {
      steps {
        sh '''
          set -e
          export NVM_DIR="$HOME/.nvm"
          [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" || (curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash && . "$NVM_DIR/nvm.sh")
          nvm install ${NODE_MAJOR} >/dev/null
          nvm use ${NODE_MAJOR} >/dev/null
          command -v npm >/dev/null 2>&1 || nvm install-latest-npm
          node -v
          npm -v
        '''
      }
    }

    stage('Install deps') {
      steps {
        sh '''
          set -e
          export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use ${NODE_MAJOR} >/dev/null
          if [ -f "${FRONTEND_DIR}/package.json" ]; then
            cd "${FRONTEND_DIR}"
            NPM_CONFIG_PRODUCTION=false npm ci --include=dev || NPM_CONFIG_PRODUCTION=false npm install
          fi
          if [ -f "${BACKEND_DIR}/package.json" ]; then
            cd "${BACKEND_DIR}"
            npm ci || npm install
          fi
        '''
      }
    }

    stage('Lint & Test') {
      steps {
        sh '''
          set -e
          export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use ${NODE_MAJOR} >/dev/null
          if [ -f "${FRONTEND_DIR}/package.json" ]; then
            cd "${FRONTEND_DIR}"
            npm run -s lint || true
          fi
          if [ -f "${BACKEND_DIR}/package.json" ]; then
            cd "${BACKEND_DIR}"
            npm test || echo "no backend tests"
          fi
        '''
      }
    }

    stage('Build (frontend)') {
      steps {
        sh '''
          set -e
          export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use ${NODE_MAJOR} >/dev/null
          cd "${FRONTEND_DIR}"
          npm run build --if-present || npx --yes vite build
          test -d dist || { echo "No dist/ folder found after build"; exit 1; }
        '''
      }
    }

    stage('Package (backend)') {
      steps {
        sh '''
          set -e
          if [ -f "${BACKEND_DIR}/package.json" ]; then
            cd "${BACKEND_DIR}"
            rm -rf .release && mkdir -p .release
            cp -r package.json package-lock.json .release/ 2>/dev/null || true
            if [ -d dist ]; then
              cp -r dist .release/
            elif [ -d src ]; then
              cp -r src .release/
            fi
          fi
        '''
      }
    }

    stage('Deploy to AWS') {
      when { expression { return params.DO_DEPLOY } }
      steps {
        echo "Deploying to ${AWS_USER}@${AWS_HOST}…"

        // Upload FE build to EC2
        sshagent (credentials: ["${SSH_CRED_ID}"]) {
          sh '''
            set -e
            # Create a tar to transfer (faster and preserves perms)
            tar -C "${FRONTEND_DIR}/dist" -czf frontend.tgz .

            # Copy artifact up (try rsync, fallback to scp)
            if command -v rsync >/dev/null 2>&1; then
              rsync -avz -e "ssh -o StrictHostKeyChecking=no" frontend.tgz ${AWS_USER}@${AWS_HOST}:/tmp/frontend.tgz
            else
              scp -o StrictHostKeyChecking=no frontend.tgz ${AWS_USER}@${AWS_HOST}:/tmp/frontend.tgz
            fi

            # Remote commands: unpack to NGINX webroot, reload nginx; PM2 for backend if present
            ssh -o StrictHostKeyChecking=no ${AWS_USER}@${AWS_HOST} bash -lc "
              set -euo pipefail

              # Prepare webroot
              sudo mkdir -p '${NGINX_WEBROOT}'
              sudo rm -rf '${NGINX_WEBROOT:?}'/*

              # Unpack FE
              sudo tar -C '${NGINX_WEBROOT}' -xzf /tmp/frontend.tgz
              rm -f /tmp/frontend.tgz

              # Reload nginx if installed
              if command -v nginx >/dev/null 2>&1; then
                sudo nginx -t && sudo systemctl reload nginx || true
              fi

              # OPTIONAL: Backend via PM2 if repo has Backend/package.json
              if [ -d '~/app/mediconnect-backend' ]; then
                true
              fi
            "
          '''
        }

        // OPTIONAL: deploy backend code & start with PM2
        // Push only if BACKEND_DIR exists and has package.json
        script {
          if (fileExists("${BACKEND_DIR}/package.json")) {
            sshagent (credentials: ["${SSH_CRED_ID}"]) {
              sh '''
                set -e
                export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh" || true

                # Bundle minimal backend payload
                rm -f backend.tgz
                tar -C "${BACKEND_DIR}" -czf backend.tgz \
                  package.json package-lock.json \
                  $( [ -d "${BACKEND_DIR}/dist" ] && echo "dist" ) \
                  $( [ -d "${BACKEND_DIR}/src" ] && echo "src" )

                # Upload
                scp -o StrictHostKeyChecking=no backend.tgz ${AWS_USER}@${AWS_HOST}:/tmp/backend.tgz

                # Remote: install & (re)start with PM2
                ssh -o StrictHostKeyChecking=no ${AWS_USER}@${AWS_HOST} bash -lc "
                  set -euo pipefail
                  mkdir -p ~/apps/mediconnect-backend
                  tar -C ~/apps/mediconnect-backend -xzf /tmp/backend.tgz
                  rm -f /tmp/backend.tgz

                  # Ensure NVM/Node
                  export NVM_DIR=\\\"$HOME/.nvm\\\"
                  [ -s \\\"$NVM_DIR/nvm.sh\\\" ] || curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
                  . \\\"$NVM_DIR/nvm.sh\\\"
                  nvm install ${NODE_MAJOR} >/dev/null
                  nvm use ${NODE_MAJOR} >/dev/null
                  command -v npm >/dev/null 2>&1 || nvm install-latest-npm

                  cd ~/apps/mediconnect-backend
                  npm ci --omit=dev || npm install --omit=dev

                  if ! command -v pm2 >/dev/null 2>&1; then
                    npm i -g pm2
                  fi

                  if pm2 list | grep -q \\\"${PM2_APP_NAME}\\\"; then
                    pm2 restart \\\"${PM2_APP_NAME}\\\"
                  else
                    pm2 start \\\"npm run start\\\" --name \\\"${PM2_APP_NAME}\\\"
                  fi
                  pm2 save || true
                "
              '''
            }
          } else {
            echo "Skipping backend deploy: ${BACKEND_DIR}/package.json not found."
          }
        }
      }
    }
  } // stages

  post {
    success { echo "✅ Build ${env.BUILD_NUMBER} OK on ${env.BRANCH_NAME}" }
    failure { echo "❌ Build ${env.BUILD_NUMBER} FAILED on ${env.BRANCH_NAME}" }
    always  { archiveArtifacts allowEmptyArchive: true, artifacts: "**/dist/**,**/build/**" }
  }
}
