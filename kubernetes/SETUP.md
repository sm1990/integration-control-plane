# ICP Kubernetes Deployment Guide

This guide walks you through deploying the Integration Control Plane (ICP) on a fresh Kubernetes cluster.

## Prerequisites

- Kubernetes cluster (1.25+)
- `kubectl` configured to access your cluster
- Docker image `wso2icp:2.0.0` available in your cluster

## Step 1: Install cert-manager

cert-manager is required for automatic TLS certificate management.

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.0/cert-manager.yaml

# Wait for cert-manager to be ready
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager -n cert-manager
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-webhook -n cert-manager
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-cainjector -n cert-manager
```

## Step 2: Install NGINX Gateway Fabric

NGINX Gateway Fabric provides the Gateway API implementation.

```bash
# Install Gateway API CRDs
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.1.0/standard-install.yaml

# Install NGINX Gateway Fabric
kubectl apply -f https://raw.githubusercontent.com/nginxinc/nginx-gateway-fabric/v2.3.0/deploy/crds.yaml
kubectl apply -f https://raw.githubusercontent.com/nginxinc/nginx-gateway-fabric/v2.3.0/deploy/default/deploy.yaml

# Wait for NGINX Gateway to be ready
kubectl wait --for=condition=available --timeout=300s deployment/nginx-gateway -n nginx-gateway
```

## Step 3: Deploy ICP Application

### 3.1 Deploy the application pod

```bash
kubectl apply -f deployment.yaml
```

### 3.2 Create the service

```bash
kubectl apply -f service.yaml
```

### 3.3 Wait for pod to be ready

```bash
kubectl wait --for=condition=ready --timeout=300s pod -l app=icp
```

## Step 4: Set up TLS Certificates

### 4.1 Create self-signed issuer

```bash
kubectl apply -f issuer.yaml
```

### 4.2 Create certificate for client-facing TLS

```bash
kubectl apply -f cert.yaml
```

### 4.3 Wait for certificate to be ready

```bash
kubectl wait --for=condition=ready --timeout=60s certificate/icp-cert
```

## Step 5: Extract Backend Certificate

The backend uses self-signed certificates, so we need to extract and trust them.

```bash
# Extract the backend certificate
kubectl exec deployment/icp-deployment -- sh -c 'echo | openssl s_client -connect localhost:9445 2>/dev/null | openssl x509 -outform PEM' > /tmp/icp-backend-cert.pem

# Create ConfigMap with the backend CA certificate
kubectl create configmap icp-backend-ca --from-file=ca.crt=/tmp/icp-backend-cert.pem

# Clean up temporary file (optional)
rm /tmp/icp-backend-cert.pem
```

## Step 6: Configure Gateway and Routing

### 6.1 Create the Gateway

```bash
kubectl apply -f gateway.yaml
```

### 6.2 Create the HTTPRoute

```bash
kubectl apply -f route.yaml
```

### 6.3 Create BackendTLSPolicy for secure backend communication

```bash
kubectl apply -f backend-tls-policy.yaml
```

## Step 7: Configure DNS/Hosts

Add `icp.local` to your `/etc/hosts` file pointing to the Gateway's external IP or localhost if using port-forwarding.

### Option A: Using LoadBalancer (if available)

```bash
# Get the Gateway external IP
GATEWAY_IP=$(kubectl get gateway icp-gateway -o jsonpath='{.status.addresses[0].value}')
echo "$GATEWAY_IP icp.local" | sudo tee -a /etc/hosts
```

### Option B: Using Port Forwarding (for local development)

```bash
# Port forward the nginx-gateway service
kubectl port-forward -n nginx-gateway service/nginx-gateway 443:443 &

# Add localhost mapping
echo "127.0.0.1 icp.local" | sudo tee -a /etc/hosts
```

## Step 8: Verify Deployment

### 8.1 Check all resources are ready

```bash
# Check pods
kubectl get pods -l app=icp

# Check service
kubectl get svc icp-service

# Check gateway
kubectl get gateway icp-gateway

# Check HTTPRoute
kubectl get httproute icp-route

# Check BackendTLSPolicy
kubectl get backendtlspolicy icp-backend-tls

# Check certificate
kubectl get certificate icp-cert
```

### 8.2 Test the application

```bash
# Test the web interface
curl -k https://icp.local

# You should see HTML content from the ICP web application

# Test with verbose output
curl -k -v https://icp.local 2>&1 | head -30
```

## Step 9: Access the Application

Open your browser and navigate to:

```
https://icp.local
```

**Note**: You may need to accept the self-signed certificate warning in your browser.

## Troubleshooting

### Check pod logs

```bash
kubectl logs -l app=icp --tail=100
```

### Check Gateway status

```bash
kubectl describe gateway icp-gateway
```

### Check HTTPRoute status

```bash
kubectl describe httproute icp-route
```

### Check BackendTLSPolicy status

```bash
kubectl describe backendtlspolicy icp-backend-tls
```

### Check nginx-gateway logs

```bash
kubectl logs -n nginx-gateway deployment/nginx-gateway --tail=100
```

### Verify backend is responding

```bash
# Test inside the pod
kubectl exec deployment/icp-deployment -- curl -k https://localhost:9445
```

### Common Issues

**502 Bad Gateway**: This usually means the Gateway cannot connect to the backend. Ensure:
- The BackendTLSPolicy is properly configured
- The backend CA certificate ConfigMap exists
- The Service has `appProtocol: https` set

**Connection refused**: Ensure:
- The pod is running: `kubectl get pods -l app=icp`
- The service endpoints exist: `kubectl get endpoints icp-service`

**Certificate issues**: Verify cert-manager is working:
```bash
kubectl get certificate -A
kubectl describe certificate icp-cert
```

## Cleanup

To remove all resources:

```bash
# Delete application resources
kubectl delete -f backend-tls-policy.yaml
kubectl delete -f route.yaml
kubectl delete -f gateway.yaml
kubectl delete -f cert.yaml
kubectl delete -f issuer.yaml
kubectl delete -f service.yaml
kubectl delete -f deployment.yaml

# Delete ConfigMap
kubectl delete configmap icp-backend-ca

# Optionally remove NGINX Gateway Fabric
kubectl delete -f https://raw.githubusercontent.com/nginxinc/nginx-gateway-fabric/v2.3.0/deploy/default/deploy.yaml
kubectl delete -f https://raw.githubusercontent.com/nginxinc/nginx-gateway-fabric/v2.3.0/deploy/crds.yaml

# Optionally remove cert-manager
kubectl delete -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.0/cert-manager.yaml
```

## Architecture Overview

```
Client (Browser)
    |
    | HTTPS (TLS Terminated)
    v
Gateway (icp-gateway)
    |
    | HTTPS (Re-encrypted with BackendTLSPolicy)
    v
Service (icp-service:9445)
    |
    v
Pod (icp-deployment)
    - Port 9445: Web Console (HTTPS)
    - Port 9446: GraphQL API (HTTPS)
    - Port 9448: Observability API(HTTPS)
```

## Files Reference

- `deployment.yaml` - ICP application deployment
- `service.yaml` - Service with appProtocol: https
- `issuer.yaml` - Self-signed certificate issuer
- `cert.yaml` - TLS certificate for client-facing Gateway
- `gateway.yaml` - Gateway API gateway with TLS termination
- `route.yaml` - HTTPRoute for path-based routing
- `backend-tls-policy.yaml` - Policy for backend HTTPS communication
