# Complete Guide: Deploying Applications to Kubernetes

## Overview

This guide covers deploying applications to Kubernetes with **Jenkins running inside the Kubernetes cluster** as a pod. This modern cloud-native approach provides auto-scaling, isolation, and efficient resource usage.

### Tools & Components:
- **Git**: Source code repository (GitHub/GitLab/Bitbucket)
- **Nexus**: Docker image registry (can run in K8s or externally)
- **Jenkins**: CI/CD orchestrator (runs as pod in K8s)
- **kubectl**: Kubernetes cluster management (from tools VM for admin tasks)
- **Docker**: Image building (in Jenkins agent pods)

---

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         Git Repository                          │
│                    (GitHub/GitLab/Bitbucket)                    │
│                                                                 │
│  app/                                                           │
│    ├── Dockerfile                                              │
│    ├── src/                                                     │
│    ├── k8s/                                                     │
│    └── Jenkinsfile  ← Defines the pipeline                     │
└─────────────────────────────────────────────────────────────────┘
                            ↓ (Git webhook trigger)
┌─────────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                           │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Jenkins Master Pod (Persistent)                          │  │
│  │ - Web UI (NodePort 30080)                                │  │
│  │ - Uses ServiceAccount with RBAC                         │  │
│  │ - PersistentVolume for /var/jenkins_home                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                      │
│              (Creates dynamic agent pods)                       │
│                          ↓                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ Agent Pod 1 │  │ Agent Pod 2 │  │ Agent Pod 3 │            │
│  │ (Build #1)  │  │ (Build #2)  │  │ (Build #3)  │            │
│  │ - Docker    │  │ - Maven     │  │ - Node.js   │            │
│  │ - kubectl   │  │ - kubectl   │  │ - kubectl   │            │
│  │ Auto-scaled │  │ Auto-scaled │  │ Auto-scaled │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│       ↓                  ↓                  ↓                   │
│  Build → Push to Nexus → Deploy to K8s                         │
│  (Pods terminated after build completes)                       │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Application Pods (Your deployed apps)                    │  │
│  │ - Pull images from Nexus                                 │  │
│  │ - Managed by Deployments                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         ↑
         │ (Admin access via kubectl)
┌────────────────────┐
│ Tools VM           │
│ - kubectl          │
│ - Docker (local)   │
│ - Git (optional)   │
└────────────────────┘
```

---

## Step 0: Jenkins in Kubernetes - CI/CD Pipeline Orchestrator

### Overview: Jenkins Running Inside Kubernetes

Jenkins runs as a **pod inside the Kubernetes cluster**, not on the tools VM. This cloud-native approach provides:

✅ **Auto-scaling**: Dynamic agent pods created on-demand
✅ **Isolation**: Each build in separate pod
✅ **Resource efficiency**: No idle resources
✅ **High availability**: Automatic pod restart on failure
✅ **Flexibility**: Different pod templates for different builds

```
Git Repository (Push) → [Webhook] → Jenkins Pod in K8s → Agent Pods → Build → Test → Push → Deploy
                                                              ↓
                                                   Fully Automated & Auto-Scaled
```

### Without Jenkins (Manual)
```bash
# Developer manually runs:
git pull
docker build -t my-app:v1.0.0 .
docker push nexus-registry.local:8082/my-org/my-app:v1.0.0
kubectl set image deployment/my-app my-app-container=nexus-registry.local:8082/my-org/my-app:v1.0.0
```
❌ Error-prone, slow, requires manual intervention

### With Jenkins in Kubernetes (Automated)
```bash
# Developer only does:
git push origin main

# Jenkins AUTOMATICALLY:
# ✅ Webhook triggers Jenkins master pod
# ✅ Jenkins creates agent pod with Docker + kubectl
# ✅ Agent clones repo
# ✅ Agent builds Docker image
# ✅ Agent runs tests
# ✅ Agent pushes to Nexus
# ✅ Agent deploys to Kubernetes (using ServiceAccount)
# ✅ Agent verifies health
# ✅ Agent pod is terminated
# ✅ Sends notification
```

### Jenkins in Kubernetes Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Git Repository                          │
│                    (Your source code)                           │
│                                                                 │
│  app/                                                           │
│    ├── Dockerfile                                              │
│    ├── src/                                                     │
│    ├── k8s/deployment.yaml                                     │
│    └── Jenkinsfile  ← Defines pod template & pipeline         │
└─────────────────────────────────────────────────────────────────┘
                            ↓ (Git webhook trigger)
┌─────────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                           │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Jenkins Master Pod (Persistent)                          │  │
│  │ - Receives webhook                                       │  │
│  │ - Uses ServiceAccount to create agent pods              │  │
│  │ - PersistentVolume for job history                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                      │
│              (Creates dynamic agent pod)                        │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Jenkins Agent Pod (Ephemeral)                            │  │
│  │                                                          │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │  │
│  │  │ Checkout │→ │  Build   │→ │  Push    │→ Deploy      │  │
│  │  │ Git repo │  │ Docker   │  │ to Nexus │  to K8s      │  │
│  │  └──────────┘  └──────────┘  └──────────┘              │  │
│  │       ↓              ↓              ↓           ↓        │  │
│  │  git clone    docker build   docker push  kubectl apply │  │
│  │                                                          │  │
│  │  Containers: jnlp, docker, kubectl                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                      │
│              (Pod terminated after build)                       │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Application Pods (Your deployed apps)                    │  │
│  │ - Pull images from Nexus via ImagePullSecret            │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Pipeline Stages in Jenkins Agent Pod

```
Stage 1: Checkout     ← Clone from Git (in agent pod)
    ↓
Stage 2: Build        ← docker build (in Docker container in agent pod)
    ↓
Stage 3: Test         ← Run unit tests, security scans
    ↓
Stage 4: Push         ← docker push to Nexus
    ↓
Stage 5: Deploy       ← kubectl apply (using ServiceAccount)
    ↓
Stage 6: Verify       ← Smoke tests, health checks
    ↓
Stage 7: Cleanup      ← Agent pod terminated automatically
```

### Step 0.1: Deploy Jenkins to Kubernetes

**See detailed guide:** `docs/JENKINS_IN_K8S.md`

Quick deployment using Helm:

```bash
# Add Jenkins Helm repo
helm repo add jenkins https://charts.jenkins.io
helm repo update

# Create namespace
kubectl create namespace jenkins

# Install Jenkins
helm install jenkins jenkins/jenkins \
  --namespace jenkins \
  --set controller.serviceType=NodePort \
  --set controller.nodePort=30080 \
  --set controller.installPlugins[0]=kubernetes:latest \
  --set controller.installPlugins[1]=git:latest \
  --set controller.installPlugins[2]=workflow-aggregator:latest \
  --set persistence.enabled=true \
  --set persistence.size=10Gi

# Get admin password
kubectl exec -n jenkins -it svc/jenkins -- \
  /bin/cat /run/secrets/additional/chart-admin-password && echo

# Access Jenkins at: http://<any-node-ip>:30080
```

**Access Jenkins at:** `http://10.0.2.10:30080` (or any node IP)

### Step 0.2: Configure Jenkins Kubernetes Plugin

After login to Jenkins UI:

1. **Kubernetes Plugin** should already be installed (via Helm)
2. Go to: Manage Jenkins → Manage Nodes and Clouds → Configure Clouds
3. Kubernetes cloud should be auto-configured:
   - **Kubernetes URL**: `https://kubernetes.default.svc.cluster.local`
   - **Kubernetes Namespace**: `jenkins`
   - **Jenkins URL**: `http://jenkins.jenkins.svc.cluster.local:8080`
   - **Credentials**: Uses ServiceAccount (no manual config needed)
4. Test Connection (should succeed)

### Step 0.3: Add Credentials for Nexus Registry

1. Go to: Manage Jenkins → Manage Credentials
2. Add Credentials → Username with password
   - Username: `your-nexus-user`
   - Password: `your-nexus-password`
   - ID: `nexus-credentials`

### Step 0.4: Create Pipeline Job

1. New Item → Pipeline
2. Name: `my-app-deploy`
3. Pipeline section:
   - Definition: Pipeline script from SCM
   - SCM: Git
   - Repository URL: `https://github.com/your-org/your-app.git`
   - Branch: `*/main`
   - Script Path: `Jenkinsfile`

### Step 0.5: Example Jenkinsfile for Kubernetes

Create `Jenkinsfile` in your Git repository root:

```groovy
pipeline {
    agent {
        kubernetes {
            yaml '''
apiVersion: v1
kind: Pod
metadata:
  labels:
    jenkins: agent
spec:
  serviceAccountName: jenkins-admin
  containers:
  - name: docker
    image: docker:latest
    command:
    - cat
    tty: true
    volumeMounts:
    - name: docker-sock
      mountPath: /var/run/docker.sock
  - name: kubectl
    image: bitnami/kubectl:latest
    command:
    - cat
    tty: true
  volumes:
  - name: docker-sock
    hostPath:
      path: /var/run/docker.sock
'''
        }
    }
    
    environment {
        REGISTRY = "nexus-registry.local:8082"
        APP_NAME = "my-app"
        IMAGE_NAME = "${REGISTRY}/my-org/${APP_NAME}"
    }
    
    stages {
        stage('Checkout') {
            steps {
                echo "Cloning repository..."
                checkout scm
                sh 'git --version'
            }
        }
        
        stage('Build Docker Image') {
            steps {
                container('docker') {
                    echo "Building Docker image: ${IMAGE_NAME}:${BUILD_NUMBER}"
                    sh '''
                        docker build -t ${IMAGE_NAME}:${BUILD_NUMBER} .
                        docker tag ${IMAGE_NAME}:${BUILD_NUMBER} ${IMAGE_NAME}:latest
                    '''
                }
            }
        }
        
        stage('Run Tests') {
            steps {
                container('docker') {
                    echo "Running tests in container..."
                    sh '''
                        docker run --rm \
                          -v ${WORKSPACE}:/app \
                          ${IMAGE_NAME}:${BUILD_NUMBER} \
                          npm test || true
                    '''
                }
            }
        }
        
        stage('Push to Nexus Registry') {
            steps {
                container('docker') {
                    echo "Logging in to Nexus and pushing image..."
                    withCredentials([usernamePassword(
                        credentialsId: 'nexus-credentials',
                        usernameVariable: 'USER',
                        passwordVariable: 'PASS'
                    )]) {
                        sh '''
                            echo $PASS | docker login -u $USER --password-stdin ${REGISTRY}
                            docker push ${IMAGE_NAME}:${BUILD_NUMBER}
                            docker push ${IMAGE_NAME}:latest
                            docker logout ${REGISTRY}
                        '''
                    }
                }
            }
        }
        
        stage('Deploy to Kubernetes') {
            steps {
                container('kubectl') {
                    echo "Deploying to Kubernetes cluster..."
                    sh '''
                        # Update deployment with new image
                        kubectl set image deployment/${APP_NAME} \
                          ${APP_NAME}-container=${IMAGE_NAME}:${BUILD_NUMBER} \
                          --record
                        
                        # Wait for rollout
                        kubectl rollout status deployment/${APP_NAME}
                    '''
                }
            }
        }
        
        stage('Verify Deployment') {
            steps {
                container('kubectl') {
                    echo "Running smoke tests..."
                    sh '''
                        # Check pod status
                        kubectl get pods -l app=${APP_NAME} -o wide
                        
                        # Check service
                        kubectl get service ${APP_NAME}-service
                    '''
                }
            }
        }
    }
    
    post {
        success {
            echo "✅ Deployment successful!"
            // Add Slack notification here if desired
        }
        
        failure {
            echo "❌ Deployment failed!"
            // Add Slack notification and possible rollback
            container('kubectl') {
                sh '''
                    echo "Consider rolling back:"
                    echo "kubectl rollout undo deployment/${APP_NAME}"
                '''
            }
        }
        
        always {
            echo "Agent pod will be terminated automatically"
        }
    }
}
```

**Key Differences from VM-based Jenkins:**
- `agent { kubernetes { yaml '''...''' } }` - Defines pod template inline
- `container('docker')` - Runs steps in specific container
- `container('kubectl')` - Switches to kubectl container
- No need for kubeconfig - uses ServiceAccount automatically
- Agent pod is ephemeral - created for build, terminated after

### Step 0.6: Configure Git Webhook

#### For GitHub:
1. Go to Repository → Settings → Webhooks
2. Add webhook:
   - Payload URL: `http://<node-ip>:30080/github-webhook/`
   - Content type: `application/json`
   - Events: Push events
   - Active: ✓

#### For GitLab:
1. Go to Settings → Integrations → Webhooks
2. Add webhook:
   - URL: `http://<node-ip>:30080/gitlab/build_now`
   - Trigger: Push events
   - Active: ✓

#### For Bitbucket:
1. Go to Repository settings → Webhooks
2. Add webhook:
   - URL: `http://<node-ip>:30080/bitbucket-hook/`
   - Events: Repository push

**Note:** Replace `<node-ip>` with your Kubernetes node IP (e.g., `10.0.2.10`)

### Jenkins in Kubernetes Benefits

✅ **Auto-Scaling** - Agent pods created on-demand, no idle resources
✅ **Isolation** - Each build in separate pod, no dependency conflicts
✅ **Resource Efficiency** - Only use resources during builds
✅ **Flexibility** - Different pod templates for different build types
✅ **High Availability** - Jenkins master can be replicated
✅ **Cloud-Native** - Leverages Kubernetes orchestration
✅ **Cost-Effective** - Pay only for what you use

### Comparison: Jenkins on VM vs Jenkins in K8s

| Aspect | Jenkins on Tools VM | Jenkins in Kubernetes |
|--------|-------------------|----------------------|
| **Location** | Runs on tools VM | Runs as pod in K8s cluster |
| **Agents** | Static agents or VM-based | Dynamic pods (auto-scaled) |
| **Scaling** | Manual | Automatic (Kubernetes) |
| **Resources** | Fixed VM resources | Dynamic pod resources |
| **Isolation** | Shared VM environment | Isolated pods per build |
| **Access to K8s** | Via kubeconfig file | Via ServiceAccount (in-cluster) |
| **Docker builds** | Uses VM Docker daemon | Uses DinD or host Docker socket |
| **Setup Complexity** | Simple | Moderate (requires K8s knowledge) |
| **Best For** | Small teams, simple setups | Production, auto-scaling needs |

---

## Step 1: Prerequisites & Setup

### 1.1 Tools VM Setup (for Administration)

The tools VM is now primarily for cluster administration, not for running Jenkins:

```bash
# Verify kubectl is installed and configured
kubectl cluster-info
kubectl get nodes
kubectl get pods --all-namespaces

# Docker is available for local testing (optional)
docker --version

# Git for cloning repos locally (optional)
git --version
```

### 1.2 Verify Jenkins is Running in Kubernetes

```bash
# Check Jenkins pod
kubectl get pods -n jenkins

# Check Jenkins service
kubectl get service -n jenkins

# Access Jenkins UI
# http://<any-node-ip>:30080
```

### 1.3 Create Kubernetes Namespace for Applications

```bash
# Create namespace for your applications
kubectl create namespace production

# Or use default namespace
kubectl config set-context --current --namespace=default
```

---

## Step 2: Application Repository Setup

### 2.1 Create Application Repository Structure

Your Git repository should have:

```
my-app/
├── Dockerfile                 # Docker image definition
├── Jenkinsfile               # CI/CD pipeline definition
├── src/                      # Application source code
├── k8s/                      # Kubernetes manifests
│   ├── deployment.yaml
│   ├── service.yaml
│   └── configmap.yaml
├── tests/                    # Test files
└── README.md
```

### 2.2 Example Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/

EXPOSE 8080

CMD ["node", "src/index.js"]
```

### 2.3 Push to Git Repository

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-org/my-app.git
git push -u origin main
```

**Note:** Jenkins will automatically clone from Git when webhook triggers. No need to manually clone to tools VM.

---

## Step 3: Create Kubernetes Docker Registry Secret

**Critical for pulling from private registries!**

### 3.1 Create the Secret
```bash
kubectl create secret docker-registry nexus-secret \
  --docker-server=nexus-registry.local:8082 \
  --docker-username=your-nexus-user \
  --docker-password=your-nexus-password \
  --docker-email=your-email@example.com \
  -n default
```

### 3.2 Verify Secret Creation
```bash
kubectl get secrets
kubectl describe secret nexus-secret

# Check secret contents (base64 encoded)
kubectl get secret nexus-secret -o jsonpath='{.data.*}' | base64 --decode
```

---

## Step 4: Create Kubernetes Deployment

### 4.1 Deployment YAML Example

Create `deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  labels:
    app: my-app
    version: v1
spec:
  replicas: 3  # Number of pod replicas
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
        tier: frontend
      annotations:
        description: "My Application Deployment"
    spec:
      # Reference the Nexus registry secret
      imagePullSecrets:
      - name: nexus-secret
      
      containers:
      - name: my-app-container
        image: nexus-registry.local:8082/my-org/my-app:v1.0.0
        imagePullPolicy: IfNotPresent  # or Always for development
        
        ports:
        - containerPort: 8080
          protocol: TCP
        
        # Environment variables
        env:
        - name: APP_ENV
          value: "production"
        - name: LOG_LEVEL
          value: "info"
        
        # Resource limits and requests
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
          limits:
            cpu: "500m"
            memory: "512Mi"
        
        # Health checks
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
```

### 4.2 Create Service to Expose Application

Create `service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app-service
  labels:
    app: my-app
spec:
  type: NodePort  # Or LoadBalancer, ClusterIP
  
  selector:
    app: my-app
  
  ports:
  - protocol: TCP
    port: 80          # Service port
    targetPort: 8080  # Container port
    nodePort: 30080   # Node port (30000-32767)
```

---

## Step 5: Deploy to Kubernetes

### 5.1 Apply Deployment and Service
```bash
# Apply both manifests
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml

# Or apply all YAML files in directory
kubectl apply -f k8s-manifests/
```

### 5.2 Verify Deployment
```bash
# Check deployment status
kubectl get deployments
kubectl describe deployment my-app

# Check pods
kubectl get pods -l app=my-app
kubectl describe pod <pod-name>

# Check service
kubectl get services
kubectl describe service my-app-service

# View logs
kubectl logs <pod-name>
kubectl logs <pod-name> --follow  # Stream logs
```

### 5.3 Access the Application
```bash
# Get the service endpoint
kubectl get service my-app-service

# Access via NodePort (from any worker node)
curl http://192.168.57.21:30080/
curl http://192.168.57.22:30080/

# Port-forward from tools VM
kubectl port-forward service/my-app-service 8080:80
# Then access: http://localhost:8080
```

---

## Step 6: Update/Rollout New Versions

### 6.1 Build New Version
```bash
# Update code
git pull origin main

# Build new image with new tag
docker build -t my-app:v1.1.0 .
docker tag my-app:v1.1.0 nexus-registry.local:8082/my-org/my-app:v1.1.0
docker push nexus-registry.local:8082/my-org/my-app:v1.1.0
```

### 6.2 Update Deployment Image
```bash
# Method 1: Update YAML and reapply
# (Edit deployment.yaml to use v1.1.0)
kubectl apply -f deployment.yaml

# Method 2: Direct command (faster)
kubectl set image deployment/my-app \
  my-app-container=nexus-registry.local:8082/my-org/my-app:v1.1.0 \
  --record

# Check rollout status
kubectl rollout status deployment/my-app
```

### 6.3 Rollback if Needed
```bash
# View rollout history
kubectl rollout history deployment/my-app

# Rollback to previous version
kubectl rollout undo deployment/my-app

# Rollback to specific revision
kubectl rollout undo deployment/my-app --to-revision=2
```

---

## Step 7: Monitoring & Troubleshooting

### 7.1 Check Pod Status
```bash
# Get detailed pod info
kubectl get pods -o wide
kubectl describe pod <pod-name>

# Check pod events
kubectl get events --sort-by='.lastTimestamp'

# Check container logs
kubectl logs <pod-name>
kubectl logs <pod-name> -c <container-name>
```

### 7.2 Common Issues & Solutions

#### Image Pull Errors
```bash
# Issue: ImagePullBackOff or ErrImagePull
# Solution: Verify secret and credentials
kubectl describe pod <pod-name>
kubectl describe secret nexus-secret

# Re-create secret if needed
kubectl delete secret nexus-secret
kubectl create secret docker-registry nexus-secret \
  --docker-server=nexus-registry.local:8082 \
  --docker-username=your-user \
  --docker-password=your-pass \
  --docker-email=your-email@example.com
```

#### Pod Not Starting
```bash
# Check pod logs
kubectl logs <pod-name> --previous  # Previous attempt logs

# Check resource limits
kubectl top pods
kubectl describe node <node-name>

# Check node status
kubectl get nodes
kubectl describe node <node-name>
```

#### Service Not Accessible
```bash
# Verify service exists and has endpoints
kubectl get endpoints my-app-service

# Test pod connectivity internally
kubectl run -it debug --image=busybox --restart=Never -- /bin/sh
# Inside the pod: wget http://my-app-service

# Check service configuration
kubectl get service my-app-service -o yaml
```

---

## Step 8: Advanced Deployment Patterns

### 8.1 Blue-Green Deployment
```yaml
# Deploy new version (green) alongside old (blue)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app-green
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
      version: green
  template:
    metadata:
      labels:
        app: my-app
        version: green
    spec:
      containers:
      - name: my-app
        image: nexus-registry.local:8082/my-org/my-app:v1.1.0

---
# Service switches between blue and green
apiVersion: v1
kind: Service
metadata:
  name: my-app-service
spec:
  selector:
    app: my-app
    version: green  # Change to "blue" to switch back
  ports:
  - port: 80
    targetPort: 8080
```

### 8.2 ConfigMaps for Configuration
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: my-app-config
data:
  app.properties: |
    APP_ENV=production
    LOG_LEVEL=info
    DATABASE_POOL_SIZE=20

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  template:
    spec:
      containers:
      - name: my-app
        image: nexus-registry.local:8082/my-org/my-app:latest
        volumeMounts:
        - name: config
          mountPath: /etc/config
      volumes:
      - name: config
        configMap:
          name: my-app-config
```

### 8.3 Secrets for Sensitive Data
```bash
# Create secret from file
kubectl create secret generic db-credentials \
  --from-literal=username=admin \
  --from-literal=password=secret123

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  template:
    spec:
      containers:
      - name: my-app
        env:
        - name: DB_USERNAME
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: username
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
```

---

## Step 9: CI/CD Pipeline Integration

### 9.1 Automated Deployment Script

Create `deploy.sh`:

```bash
#!/bin/bash
set -e

APP_NAME="my-app"
REGISTRY="nexus-registry.local:8082"
VERSION=$(git describe --tags --always)
IMAGE="$REGISTRY/my-org/$APP_NAME:$VERSION"

echo "=== Building Docker image ==="
docker build -t $IMAGE .

echo "=== Pushing to registry ==="
docker push $IMAGE

echo "=== Updating Kubernetes deployment ==="
kubectl set image deployment/$APP_NAME \
  ${APP_NAME}-container=$IMAGE \
  --record

echo "=== Waiting for rollout ==="
kubectl rollout status deployment/$APP_NAME

echo "=== Deployment complete ==="
kubectl get deployment,pods,services
```

### 9.2 Ansible Playbook for Deployment

Create `deploy-app.yml`:

```yaml
---
- name: Deploy application to Kubernetes
  hosts: tools
  tasks:
    - name: Clone repository
      git:
        repo: https://github.com/your-org/your-app.git
        dest: /opt/applications/my-app
        version: main

    - name: Build Docker image
      docker_image:
        name: my-app
        tag: latest
        source: build
        build:
          path: /opt/applications/my-app
          dockerfile: Dockerfile

    - name: Push to registry
      shell: |
        docker tag my-app:latest nexus-registry.local:8082/my-org/my-app:latest
        docker push nexus-registry.local:8082/my-org/my-app:latest
      environment:
        KUBECONFIG: /home/vagrant/.kube/config

    - name: Deploy to Kubernetes
      kubernetes.core.k8s:
        state: present
        definition: "{{ lookup('template', 'deployment.yml.j2') }}"
        kubeconfig: /home/vagrant/.kube/config

    - name: Verify deployment
      kubernetes.core.k8s_info:
        kind: Deployment
        name: my-app
        kubeconfig: /home/vagrant/.kube/config
      register: deployment_status

    - name: Display deployment status
      debug:
        msg: "Deployment status: {{ deployment_status.resources[0].status }}"
```

---

## Quick Reference Commands

```bash
# Get all resources
kubectl get all -A

# Get resource details
kubectl describe <resource-type> <resource-name>

# View logs
kubectl logs <pod-name>
kubectl logs <pod-name> -f  # Follow

# Execute command in pod
kubectl exec -it <pod-name> -- /bin/bash

# Port forward
kubectl port-forward <pod-name> 8080:8080

# Delete resource
kubectl delete <resource-type> <resource-name>

# Apply manifest
kubectl apply -f manifest.yaml

# Watch resource
kubectl get pods -w

# Get resource in YAML format
kubectl get <resource-type> <resource-name> -o yaml

# Edit resource
kubectl edit <resource-type> <resource-name>

# Scaling
kubectl scale deployment <name> --replicas=5

# Check resource events
kubectl get events --sort-by='.lastTimestamp'
```

---

## Security Best Practices

1. **Always use ImagePullSecrets** for private registries
2. **Use resource limits** to prevent resource exhaustion
3. **Implement health checks** (liveness & readiness probes)
4. **Store secrets separately** from configuration
5. **Use RBAC** for access control
6. **Scan images** for vulnerabilities before deploying
7. **Use network policies** to restrict traffic
8. **Keep kubeconfig secure** - restrict file permissions
9. **Enable pod security policies**
10. **Monitor and log** all deployments

---

## Key Takeaways

✅ **Tools VM acts as deployment hub** with Git, Docker, Nexus, and kubectl
✅ **Docker Registry Secrets** enable pulling from private Nexus registry
✅ **Deployments & Services** define how apps run and are accessed
✅ **Rolling updates** ensure zero-downtime deployments
✅ **Monitoring & logs** help troubleshoot issues
✅ **Automation scripts** streamline the deployment process
