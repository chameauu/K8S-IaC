# Prometheus & Grafana Ansible Role

This role deploys the Prometheus and Grafana monitoring stack on a Kubernetes cluster using the kube-prometheus-stack Helm chart.

## Overview

The role automates the deployment of:
- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **Alertmanager**: Alert notifications
- **Node Exporter**: Node metrics
- **Kube-State-Metrics**: Kubernetes API metrics

## Features

- **Pod Annotation-based Discovery**: Automatically discovers and scrapes metrics from pods with Prometheus annotations
- **NFS Persistent Storage**: Uses NFS for Prometheus and Alertmanager data persistence
- **NodePort Services**: Exposes services on fixed ports for external access
- **Vault Integration**: Grafana admin password from Ansible vault

## Requirements

- Kubernetes cluster with NFS storage configured
- Helm 3.x installed on the master node
- Ansible with kubernetes.core collection
- Vault password configured for sensitive data

## Variables

### Default Variables (defaults/main.yml)

```yaml
# Namespace and release configuration
prometheus_namespace: monitoring
prometheus_release_name: prometheus
prometheus_chart_name: prometheus-community/kube-prometheus-stack

# Prometheus configuration
prometheus_retention: 30d
prometheus_storage_size: 50Gi
prometheus_replicas: 1

# Grafana configuration
grafana_admin_user: admin
grafana_admin_password: "{{ vault_grafana_password }}"
grafana_storage_size: 10Gi

# Service ports
prometheus_service_port: 30090
grafana_service_port: 30091
alertmanager_service_port: 30093

# Storage configuration
prometheus_storage_class: nfs
```

### Vault Variables

Add to `ansible/inventory/group_vars/all/vault.yml`:

```yaml
vault_grafana_password: admin123
```

## Usage

### Basic Usage

Add to your playbook:

```yaml
- name: Deploy Prometheus and Grafana
  hosts: master
  roles:
    - prometheus-grafana
```

### With Custom Variables

```yaml
- name: Deploy Prometheus and Grafana
  hosts: master
  vars:
    prometheus_retention: 60d
    prometheus_storage_size: 100Gi
    grafana_service_port: 3000
  roles:
    - prometheus-grafana
```

## Pod Annotations

To enable metric scraping for your applications, add these annotations to pod metadata:

```yaml
metadata:
  annotations:
    prometheus.io/scrape: "true"      # Enable scraping
    prometheus.io/path: "/metrics"    # Metrics endpoint path
    prometheus.io/port: "8080"        # Metrics port
    prometheus.io/scheme: "http"      # Protocol (http or https)
```

### Example: Jenkins

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: jenkins
spec:
  template:
    metadata:
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/path: "/prometheus"
        prometheus.io/port: "8080"
        prometheus.io/scheme: "http"
    spec:
      containers:
      - name: jenkins
        image: jenkins/jenkins:latest
        ports:
        - containerPort: 8080
```

## Access

After deployment, access the services at:

| Service | URL | Credentials |
|---------|-----|-------------|
| Prometheus | http://10.0.2.10:30090 | No auth |
| Grafana | http://10.0.2.10:30091 | admin / (from vault) |
| Alertmanager | http://10.0.2.10:30093 | No auth |

## Verification

### Check Deployment Status

```bash
kubectl get pods -n monitoring
kubectl get svc -n monitoring
```

### Verify Pod Discovery

```bash
# Check if pods are being scraped
kubectl get pods -A -o jsonpath='{range .items[*]}{.metadata.namespace}{"\t"}{.metadata.name}{"\t"}{.metadata.annotations.prometheus\.io/scrape}{"\n"}{end}'
```

### Check Prometheus Targets

1. Open Prometheus UI: http://10.0.2.10:30090
2. Go to "Status" → "Targets"
3. Verify discovered pods are listed

### Check Grafana Dashboards

1. Open Grafana: http://10.0.2.10:30091
2. Login with admin credentials
3. Verify Prometheus data source is connected
4. Check pre-configured dashboards

## Troubleshooting

### Pods not being scraped

1. Verify pod annotations are correct
2. Check Prometheus logs: `kubectl logs -n monitoring prometheus-prometheus-0`
3. Verify metrics endpoint is accessible: `kubectl port-forward -n <namespace> <pod> 8080:8080`

### Grafana not connecting to Prometheus

1. Check Grafana logs: `kubectl logs -n monitoring deployment/prometheus-grafana`
2. Verify Prometheus service DNS: `kubectl exec -n monitoring deployment/prometheus-grafana -- nslookup prometheus-operated`

### Storage issues

1. Verify NFS is mounted: `kubectl get pvc -n monitoring`
2. Check NFS server: `showmount -e <nfs-server>`
3. Verify permissions on NFS exports

## Customization

### Custom Grafana Dashboards

Add dashboard JSON files to `templates/` and import them in the role tasks.

### Custom Alert Rules

Add PrometheusRule resources to configure alerting rules.

### ServiceMonitor Integration

For more advanced monitoring, migrate to ServiceMonitor CRDs:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: my-app
spec:
  selector:
    matchLabels:
      app: my-app
  endpoints:
  - port: metrics
    interval: 30s
```

## References

- [kube-prometheus-stack Helm Chart](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack)
- [Prometheus Pod Annotations](https://prometheus.io/docs/prometheus/latest/configuration/configuration/#kubernetes_sd_config)
- [Grafana Provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/)
- [Alertmanager Configuration](https://prometheus.io/docs/alerting/latest/configuration/)

## License

Same as parent project
