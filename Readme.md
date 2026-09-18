# FinTrack – Chit Management System

## Technologies

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express.js
- Database: MongoDB

---

# Prerequisites

Install:

- Node.js
- npm
- MongoDB
- Visual Studio Code
- Live Server Extension (VS Code)

Check installations:

node --version
npm --version
git --version

---

# Frontend Setup

## Navigate to Frontend

cd frontend

## Run Frontend

### Option 1: VS Code Live Server

Open the project in VS Code:

code .

Then open index.html using Live Server.

### Option 2: Python HTTP Server

Run:

python -m http.server 5500

Open:

http://localhost:5500

---

# Backend Setup

## Navigate to Backend

cd backend

## Install Dependencies

npm install

## Start Development Server

npm run dev

## Start Production Server

npm start

---

# MongoDB Setup

## MongoDB Local

Start MongoDB service.

Connection:

mongodb://127.0.0.1:27017/fintrack

## MongoDB Atlas

Add the MongoDB Atlas connection string to the backend .env file.

---

# Run Frontend and Backend

## Terminal 1 – Frontend

cd frontend

python -m http.server 5500

---

## Terminal 2 – Backend

cd backend

npm run dev

---

# URLs

Frontend:

http://localhost:5500

Backend:

http://localhost:5000

---

# Git Commands

## Check Status

git status

## Add Files

git add .

## Commit Changes

git commit -m "Update FinTrack project"

## Push Changes

git push origin main