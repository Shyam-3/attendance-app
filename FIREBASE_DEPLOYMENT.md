# 🚀 Firebase Deployment Guide

This guide will help you deploy your Attendance Tracker application to Firebase.

## 📋 Prerequisites

1. **Node.js** (v18 or higher)
2. **Firebase CLI** - Install globally:
   ```cmd
   npm install -g firebase-tools
   ```
3. **PostgreSQL Database** (e.g., Supabase, Neon, or other cloud PostgreSQL)
4. **Firebase Account** - Create one at [firebase.google.com](https://firebase.google.com)

---

## 🔧 Initial Setup

### Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"**
3. Enter a project name (e.g., `attendance-tracker`)
4. Follow the prompts to create the project
5. **Note your Project ID** (you'll need this)

### Step 2: Configure Firebase Project Locally

1. **Login to Firebase:**
   ```cmd
   firebase login
   ```

2. **Update `.firebaserc` with your project ID:**
   - Open `.firebaserc`
   - Replace `"your-firebase-project-id"` with your actual Firebase project ID

   ```json
   {
     "projects": {
       "default": "your-actual-project-id"
     }
   }
   ```

### Step 3: Enable Firebase Services

In the Firebase Console:

1. **Enable Firebase Hosting:**
   - Go to **Hosting** in the left sidebar
   - Click **Get Started** and follow the wizard

2. **Enable Cloud Functions:**
   - Go to **Functions** in the left sidebar
   - Click **Get Started**
   - Upgrade to **Blaze (Pay as you go)** plan (required for Cloud Functions)

3. **Set up billing:**
   - Cloud Functions require the Blaze plan
   - You get generous free tier limits (2M invocations/month)

---

## 🗄️ Database Setup

You need a PostgreSQL database accessible from the internet. Recommended options:

### Option A: Supabase (Recommended - Free tier available)

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Get your connection strings:
   - **Direct connection** (for local dev)
   - **Connection pooling** (for serverless functions)
4. Note both `DATABASE_URL` and `DIRECT_URL`

### Option B: Neon (Free tier available)

1. Go to [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string

### Option C: Other PostgreSQL Providers

- Google Cloud SQL
- AWS RDS
- DigitalOcean Managed Databases
- Render PostgreSQL

---

## 🔐 Environment Variables

### Step 1: Configure Functions Environment Variables

Set environment variables for Firebase Functions:

```cmd
firebase functions:config:set database.url="postgresql://user:password@host:5432/database"
firebase functions:config:set database.direct_url="postgresql://user:password@host:5432/database"
```

### Step 2: Create Local `.env` Files

**For local development:**

1. **Backend `.env`** (in `backend/` folder):
   ```env
   DATABASE_URL=postgresql://user:password@host:5432/database
   DIRECT_URL=postgresql://user:password@host:5432/database
   PORT=5000
   FRONTEND_URL=http://127.0.0.1:5173
   ```

2. **Functions `.env`** (in `functions/` folder):
   ```env
   DATABASE_URL=postgresql://user:password@host:5432/database
   DIRECT_URL=postgresql://user:password@host:5432/database
   ```

3. **Frontend `.env`** (in `frontend/` folder):
   ```env
   VITE_API_BASE_URL=https://your-project-id.web.app
   ```
   
   **Note:** Replace `your-project-id` with your actual Firebase project ID

---

## 📦 Install Dependencies

Run from the root directory:

```cmd
npm run setup
```

This will install dependencies for:
- Backend
- Frontend
- Firebase Functions

Or install manually:

```cmd
cd backend
npm install

cd ../frontend
npm install

cd ../functions
npm install

cd ..
```

---

## 🗃️ Database Migration

Run Prisma migrations to set up your database schema:

```cmd
cd backend
npm run prisma:migrate
npm run prisma:generate
cd ..
```

---

## 🏗️ Build & Deploy

### Deploy Everything (Functions + Hosting)

```cmd
npm run deploy
```

This will:
1. Copy Prisma files to functions directory
2. Install function dependencies
3. Build the frontend
4. Deploy both Cloud Functions and Hosting

### Deploy Only Functions

```cmd
npm run deploy:functions
```

### Deploy Only Hosting (Frontend)

```cmd
npm run deploy:hosting
```

---

## ✅ Verify Deployment

After deployment completes, you'll see URLs in the terminal:

1. **Hosting URL:** `https://your-project-id.web.app`
2. **Functions URL:** `https://us-central1-your-project-id.cloudfunctions.net/api`

### Test Your Deployment

1. **Visit your site:**
   ```
   https://your-project-id.web.app
   ```

2. **Check API health:**
   ```
   https://your-project-id.web.app/health
   ```

3. **Try uploading a file** through the UI

---

## 🔄 Updating Your App

When you make changes:

1. **Update frontend only:**
   ```cmd
   npm run deploy:hosting
   ```

2. **Update backend/API only:**
   ```cmd
   npm run deploy:functions
   ```

3. **Update both:**
   ```cmd
   npm run deploy
   ```

---

## 🐛 Troubleshooting

### View Function Logs

```cmd
firebase functions:log
```

Or view in Firebase Console → Functions → Logs

### Common Issues

**1. Database Connection Errors**
- Verify `DATABASE_URL` is set correctly
- Check if your database allows connections from Firebase IPs
- For Supabase: Use the pooling connection string for functions

**2. CORS Errors**
- Update `VITE_API_BASE_URL` in frontend `.env`
- Rebuild and redeploy frontend

**3. Function Timeout**
- Default timeout is 60s
- Increase in `firebase.json` if needed:
  ```json
  "functions": [
    {
      "source": "functions",
      "runtime": "nodejs18",
      "timeout": "300s"
    }
  ]
  ```

**4. Cold Start Issues**
- First request may be slow (Firebase spins up function)
- Consider Cloud Run for faster cold starts

**5. Prisma Not Found**
- Ensure `copy-prisma.ps1` script runs before deploy
- Manually copy: `backend/prisma` → `functions/prisma`

---

## 💰 Cost Considerations

### Firebase Free Tier (Spark Plan)
- Hosting: 10 GB storage, 360 MB/day transfer
- **Functions require Blaze plan**

### Firebase Blaze Plan (Pay as you go)
- **Hosting:** Free tier same as Spark
- **Functions:** 
  - 2M invocations/month FREE
  - 400K GB-seconds compute time FREE
  - Very low cost beyond free tier

### Database Costs
- **Supabase:** Free tier with 500 MB database
- **Neon:** Free tier with 3 GB storage

**Expected monthly cost for small app:** $0-5

---

## 🔒 Security Best Practices

1. **Environment Variables:**
   - NEVER commit `.env` files
   - Use Firebase Functions config for secrets

2. **Database Security:**
   - Use strong passwords
   - Enable SSL connections
   - Whitelist Firebase IPs if possible

3. **CORS Configuration:**
   - Restrict origins in production
   - Update `cors` settings in `functions/src/index.ts`

4. **Authentication (Recommended):**
   - Add Firebase Authentication
   - Protect admin routes

---

## 📊 Monitoring

### Firebase Console
- **Functions:** View invocations, errors, execution time
- **Hosting:** View bandwidth usage
- **Performance:** Monitor app performance

### Enable Monitoring

```cmd
firebase deploy --only functions --force
```

---

## 🚀 Advanced Configuration

### Custom Domain

1. Go to Firebase Console → Hosting
2. Click **Add custom domain**
3. Follow DNS configuration steps

### Environment-Specific Deploys

Create multiple Firebase projects:

```cmd
firebase use --add
```

Switch between environments:

```cmd
firebase use production
firebase use staging
```

---

## 📚 Useful Commands

```cmd
# View current project
firebase projects:list

# View function logs in real-time
firebase functions:log --only api

# Test functions locally
cd functions
npm run serve

# Open Firebase Console
firebase open

# View hosting URLs
firebase hosting:sites:list
```

---

## 🆘 Need Help?

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Functions Docs](https://firebase.google.com/docs/functions)
- [Prisma with Serverless](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-firebase)

---

## 📝 Deployment Checklist

- [ ] Created Firebase project
- [ ] Updated `.firebaserc` with project ID
- [ ] Set up PostgreSQL database
- [ ] Configured Firebase Functions environment variables
- [ ] Created frontend `.env` with `VITE_API_BASE_URL`
- [ ] Ran `npm run setup`
- [ ] Ran Prisma migrations
- [ ] Deployed with `npm run deploy`
- [ ] Tested deployment at hosting URL
- [ ] Verified `/health` endpoint works
- [ ] Tested file upload functionality

---

**🎉 You're all set! Your attendance tracker is now live on Firebase!**
