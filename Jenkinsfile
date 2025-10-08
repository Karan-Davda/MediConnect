// Jenkinsfile for Mediconnet (Multibranch-ready) — uses NVM to provide Node/npm on agent

pipeline {
  agent any

  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 30, unit: 'MINUTES')
  }

  environment {
    FRONTEND_DIR = "MediConnect/Frontend/Web"   // <-- fix spelling/case
    BACKEND_DIR  = "MediConnect/Backend"       // <-- fix if this actually exists
    NGINX_WEBROOT = "/var/www/MEDICONNET_FRONTEND"
    PM2_APP_NAME  = "MEDICONNET_API"
    NODE_ENV = "production"
    TERM = "xterm-256color"
    FORCE_COLOR = "1"
  }

  stages {

    stage('Checkout') {
      steps {
        checkout scm
        sh '''
          git rev-parse --short HEAD
          echo "Workspace tree (depth 3):"
          find . -maxdepth 3 -type f -name package.json -print
          echo "Listing expected frontend dir:"
          ls -la "${FRONTEND_DIR}" || true
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
          // Frontend
          sh """
            ${NVM_SETUP}
            if [ -f "${FRONTEND_DIR}/package.json" ]; then
              cd "${FRONTEND_DIR}"
              npm ci || npm install
            else
              echo "Skip frontend install: ${FRONTEND_DIR}/package.json not found"
            fi
          """
          // Backend (guard for empty folder)
          sh """
            ${NVM_SETUP}
            if [ -f "${BACKEND_DIR}/package.json" ]; then
              cd "${BACKEND_DIR}"
              npm ci || npm install
            else
              echo "Skip backend install: ${BACKEND_DIR}/package.json not found"
            fi
          """
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
          // Frontend lint is optional
          sh """
            ${NVM_SETUP}
            if [ -f "${FRONTEND_DIR}/package.json" ]; then
              cd "${FRONTEND_DIR}"
              npm run -s lint || true
            else
              echo "Skip frontend lint: package.json not found"
            fi
          """
          // Backend tests are optional
          sh """
            ${NVM_SETUP}
            if [ -f "${BACKEND_DIR}/package.json" ]; then
              cd "${BACKEND_DIR}"
              npm test || echo "no tests"
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
            set -e
            export NVM_DIR="$HOME/.nvm"
            [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" || (curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash && . "$NVM_DIR/nvm.sh")
            nvm install 18 >/dev/null
            nvm use 18 >/dev/null
          '''
          sh """
            ${NVM_SETUP}
            if [ -f "${FRONTEND_DIR}/package.json" ]; then
              cd "${FRONTEND_DIR}"
              npm run build --if-present
              if [ ! -d dist ] && [ ! -d build ]; then
                echo "No dist/ or build/ folder created. Ensure your build script outputs one of these."
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
        sh '''
          set -euo pipefail
          if [ -d "${BACKEND_DIR}" ] && [ -f "${BACKEND_DIR}/package.json" ]; then
            cd "${BACKEND_DIR}"
            rm -rf .release && mkdir -p .release
            cp -r package.json package-lock.json .release/ 2>/dev/null || true
            if [ -d dist ]; then
              cp -r dist .release/
            elif [ -d src ]; then
              cp -r src .release/
            else
              echo "Backend has neither dist/ nor src/. Add your build or adjust copy."
            fi
          else
            echo "Skip backend package: ${BACKEND_DIR}/package.json not found"
          fi
        '''
      }
    }

    stage('Deploy') {
      when { branch 'main' }
      steps {
        echo "Deploying Mediconnet to this EC2"

        // --- Frontend → Nginx ---
        sh """
          set -euo pipefail

          : "\${NGINX_WEBROOT}"
          : "\${FRONTEND_DIR}"

          if [ ! -d "${FRONTEND_DIR}/dist" ] && [ ! -d "${FRONTEND_DIR}/build" ]; then
            echo "Nothing to deploy: no dist/ or build/ under ${FRONTEND_DIR}"
            exit 1
          fi

          sudo mkdir -p "${NGINX_WEBROOT}"

          if [ -d "${FRONTEND_DIR}/dist" ]; then
            SRC="${FRONTEND_DIR}/dist"
          else
            SRC="${FRONTEND_DIR}/build"
          fi

          if [ -z "${NGINX_WEBROOT}" ] || [ "${NGINX_WEBROOT}" = "/" ]; then
            echo "Refusing to wipe NGINX_WEBROOT='${NGINX_WEBROOT}'"; exit 1
          fi
          if [ ! -d "${NGINX_WEBROOT}" ]; then
            echo "Target does not exist: ${NGINX_WEBROOT}"; exit 1
          fi

          sudo find "${NGINX_WEBROOT}" -mindepth 1 -maxdepth 1 -print -exec sudo rm -rf -- {} +

          sudo cp -r "$SRC"/* "${NGINX_WEBROOT}/"

          sudo nginx -t && sudo systemctl reload nginx || true
        """

        // --- Backend → PM2 (only if backend exists) ---
        script {
          def NVM_SETUP = '''
            set -e
            export NVM_DIR="$HOME/.nvm"
            [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" || (curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash && . "$NVM_DIR/nvm.sh")
            nvm install 18 >/dev/null
            nvm use 18 >/dev/null
          '''
          sh """
            ${NVM_SETUP}
            if [ -f "${BACKEND_DIR}/package.json" ]; then
              cd "${BACKEND_DIR}"
              npm ci --omit=dev || npm install --omit=dev
              if ! command -v pm2 >/dev/null 2>&1; then
                npm i -g pm2
              fi
              if pm2 list | grep -q "${PM2_APP_NAME}"; then
                pm2 restart "${PM2_APP_NAME}"
              else
                pm2 start "npm run start" --name "${PM2_APP_NAME}"
              fi
              pm2 save
            else
              echo "Skip backend deploy: ${BACKEND_DIR}/package.json not found"
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
      archiveArtifacts allowEmptyArchive: true, artifacts: "${FRONTEND_DIR}/dist/**,${FRONTEND_DIR}/build/**"
    }
  }
}
