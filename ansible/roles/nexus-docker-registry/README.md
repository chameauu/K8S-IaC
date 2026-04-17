# Ansible Role: nexus-docker-registry

Configures Nexus Repository Manager as a Docker registry using the REST API.

## Description

This role automates the configuration of Nexus as a Docker registry, including:
- Enabling Docker Bearer Token Realm
- Creating blob stores for Docker repositories
- Creating Docker hosted, proxy, and group repositories
- Configuring HTTP connectors for each repository
- Configuring Docker daemon for insecure registries

## Requirements

- Nexus Repository Manager 3.x running and accessible
- Nexus admin credentials
- Python `requests` library (for uri module)

## Role Variables

Available variables with default values (see `defaults/main.yml`):

```yaml
# Nexus connection
nexus_url: "http://localhost:8081"
nexus_admin_user: "admin"
nexus_admin_password: "admin123"

# Docker registry ports
nexus_docker_hosted_port: 8082
nexus_docker_proxy_port: 8083
nexus_docker_group_port: 8084

# Repository names
nexus_docker_hosted_repo: "docker-hosted"
nexus_docker_proxy_repo: "docker-proxy"
nexus_docker_group_repo: "docker-group"

# Deployment policy
nexus_deployment_policy: "ALLOW"  # ALLOW, ALLOW_ONCE, or DENY

# Wait timeout
nexus_wait_timeout: 300
```

## Dependencies

None.

## Example Playbook

```yaml
---
- name: Configure Nexus as Docker Registry
  hosts: tools
  become: no
  roles:
    - nexus-docker-registry
```

With custom variables:

```yaml
---
- name: Configure Nexus as Docker Registry
  hosts: tools
  become: no
  roles:
    - role: nexus-docker-registry
      vars:
        nexus_admin_password: "my-secure-password"
        nexus_deployment_policy: "ALLOW_ONCE"
```

## What This Role Does

1. **Waits for Nexus** to be ready (up to 5 minutes)
2. **Enables Docker Bearer Token Realm** for Docker authentication
3. **Creates blob stores** for hosted, proxy, and group repositories
4. **Creates Docker hosted repository** (port 8082) for custom images
5. **Creates Docker proxy repository** (port 8083) for Docker Hub caching
6. **Creates Docker group repository** (port 8084) combining both
7. **Configures Docker daemon** to allow insecure registries
8. **Displays summary** with access information and next steps

## After Running This Role

### Test Docker Registry

```bash
# Login
docker login 10.0.2.30:8082
# Username: admin
# Password: admin123

# Tag and push test image
docker pull hello-world
docker tag hello-world 10.0.2.30:8082/hello-world:latest
docker push 10.0.2.30:8082/hello-world:latest

# Verify in Nexus UI
# Browse → docker-hosted → hello-world
```

### Configure Kubernetes Nodes

Run the companion playbook:
```bash
ansible-playbook ansible/playbooks/configure-k8s-nodes-nexus.yml
```

### Create Kubernetes Secret

```bash
kubectl create secret docker-registry nexus-registry \
  --docker-server=10.0.2.30:8082 \
  --docker-username=admin \
  --docker-password=admin123 \
  --docker-email=admin@example.com
```

## Idempotency

This role is idempotent - it can be run multiple times safely:
- Existing blob stores are not recreated (400 error ignored)
- Existing repositories are not recreated (400 error ignored)
- Docker daemon config is overwritten with same content

## Troubleshooting

### Nexus Not Ready

If role fails with "Nexus is not ready":
```bash
# Check Nexus container
docker ps | grep nexus

# Check logs
docker logs nexus --tail 100

# Nexus takes 2-3 minutes to start
# Wait and retry
```

### API Calls Fail

If API calls return 401 Unauthorized:
```bash
# Verify credentials
curl -u admin:admin123 http://localhost:8081/service/rest/v1/status

# Check if password was changed
docker exec nexus cat /nexus-data/admin.password
```

### Docker Daemon Not Restarting

If Docker doesn't restart:
```bash
# Check Docker status
sudo systemctl status docker

# Manually restart
sudo systemctl restart docker

# Verify insecure registries
docker info | grep -A 5 "Insecure Registries"
```

## Security Notes

- Default credentials are used (admin/admin123)
- HTTP is used instead of HTTPS (insecure)
- Anonymous access may be enabled

For production:
1. Change admin password
2. Configure HTTPS with SSL certificates
3. Create dedicated users with minimal privileges
4. Disable anonymous access if not needed

## License

MIT

## Author Information

Created for Kubernetes learning environment with Vagrant and Ansible.
