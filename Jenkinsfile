// Jenkinsfile for MediConnect — multibranch-friendly, Node via NVM

pipeline {
  agent any

  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 30, unit: 'MINUTES')
  }

  environment {
    // === PATHS (match your repo) ===
    FRONTEND_DIR = "MediConnect/Frontend/web"
    BACKEND_DIR  = ""  // set to folder if/when backend exists, e.g. "MediConnect/Backend"

    // === DEPLOY TARGETS (adjust to your server) ===
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
          set -e
          echo "Commit: $(git rev-parse --short HEAD)"
          echo "package.json files (depth<=3):"
          find . -maxdepth 3 -type f -name package.json -print
          echo "List frontend dir:"
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
            [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" \
              || (curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash && . "$NVM_DIR/nvm.sh")
            nvm install 18 >/dev/null
            nvm use 18 >/dev/null
            node -v
            npm -v
            npm config set fund false
            npm config set audit false
          '''

          // --- Frontend ---
          sh """
            ${NVM_SETUP}
            if [ -f "${FRONTEND_DIR}/package.json" ]; then
              cd "${FRONTEND_DIR}"
              if [ -f package-lock.json ]; then
                echo "Using npm ci (ignore scripts)…"
                npm ci --ignore-scripts --no-audit --no-fund
              else
                echo "No lockfile; using npm install (ignore scripts)…"
                npm install --ignore-scripts --no-audit --no-fund
              fi
            else
              echo "❌ ${FRONTEND_DIR}/package.json not found"; exit 1
            fi
          """

          // --- Backend (optional) ---
          sh """
            ${NVM_SETUP}
            if [ -n "${BACKEND_DIR}" ] && [ -f "${BACKEND_DIR}/package.json" ]; then
              cd "${BACKEND_DIR}"
              if [ -f package-lock.json ]; then
                npm ci --ignore-scripts --no-audit --no-fund
              else
                npm install --ignore-scripts --no-audit --no-fund
              fi
            else
              echo "ℹ️  Skip backend install: no BACKEND_DIR or package.json"
            fi
          """
        }
      }
      post {
        unsuccessful {
          // show npm debug logs to aid triage
          sh 'ls -1 ~/.npm/_logs || true; tail -n +1 ~/.npm/_logs/* 2>/dev/null || true'
        }
      }
    }

    stage('Lint & Test') {
      steps {
        script {
          def NVM_SETUP = '''
            set -e
            export NVM_DIR="$HOME/.nvm"
            [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" \
              || (curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash && . "$NVM_DIR/nvm.sh")
            nvm install 18 >/dev/null
            nvm use 18 >/dev/null
          '''
          // Frontend lint (non-blocking)
          sh """
            ${NVM_SETUP}
            cd "${FRONTEND_DIR}"
            npm run -s lint || true
          """
          // Backend tests (optional, non-blocking)
          sh """
            ${NVM_SETUP}
            if [ -n "${BACKEND_DIR}" ] && [ -f "${BACKEND_DIR}/package.json" ]; then
              cd "${BACKEND_DIR}"
              npm test || echo "no tests"
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
            [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" \
              || (curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash && . "$NVM_DIR/nvm.sh")
            nvm install 18 >/dev/null
            nvm use 18 >/dev/null
          '''
          sh """
            ${NVM_SETUP}
            cd "${FRONTEND_DIR}"
            # run your own build scripts even though dependency scripts were skipped
            npm run build --if-present

            if [ ! -d dist ] && [ ! -d build ]; then
              echo "No dist/ or build/ folder created. Ensure 'npm run build' outputs one of these."
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
          if [ -n "${BACKEND_DIR}" ] && [ -f "${BACKEND_DIR}/package.json" ]; then
            cd "${BACKEND_DIR}"
            rm -rf .release && mkdir -p .release
            cp -r package.json package-lock.json .release/ 2>/dev/null || true
            if [ -d dist ]; then
              cp -r dist .release/
            elif [ -d src ]; then
              cp -r src .release/
            else
              echo "Backend has neither dist/ nor src/. Adjust as needed."
            fi
          else
            echo "Skip backend package."
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

          if [ -d "${FRONTEND_DIR}/dist" ]; then
            SRC="${FRONTEND_DIR}/dist"
          elif [ -d "${FRONTEND_DIR}/build" ]; then
            SRC="${FRONTEND_DIR}/build"
          else
            echo "Nothing to deploy: no dist/ or build/ in ${FRONTEND_DIR}"
            exit 1
          fi

          sudo mkdir -p "${NGINX_WEBROOT}"

          if [ -z "${NGINX_WEBROOT}" ] || [ "${NGINX_WEBROOT}" = "/" ]; then
            echo "Refusing to wipe NGINX_WEBROOT='${NGINX_WEBROOT}'"; exit 1
          fi
          [ -d "${NGINX_WEBROOT}" ] || { echo "Target does not exist: ${NGINX_WEBROOT}"; exit 1; }

          sudo find "${NGINX_WEBROOT}" -mindepth 1 -maxdepth 1 -print -exec sudo rm -rf -- {} +

          sudo cp -r "$SRC"/* "${NGINX_WEBROOT}/"

          sudo nginx -t && sudo systemctl reload nginx || true
        """

        // --- Backend → PM2 (only if defined) ---
        script {
          def NVM_SETUP = '''
            set -e
            export NVM_DIR="$HOME/.nvm"
            [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" \
              || (curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash && . "$NVM_DIR/nvm.sh")
            nvm install 18 >/dev/null
            nvm use 18 >/dev/null
          '''
          sh """
            ${NVM_SETUP}
            if [ -n "${BACKEND_DIR}" ] && [ -f "${BACKEND_DIR}/package.json" ]; then
              cd "${BACKEND_DIR}"
              # install runtime deps only, still ignoring scripts for safety
              if [ -f package-lock.json ]; then
                npm ci --omit=dev --ignore-scripts --no-audit --no-fund
              else
                npm install --omit=dev --ignore-scripts --no-audit --no-fund
              fi
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
              echo "Skip backend deploy."
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
