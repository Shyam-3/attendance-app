# 🚀 Render.com Deployment Guide

Complete guide to deploy your Attendance Tracker backend on Render.com (FREE tier).

---

## 📋 Prerequisites

1. **GitHub Account** - Push your code to GitHub
2. **Render Account** - Sign up at [render.com](https://render.com)
3. **PostgreSQL Database** - Supabase or Render PostgreSQL

---

## 🗄️ Step 1: Set Up Database (Choose One)

### Option A: Supabase (Recommended)

1. Go to [supabase.com](https://supabase.com) and create project
2. Get your connection strings:
   - **Transaction pooling mode** (for Render)
   - Direct connection (backup)
3. Save both URLs for later

### Option B: Render PostgreSQL

1. In Render Dashboard, click **"New +"**
2. Select **"PostgreSQL"**
3. Fill details:
   - **Name:** `attendance-db`
   - **Database:** `attendance`
   - **User:** `attendance`
   - **Region:** Choose closest to you
4. Click **"Create Database"**
5. Copy the **"Internal Database URL"** from the dashboard

---

## 📤 Step 2: Push Code to GitHub

If not already done:

```cmd
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

---

## 🌐 Step 3: Deploy Backend on Render

### 3.1 Create Web Service

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Select your `attendance-tracker-ts` repository

### 3.2 Configure Web Service

Fill in the following settings:

**Basic Settings:**
- **Name:** `attendance-tracker-backend` (or any name)
- **Region:** Choose closest to you
- **Branch:** `main`
- **Root Directory:** `backend`
- **Runtime:** `Node`

**Build Settings:**
- **Build Command:**
  ```bash
  npm install && npm run build && npx prisma generate
  ```

- **Start Command:**
  ```bash
  npm start
  ```

**Instance Type:**
- Select **"Free"** (0.1 CPU, 512 MB RAM)

### 3.3 Add Environment Variables

Click **"Advanced"** → **"Add Environment Variable"**

Add these variables:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Your PostgreSQL connection URL |
| `DIRECT_URL` | Your PostgreSQL direct connection URL |
| `PORT` | `5000` |
| `FRONTEND_URL` | `https://your-frontend.vercel.app` (update later) |
| `NODE_ENV` | `production` |

**Important:** Use the **pooled/transaction** connection string for `DATABASE_URL` if using Supabase.

### 3.4 Deploy

1. Click **"Create Web Service"**
2. Render will start building and deploying
3. Wait for deployment to complete (3-5 minutes)
4. You'll get a URL like: `https://attendance-tracker-backend.onrender.com`

---

## ✅ Step 4: Test Backend

Visit these URLs to verify:

1. **Health Check:**
   ```
   https://attendance-tracker-backend.onrender.com/health
   ```
   Should return: `{"status":"healthy","database":"PostgreSQL (Prisma)",...}`

2. **API Stats:**
   ```
   https://attendance-tracker-backend.onrender.com/api/stats
   ```

---

## 🎨 Step 5: Deploy Frontend

### Option A: Vercel (Recommended)

1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Click **"Add New Project"**
4. Import your GitHub repository
5. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
6. Add Environment Variable:
   - **Key:** `VITE_API_BASE_URL`
   - **Value:** `https://attendance-tracker-backend.onrender.com`
7. Click **"Deploy"**

### Option B: Netlify

1. Go to [netlify.com](https://netlify.com)
2. Click **"Add new site"** → **"Import existing project"**
3. Connect GitHub and select repository
4. Configure:
   - **Base directory:** `frontend`
   - **Build command:** `npm run build`
   - **Publish directory:** `frontend/dist`
5. Add Environment Variable:
   - **Key:** `VITE_API_BASE_URL`
   - **Value:** `https://attendance-tracker-backend.onrender.com`
6. Click **"Deploy"**

---

## 🔄 Step 6: Update Backend CORS

After deploying frontend, update backend `FRONTEND_URL`:

1. Go to Render Dashboard
2. Select your backend service
3. Go to **"Environment"** tab
4. Update `FRONTEND_URL` to your frontend URL:
   ```
   https://your-app.vercel.app
   ```
5. Save changes (service will auto-redeploy)

---

## 📊 Step 7: Run Database Migrations

### Option 1: Using Render Shell (Recommended)

1. In Render Dashboard, go to your web service
2. Click **"Shell"** tab
3. Run:
   ```bash
   cd backend
   npx prisma migrate deploy
   ```

### Option 2: Local Migration (Push to Remote DB)

1. Update your local `backend/.env` with production database URL
2. Run locally:
   ```cmd
   cd backend
   npm run prisma:migrate
   cd ..
   ```

---

## 🎯 Important Notes

### Free Tier Limitations

**Render Free Tier:**
- ✅ 750 hours/month (enough for always-on)
- ⚠️ **Sleeps after 15 minutes of inactivity**
- ⚠️ **Cold start: ~30-60 seconds to wake up**
- ✅ Auto-sleeps and auto-wakes
- ✅ 512 MB RAM

**To prevent sleep:**
- Use a service like [cron-job.org](https://cron-job.org) to ping your `/health` endpoint every 10 minutes

### Performance Tips

1. **Keep Service Awake:**
   - Create a cron job to ping `/health` every 10 minutes
   - Example: `curl https://your-backend.onrender.com/health`

2. **Optimize Cold Starts:**
   - Backend uses Prisma which adds startup time
   - Consider connection pooling

3. **Monitor Usage:**
   - Check Render Dashboard for metrics
   - Monitor database connections

---

## 🔄 Updating Your App

### Update Backend

1. Push changes to GitHub:
   ```cmd
   git add .
   git commit -m "Update backend"
   git push
   ```
2. Render auto-deploys from `main` branch
3. Wait 2-3 minutes for deployment

### Update Frontend

1. Push changes to GitHub
2. Vercel/Netlify auto-deploys
3. Changes live in ~1 minute

### Manual Redeploy

In Render Dashboard:
- Click **"Manual Deploy"** → **"Clear build cache & deploy"**

---

## 🐛 Troubleshooting

### Backend won't start

**Check logs in Render Dashboard:**
1. Go to your service
2. Click **"Logs"** tab
3. Look for errors

**Common issues:**
- ❌ Database URL incorrect → Check environment variables
- ❌ Build failed → Check Build Command
- ❌ Prisma not generated → Add `npx prisma generate` to build command

### Database connection errors

**For Supabase:**
- Use **Transaction/Pooler** connection string, not Direct
- Format: `postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres`

**For Render PostgreSQL:**
- Use **Internal Database URL**
- Enable SSL in Prisma if required

### CORS errors

1. Check `FRONTEND_URL` environment variable
2. Make sure it matches your frontend URL exactly
3. Redeploy backend after changing

### Service sleeping

**Symptoms:**
- First request takes 30-60 seconds
- Then fast afterwards

**Solutions:**
- Set up cron job to ping every 10 minutes
- Upgrade to paid plan ($7/month for no sleep)

---

## 💰 Cost Breakdown

### Completely Free Setup

| Service | Plan | Cost |
|---------|------|------|
| Render (Backend) | Free | $0 |
| Vercel (Frontend) | Hobby | $0 |
| Supabase (Database) | Free | $0 |
| **Total** | | **$0/month** |

**Limitations:**
- Backend sleeps after 15 min inactivity
- 500 MB database (Supabase)
- No custom domains on some services

---

## 🔐 Security Checklist

- [ ] Database uses strong password
- [ ] Environment variables set (not in code)
- [ ] CORS configured with specific origin
- [ ] SSL enabled on database connections
- [ ] `.env` files in `.gitignore`

---

## 📚 Useful Links

- [Render Documentation](https://render.com/docs)
- [Render Node.js Guide](https://render.com/docs/deploy-node-express-app)
- [Prisma with Render](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-render)
- [Vercel Documentation](https://vercel.com/docs)

---

## 🆘 Quick Commands

**View Logs:**
```bash
# In Render Shell
tail -f /var/log/render.log
```

**Test Database Connection:**
```bash
# In Render Shell
npx prisma db push
```

**Check Prisma Version:**
```bash
npx prisma --version
```

---

## ✅ Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] PostgreSQL database created
- [ ] Render web service created
- [ ] Environment variables configured
- [ ] Backend deployed successfully
- [ ] `/health` endpoint returns success
- [ ] Database migrations run
- [ ] Frontend deployed (Vercel/Netlify)
- [ ] Frontend `VITE_API_BASE_URL` set
- [ ] Backend `FRONTEND_URL` updated
- [ ] CORS working correctly
- [ ] File upload tested
- [ ] Export functionality tested

---

**🎉 Your app is now live and 100% free to host!**

**Backend:** `https://your-backend.onrender.com`  
**Frontend:** `https://your-app.vercel.app`
