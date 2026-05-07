# NGINX Ingress Controller Role

This Ansible role deploys the NGINX Ingress Controller to a Kubernetes cluster using Helm.

## Purpose

The NGINX Ingress Controller provides HTTP/HTTPS routing to Kubernetes services based on domain names and paths, replacing the need for multiple NodePort services.

## What It Does

1. Adds the NGINX Ingress Helm repository
2. Creates the `ingress-nginx` namespace
3. Deploys the NGINX Ingress Controller via Helm
4. Configures the controller as a NodePort service
5. Waits for the deployment to be ready

## Requirements

- Kubernetes cluster running
- Helm installed on the target host
- kubectl configured with cluster access

## Variables

Defined in `defaults/main.yml`:

| Variable | Default | Description |
|----------|---------|-------------|
| `nginx_ingress_namespace` | `ingress-nginx` | Kubernetes namespace for Ingress Controller |
| `nginx_ingress_release_name` | `ingress-nginx` | Helm release name |
| `nginx_ingress_chart_name` | `ingress-nginx/ingress-nginx` | Helm chart name |
| `nginx_ingress_service_type` | `NodePort` | Service type (NodePort or LoadBalancer) |
| `nginx_ingress_http_port` | `30080` | NodePort for HTTP traffic |
| `nginx_ingress_https_port` | `30443` | NodePort for HTTPS traffic |
| `nginx_ingress_replicas` | `1` | Number of controller replicas |
| `nginx_ingress_cpu_request` | `100m` | CPU request |
| `nginx_ingress_memory_request` | `128Mi` | Memory request |
| `nginx_ingress_cpu_limit` | `200m` | CPU limit |
| `nginx_ingress_memory_limit` | `256Mi` | Memory limit |

## Usage

### Deploy via site.yml

```bash
ansible-playbook -i ansible/inventory/hosts.ini \
  ansible/playbooks/site.yml \
  --vault-password-file ~/.ansible_vault_pass \
  --tags ingress
```

### Deploy standalone

```bash
ansible-playbook -i ansible/inventory/hosts.ini \
  -e "target_hosts=tools" \
  --vault-password-file ~/.ansible_vault_pass \
  -e "ansible_roles=['nginx-ingress']"
```

## After Deployment

### Verify Installation

```bash
# Check pods
kubectl get pods -n ingress-nginx

# Check service
kubectl get svc -n ingress-nginx

# Check IngressClass
kubectl get ingressclass
```

### Expected Output

```
NAME                                       READY   STATUS    RESTARTS   AGE
ingress-nginx-controller-xxxxxxxxx-xxxxx   1/1     Running   0          2m
```

### Access

The Ingress Controller is exposed via NodePort:
- HTTP: Port 30080
- HTTPS: Port 30443

## Next Steps

After deploying the Ingress Controller:

1. **Create Ingress Resources**: Define Ingress resources for your services (Jenkins, Grafana, Prometheus)
2. **Update /etc/hosts**: Add domain name mappings on your host machine
3. **Test Access**: Access services via domain names

Example Ingress resource:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: jenkins-ingress
  namespace: jenkins
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "false"
spec:
  ingressClassName: nginx
  rules:
  - host: jenkins.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: jenkins
            port:
              number: 8080
```

## Troubleshooting

### Controller Not Starting

```bash
# Check logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller

# Check events
kubectl get events -n ingress-nginx --sort-by='.lastTimestamp'
```

### Service Not Accessible

```bash
# Check service endpoints
kubectl get endpoints -n ingress-nginx

# Check node ports
kubectl get svc -n ingress-nginx -o yaml
```

### Ingress Not Working

```bash
# Check Ingress resources
kubectl get ingress -A

# Describe specific Ingress
kubectl describe ingress <ingress-name> -n <namespace>

# Check controller logs for routing issues
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller | grep <host-name>
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Host Machine                          │
│                                                              │
│  Browser → http://jenkins.local:30080                       │
│            http://grafana.local:30080                        │
│            http://prometheus.local:30080                     │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           │ Port 30080 (NodePort)
                           │
┌──────────────────────────▼───────────────────────────────────┐
│                   Kubernetes Cluster                         │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         NGINX Ingress Controller                       │ │
│  │         (ingress-nginx namespace)                      │ │
│  │                                                        │ │
│  │  Routes based on Host header:                         │ │
│  │  - jenkins.local → jenkins service                    │ │
│  │  - grafana.local → grafana service                    │ │
│  │  - prometheus.local → prometheus service              │ │
│  └────────────────────────────────────────────────────────┘ │
│                           │                                  │
│         ┌─────────────────┼─────────────────┐               │
│         │                 │                 │               │
│         ▼                 ▼                 ▼               │
│  ┌──────────┐      ┌──────────┐     ┌──────────┐          │
│  │ Jenkins  │      │ Grafana  │     │Prometheus│          │
│  │ Service  │      │ Service  │     │ Service  │          │
│  │ :8080    │      │ :80      │     │ :9090    │          │
│  └──────────┘      └──────────┘     └──────────┘          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## References

- [NGINX Ingress Controller Documentation](https://kubernetes.github.io/ingress-nginx/)
- [Kubernetes Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)
- [Helm Chart Values](https://github.com/kubernetes/ingress-nginx/tree/main/charts/ingress-nginx)

## Tags

- `ingress`: Deploy Ingress Controller
- `nginx-ingress`: Specific to NGINX Ingress

## Dependencies

- kubectl role (for cluster access)
- helm role (for Helm installation)
- Kubernetes cluster must be running

## Notes

- Uses NodePort for simplicity in development environments
- For production, consider using LoadBalancer service type
- Resource limits are set conservatively for resource-constrained environments
- Single replica is sufficient for development/testing
