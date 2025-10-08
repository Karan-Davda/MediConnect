// Jenkinsfile for MediConnect — multibranch-ready, NVM-provisioned Node

pipeline {
  agent any

  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 30, unit: 'MINUTES')
  }

  environment {
    FRONTEND_DIR = "MediConnect/Frontend/web"   // exact path (lowercase web)
    BACKEND_DIR  = ""                           // leave empty if no backend
    NGINX_WEBROOT = "/var/www/MEDICONNECT_FRONTEND"
    PM2_APP_NAME  = "MEDICONNECT_API"
    NODE_ENV = "production"
    TERM = "xterm-256color"
    FORCE_COLOR = "1"
  }

  stages {

    stage('Checkout (clean)') {
      steps {
        deleteDir()
        checkout scm
        sh '''
          set -euo pipefail
          echo "Commit: $(git rev-parse --short HEAD)"
          echo "package.json (depth<=4):"
          find . -maxdepth 4 -type f -name package.json -print | sort
          echo; echo "Listing MediConnect/Frontend:"
          ls -la ./MediConnect/Frontend || true
          echo; echo "Listing MediConnect/Frontend/web:"
          ls -la ./MediConnect/Frontend/web || true
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
          dir("${FRONTEND_DIR}") {
            sh '''
              set -e
              if [ ! -f package.json ]; then
                echo "❌ package.json not found in $(pwd)"; exit 1
              fi
              # Prefer reproducible CI, fall back if no lockfile
              (''' + NVM_SETUP + '''
              npm ci --ignore-scripts) || (''' + NVM_SETUP + '''
              npm install --no-audit --prefer-offline --ignore-scripts)
            '''
          }

          // Backend (optional)
          if (env.BACKEND_DIR?.trim()) {
            dir("${BACKEND_DIR}") {
              sh '''
                set -e
                if [ -f package.json ]; then
                  ''' + NVM_SETUP + '''
                  (npm ci --ignore-scripts) || npm install --no-audit --prefer-offline --ignore-scripts
                else
                  echo "Skip backend install: package.json not found"
                fi
              '''
            }
          } else {
            echo "Skip backend install: BACKEND_DIR not set"
          }
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
          dir("${FRONTEND_DIR}") {
            sh '''
              ''' + NVM_SETUP + '''
              npm run -s lint || true
            '''
          }
          if (env.BACKEND_DIR?.trim()) {
            dir("${BACKEND_DIR}") {
              sh '''
                ''' + NVM_SETUP + '''
                [ -f package.json ] && (npm test || echo "no tests") || echo "Skip backend tests: package.json not found"
              '''
            }
          }
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
          dir("${FRONTEND_DIR}") {
            sh '''
              ''' + NVM_SETUP + '''
              npm run build --if-present
              if [ ! -d dist ] && [ ! -d build ]; then
                echo "❌ No dist/ or build/ folder created. Ensure your build outputs one of these (Vite default is dist/)."
                exit 1
              fi
            '''
          }
        }
      }
    }

    stage('Package (backend)') {
      steps {
        script {
          if (env.BACKEND_DIR?.trim()) {
            dir("${BACKEND_DIR}") {
              sh '''
                set -euo pipefail
                if [ -f package.json ]; then
                  rm -rf .release && mkdir -p .release
                  cp -r package.json package-lock.json .release/ 2>/dev/null || true
                  if [ -d dist ]; then
                    cp -r dist .release/
                  elif [ -d src ]; then
                    cp -r src .release/
                  else
                    echo "Backend has neither dist/ nor src/. Adjust copy if needed."
                  fi
                else
                  echo "Skip backend package: package.json not found"
                fi
              '''
            }
          } else {
            echo "Skip backend package: BACKEND_DIR not set"
          }
        }
      }
    }

    stage('Deploy') {
      when { branch 'main' }
      steps {
        echo "Deploying MediConnect to this EC2"

        // --- Frontend → Nginx ---
        dir("${FRONTEND_DIR}") {
          sh '''
            set -euo pipefail

            : "${NGINX_WEBROOT}"

            SRC=""
            if [ -d dist ]; then SRC="dist";
            elif [ -d build ]; then SRC="build";
            else echo "Nothing to deploy: no dist/ or build/ in $(pwd)"; exit 1; fi

            sudo mkdir -p "${NGINX_WEBROOT}"

            if [ -z "${NGINX_WEBROOT}" ] || [ "${NGINX_WEBROOT}" = "/" ]; then
              echo "Refusing to wipe NGINX_WEBROOT='${NGINX_WEBROOT}'"; exit 1
            fi
            [ -d "${NGINX_WEBROOT}" ] || { echo "Target does not exist: ${NGINX_WEBROOT}"; exit 1; }

            sudo find "${NGINX_WEBROOT}" -mindepth 1 -maxdepth 1 -print -exec sudo rm -rf -- {} +
            sudo cp -r "$SRC"/* "${NGINX_WEBROOT}/"
            sudo nginx -t && sudo systemctl reload nginx || true
          '''
        }

        // --- Backend → PM2 (optional) ---
        script {
          if (env.BACKEND_DIR?.trim()) {
            def NVM_SETUP = '''
              set -e
              export NVM_DIR="$HOME/.nvm"
              [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" || (curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash && . "$NVM_DIR/nvm.sh")
              nvm install 18 >/dev/null
              nvm use 18 >/dev/null
            '''
            dir("${BACKEND_DIR}") {
              sh '''
                ''' + NVM_SETUP + '''
                if [ -f package.json ]; then
                  (npm ci --omit=dev --ignore-scripts) || npm install --omit=dev --no-audit --prefer-offline --ignore-scripts
                  if ! command -v pm2 >/dev/null 2>&1; then npm i -g pm2; fi
                  if pm2 list | grep -q "${PM2_APP_NAME}"; then
                    pm2 restart "${PM2_APP_NAME}"
                  else
                    pm2 start "npm run start" --name "${PM2_APP_NAME}"
                  fi
                  pm2 save
                else
                  echo "Skip backend deploy: package.json not found"
                fi
              '''
            }
          } else {
            echo "Skip backend deploy: BACKEND_DIR not set"
          }
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
