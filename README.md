# CogniSphere
 AI Advanced Chat Bot

## Getting Started

 
## Installation

You will need Node.js 18.9+ and npm installed on your local development machine:

```shell
sudo apt update && sudo apt install -y nodejs npm
```


You will then install the app in folder of your choice.

```shell
sudo mkdir /var/www
sudo mkdir /var/www/cognisphere
cd /var/www/cognisphere

sudo git config --global init.defaultBranch main
sudo git init
sudo git remote add origin https://github.com/wajihalsaid/cognisphere.git
sudo git pull --rebase origin main

sudo npm install
sudo npm run build
```

To run the app temporary:
```shell
npm start
```


To keep it always running even after reboot:

```shell
sudo npm install -g pm2
sudo pm2 start npm --name "cognisphere" -- start
sudo pm2 save
sudo pm2 startup
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.


## Keep your sevrer running latest version (on-demand):

[optional] Create an on-demand script that it will make your project to get latest updates

```shell
sudo tee -a /var/www/cognisphere/.git/hooks/post-receive > /dev/null <<EOF
#!/bin/bash
APP_DIR="/var/www/cognisphere"
BRANCH="main"  # Change to the branch you are pulling from

cd \$APP_DIR || exit

echo "🚀 Pulling latest changes from Git..."
git pull origin \$BRANCH

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building the Next.js app..."
npm run build

echo "♻️ Restarting Next.js app with PM2..."
pm2 restart cognisphere

echo "✅ Deployment completed!"
EOF

# Make the hook executable
sudo chmod +x /var/www/cognisphere/.git/hooks/post-receive
```


Whenever you want to run the update, execute the below command:


```shell
sudo bash /var/www/cognisphere/.git/hooks/post-receive 
```
