#!/bin/bash

echo Updating packages
sudo apt update
sudo apt -y upgrade

echo Installing dependencies
sudo apt install npm nodejs
npm install

echo Redirecting port 80 to port 3000
sudo iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 80 -j REDIRECT --to-port 3000
 
