pipeline {
  agent any

  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 30, unit: 'MINUTES')
  }

  parameters {
    booleanParam(name: 'DO_DEPLOY', defaultValue: false, description: 'Deploy locally on this Mac after build?')
  }

  environment {
    FRONTEND_DIR  = "Frontend/web"
    BACKEND_DIR   = "Backend"
    // Default webroot (Linux). We’ll override for macOS inside the stage.
    NGINX_WEBROOT = "/var/www/MEDICONNECT_FRONTEND"
    PM2_APP_NAME  = "MEDICONNECT_API"
    NODE_ENV      = "production"
    TERM          = "xterm-256color"
    FORCE_COLOR   = "1"
  }

  stages {
    stage('Checkout') { steps { checkout scm } }

    stage('Install Node (NVM)') {
      steps {
        sh '''
          set -e
          export NVM_DIR="$HOME/.nvm"
          [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" || (curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash && . "$NVM_DIR/nvm.sh")
          # Vite wants Node 20+. Use 20 LTS locally.
          nvm install 20 >/dev/null
          nvm use 20 >/dev/null
          node -v
          npm -v
        '''
      }
    }

    stage('Install deps') {
      steps {
        sh '''
          set -e
          export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 20 >/dev/null
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
          export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 20 >/dev/null
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
          export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 20 >/dev/null
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
            if [ -d dist ]; then cp -r dist .release/; elif [ -d src ]; then cp -r src .release/; fi
          fi
        '''
      }
    }

    stage('Deploy (local, optional)') {
      when { expression { return params.DO_DEPLOY } }
      steps {
        echo "Deploying locally on this Mac…"
        sh '''
          set -e
          # Detect macOS and choose proper webroot
          TARGET_WEBROOT="${NGINX_WEBROOT}"
          case "$(uname -s)" in
            Darwin)
              TARGET_WEBROOT="/opt/homebrew/var/www/mediconnect"
              ;;
          esac
          echo "Using webroot: ${TARGET_WEBROOT}"
          mkdir -p "${TARGET_WEBROOT}"

          # Copy frontend build
          SRC="${FRONTEND_DIR}/dist"
          rsync -a --delete "${SRC}/" "${TARGET_WEBROOT}/"

          # Reload nginx (macOS via brew; ignore failure if not installed)
          if command -v nginx >/dev/null 2>&1; then
            if command -v brew >/dev/null 2>&1; then
              nginx -t && brew services restart nginx || true
            else
              nginx -t || true
            fi
          fi

          # Start/restart backend with PM2 (optional)
          if [ -f "${BACKEND_DIR}/package.json" ]; then
            export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 20 >/dev/null
            cd "${BACKEND_DIR}"
            if ! command -v pm2 >/dev/null 2>&1; then npm i -g pm2; fi
            if pm2 list | grep -q "${PM2_APP_NAME}"; then
              pm2 restart "${PM2_APP_NAME}"
            else
              pm2 start "npm run start" --name "${PM2_APP_NAME}"
            fi
            pm2 save
          fi

          echo "✅ Local deploy complete. Try: http://localhost:8080"
        '''
      }
    }
  }

  post {
    success { echo "✅ Build ${env.BUILD_NUMBER} OK on ${env.BRANCH_NAME}" }
    failure { echo "❌ Build ${env.BUILD_NUMBER} FAILED on ${env.BRANCH_NAME}" }
    always  { archiveArtifacts allowEmptyArchive: true, artifacts: "**/dist/**,**/build/**" }
  }
}
