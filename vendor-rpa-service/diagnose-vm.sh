#!/bin/bash

# Quick VM Diagnostics Script
# Run this on the VM to check current configuration

echo "========================================="
echo "RPA Gateway Diagnostics"
echo "VM: $(hostname -I | awk '{print $1}')"
echo "Date: $(date)"
echo "========================================="

echo ""
echo "=== 1. Checking Nginx Status ==="
if command -v nginx &> /dev/null; then
    nginx -v 2>&1
    sudo systemctl status nginx --no-pager | head -5
    echo "Nginx is installed"
else
    echo "❌ Nginx not installed"
fi

echo ""
echo "=== 2. Checking PM2 Processes ==="
if command -v pm2 &> /dev/null; then
    pm2 list
else
    echo "❌ PM2 not installed"
fi

echo ""
echo "=== 3. Checking Bot Server Ports ==="
echo "Expected: 3001 (alsagr), 3002 (takaful), 3003 (watania), 3004 (sukoon)"
netstat -tulpn 2>/dev/null | grep -E "3001|3002|3003|3004" || ss -tulpn 2>/dev/null | grep -E "3001|3002|3003|3004" || echo "No bot servers found on ports 3001-3004"

echo ""
echo "=== 4. Testing Alsagr Bot Directly ==="
curl -s --max-time 2 http://localhost:3001/health 2>/dev/null || echo "❌ Alsagr bot not responding on port 3001"

echo ""
echo "=== 5. Testing Sukoon Bot Directly ==="
curl -s --max-time 2 http://localhost:3004/health 2>/dev/null || echo "❌ Sukoon bot not responding on port 3004"

echo ""
echo "=== 6. Testing via Nginx (Port 80) ==="
curl -s --max-time 2 http://localhost/health 2>/dev/null || echo "❌ Nginx not responding on port 80"

echo ""
echo "=== 7. Testing External Access ==="
curl -s --max-time 2 http://$(hostname -I | awk '{print $1}')/health 2>/dev/null || echo "❌ Cannot reach via external IP"

echo ""
echo "=== 8. Checking Nginx Configuration ==="
if [ -f /etc/nginx/nginx.conf ]; then
    echo "Main config exists: /etc/nginx/nginx.conf"
    echo "Sites enabled:"
    ls -1 /etc/nginx/sites-enabled/ 2>/dev/null || echo "  No sites-enabled directory"
    echo "Conf.d:"
    ls -1 /etc/nginx/conf.d/ 2>/dev/null || echo "  No conf.d directory"
else
    echo "❌ Nginx config not found at /etc/nginx/nginx.conf"
fi

echo ""
echo "=== 9. Recent Nginx Errors (last 10 lines) ==="
if [ -f /var/log/nginx/error.log ]; then
    sudo tail -10 /var/log/nginx/error.log 2>/dev/null || echo "Cannot read nginx error log"
else
    echo "No nginx error log found"
fi

echo ""
echo "=== 10. Checking Python Virtual Environment ==="
if [ -d /home/janees/Desktop/crm/Interactiveproject/vendor-rpa-service/venv ]; then
    echo "✅ Python venv exists"
    /home/janees/Desktop/crm/Interactiveproject/vendor-rpa-service/venv/bin/python3 --version
else
    echo "❌ Python venv not found - RPA bots may fail"
fi

echo ""
echo "========================================="
echo "Diagnostics Complete"
echo "========================================="
echo ""
echo "Next Steps:"
echo "1. If Nginx is missing → Install nginx or use Node.js gateway"
echo "2. If PM2 processes not running → Run: pm2 start ecosystem.config.js"
echo "3. If nginx config missing → See NGINX_SETUP_GUIDE.md"
echo "4. If ports not listening → Check PM2 logs: pm2 logs alsagr-bot"
