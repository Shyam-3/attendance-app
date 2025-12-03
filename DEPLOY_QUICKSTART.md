# Firebase Deployment - Quick Start

## Prerequisites
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Have a PostgreSQL database ready (Supabase recommended)

## Quick Deploy Steps

### 1. Login to Firebase
```cmd
firebase login
```

### 2. Update Project ID
Edit `.firebaserc` and replace `your-firebase-project-id` with your actual Firebase project ID

### 3. Set Environment Variables
```cmd
firebase functions:config:set database.url="your-postgresql-url"
firebase functions:config:set database.direct_url="your-postgresql-url"
```

### 4. Create Frontend .env
Create `frontend/.env`:
```env
VITE_API_BASE_URL=https://your-project-id.web.app
```

### 5. Install Dependencies
```cmd
npm run setup
```

### 6. Run Database Migrations
```cmd
cd backend
npm run prisma:migrate
npm run prisma:generate
cd ..
```

### 7. Deploy
```cmd
npm run deploy
```

### 8. Test
Visit `https://your-project-id.web.app`

---

For detailed instructions, see [FIREBASE_DEPLOYMENT.md](./FIREBASE_DEPLOYMENT.md)
