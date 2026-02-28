# Kubernetes Cluster with Vagrant & Ansible

Automated Kubernetes cluster deployment using Vagrant and Ansible. Creates a production-like 3-node cluster on your local machine in minutes.

## 🚀 Quick Start

```bash
# Clone the repository
git clone git@github.com:chameauu/K8S-IaC.git
cd K8S-IaC

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
- [Ansible](https://www.ansible.com/) 2.12+ (installed on host machine)
- 7GB+ RAM available (2GB master + 2GB node1 + 2GB node2 + 1GB tools)
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
│  │  │ 1 CPU        │                                  │ │
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
- ✅ Separate management VM
- ✅ Idempotent Ansible playbooks
- ✅ Port forwarding for API access
- ✅ Ready for development and testing

## 📦 What Gets Installed

### On All Cluster Nodes (Master + Workers)
- Ubuntu 22.04 LTS (Jammy)
- containerd (container runtime)
- kubelet, kubeadm, kubectl (v1.28)
- Required kernel modules (overlay, br_netfilter) and sysctl settings

### On Master Node
- Kubernetes control plane (initialized with kubeadm)
- API server (accessible on port 6443, forwarded to host)
- Scheduler
- Controller manager
- etcd
- Flannel CNI (installed on master)

### On Tools VM
- kubectl (v1.28)
- Cluster admin kubeconfig (copied from master)
- Useful utilities (curl, wget, vim, git, net-tools, dnsutils, iputils-ping)

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

Then run:

```bash
vagrant up
```

Note: You'll also need to update `ansible/inventory/hosts.ini` to add the new worker node:

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

Edit `ansible/playbooks/master.yml` and replace the Flannel installation task:

```yaml
# Replace this task:
- name: Install Flannel CNI
  become_user: vagrant
  command: kubectl apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml

# With Calico:
- name: Install Calico CNI
  become_user: vagrant
  command: kubectl apply -f https://docs.projectcalico.org/manifests/calico.yaml
  environment:
    KUBECONFIG: /home/vagrant/.kube/config
```

Note: If using Calico, you may need to adjust the pod CIDR in the kubeadm init command (default is 10.244.0.0/16 for Flannel).

## 📁 Project Structure

```
.
├── Vagrantfile                    # VM definitions
└── ansible/
    ├── ansible.cfg                # Ansible configuration
    ├── inventory/
    │   └── hosts.ini              # Host inventory
    └── playbooks/
        ├── site.yml               # Main playbook
        ├── common.yml             # Node preparation
        ├── master.yml             # Master initialization
        ├── workers.yml            # Worker join
        └── tools.yml              # Tools VM setup
```

## 🔍 How It Works

1. **Vagrant** creates 4 VMs with private networking (192.168.57.0/24)
2. **Ansible** automatically provisions them (triggered after all VMs are up):
   - `common.yml`: Prepares all cluster nodes (disables swap, loads kernel modules, installs containerd + Kubernetes packages)
   - `master.yml`: Initializes master node with kubeadm, installs Flannel CNI, generates join command
   - `workers.yml`: Joins worker nodes to the cluster using the join command from master
   - `tools.yml`: Sets up tools VM with kubectl and copies kubeconfig from master

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

- 🐛 [Issues](https://github.com/chameauu/K8S-IaC/issues)
- 💬 [Discussions](https://github.com/chameauu/K8S-IaC/discussions)

---

**Built with ❤️ for learning Kubernetes**
