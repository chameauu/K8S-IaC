# Full-Stack User Management App

Simple full-stack application with Node.js backend, HTML/NGINX frontend, and MySQL database.

## Architecture

- **Frontend**: NGINX serving static HTML (Port 30082)
- **Backend**: Node.js Express API (Port 3000)
- **Database**: MySQL 8.0

## Features

- Add users (name + email)
- View all users
- Delete users
- Data persisted in MySQL

## Deployment

### Push to Gitea
```bash
cd fullstack-app
git init
git add .
git commit -m "Initial commit"
git remote add origin http://10.0.2.30:3000/jmal/fullstack-app.git
git push -u origin master
```

### Jenkins Pipeline
The Jenkinsfile will:
1. Build backend Docker image
2. Build frontend Docker image
3. Deploy MySQL with persistent storage
4. Deploy backend (2 replicas)
5. Deploy frontend (2 replicas)

### Access
- Frontend: http://10.0.2.10:30082
- Backend API: http://backend-service:3000/api (internal)
- MySQL: mysql-service:3306 (internal)

## Local Development

### Backend
```bash
cd backend
npm install
DB_HOST=localhost DB_USER=appuser DB_PASSWORD=apppass123 DB_NAME=appdb npm start
```

### Frontend
```bash
cd frontend
# Serve with any HTTP server
python3 -m http.server 8080
```

## Database Schema

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
