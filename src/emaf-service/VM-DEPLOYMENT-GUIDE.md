# 🚀 EMAF Service - Azure VM Deployment Guide

## ✅ What You Have

- **VM:** `rpa-vm-production` (20.203.51.248)
- **Size:** Standard_D2s_v3 (2 vCPUs, 8GB RAM)
- **OS:** Linux
- **Docker Image:** Already built in ACR (`interactivecrmacr.azurecr.io/emaf-service:latest`)

---

## 🎯 Quick Deployment (5 minutes)

### **Step 1: Test SSH Access**

```bash
ssh azureuser@20.203.51.248
```

**If this fails**, set up SSH access:

```bash
# Generate SSH key if you don't have one
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N ""

# Add your SSH key to the VM
az vm user update \
  --resource-group Interactive-CRM-Dev \
  --name rpa-vm-production \
  --username azureuser \
  --ssh-key-value "$(cat ~/.ssh/id_rsa.pub)"
```

---

### **Step 2: Run the Deployment Script**

```bash
cd /home/janees/Desktop/crm/Interactiveproject/src/emaf-service
./deploy-to-vm.sh
```

That's it! The script will:
- Install Docker on the VM
- Pull your Docker image from ACR
- Start the EMAF service
- Open port 8080

---

## 🧪 Test Your Deployment

After deployment completes, test these URLs:

### **1. HTML Preview**
```bash
curl "http://20.203.51.248:8080/api/admin/emaf/preview?vendorCode=alsagr&format=html"
```

### **2. PDF Generation** (The important one!)
```bash
curl -o test.pdf "http://20.203.51.248:8080/api/admin/emaf/preview?vendorCode=alsagr&format=pdf"
```

### **3. View in Browser**
Open in browser:
- http://20.203.51.248:8080/api/admin/emaf/preview?vendorCode=alsagr&format=html

---

## 📊 Monitoring & Management

### **View Live Logs**
```bash
ssh azureuser@20.203.51.248 'sudo docker logs -f emaf-service'
```

### **Restart Service**
```bash
ssh azureuser@20.203.51.248 'sudo docker restart emaf-service'
```

### **Check Container Status**
```bash
ssh azureuser@20.203.51.248 'sudo docker ps'
```

### **Stop Service**
```bash
ssh azureuser@20.203.51.248 'sudo docker stop emaf-service'
```

---

## 🔄 Updating the Service

When you make code changes and want to redeploy:

```bash
cd /home/janees/Desktop/crm/Interactiveproject/src/emaf-service

# 1. Rebuild Docker image
az acr build --registry interactivecrmacr --image emaf-service:latest --file Dockerfile .

# 2. Redeploy to VM
./deploy-to-vm.sh
```

---

## 🌐 Integration with Your App

Update your frontend/backend to use:

**Base URL:** `http://20.203.51.248:8080`

**Or better**, set up a reverse proxy with a domain name:
- `emaf.yourdomain.com` → `20.203.51.248:8080`

---

## 🔐 Security Recommendations (Optional but Important)

1. **Use HTTPS:** Set up Nginx reverse proxy with Let's Encrypt SSL
2. **Firewall:** Restrict port 8080 to only your app's IP
3. **Authentication:** Add API key authentication to endpoints

---

## 💰 Cost Comparison

| Solution | Monthly Cost |
|----------|-------------|
| **Azure Function (Consumption)** | $5-20 (but no Docker support) ❌ |
| **Azure Function (Premium)** | $150+ (with Docker support) 💸 |
| **Azure Function (Dedicated)** | $50-70 (with Docker support) 💸 |
| **Your VM (existing)** | **$0 extra** (already have it!) ✅ |

**You're using existing infrastructure = $0 extra cost!**

---

## 🐛 Troubleshooting

### Container won't start?
```bash
ssh azureuser@20.203.51.248 'sudo docker logs emaf-service'
```

### Port not accessible?
```bash
# Check if firewall allows it
az network nsg rule list --resource-group Interactive-CRM-Dev --nsg-name rpa-vm-production-nsg -o table | grep 8080

# Open port if needed
az vm open-port --resource-group Interactive-CRM-Dev --name rpa-vm-production --port 8080
```

### Need to access VM directly?
```bash
ssh azureuser@20.203.51.248
sudo docker ps
sudo docker logs emaf-service
```

---

## 📞 Quick Commands Reference

```bash
# Deploy
./deploy-to-vm.sh

# Test HTML
curl http://20.203.51.248:8080/api/admin/emaf/preview?vendorCode=alsagr&format=html

# Test PDF
curl -o test.pdf "http://20.203.51.248:8080/api/admin/emaf/preview?vendorCode=alsagr&format=pdf" && xdg-open test.pdf

# View logs
ssh azureuser@20.203.51.248 'sudo docker logs -f emaf-service'

# Restart
ssh azureuser@20.203.51.248 'sudo docker restart emaf-service'

# Rebuild & Redeploy
az acr build --registry interactivecrmacr --image emaf-service:latest -f Dockerfile . && ./deploy-to-vm.sh
```

---

## ✅ Next Steps

1. Run `./deploy-to-vm.sh`
2. Test the endpoints
3. Integrate with your frontend
4. Set up monitoring (optional)
5. Configure reverse proxy for HTTPS (recommended)

---

**Need help?** Check the logs first:
```bash
ssh azureuser@20.203.51.248 'sudo docker logs emaf-service'
```
