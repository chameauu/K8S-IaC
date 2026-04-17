# Ansible Role: gitea

Deploys Gitea Git server on tools VM using Docker.

## Description

This role deploys Gitea, a lightweight self-hosted Git service, on the tools VM. Gitea provides:
- Git repository hosting
- Web UI for repository management
- Webhook support for CI/CD integration
- Issue tracking
- Pull requests
- Wiki

## Requirements

- Docker installed on tools VM
- Ports 3000 (HTTP) and 2222 (SSH) available

## Role Variables

Available variables with default values (see `defaults/main.yml`):

```yaml
# Gitea version
gitea_version: "latest"
gitea_image: "gitea/gitea:latest"

# Ports
gitea_http_port: 3000
gitea_ssh_port: 2222

# Server settings
gitea_domain: "10.0.2.30"
gitea_root_url: "http://10.0.2.30:3000/"

# Admin user (for reference)
gitea_admin_username: "admin"
gitea_admin_password: "admin123"
gitea_admin_email: "admin@example.com"

# Docker settings
gitea_data_volume: "gitea-data"
gitea_container_name: "gitea"
```

## Dependencies

None.

## Example Playbook

```yaml
---
- name: Deploy Gitea on Tools VM
  hosts: tools
  become: no
  roles:
    - gitea
```

With custom variables:

```yaml
---
- name: Deploy Gitea on Tools VM
  hosts: tools
  become: no
  roles:
    - role: gitea
      vars:
        gitea_http_port: 3001
        gitea_admin_username: "gitadmin"
```

## What This Role Does

1. **Checks Docker** is running
2. **Creates data volume** for persistent storage
3. **Pulls Gitea image** from Docker Hub
4. **Starts Gitea container** with configuration
5. **Waits for Gitea** to be ready (up to 2.5 minutes)
6. **Displays access information** and next steps

## After Deployment

### First-Time Setup

1. **Access Gitea UI:**
   - URL: http://10.0.2.30:3000
   - Click "Register" (top right)

2. **Create Admin User:**
   - Username: `admin`
   - Password: `admin123`
   - Email: `admin@example.com`
   - Click "Register Account"
   - First user becomes admin automatically

3. **Create Repository:**
   - Click "+" → "New Repository"
   - Name: `hello-world-k8s`
   - Description: "Hello World CI/CD Demo"
   - Initialize: ✓ Add .gitignore (optional)
   - Click "Create Repository"

### Push Sample App

```bash
cd sample-app

# Initialize git if not already
git init

# Add Gitea remote
git remote add origin http://10.0.2.30:3000/admin/hello-world-k8s.git

# Push code
git add .
git commit -m "Initial commit"
git push -u origin main
```

### Configure Jenkins Webhook

1. **In Gitea:**
   - Go to repository → Settings → Webhooks
   - Add Webhook → Gitea
   - Target URL: `http://jenkins.jenkins.svc.cluster.local:8080/git/notifyCommit?url=http://10.0.2.30:3000/admin/hello-world-k8s.git`
   - HTTP Method: POST
   - Trigger On: Push events
   - Click "Add Webhook"

2. **In Jenkins:**
   - Create Pipeline job
   - SCM: Git
   - Repository URL: `http://10.0.2.30:3000/admin/hello-world-k8s.git`
   - Build Triggers: ✓ Poll SCM (or webhook)

### Test Webhook

```bash
cd sample-app
echo "<!-- test -->" >> index.html
git add .
git commit -m "Test webhook"
git push

# Jenkins should automatically start building!
```

## Accessing Gitea

### Web UI
- URL: http://10.0.2.30:3000
- Username: admin
- Password: admin123

### Git Clone (HTTP)
```bash
git clone http://10.0.2.30:3000/admin/hello-world-k8s.git
```

### Git Clone (SSH)
```bash
git clone ssh://git@10.0.2.30:2222/admin/hello-world-k8s.git
```

## Container Management

```bash
# Check status
docker ps | grep gitea

# View logs
docker logs gitea

# Restart
docker restart gitea

# Stop
docker stop gitea

# Start
docker start gitea

# Remove (data persists in volume)
docker rm -f gitea
```

## Data Persistence

Data is stored in Docker volume `gitea-data`:

```bash
# Backup
docker run --rm -v gitea-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/gitea-backup-$(date +%Y%m%d).tar.gz /data

# Restore
docker run --rm -v gitea-data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/gitea-backup-YYYYMMDD.tar.gz -C /

# View volume location
docker volume inspect gitea-data
```

## Troubleshooting

### Gitea Not Accessible

```bash
# Check container is running
docker ps | grep gitea

# Check logs
docker logs gitea --tail 100

# Restart container
docker restart gitea

# Wait 1-2 minutes for startup
```

### Port Already in Use

```bash
# Check what's using port 3000
sudo lsof -i :3000

# Change port in variables
gitea_http_port: 3001
```

### Cannot Push to Repository

```bash
# Check Git credentials
git config --global user.name "admin"
git config --global user.email "admin@example.com"

# Use HTTP with credentials
git remote set-url origin http://admin:admin123@10.0.2.30:3000/admin/hello-world-k8s.git
```

### Webhook Not Working

```bash
# Check webhook delivery in Gitea
# Repository → Settings → Webhooks → Recent Deliveries

# Test webhook manually
curl -X POST http://10.0.2.30:3000/api/v1/repos/admin/hello-world-k8s/hooks/1/test

# Check Jenkins is accessible from tools VM
curl -I http://jenkins.jenkins.svc.cluster.local:8080
```

## Configuration

### Change Admin Password

1. Login to Gitea
2. Click avatar → Settings
3. Account → Password
4. Enter new password
5. Click "Update Password"

### Enable/Disable Registration

Edit container environment:
```yaml
GITEA__service__DISABLE_REGISTRATION: "true"  # Disable new registrations
```

### Configure Email

Add to container environment:
```yaml
GITEA__mailer__ENABLED: "true"
GITEA__mailer__FROM: "gitea@example.com"
GITEA__mailer__SMTP_ADDR: "smtp.gmail.com"
GITEA__mailer__SMTP_PORT: "587"
GITEA__mailer__USER: "your-email@gmail.com"
GITEA__mailer__PASSWD: "your-app-password"
```

## Integration with Jenkins

### Jenkins Pipeline with Gitea

```groovy
pipeline {
    agent any
    
    stages {
        stage('Checkout') {
            steps {
                git url: 'http://10.0.2.30:3000/admin/hello-world-k8s.git',
                    branch: 'main'
            }
        }
        
        stage('Build') {
            steps {
                sh 'docker build -t my-app .'
            }
        }
    }
}
```

### Gitea Credentials in Jenkins

1. Manage Jenkins → Manage Credentials
2. Add Username with password
3. Username: `admin`
4. Password: `admin123`
5. ID: `gitea-credentials`

## Features

✅ Lightweight (uses ~100MB RAM)  
✅ Fast startup (1-2 minutes)  
✅ SQLite database (no external DB needed)  
✅ Webhook support for CI/CD  
✅ SSH and HTTP Git access  
✅ Web UI for repository management  
✅ Issue tracking and pull requests  
✅ Persistent data storage  

## Comparison with Other Git Servers

| Feature | Gitea | GitLab | GitHub |
|---------|-------|--------|--------|
| Self-hosted | ✅ | ✅ | ❌ |
| Resource usage | Low | High | N/A |
| Setup time | 2 min | 15 min | N/A |
| CI/CD | Via Jenkins | Built-in | Built-in |
| Cost | Free | Free/Paid | Free/Paid |

## Uninstall

```bash
# Stop and remove container
docker stop gitea
docker rm gitea

# Remove volume (deletes all data!)
docker volume rm gitea-data

# Remove image
docker rmi gitea/gitea:latest
```

## License

MIT

## Author Information

Created for Kubernetes learning environment with Vagrant and Ansible.
