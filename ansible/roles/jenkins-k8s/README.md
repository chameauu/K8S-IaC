# Ansible Role: jenkins-k8s

Deploys Jenkins on Kubernetes using a simplified StatefulSet approach optimized for resource-constrained VM environments.

## Description

This role deploys Jenkins to a Kubernetes cluster without using the resource-intensive Helm chart. It's designed for learning and development environments where resources are limited.

## Requirements

- Kubernetes cluster must be running
- kubectl must be configured on the target host
- Python kubernetes module: `pip3 install kubernetes`
- Ansible kubernetes.core collection: `ansible-galaxy collection install kubernetes.core`

## Role Variables

Available variables are listed below, along with default values (see `defaults/main.yml`):

```yaml
# Jenkins Docker image
jenkins_image: "jenkins/jenkins:2.555.1-jdk21"

# Resource requests and limits
jenkins_cpu_request: "100m"
jenkins_memory_request: "512Mi"
jenkins_cpu_limit: "1000m"
jenkins_memory_limit: "1Gi"

# Java heap settings
jenkins_java_opts: "-Xmx512m -Xms256m"

# Service configuration
jenkins_nodeport: 30080
jenkins_namespace: "jenkins"
```

## Dependencies

None.

## Example Playbook

```yaml
---
- name: Deploy Jenkins on Kubernetes
  hosts: tools
  become: no
  roles:
    - jenkins-k8s
```

Or with custom variables:

```yaml
---
- name: Deploy Jenkins on Kubernetes
  hosts: tools
  become: no
  roles:
    - role: jenkins-k8s
      vars:
        jenkins_memory_limit: "2Gi"
        jenkins_nodeport: 32080
```

## What This Role Does

1. Creates `jenkins` namespace in Kubernetes
2. Deploys ServiceAccount with RBAC permissions
3. Creates ClusterRole for pod management
4. Creates ClusterRoleBinding
5. Deploys Jenkins Service (NodePort)
6. Deploys Jenkins StatefulSet
7. Waits for Jenkins pod to be ready
8. Displays access information

## After Deployment

Access Jenkins at: `http://<master-node-ip>:30080`

Get the admin password:
```bash
# SSH to the node where Jenkins is running
vagrant ssh <node-name>

# Find the Jenkins container
sudo crictl ps | grep jenkins

# Get the password
sudo crictl exec <container-id> cat /var/jenkins_home/secrets/initialAdminPassword
```

## Why Not Helm?

The official Jenkins Helm chart includes an init container that downloads and installs plugins during startup. This requires significant memory (1-2Gi) and often fails in VM environments with limited resources.

This simplified deployment:
- Uses less memory (512Mi-1Gi)
- Starts faster (2-4 minutes vs 5-10 minutes)
- More reliable in resource-constrained environments
- Plugins are installed manually through the UI

## Persistence

This role uses `emptyDir` for storage, meaning data is lost when the pod restarts. This is suitable for learning environments.

For production, modify the StatefulSet to use a PersistentVolumeClaim.

## Troubleshooting

Check deployment status:
```bash
kubectl get pods -n jenkins
kubectl get svc -n jenkins
kubectl describe pod jenkins-0 -n jenkins
kubectl logs jenkins-0 -n jenkins
```

## License

MIT

## Author Information

Created for Kubernetes learning environment with Vagrant and Ansible.
