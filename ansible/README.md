# Ansible Roles-Based Kubernetes Setup

This directory contains a refactored Ansible setup using roles for deploying a Kubernetes cluster.

## Structure

```
ansible_roles/
├── roles/
│   ├── common-node/              # Common setup for all nodes
│   │   ├── tasks/
│   │   │   └── main.yml         # Installs containerd, kernel setup, kubelet & kubectl
│   │   ├── defaults/
│   │   │   └── main.yml
│   │   └── handlers/
│   ├── kubernetes-master/        # Master-specific setup (includes kubeadm)
│   │   ├── tasks/
│   │   │   └── main.yml         # Installs kubeadm, initializes cluster
│   │   ├── defaults/
│   │   │   └── main.yml
│   │   └── handlers/
│   ├── kubernetes-worker/        # Worker node joining
│   │   ├── tasks/
│   │   │   └── main.yml         # Joins worker to cluster
│   │   └── defaults/
│   │       └── main.yml
│   └── cni-flannel/              # Flannel CNI plugin setup
│       ├── tasks/
│       │   └── main.yml
│       └── defaults/
│           └── main.yml
├── inventory/
│   └── hosts.ini                # Inventory file
├── ansible.cfg                  # Ansible configuration
├── site.yml                     # Common node setup playbook
├── master.yml                   # Master initialization playbook
├── workers.yml                  # Worker joining playbook
└── README.md                    # This file
```

## Key Differences from Original Setup

### kubeadm Installation
- **Original**: kubeadm installed on ALL nodes (master + workers)
- **New**: kubeadm installed ONLY on the master node
  - Workers get only `kubelet` and `kubectl`
  - Master uses `kubeadm init` to initialize the cluster
  - Master generates the join command for workers

### Role-Based Organization
- **common-node**: Shared setup (swap, kernel modules, containerd, kubelet, kubectl)
- **kubernetes-master**: Master-specific (kubeadm installation, cluster init, join command generation)
- **kubernetes-worker**: Worker-specific (joining cluster using the generated join command)
- **cni-flannel**: CNI plugin installation

## Usage

### Prerequisites
- Vagrant with VirtualBox
- Ansible installed on the host machine
- SSH key for vagrant user

### Execution Order

1. **Setup all common prerequisites** (all nodes):
   ```bash
   ansible-playbook -i inventory/hosts.ini site.yml
   ```

2. **Initialize master node**:
   ```bash
   ansible-playbook -i inventory/hosts.ini master.yml
   ```

3. **Join worker nodes**:
   ```bash
   ansible-playbook -i inventory/hosts.ini workers.yml
   ```

### Or Run Everything at Once
```bash
ansible-playbook -i inventory/hosts.ini setup-all.yml
```

## Role Details

### common-node
Runs on all nodes (k8s_cluster group):
- Disables swap
- Loads kernel modules (overlay, br_netfilter)
- Configures sysctl
- Sets up containerd runtime
- Installs kubelet and kubectl
- **Does NOT install kubeadm**

Variables:
- `k8s_version`: Kubernetes version (default: 1.28)
- `containerd_version`: Containerd version (default: latest)

### kubernetes-master
Runs on master node:
- Installs kubeadm
- Initializes cluster with `kubeadm init`
- Sets up kubeconfig for vagrant and root users
- Generates and stores join command for worker nodes

Variables:
- `master_ip`: Master node IP (default: 192.168.57.10)
- `pod_cidr`: Pod CIDR range (default: 10.244.0.0/16)
- `k8s_version`: Kubernetes version (default: 1.28)

### kubernetes-worker
Runs on worker nodes:
- Retrieves join command from master host variables
- Executes `kubeadm join` command
- Waits for kubelet configuration to be created

### cni-flannel
Runs on master node:
- Deploys Flannel CNI plugin
- Waits for DaemonSet to be ready

## Benefits of This Approach

1. **Cleaner separation of concerns** - Each role has a single responsibility
2. **Reusability** - Roles can be used in other playbooks or projects
3. **Easier maintenance** - Changes to specific components are isolated
4. **Better scalability** - Easy to add new roles or extend existing ones
5. **Security** - kubeadm only on master, reducing attack surface on workers
6. **Modularity** - Can run individual playbooks for specific setup phases

## Troubleshooting

### Check role execution
```bash
ansible-playbook -i inventory/hosts.ini site.yml -v
```

### Run specific role only
```bash
ansible-playbook -i inventory/hosts.ini site.yml --tags "common-node"
```

### Test connectivity
```bash
ansible all -i inventory/hosts.ini -m ping
```

## Files Changed/Removed from Original

### Removed from ansible/playbooks/:
- kubelet and kubeadm no longer installed together on all nodes
- All components now organized as roles

### New Structure:
- Roles-based organization under `roles/` directory
- Each role is self-contained with its own tasks, handlers, and defaults
