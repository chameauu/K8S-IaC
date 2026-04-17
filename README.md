# Kubernetes Cluster with Vagrant & Ansible

Automated Kubernetes cluster deployment using Vagrant and Ansible. Creates a production-like 3-node cluster on your local machine in minutes.

## 🚀 Quick Start

```bash
# Clone the repository
git clone <your-repo-url>
cd <repo-name>

# Start the cluster
vagrant up

# Access the cluster
vagrant ssh tools
kubectl get nodes
```

That's it! You now have a fully functional Kubernetes cluster.

## 📋 Prerequisites

- [VirtualBox](https://www.virtualbox.org/) 6.1+
- [Vagrant](https://www.vagrantup.com/) 2.3+
- [Ansible](https://www.ansible.com/) 2.12+
- 8GB+ RAM available
- 20GB+ free disk space

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Host Machine                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │              Private Network (192.168.57.0/24)     │ │
│  │                                                     │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐│ │
│  │  │   Master     │  │   Worker 1   │  │ Worker 2 ││ │
│  │  │ .57.10       │  │ .57.21       │  │ .57.22   ││ │
│  │  │ 2GB RAM      │  │ 2GB RAM      │  │ 2GB RAM  ││ │
│  │  │ 2 CPUs       │  │ 1 CPU        │  │ 1 CPU    ││ │
│  │  └──────────────┘  └──────────────┘  └──────────┘│ │
│  │                                                     │ │
│  │  ┌──────────────┐                                  │ │
│  │  │   Tools VM   │  (Management - NOT in cluster)  │ │
│  │  │ .57.30       │                                  │ │
│  │  │ 1GB RAM      │                                  │ │
│  │  └──────────────┘                                  │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Cluster Nodes:** 3 (1 master + 2 workers)  
**Management VM:** 1 (tools - for kubectl access)  
**Total VMs:** 4

## ✨ Features

- ✅ Fully automated deployment
- ✅ Kubernetes 1.28
- ✅ Flannel CNI for networking
- ✅ containerd runtime
- ✅ Separate management VM with kubectl, Helm, Docker
- ✅ Jenkins on Kubernetes (automated deployment)
- ✅ Idempotent Ansible playbooks
- ✅ Port forwarding for API access
- ✅ Ready for development and testing
- ✅ Infrastructure as Code approach

## 📦 What Gets Installed

### On All Cluster Nodes (Master + Workers)
- Ubuntu 22.04 LTS
- containerd (container runtime)
- kubelet, kubeadm, kubectl
- Flannel CNI
- Required kernel modules and sysctl settings

### On Master Node
- Kubernetes control plane
- API server (accessible on port 6443)
- Scheduler
- Controller manager
- etcd

### On Tools VM
- kubectl configured with cluster access
- Helm 4.x (Kubernetes package manager)
- Docker (for Nexus and other containers)
- Jenkins on Kubernetes (optional)
- Cluster admin kubeconfig
- Useful utilities (curl, vim, git, etc.)

## 🎯 Usage

### Start the Cluster

```bash
vagrant up
```

First run takes 10-15 minutes (downloads Ubuntu image and installs everything).

### Access the Cluster

```bash
# SSH to tools VM
vagrant ssh tools

# Check cluster status
kubectl get nodes
kubectl get pods -A
```

### Deploy an Application

```bash
vagrant ssh tools

# Create a deployment
kubectl create deployment nginx --image=nginx --replicas=3

# Expose it
kubectl expose deployment nginx --port=80 --type=NodePort

# Get the NodePort
kubectl get svc nginx
```

### Deploy Jenkins on Kubernetes

```bash
# Automated deployment with Ansible
ansible-playbook ansible/playbooks/jenkins.yml

# Access Jenkins at: http://10.0.2.10:30080
# Username: admin
# Password: See docs/ANSIBLE_JENKINS_DEPLOYMENT.md
```

See [docs/ANSIBLE_JENKINS_DEPLOYMENT.md](docs/ANSIBLE_JENKINS_DEPLOYMENT.md) for complete Jenkins setup guide.

### Access from Host Machine

```bash
# Copy kubeconfig
vagrant ssh tools -c "cat /home/vagrant/.kube/config" > ~/.kube/k8s-config

# Update server address
sed -i 's|https://192.168.57.10:6443|https://127.0.0.1:6443|g' ~/.kube/k8s-config

# Use it
export KUBECONFIG=~/.kube/k8s-config
kubectl get nodes
```

### Stop the Cluster

```bash
vagrant halt
```

### Destroy the Cluster

```bash
vagrant destroy -f
```

## 🔧 Configuration

### Change Number of Workers

Edit `Vagrantfile`:

```ruby
NUM_WORKER_NODES = 3  # Change from 2 to 3
```

Update `ansible/inventory/hosts.ini`:

```ini
[workers]
node1 ansible_host=192.168.57.21 ansible_ssh_private_key_file=.vagrant/machines/node1/virtualbox/private_key
node2 ansible_host=192.168.57.22 ansible_ssh_private_key_file=.vagrant/machines/node2/virtualbox/private_key
node3 ansible_host=192.168.57.23 ansible_ssh_private_key_file=.vagrant/machines/node3/virtualbox/private_key
```

### Change VM Resources

Edit `Vagrantfile`:

```ruby
vb.memory = 4096  # Increase RAM
vb.cpus = 4       # Increase CPUs
```

### Change Kubernetes Version

Edit `ansible/playbooks/common.yml` and `ansible/playbooks/tools.yml`:

```yaml
# Change from v1.28 to v1.29
https://pkgs.k8s.io/core:/stable:/v1.29/deb/
```

### Use Different CNI

Edit `ansible/playbooks/master.yml`:

```yaml
# Replace Flannel with Calico
- name: Install Calico CNI
  command: kubectl apply -f https://docs.projectcalico.org/manifests/calico.yaml
```

## 📁 Project Structure

```
.
├── Vagrantfile                    # VM definitions
├── k8s/
│   └── jenkins-simple.yaml        # Jenkins Kubernetes manifest
├── ansible/
│   ├── ansible.cfg                # Ansible configuration
│   ├── inventory/
│   │   └── hosts.ini              # Host inventory
│   ├── playbooks/
│   │   ├── site.yml               # Main playbook (all-in-one)
│   │   ├── common.yml             # Node preparation
│   │   ├── master.yml             # Master initialization
│   │   ├── workers.yml            # Worker join
│   │   ├── tools.yml              # Tools VM setup
│   │   └── jenkins.yml            # Jenkins deployment
│   └── roles/
│       ├── helm/                  # Helm installation
│       └── jenkins-k8s/           # Jenkins deployment
└── docs/
    ├── ANSIBLE_JENKINS_DEPLOYMENT.md  # Jenkins automation guide
    ├── JENKINS_SIMPLE_DEPLOYMENT.md   # Manual Jenkins guide
    └── ...
```

## 🔍 How It Works

1. **Vagrant** creates 4 VMs with networking
2. **Ansible** automatically provisions them:
   - Prepares all nodes (swap, kernel modules, containerd)
   - Initializes master node with kubeadm
   - Installs Flannel CNI
   - Joins worker nodes to cluster
   - Sets up tools VM with kubectl, Helm, Docker
   - Optionally deploys Jenkins on Kubernetes

See [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) for detailed explanation.

## 🧪 Testing

```bash
# SSH to tools VM
vagrant ssh tools

# Run tests
kubectl get nodes                    # All nodes should be Ready
kubectl get pods -A                  # All pods should be Running

# Deploy test app
kubectl create deployment test --image=nginx
kubectl get pods

# Clean up
kubectl delete deployment test
```

See [docs/TESTING.md](docs/TESTING.md) for comprehensive testing guide.

## 🐛 Troubleshooting

### VMs won't start

```bash
# Check VirtualBox
VBoxManage list vms

# Check Vagrant status
vagrant status

# Try with debug
vagrant up --debug
```

### Ansible connection fails

```bash
# Check SSH keys exist
ls -la .vagrant/machines/*/virtualbox/private_key

# Test SSH manually
ssh -i .vagrant/machines/master/virtualbox/private_key vagrant@192.168.57.10
```

### Nodes not Ready

```bash
vagrant ssh master

# Check kubelet
sudo systemctl status kubelet

# Check containerd
sudo systemctl status containerd

# Check Flannel
kubectl get pods -n kube-flannel
```

### Provisioning fails

```bash
# Re-run provisioning
vagrant provision

# Or run Ansible manually
cd ansible
ansible-playbook -i inventory/hosts.ini playbooks/site.yml -v
```

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- [Kubernetes](https://kubernetes.io/)
- [Vagrant](https://www.vagrantup.com/)
- [Ansible](https://www.ansible.com/)
- [Flannel](https://github.com/flannel-io/flannel)

## 📞 Support

- 📖 [Documentation](docs/)
- 🐛 [Issues](https://github.com/yourusername/yourrepo/issues)
- 💬 [Discussions](https://github.com/yourusername/yourrepo/discussions)

## ⭐ Star History

If you find this project useful, please consider giving it a star!

---

**Built with ❤️ for learning Kubernetes**
