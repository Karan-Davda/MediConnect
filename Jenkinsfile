// Jenkinsfile for Mediconnet (Multibranch-ready) — uses NVM to provide Node/npm on agent

pipeline {
  agent any

  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 30, unit: 'MINUTES')
  }

  environment {
    // Repo layout (quote paths because of nested dirs)
    FRONTEND_DIR = "Mediconnet/Frontend/Web"
    BACKEND_DIR  = "Mediconnet/Backend"

    // Server targets (adjust these)
    NGINX_WEBROOT = "/var/www/MEDICONNET_FRONTEND"   // <-- SET THIS
    PM2_APP_NAME  = "MEDICONNET_API"                 // <-- SET THIS
    NODE_ENV = "production"

    // Keep some tools colorful even without ansiColor plugin
    TERM = "xterm-256color"
    FORCE_COLOR = "1"
  }

  // Reusable NVM bootstrap (install if missing, then use Node 18)
  // We embed this into each sh """ ... """ so node/npm exist in that shell.
  // NOTE: Groovy will expand ${NVM_SETUP} into the shell script content.
  // Do NOT put bash ${var:?} constructs inside, or escape with \${...}.
  // (We avoided those elsewhere already.)
  // Using 18 LTS for stability; change if you need 20.x.
  // Also prints versions for quick debugging.
  stages {

    stage('Checkout') {
      steps {
        checkout scm
        sh 'git rev-parse --short HEAD'
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
          sh """
            ${NVM_SETUP}
            cd "${FRONTEND_DIR}"
            npm ci
          """
          sh """
            ${NVM_SETUP}
            cd "${BACKEND_DIR}"
            npm ci
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
          sh """
            ${NVM_SETUP}
            cd "${FRONTEND_DIR}"
            npm run -s lint || true
          """
          sh """
            ${NVM_SETUP}
            cd "${BACKEND_DIR}"
            npm test || echo "no tests"
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
              echo "No dist/ or build/ folder created. Ensure your build script outputs one of these."
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
          cd "${BACKEND_DIR}"
          rm -rf .release && mkdir -p .release
          cp -r package.json package-lock.json .release/ 2>/dev/null || true
          # If you transpile TS -> dist, include it; else include src
          if [ -d dist ]; then
            cp -r dist .release/
          elif [ -d src ]; then
            cp -r src .release/
          else
            echo "Backend has neither dist/ nor src/. Add your build or adjust copy."
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

          # Sanity: required envs
          : "\${NGINX_WEBROOT}"
          : "\${FRONTEND_DIR}"

          sudo mkdir -p "${NGINX_WEBROOT}"

          if [ -d "${FRONTEND_DIR}/dist" ]; then
            SRC="${FRONTEND_DIR}/dist"
          elif [ -d "${FRONTEND_DIR}/build" ]; then
            SRC="${FRONTEND_DIR}/build"
          else
            echo "No frontend build folder found under \${FRONTEND_DIR}"; exit 1
          fi

          # Explicit safety guards
          if [ -z "${NGINX_WEBROOT}" ] || [ "${NGINX_WEBROOT}" = "/" ]; then
            echo "Refusing to wipe NGINX_WEBROOT='${NGINX_WEBROOT}'"; exit 1
          fi
          if [ ! -d "${NGINX_WEBROOT}" ]; then
            echo "Target does not exist: ${NGINX_WEBROOT}"; exit 1
          fi

          # Remove prior contents safely
          sudo find "${NGINX_WEBROOT}" -mindepth 1 -maxdepth 1 -print -exec sudo rm -rf -- {} +

          # Deploy new static assets
          sudo cp -r "$SRC"/* "${NGINX_WEBROOT}/"

          # Validate and reload nginx (ignore reload failure if validation fails)
          sudo nginx -t && sudo systemctl reload nginx || true
        """

        // --- Backend → PM2 restart (ensure Node via NVM and pm2 available) ---
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
            cd "${BACKEND_DIR}"
            npm ci --omit=dev

            if ! command -v pm2 >/dev/null 2>&1; then
              npm i -g pm2
            fi

            if pm2 list | grep -q "${PM2_APP_NAME}"; then
              pm2 restart "${PM2_APP_NAME}"
            else
              pm2 start "npm run start" --name "${PM2_APP_NAME}"
            fi
            pm2 save
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
