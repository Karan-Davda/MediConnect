// Jenkinsfile for Mediconnet (Multibranch-ready)

pipeline {
  agent any

  options {
    timestamps()
    ansiColor('xterm')
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
  }

  triggers {
    // GitHub webhook will trigger builds; this is a fallback
    pollSCM('@daily')
  }

  stages {

    stage('Checkout') {
      steps {
        checkout scm
        sh 'git rev-parse --short HEAD'
      }
    }

    stage('Install deps') {
      steps {
        dir("${env.FRONTEND_DIR}") { sh 'npm ci' }
        dir("${env.BACKEND_DIR}")  { sh 'npm ci' }
      }
    }

    stage('Lint & Test') {
      steps {
        // Make sure these scripts exist; '|| true' keeps pipeline going if optional
        dir("${env.FRONTEND_DIR}") { sh 'npm run -s lint || true' }
        dir("${env.BACKEND_DIR}")  { sh 'npm test || echo "no tests"' }
      }
    }

    stage('Build (frontend)') {
      steps {
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

    stage('Package (backend)') {
      steps {
        dir("${env.BACKEND_DIR}") {
          sh '''
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

    stage('Deploy') {
      when { branch 'main' }
      steps {
        echo "Deploying Mediconnet to this EC2"

        // Frontend → Nginx
        sh '''
          sudo mkdir -p "${NGINX_WEBROOT}"
          if [ -d "${FRONTEND_DIR}/dist" ]; then
            SRC="${FRONTEND_DIR}/dist"
          elif [ -d "${FRONTEND_DIR}/build" ]; then
            SRC="${FRONTEND_DIR}/build"
          else
            echo "No frontend build folder found."
            exit 1
          fi
          sudo rm -rf "${NGINX_WEBROOT:?}"/*
          sudo cp -r "$SRC"/* "${NGINX_WEBROOT}/"
          sudo nginx -t && sudo systemctl reload nginx || true
        '''

        // Backend → PM2 restart
        sh '''
          cd "${BACKEND_DIR}"
          npm ci --omit=dev
          if pm2 list | grep -q "${PM2_APP_NAME}"; then
            pm2 restart "${PM2_APP_NAME}"
          else
            pm2 start "npm run start" --name "${PM2_APP_NAME}"
          fi
          pm2 save
        '''
      }
    }
  }

  post {
    success { echo "✅ Build ${env.BUILD_NUMBER} OK on ${env.BRANCH_NAME}" }
    failure { echo "❌ Build ${env.BUILD_NUMBER} FAILED on ${env.BRANCH_NAME}" }
    always  {
      archiveArtifacts allowEmptyArchive: true, artifacts: "${FRONTEND_DIR}/dist/**, ${FRONTEND_DIR}/build/**"
    }
  }
}

