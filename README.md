# CogniSphere
 AI Advanced ChatBot

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

sudo git init --bare
sudo git remote add origin https://github.com/wajihalsaid/cognisphere.git
sudo git pull --rebase origin main

sudo npm install
sudo npm run build
```

To keep it always running even after reboot:

```shell
sudo pm2 start npm --name "cognisphere" -- start
sudo pm2 save
sudo pm2 startup
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
