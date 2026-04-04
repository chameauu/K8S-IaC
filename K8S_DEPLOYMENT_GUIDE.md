# Complete Guide: Deploying Applications to Kubernetes from Tools VM

## Overview
Your tools VM (192.168.57.30) will serve as the deployment automation hub with:
- **Git**: Source code repository access
- **Nexus**: Docker image registry (artifact storage)
- **Docker**: Image building and pushing
- **kubectl**: Kubernetes cluster interaction

---

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Tools VM (192.168.57.30)                                        │
│                                                                 │
│  ┌──────────────┐  ┌──────────┐  ┌────────┐  ┌──────────────┐ │
│  │     Git      │  │  Nexus   │  │ Docker │  │    kubectl   │ │
│  │  Repository  │  │ Registry │  │ Engine │  │  (K8s API)   │ │
│  └──────────────┘  └──────────┘  └────────┘  └──────────────┘ │
│         ↓               ↓            ↓             ↓            │
│    Clone/Pull    Store Images  Build Images   Deploy Pods      │
└─────────────────────────────────────────────────────────────────┘
                            ↓
                ┌──────────────────────────┐
                │  Kubernetes Cluster      │
                │                          │
                │ ┌─────────────────────┐  │
                │ │ Master Node         │  │
                │ │ - API Server        │  │
                │ │ - Scheduler         │  │
                │ └─────────────────────┘  │
                │ ┌──────┐  ┌──────┐       │
                │ │node1 │  │node2 │  ...  │
                │ │Pods  │  │Pods  │       │
                │ └──────┘  └──────┘       │
                └──────────────────────────┘
```

---

## Step 0: Jenkins - CI/CD Pipeline Orchestrator

### Overview: What is Jenkins?

Jenkins is the **CI/CD (Continuous Integration/Continuous Deployment) orchestrator** that automates your entire deployment pipeline.

```
Git Repository (Push) → [Webhook] → Jenkins Pipeline → Build → Test → Push → Deploy to K8s
                                                       ↓
                                        Fully Automated in < 5 minutes
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

### With Jenkins (Automated)
```bash
# Developer only does:
git push origin main

# Jenkins AUTOMATICALLY:
# ✅ Clones repo
# ✅ Builds Docker image
# ✅ Runs tests
# ✅ Pushes to Nexus
# ✅ Deploys to Kubernetes
# ✅ Verifies health
# ✅ Sends notification
```

### Jenkins Architecture in Your Setup

```
┌─────────────────────────────────────────────────────────────────┐
│                         Git Repository                          │
│                    (Your source code)                           │
│                                                                 │
│  app/                                                           │
│    ├── Dockerfile                                              │
│    ├── src/                                                     │
│    └── Jenkinsfile  ← Defines the pipeline                     │
└─────────────────────────────────────────────────────────────────┘
                            ↓ (Git webhook trigger)
┌─────────────────────────────────────────────────────────────────┐
│                        JENKINS (on Tools VM)                    │
│                                                                 │
│  ┌──────────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │   Checkout   │→ │  Build   │→ │  Push    │→ │  Deploy    │  │
│  │   Git repo   │  │ Docker   │  │ to       │  │ to K8s     │  │
│  │              │  │ image    │  │ Nexus    │  │            │  │
│  └──────────────┘  └──────────┘  └──────────┘  └────────────┘  │
│         ↓                ↓              ↓              ↓         │
│   git clone        docker build   docker push     kubectl apply  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Kubernetes Cluster                            │
│  (Pulls image from Nexus via ImagePullSecret)                  │
└─────────────────────────────────────────────────────────────────┘
```

### Pipeline Stages

```
Stage 1: Checkout     ← Clone from Git
    ↓
Stage 2: Build        ← docker build (create image)
    ↓
Stage 3: Test         ← Run unit tests, security scans
    ↓
Stage 4: Push         ← docker push to Nexus
    ↓
Stage 5: Deploy       ← kubectl apply to Kubernetes
    ↓
Stage 6: Verify       ← Smoke tests, health checks
```

### Step 0.1: Install Jenkins on Tools VM

```bash
# Install Java (Jenkins dependency)
sudo apt update
sudo apt install -y openjdk-11-jdk

# Add Jenkins repository
wget -q -O - https://pkg.jenkins.io/debian/jenkins.io.key | sudo apt-key add -
sudo sh -c 'echo deb http://pkg.jenkins.io/debian binary/ > /etc/apt/sources.list.d/jenkins.list'

# Install Jenkins
sudo apt update
sudo apt install -y jenkins

# Start Jenkins
sudo systemctl start jenkins
sudo systemctl enable jenkins

# Check status
sudo systemctl status jenkins

# Get initial admin password
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

**Access Jenkins at:** `http://192.168.57.30:8080`

### Step 0.2: Configure Jenkins Credentials

After login, add credentials for:

1. **Nexus Registry Credentials**
   - Go to: Manage Jenkins → Manage Credentials
   - Add Credentials → Username with password
   - Username: `your-nexus-user`
   - Password: `your-nexus-password`
   - ID: `nexus-credentials`

2. **Git SSH Key** (optional, if using SSH)
   - Add Credentials → SSH Username with private key
   - ID: `github-ssh-key`

3. **kubeconfig** (for Kubernetes access)
   - Add Credentials → Secret file
   - Upload: `/home/vagrant/.kube/config`
   - ID: `kubeconfig`

### Step 0.3: Create Pipeline Job

1. New Item → Pipeline
2. Name: `my-app-deploy`
3. Pipeline section:
   - Definition: Pipeline script from SCM
   - SCM: Git
   - Repository URL: `https://github.com/your-org/your-app.git`
   - Branch: `*/main`
   - Script Path: `Jenkinsfile`

### Step 0.4: Example Jenkinsfile

Create `Jenkinsfile` in your Git repository root:

```groovy
pipeline {
    agent any
    
    environment {
        REGISTRY = "nexus-registry.local:8082"
        REGISTRY_CREDENTIALS = credentials('nexus-credentials')
        APP_NAME = "my-app"
        IMAGE_NAME = "${REGISTRY}/my-org/${APP_NAME}"
        KUBECONFIG = credentials('kubeconfig')
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
                echo "Building Docker image: ${IMAGE_NAME}:${BUILD_NUMBER}"
                sh '''
                    docker build -t ${IMAGE_NAME}:${BUILD_NUMBER} .
                    docker tag ${IMAGE_NAME}:${BUILD_NUMBER} ${IMAGE_NAME}:latest
                '''
            }
        }
        
        stage('Run Tests') {
            steps {
                echo "Running tests in container..."
                sh '''
                    docker run --rm \
                      -v ${WORKSPACE}:/app \
                      ${IMAGE_NAME}:${BUILD_NUMBER} \
                      npm test
                '''
            }
        }
        
        stage('Push to Nexus Registry') {
            steps {
                echo "Logging in to Nexus and pushing image..."
                sh '''
                    echo ${REGISTRY_CREDENTIALS_PSW} | \
                      docker login -u ${REGISTRY_CREDENTIALS_USR} \
                      --password-stdin ${REGISTRY}
                    
                    docker push ${IMAGE_NAME}:${BUILD_NUMBER}
                    docker push ${IMAGE_NAME}:latest
                    
                    docker logout ${REGISTRY}
                '''
            }
        }
        
        stage('Deploy to Kubernetes') {
            steps {
                echo "Deploying to Kubernetes cluster..."
                sh '''
                    export KUBECONFIG=${KUBECONFIG}
                    
                    # Update deployment with new image
                    kubectl set image deployment/${APP_NAME} \
                      ${APP_NAME}-container=${IMAGE_NAME}:${BUILD_NUMBER} \
                      --record
                    
                    # Wait for rollout
                    kubectl rollout status deployment/${APP_NAME}
                '''
            }
        }
        
        stage('Verify Deployment') {
            steps {
                echo "Running smoke tests..."
                sh '''
                    export KUBECONFIG=${KUBECONFIG}
                    
                    # Check pod status
                    kubectl get pods -l app=${APP_NAME} -o wide
                    
                    # Check service
                    kubectl get service ${APP_NAME}-service
                    
                    # Get service endpoint
                    SERVICE_IP=$(kubectl get service ${APP_NAME}-service \
                      -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
                    
                    # Smoke test (if service is accessible)
                    if [ -n "$SERVICE_IP" ]; then
                        echo "Testing endpoint: http://$SERVICE_IP"
                        curl -f http://$SERVICE_IP/health || true
                    fi
                '''
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
            sh '''
                export KUBECONFIG=${KUBECONFIG}
                echo "Consider rolling back:"
                echo "kubectl rollout undo deployment/${APP_NAME}"
            '''
        }
        
        always {
            // Cleanup
            sh 'docker logout || true'
        }
    }
}
```

### Step 0.5: Configure Git Webhook

#### For GitHub:
1. Go to Repository → Settings → Webhooks
2. Add webhook:
   - Payload URL: `http://your-jenkins-url:8080/github-webhook/`
   - Content type: `application/json`
   - Events: Push events
   - Active: ✓

#### For GitLab:
1. Go to Settings → Integrations → Webhooks
2. Add webhook:
   - URL: `http://your-jenkins-url:8080/gitlab/build_now`
   - Trigger: Push events
   - Active: ✓

#### For Bitbucket:
1. Go to Repository settings → Webhooks
2. Add webhook:
   - URL: `http://your-jenkins-url:8080/bitbucket-hook/`
   - Events: Repository push

### Step 0.6: Install Required Jenkins Plugins

1. Manage Jenkins → Plugin Manager
2. Install plugins:
   - **Pipeline** - For declarative pipelines
   - **Git** - For Git integration
   - **Docker** - For Docker operations
   - **Docker Pipeline** - For Docker in pipelines
   - **Kubernetes** - For Kubernetes integration
   - **Slack** - For notifications (optional)
   - **GitHub/GitLab/Bitbucket Integration** - Based on your Git provider

### Jenkins + Other Tools Integration

| Tool | Jenkins Uses | How |
|------|-------------|-----|
| **Git** | Repository + Webhook | Triggers pipeline on push, clones code |
| **Docker** | Docker daemon on Tools VM | Builds images, runs tests in containers |
| **Nexus** | Registry API + credentials | Pushes images, stores artifacts |
| **Kubernetes** | kubectl + kubeconfig | Deploys, updates, verifies pods |
| **Slack/Email** | Notifications | Alerts on build success/failure |

### Jenkins Benefits

✅ **Fully Automated** - No manual intervention needed
✅ **Consistent** - Same process every time
✅ **Fast** - Complete pipeline in 2-5 minutes
✅ **Audit Trail** - Complete history of all deployments
✅ **Scalable** - Easy to manage multiple applications
✅ **Reliable** - Built-in error handling and rollback
✅ **Integrated** - Works with Git, Docker, Kubernetes seamlessly

---

## Step 1: Prerequisites & Setup on Tools VM

### 1.1 Install Required Tools
```bash
# Already should have from tools-setup role:
sudo apt update
sudo apt install -y git docker.io kubectl

# Verify installations
git --version
docker --version
kubectl version --client

# Add vagrant user to docker group
sudo usermod -aG docker vagrant
```

### 1.2 Configure kubectl Access to Cluster
```bash
# The kubeconfig should be copied from master (done by tools-setup role)
# Verify it's accessible
kubectl cluster-info
kubectl get nodes
kubectl get pods --all-namespaces
```

### 1.3 Configure Docker Registry Authentication
```bash
# Login to Nexus registry (or your private registry)
docker login nexus-registry.local:8082
# Username: your-nexus-user
# Password: your-nexus-password
```

---

## Step 2: Pull & Build Application from Git

### 2.1 Clone Application Repository
```bash
cd /opt/applications
git clone https://github.com/your-org/your-app.git
cd your-app
git checkout main  # or your desired branch
```

### 2.2 Build Docker Image
```bash
# Build the Docker image
docker build -t my-app:latest .

# Tag for Nexus registry
docker tag my-app:latest nexus-registry.local:8082/my-org/my-app:latest
docker tag my-app:latest nexus-registry.local:8082/my-org/my-app:v1.0.0
```

### 2.3 Push to Nexus Registry
```bash
# Push images to Nexus
docker push nexus-registry.local:8082/my-org/my-app:latest
docker push nexus-registry.local:8082/my-org/my-app:v1.0.0

# Verify push
curl -u your-nexus-user:password http://nexus-registry.local:8082/service/rest/v1/search
```

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
