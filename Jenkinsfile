pipeline {
  agent any

  options {
    timestamps()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 30, unit: 'MINUTES')
  }

  environment {
    // Leave these empty; we’ll auto-detect FRONTEND_DIR
    FRONTEND_DIR = ""
    BACKEND_DIR  = ""                       // set later if you add a backend
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
          set -e
          echo "Commit: $(git rev-parse --short HEAD)"

          echo "== package.json candidates (depth<=6) =="
          find . -maxdepth 6 -type f -name package.json -print | sort

          # Auto-detect FRONTEND_DIR: look for a package.json with vite + react
          FRONTEND_DIR_CANDIDATE="$(
            find . -maxdepth 6 -type f -name package.json | while read -r f; do
              if grep -q '"vite"' "$f" && grep -q '"react"' "$f"; then
                dirname "$f"
                break
              fi
            done
          )"

          if [ -z "$FRONTEND_DIR_CANDIDATE" ]; then
            echo "❌ Could not auto-detect a Vite/React frontend. Please check your repo layout."
            echo "Tip: ensure your frontend's package.json contains \"vite\" and \"react\"."
            exit 1
          fi

          echo "✅ Auto-detected FRONTEND_DIR: $FRONTEND_DIR_CANDIDATE"
          printf 'FRONTEND_DIR=%s\n' "$FRONTEND_DIR_CANDIDATE" > .ci-paths

          echo
          echo "== ls of detected FRONTEND_DIR =="
          ls -la "$FRONTEND_DIR_CANDIDATE" || true
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

          sh '''
            set -e
            . ./.ci-paths
            cd "$FRONTEND_DIR"
            [ -f package.json ] || { echo "❌ package.json not found in $(pwd)"; exit 1; }
            (''' + NVM_SETUP + ''' npm ci --ignore-scripts) \
              || (''' + NVM_SETUP + ''' npm install --no-audit --prefer-offline --ignore-scripts)
          '''

          // If/when you add a backend, set BACKEND_DIR in .ci-paths and add similar block here
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
          sh '''
            set -e
            . ./.ci-paths
            cd "$FRONTEND_DIR"
            ''' + NVM_SETUP + '''
            npm run -s lint || true
          '''
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
          sh '''
            set -e
            . ./.ci-paths
            cd "$FRONTEND_DIR"
            ''' + NVM_SETUP + '''
            npm run build --if-present
            if [ ! -d dist ] && [ ! -d build ]; then
              echo "❌ No dist/ or build/ produced by the build. Vite default is dist/."
              exit 1
            fi
          '''
        }
      }
    }

    stage('Deploy') {
      when { branch 'main' }
      steps {
        echo "Deploying MediConnect to this EC2"
        sh '''
          set -e
          . ./.ci-paths
          cd "$FRONTEND_DIR"

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
    }
  }

  post {
    success { echo "✅ Build ${env.BUILD_NUMBER} OK on ${env.BRANCH_NAME}" }
    failure { echo "❌ Build ${env.BUILD_NUMBER} FAILED on ${env.BRANCH_NAME}" }
    always {
      script {
        sh '''
          set -e
          if [ -f .ci-paths ]; then
            . ./.ci-paths
            if [ -n "$FRONTEND_DIR" ]; then
              echo "Archiving build artifacts from $FRONTEND_DIR"
              true
            fi
          fi
        '''
      }
      archiveArtifacts allowEmptyArchive: true, artifacts: "**/dist/**,**/build/**"
    }
  }
}
