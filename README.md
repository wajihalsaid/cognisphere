# CogniSphere
 AI Advanced Chat Bot

## Getting Started

 
## Installation

> **Note:** Choose the instructions based on your operating system.

---

### 🐧 Ubuntu Server / Linux

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

---

### ![Windows](https://upload.wikimedia.org/wikipedia/commons/5/5f/Windows_logo_-_2012.svg) Windows 11 (PowerShell)

Install Node.js & Git on Windows 11. Open PowerShell as Administrator and run:
```shell
winget install OpenJS.NodeJS.LTS
winget install Git.Git
```

Create your project folder and clone the repo
```shell
mkdir C:\Projects\cognisphere
cd C:\Projects\cognisphere
git init
git remote add origin https://github.com/wajihalsaid/cognisphere.git
git pull --rebase origin main
```

Install dependencies
```shell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
npm install
```

Build the app
```shell
npm run build
```

Run temporarily
```shell
npm start
```
Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
Ctrl+C to stop.
you can use the same command to run it again.


---

### ![macOS](https://upload.wikimedia.org/wikipedia/commons/3/30/MacOS_logo.svg) macOS

Install Node.js and npm using macOS Terminal
```shell
brew install node
```

Create project folder and download code
```shell
mkdir -p ~/Projects/cognisphere
cd ~/Projects/cognisphere
git config --global init.defaultBranch main
git init
git remote add origin https://github.com/wajihalsaid/cognisphere.git
git pull --rebase origin main
```

Install dependencies
```shell
npm install
```

Build the app
```shell
npm run build
```

Run the app temporarily
```shell
npm start
```
Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
Ctrl+C to stop.
you can use the same command to run it again.


---

### ![Docker](https://commons.wikimedia.org/wiki/File:Docker_(container_engine)_logo.png) Pull & Use Anywhere (Docker)

If you just want to run Cognisphere without installing Node.js, npm, or cloning the repo, you can use Docker::
```shell
docker pull walsaid/cognisphere:latest
docker run -p 3000:3000 walsaid/cognisphere:latest
```

## Keep your sevrer running latest version (on-demand):

---

### 🐧 Ubuntu Server / Linux

[optional] Create an on-demand script that it will make your project to get latest updates

```shell
sudo tee -a /var/www/cognisphere/.git/hooks/post-receive > /dev/null <<EOF
#!/bin/bash
APP_DIR="/var/www/cognisphere"
BRANCH="main"  # Change to the branch you are pulling from

cd \$APP_DIR || exit

echo "🚀 Pulling latest changes from Git..."
git checkout -- .
git pull origin \$BRANCH

echo "📦 Installing dependencies..."
npm install --package-lock-only
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

---

### ![Windows](https://upload.wikimedia.org/wikipedia/commons/5/5f/Windows_logo_-_2012.svg) Windows 11 (PowerShell)

[optional] Get latest update, build and run temporarily:
```shell
cd C:\Projects\cognisphere
git restore .
git pull origin main
npm install --package-lock-only
npm install
npm run build
npm start
```


---

### ![macOS](https://upload.wikimedia.org/wikipedia/commons/3/30/MacOS_logo.svg) macOS

[optional] Get latest update, build and run temporarily:
```shell
cd ~/Projects/cognisphere
git checkout -- .
git pull origin main
npm install --package-lock-only
npm install
npm run build
npm start
```