# iShortly VPS Deployment Guide

## Prerequisites
- Ubuntu/Debian VPS server
- Domain name pointed to your VPS IP
- SSH access to your server

## Quick Deployment

1. **Clone the repository:**
   ```bash
   git clone https://github.com/princezee007/shortly.git
   cd shortly
   ```

2. **Run the deployment script:**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   nano .env
   ```
   
   Update these critical values:
   ```
   NODE_ENV=production
   BASE_URL=https://yourdomain.com
   MONGODB_URI=your_mongodb_atlas_connection_string
   FORCE_HTTPS=false  # Set to true only after SSL is configured
   ```

4. **Restart the application:**
   ```bash
   pm2 restart all
   ```

## Manual Setup Steps

### 1. Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Install PM2
```bash
sudo npm install -g pm2
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Start Application
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Nginx Configuration (Recommended)

Create `/etc/nginx/sites-available/ishortly`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/ishortly /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## SSL Setup with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

After SSL is configured, update `.env`:
```
FORCE_HTTPS=true
BASE_URL=https://yourdomain.com
```

## Troubleshooting

### Check Application Status
```bash
pm2 status
pm2 logs ishortly
```

### Check Nginx Status
```bash
sudo systemctl status nginx
sudo nginx -t
```

### Common Issues

1. **ERR_TOO_MANY_REDIRECTS**
   - Set `FORCE_HTTPS=false` in `.env`
   - Restart: `pm2 restart all`

2. **Database Connection Failed**
   - Check MongoDB Atlas connection string
   - Verify network access in MongoDB Atlas
   - Check firewall settings

3. **Port Already in Use**
   ```bash
   sudo lsof -i :3000
   pm2 kill
   pm2 start ecosystem.config.js
   ```

4. **Permission Denied**
   ```bash
   sudo chown -R $USER:$USER /path/to/shortly
   chmod +x deploy.sh
   ```

## Monitoring

- **View logs:** `pm2 logs`
- **Monitor resources:** `pm2 monit`
- **Restart app:** `pm2 restart ishortly`
- **Stop app:** `pm2 stop ishortly`

## Security Checklist

- [ ] Update system packages regularly
- [ ] Configure firewall (UFW)
- [ ] Set up SSL certificate
- [ ] Use strong MongoDB credentials
- [ ] Enable fail2ban for SSH protection
- [ ] Regular backups of database

## Support

If you encounter issues:
1. Check the logs: `pm2 logs ishortly`
2. Verify environment variables in `.env`
3. Ensure MongoDB Atlas is accessible
4. Check domain DNS settings