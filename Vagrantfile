NUM_WORKER_NODES = 2
IP_NW = "192.168.57."
MASTER_IP_START = 10
NODE_IP_START = 20
TOOLS_IP = 30

Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/jammy64"
  config.vm.box_check_update = false

  # Master Node
  config.vm.define "master" do |master|
    master.vm.hostname = "master"
    master.vm.network "private_network", ip: IP_NW + "#{MASTER_IP_START}"
    master.vm.network "forwarded_port", guest: 6443, host: 6443, host_ip: "127.0.0.1"
    
    master.vm.provider "virtualbox" do |vb|
      vb.memory = 2048
      vb.cpus = 2
      vb.name = "k8s-master"
    end
  end

  # Worker Nodes
  (1..NUM_WORKER_NODES).each do |i|
    config.vm.define "node#{i}" do |node|
      node.vm.hostname = "node#{i}"
      node.vm.network "private_network", ip: IP_NW + "#{NODE_IP_START + i}"
      # Forward NodePort range (30000-32767) - useful for testing
      # Uncomment the line below to forward a specific port
      # node.vm.network "forwarded_port", guest: 32390, host: 32390, host_ip: "127.0.0.1"
      
      node.vm.provider "virtualbox" do |vb|
        vb.memory = 2048
        vb.cpus = 1
        vb.name = "k8s-node#{i}"
      end
    end
  end

  # Tools VM
  config.vm.define "tools" do |tools|
    tools.vm.hostname = "tools"
    tools.vm.network "private_network", ip: IP_NW + "#{TOOLS_IP}"
    
    tools.vm.provider "virtualbox" do |vb|
      vb.memory = 1024
      vb.cpus = 1
      vb.name = "k8s-tools"
    end

    # Ansible provisioner runs only after all VMs are up
    tools.vm.provision "ansible" do |ansible|
      ansible.playbook = "ansible/playbooks/site.yml"
      ansible.inventory_path = "ansible/inventory/hosts.ini"
      ansible.limit = "all"
      ansible.verbose = "v"
    end
  end
end
