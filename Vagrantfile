NUM_WORKER_NODES = 2
IP_NW = "10.0.2."
MASTER_IP_START = 10
NODE_IP_START = 20
TOOLS_IP = 30
NAT_NETWORK_NAME = "k8s-natnetwork"

Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/jammy64"
  config.vm.box_check_update = false

  # Create NAT Network if it doesn't exist
  config.trigger.before :up do |trigger|
    trigger.info = "Creating VirtualBox NAT Network..."
    trigger.run = {inline: "bash -c 'VBoxManage natnetwork add --netname #{NAT_NETWORK_NAME} --network \"10.0.2.0/24\" --enable --dhcp off 2>/dev/null || true'"}
  end

  # Master Node
  config.vm.define "master" do |master|
    master.vm.hostname = "master"
    master.vm.network "forwarded_port", guest: 6443, host: 6443, host_ip: "127.0.0.1"
    # Hello World app NodePort forwarding
    master.vm.network "forwarded_port", guest: 30081, host: 30081, host_ip: "127.0.0.1"
    # Fullstack app NodePort forwarding
    master.vm.network "forwarded_port", guest: 30082, host: 9082, host_ip: "127.0.0.1"
    
    master.vm.provider "virtualbox" do |vb|
      vb.memory = 2048
      vb.cpus = 2
      vb.name = "k8s-master"
      # NIC1 stays as default NAT for Vagrant SSH
      # Add NIC2 for NAT Network (cluster communication)
      vb.customize ["modifyvm", :id, "--nic2", "natnetwork"]
      vb.customize ["modifyvm", :id, "--nat-network2", NAT_NETWORK_NAME]
      vb.customize ["modifyvm", :id, "--cableconnected2", "on"]
    end
    
    # Configure static IP on second interface (enp0s8)
    master.vm.provision "shell", run: "always", inline: <<-SHELL
      # Fix permissions for Vagrant's netplan file
      chmod 600 /etc/netplan/50-vagrant.yaml 2>/dev/null || true
      
      # Configure enp0s8 (second NIC) with static IP
      cat > /etc/netplan/60-k8s.yaml <<EOF
network:
  version: 2
  ethernets:
    enp0s8:
      dhcp4: no
      addresses: [#{IP_NW}#{MASTER_IP_START}/24]
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4]
EOF
      chmod 600 /etc/netplan/60-k8s.yaml
      netplan apply 2>&1 | grep -v "ovsdb-server" || true
    SHELL
  end

  # Worker Nodes
  (1..NUM_WORKER_NODES).each do |i|
    config.vm.define "node#{i}" do |node|
      node.vm.hostname = "node#{i}"
      
      if i == 1
        (30000..30010).each do |port|
          node.vm.network "forwarded_port", guest: port, host: port
        end
      end

      if i == 2
        # Jenkins NodePort forwarding (Jenkins pod runs on node2)
        node.vm.network "forwarded_port", guest: 30080, host: 30080, host_ip: "127.0.0.1"
      end

      node.vm.provider "virtualbox" do |vb|
        vb.memory = 2048
        vb.cpus = 1
        vb.name = "k8s-node#{i}"
        # NIC1 stays as default NAT for Vagrant SSH
        # Add NIC2 for NAT Network
        vb.customize ["modifyvm", :id, "--nic2", "natnetwork"]
        vb.customize ["modifyvm", :id, "--nat-network2", NAT_NETWORK_NAME]
        vb.customize ["modifyvm", :id, "--cableconnected2", "on"]
      end
      
      # Configure static IP on second interface (enp0s8)
      node.vm.provision "shell", run: "always", inline: <<-SHELL
        # Fix permissions for Vagrant's netplan file
        chmod 600 /etc/netplan/50-vagrant.yaml 2>/dev/null || true
        
        cat > /etc/netplan/60-k8s.yaml <<EOF
network:
  version: 2
  ethernets:
    enp0s8:
      dhcp4: no
      addresses: [#{IP_NW}#{NODE_IP_START + i}/24]
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4]
EOF
        chmod 600 /etc/netplan/60-k8s.yaml
        netplan apply 2>&1 | grep -v "ovsdb-server" || true
      SHELL
    end
  end

  # Tools VM
  config.vm.define "tools" do |tools|
    tools.vm.hostname = "tools"
    # Gitea port forwarding
    tools.vm.network "forwarded_port", guest: 3000, host: 3000, host_ip: "127.0.0.1"
    # Nexus web UI port forwarding
    tools.vm.network "forwarded_port", guest: 8081, host: 8081, host_ip: "127.0.0.1"
    # Nexus Docker registry port forwarding
    tools.vm.network "forwarded_port", guest: 8082, host: 8082, host_ip: "127.0.0.1"
    
    tools.vm.provider "virtualbox" do |vb|
      vb.memory = 2024
      vb.cpus = 1
      vb.name = "k8s-tools"
      # NIC1 stays as default NAT for Vagrant SSH
      # Add NIC2 for NAT Network
      vb.customize ["modifyvm", :id, "--nic2", "natnetwork"]
      vb.customize ["modifyvm", :id, "--nat-network2", NAT_NETWORK_NAME]
      vb.customize ["modifyvm", :id, "--cableconnected2", "on"]
    end
    
    # Configure static IP on second interface (enp0s8)
    tools.vm.provision "shell", run: "always", inline: <<-SHELL
      # Fix permissions for Vagrant's netplan file
      chmod 600 /etc/netplan/50-vagrant.yaml 2>/dev/null || true
      
      cat > /etc/netplan/60-k8s.yaml <<EOF
network:
  version: 2
  ethernets:
    enp0s8:
      dhcp4: no
      addresses: [#{IP_NW}#{TOOLS_IP}/24]
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4]
EOF
      chmod 600 /etc/netplan/60-k8s.yaml
      netplan apply 2>&1 | grep -v "ovsdb-server" || true
    SHELL

    # Ansible provisioner runs only after all VMs are up
    tools.vm.provision "ansible" do |ansible|
      ansible.playbook = "ansible/playbooks/site.yml"
      ansible.inventory_path = "ansible/inventory/hosts.ini"
      ansible.limit = "all"
      ansible.verbose = "v"
      ansible.config_file = "ansible/ansible.cfg"
    end
  end
end
