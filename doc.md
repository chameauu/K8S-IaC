## encrypt ansible
ansible-vault encrypt inventory/group_vars/vault.yaml --vault-password-file ~/.ansible_vault_pass

## disable
import hudson.plugins.git.GitStatus

// Check current value
println "Current: ${GitStatus.NOTIFY_COMMIT_ACCESS_CONTROL}"

// Set to disabled (plain String assignment)
GitStatus.NOTIFY_COMMIT_ACCESS_CONTROL = 'disabled'

// Verify
println "Updated: ${GitStatus.NOTIFY_COMMIT_ACCESS_CONTROL}"

## delete
kubectl delete pod jenkins-0 -n jenkins --force --grace-period=0
