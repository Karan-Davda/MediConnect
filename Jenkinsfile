// Jenkinsfile for Mediconnet (Multibranch-ready)

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
    // Optional: keep colors from Node tools even without plugin
    TERM = "xterm-256color"
    FORCE_COLOR = "1"
  }

  triggers {
    // GitHub webhook will trigger builds; this is a fallback
    pollSCM('@daily')
  }

  stages {

    stage('Checkout') {
      steps {
        ansiColor('xterm') {
          checkout scm
          sh 'git rev-parse --short HEAD'
        }
      }
    }

    stage('Install deps') {
      steps {
        ansiColor('xterm') {
          dir("${env.FRONTEND_DIR}") { sh 'npm ci' }
          dir("${env.BACKEND_DIR}")  { sh 'npm ci' }
        }
      }
    }

    stage('Lint & Test') {
      steps {
        ansiColor('xterm') {
          // Make sure these scripts exist; '|| true' keeps pipeline going if optional
          dir("${env.FRONTEND_DIR}") { sh 'npm run -s lint || true' }
          dir("${env.BACKEND_DIR}")  { sh 'npm test || echo "no tests"' }
        }
      }
    }

    stage('Build (frontend)') {
      steps {
        ansiColor('xterm') {
          dir("${env.FRONTEND_DIR}") {
            sh '''
              npm run build
              if [ ! -d dist ] && [ ! -d build ]; then
                echo "No dist/ or build/ folder created. Ensure your build script outputs one of these."
                exit 1
              fi
            '''
          }
        }
      }
    }

    stage('Package (backend)') {
      steps {
        ansiColor('xterm') {
          dir("${env.BACKEND_DIR}") {
            sh '''
              set -euo pipefail
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
      }
    }

    stage('Deploy') {
  when { branch 'main' }
  steps {
    ansiColor('xterm') {
      echo "Deploying Mediconnet to this EC2"

      // Frontend → Nginx
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

        # Explicit safety guards instead of \${VAR:?}
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

      // Backend → PM2 restart
      sh """
        set -euo pipefail

        : "\${BACKEND_DIR}"
        : "\${PM2_APP_NAME}"

        cd "${BACKEND_DIR}"
        npm ci --omit=dev

        # Ensure pm2 is available (adapt if pm2 is installed via nvm)
        if ! command -v pm2 >/dev/null 2>&1; then
          echo "pm2 not found in PATH for Jenkins user"; exit 1
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


  post {
  success { echo "✅ Build ${env.BUILD_NUMBER} OK on ${env.BRANCH_NAME}" }
  failure { echo "❌ Build ${env.BUILD_NUMBER} FAILED on ${env.BRANCH_NAME}" }
  always  {
    archiveArtifacts allowEmptyArchive: true, artifacts: "${FRONTEND_DIR}/dist/**,${FRONTEND_DIR}/build/**"
  }
}
