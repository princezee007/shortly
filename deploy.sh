#!/bin/bash

# iShortly VPS Deployment Script
# This script sets up the application on a VPS server

echo "Starting iShortly deployment..."

# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js (if not already installed)
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install PM2 globally (if not already installed)
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    sudo npm install -g pm2
fi

# Install application dependencies
echo "Installing application dependencies..."
npm install

# Create logs directory
mkdir -p logs

# Set proper permissions
chmod +x deploy.sh

# Start application with PM2
echo "Starting application with PM2..."
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup

echo "Deployment completed!"
echo "Application is running on port 3000"
echo "Use 'pm2 status' to check application status"
echo "Use 'pm2 logs' to view application logs"
echo "Use 'pm2 restart all' to restart the application"