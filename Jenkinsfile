// Jenkinsfile — MediConnect (multibranch)
// Uses NVM (Node 18) per-shell so node/npm are always available.

pipeline {
  agent any

  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 30, unit: 'MINUTES')
  }

  environment {
    // Repo layout (case-sensitive)
    FRONTEND_DIR = "MediConnect/Frontend/web"
    BACKEND_DIR  = ""                                   // set if/when you add a backend
    // Deploy targets (adjust for your server)
    NGINX_WEBROOT = "/var/www/MEDICONNECT_FRONTEND"
    PM2_APP_NAME  = "MEDICONNECT_API"
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
          echo "Workspace package.json files (depth 4):"
          find . -maxdepth 4 -type f -name package.json -print | sed "s#^./##"
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
              if [ -f package-lock.json ]; then npm ci; else npm install; fi
            else
              echo "⚠️  Skip frontend install: ${FRONTEND_DIR}/package.json not found"
              exit 1
            fi
          """

          // Backend (optional)
          sh """
            ${NVM_SETUP}
            if [ -n "${BACKEND_DIR}" ] && [ -f "${BACKEND_DIR}/package.json" ]; then
              cd "${BACKEND_DIR}"
              if [ -f package-lock.json ]; then npm ci; else npm install; fi
            else
              echo "ℹ️  Skip backend install: no BACKEND_DIR or package.json"
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

          // Frontend lint (non-fatal)
          sh """
            ${NVM_SETUP}
            cd "${FRONTEND_DIR}"
            npm run -s lint || true
          """

          // Backend tests (non-fatal & optional)
          sh """
            ${NVM_SETUP}
            if [ -n "${BACKEND_DIR}" ] && [ -f "${BACKEND_DIR}/package.json" ]; then
              cd "${BACKEND_DIR}"
              npm test || echo "no tests"
            else
              echo "ℹ️  Skip backend tests: no BACKEND_DIR or package.json"
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
            cd "${FRONTEND_DIR}"
            npm run build
            if [ ! -d dist ] && [ ! -d build ]; then
              echo "❌ No dist/ or build/ folder created by frontend build."
              exit 1
            fi
          """
        }
      }
    }

    stage('Package (backend)') {
      when {
        expression { return env.BACKEND_DIR?.trim() && fileExists("${env.BACKEND_DIR}/package.json") }
      }
      steps {
        sh '''
          set -euo pipefail
          cd "${BACKEND_DIR}"
          rm -rf .release && mkdir -p .release
          cp -r package.json package-lock.json .release/ 2>/dev/null || true
          if [ -d dist ]; then
            cp -r dist .release/
          elif [ -d src ]; then
            cp -r src .release/
          else
            echo "ℹ️  Backend has neither dist/ nor src/. Adjust as needed."
          fi
        '''
      }
    }

    stage('Deploy') {
      when { branch 'main' }
      steps {
        echo "Deploying MediConnect to this EC2"

        // --- Frontend → Nginx ---
        sh """
          set -euo pipefail

          : "\${NGINX_WEBROOT}"
          : "\${FRONTEND_DIR}"

          SRC=""
          if [ -d "${FRONTEND_DIR}/dist" ]; then
            SRC="${FRONTEND_DIR}/dist"
          elif [ -d "${FRONTEND_DIR}/build" ]; then
            SRC="${FRONTEND_DIR}/build"
          else
            echo "❌ Nothing to deploy: no dist/ or build/ under ${FRONTEND_DIR}"
            exit 1
          fi

          sudo mkdir -p "${NGINX_WEBROOT}"

          # Safety guard
          if [ -z "${NGINX_WEBROOT}" ] || [ "${NGINX_WEBROOT}" = "/" ]; then
            echo "Refusing to wipe NGINX_WEBROOT='${NGINX_WEBROOT}'"; exit 1
          fi

          # Wipe previous contents and copy new static assets
          sudo find "${NGINX_WEBROOT}" -mindepth 1 -maxdepth 1 -print -exec sudo rm -rf -- {} +
          sudo cp -r "$SRC"/* "${NGINX_WEBROOT}/"

          # Reload nginx if config is valid
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
            if [ -n "${BACKEND_DIR}" ] && [ -f "${BACKEND_DIR}/package.json" ]; then
              cd "${BACKEND_DIR}"
              if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

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
              echo "ℹ️  Skip backend deploy: no BACKEND_DIR or package.json"
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
      // Archive whichever folder Vite/React produced
      archiveArtifacts allowEmptyArchive: true, artifacts: "${FRONTEND_DIR}/dist/**,${FRONTEND_DIR}/build/**"
    }
  }
}
