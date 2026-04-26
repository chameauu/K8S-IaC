# Vault Ansible Role

This role automates the complete setup of HashiCorp Vault with Vault Secrets Operator (VSO) on Kubernetes.

## What It Does

1. **NFS Storage Setup**
   - Creates NFS directories for 3 Vault replicas
   - Configures NFS exports
   - Creates Kubernetes PersistentVolumes

2. **Vault Installation**
   - Installs Vault via Helm
   - Configures 3-node HA cluster with Raft storage
   - Enables Vault UI on NodePort

3. **Vault Initialization**
   - Initializes Vault with Shamir secret sharing
   - Unseals all 3 Vault pods
   - Joins followers to Raft cluster
   - Saves unseal keys and root token

4. **Vault Configuration**
   - Enables KV v2 secrets engine
   - Stores application secrets
   - Verifies secret storage

5. **Kubernetes Authentication**
   - Enables Kubernetes auth method
   - Configures Vault to validate K8s tokens
   - Creates Vault policies
   - Creates Kubernetes auth roles

6. **Vault Secrets Operator**
   - Installs VSO via Helm
   - Creates VaultConnection resource
   - Creates VaultAuth resource
   - Waits for authentication to be ready

7. **VaultStaticSecrets**
   - Creates VaultStaticSecret resources
   - Transforms secrets to required formats
   - Syncs to Kubernetes Secrets
   - Verifies synchronization

## Requirements

- Kubernetes cluster running
- NFS server (tools VM)
- Helm installed on tools VM
- kubectl configured on master node

## Role Variables

### Vault Configuration

```yaml
vault_version: "1.21.2"
vault_replicas: 3
vault_storage_size: "500Mi"
vault_ui_nodeport: 30820
vault_namespace: "vault"
```

### NFS Configuration

```yaml
vault_nfs_server: "10.0.2.30"
vault_nfs_base_path: "/data/nfs/vault"
vault_nfs_uid: 200
vault_nfs_gid: 200
```

### Initialization

```yaml
vault_key_shares: 5
vault_key_threshold: 3
vault_init_file: "/vagrant/vault-init.json"
```

### VSO Configuration

```yaml
vso_enabled: true
vso_version: "1.3.0"
vso_namespace: "vault-secrets-operator-system"
```

### Secrets to Store

```yaml
vault_secrets:
  - path: "secret/nexus/docker-registry"
    data:
      username: "admin"
      password: "Azertyqwerty1234."
      server: "10.0.2.30:8082"
```

### Policies

```yaml
vault_policies:
  - name: "jenkins-policy"
    policy: |
      path "secret/data/nexus/docker-registry" {
        capabilities = ["read"]
      }
```

### Auth Roles

```yaml
vault_k8s_auth_roles:
  - name: "jenkins"
    bound_service_account_names: "default"
    bound_service_account_namespaces: "jenkins"
    policies: "jenkins-policy"
    ttl: "24h"
```

### VaultStaticSecrets

```yaml
vault_static_secrets:
  - name: "nexus-registry-secret-vault"
    namespace: "jenkins"
    vault_path: "nexus/docker-registry"
    secret_type: "kubernetes.io/dockerconfigjson"
    refresh_after: "10m"
    transformation_template: |
      {
        "auths": {
          "{{ .Secrets.server }}": {
            "username": "{{ .Secrets.username }}",
            "password": "{{ .Secrets.password }}",
            "auth": "{{ printf "%s:%s" .Secrets.username .Secrets.password | b64enc }}"
          }
        }
      }
```

## Usage

### Run Complete Setup

```bash
ansible-playbook ansible/playbooks/setup-vault.yml
```

### Run Specific Tags

```bash
# Only NFS setup
ansible-playbook ansible/playbooks/setup-vault.yml --tags vault-nfs

# Only Vault installation
ansible-playbook ansible/playbooks/setup-vault.yml --tags vault-install

# Only initialization
ansible-playbook ansible/playbooks/setup-vault.yml --tags vault-init

# Only configuration
ansible-playbook ansible/playbooks/setup-vault.yml --tags vault-config

# Only Kubernetes auth
ansible-playbook ansible/playbooks/setup-vault.yml --tags vault-k8s-auth

# Only VSO
ansible-playbook ansible/playbooks/setup-vault.yml --tags vault-vso

# Only VaultStaticSecrets
ansible-playbook ansible/playbooks/setup-vault.yml --tags vault-static-secrets
```

### Skip Specific Parts

```bash
# Skip VSO installation
ansible-playbook ansible/playbooks/setup-vault.yml --skip-tags vault-vso,vault-static-secrets
```

## Files Created

### On Tools VM

- `/data/nfs/vault/vault-{0,1,2}/` - NFS directories for Vault storage
- `/etc/exports` - Updated with Vault NFS export
- `/tmp/vault-values.yaml` - Helm values file
- `/tmp/*.hcl` - Vault policy files

### On Local Machine

- `vault-init.json` - Vault unseal keys and root token (⚠️ Keep secure!)

### In Kubernetes

**Namespace: vault**
- StatefulSet: `vault` (3 replicas)
- Services: `vault`, `vault-ui`, `vault-internal`, `vault-active`, `vault-standby`
- PersistentVolumes: `vault-0-pv`, `vault-1-pv`, `vault-2-pv`

**Namespace: vault-secrets-operator-system**
- Deployment: `vault-secrets-operator-controller-manager`

**Namespace: jenkins**
- VaultConnection: `vault-connection`
- VaultAuth: `vault-auth`
- VaultStaticSecret: `nexus-registry-secret-vault`
- Secret: `nexus-registry-secret-vault` (synced from Vault)

## Verification

### Check Vault Status

```bash
kubectl get pods -n vault
kubectl exec -n vault vault-0 -- vault status
kubectl exec -n vault vault-0 -- vault operator raft list-peers
```

### Check VSO Status

```bash
kubectl get pods -n vault-secrets-operator-system
kubectl get vaultconnection -n jenkins
kubectl get vaultauth -n jenkins
kubectl get vaultstaticsecret -n jenkins
```

### Check Secrets

```bash
# Check Vault secret
kubectl exec -n vault vault-0 -- vault kv get secret/nexus/docker-registry

# Check Kubernetes secret
kubectl get secret nexus-registry-secret-vault -n jenkins
kubectl get secret nexus-registry-secret-vault -n jenkins -o jsonpath='{.data.\.dockerconfigjson}' | base64 -d
```

## Troubleshooting

### Vault Pods Not Starting

Check PV binding:
```bash
kubectl get pv | grep vault
kubectl get pvc -n vault
```

Check NFS exports:
```bash
vagrant ssh tools
sudo exportfs -v | grep vault
```

### Vault Sealed After Restart

Unseal manually:
```bash
# Get unseal keys from vault-init.json
KEY1=$(cat vault-init.json | jq -r '.unseal_keys_b64[0]')
KEY2=$(cat vault-init.json | jq -r '.unseal_keys_b64[1]')
KEY3=$(cat vault-init.json | jq -r '.unseal_keys_b64[2]')

# Unseal all pods
for pod in vault-0 vault-1 vault-2; do
  kubectl exec -n vault $pod -- vault operator unseal $KEY1
  kubectl exec -n vault $pod -- vault operator unseal $KEY2
  kubectl exec -n vault $pod -- vault operator unseal $KEY3
done
```

### VaultAuth Not Healthy

Check VaultConnection:
```bash
kubectl get vaultconnection -n jenkins
kubectl describe vaultauth vault-auth -n jenkins
```

Check Vault role:
```bash
kubectl exec -n vault vault-0 -- vault read auth/kubernetes/role/jenkins
```

### VaultStaticSecret Not Syncing

Check VaultAuth status:
```bash
kubectl get vaultauth -n jenkins
```

Check secret exists in Vault:
```bash
kubectl exec -n vault vault-0 -- vault kv get secret/nexus/docker-registry
```

Check VSO logs:
```bash
kubectl logs -n vault-secrets-operator-system deployment/vault-secrets-operator-controller-manager -c manager
```

## Security Notes

### Production Recommendations

1. **Enable TLS** for Vault communication
2. **Implement auto-unseal** with cloud KMS
3. **Revoke root token** after initial setup
4. **Enable audit logging**
5. **Use separate policies** per application
6. **Rotate unseal keys** periodically
7. **Implement backup strategy** for Raft snapshots
8. **Monitor Vault health** and seal status

### Protecting vault-init.json

The `vault-init.json` file contains:
- Root token (full admin access)
- 5 unseal keys (3 needed to unseal)

**Best practices**:
- Store in secure location (password manager, vault)
- Encrypt the file
- Distribute unseal keys to different people
- Delete from disk after securing
- Never commit to git

## Dependencies

This role depends on:
- `nfs-server` role (for NFS setup)
- `kubectl` role (for K8s access)
- `helm` role (for Helm charts)

## License

MIT

## Author

Created for Kubernetes CI/CD pipeline automation
