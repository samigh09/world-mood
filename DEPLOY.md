# Netlify Deployment Guide

This guide will help you deploy the application to Netlify with GitHub Actions.

## Prerequisites

1. A GitHub account
2. A Netlify account (sign up at [Netlify](https://app.netlify.com/))
3. Your code pushed to a GitHub repository

## Deployment Steps

### 1. Push to GitHub

First, make sure your code is in a GitHub repository:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin YOUR_REPOSITORY_URL
git push -u origin main
```

### 2. Set up Netlify

1. Go to [Netlify](https://app.netlify.com/) and log in
2. Click "Add new site" > "Import an existing project"
3. Connect to your GitHub/GitLab account
4. Select your repository
5. Configure the build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
6. Click "Deploy site"

### 3. Set up Environment Variables (if any)

In your Netlify site settings, go to "Site settings" > "Build & deploy" > "Environment" to add any required environment variables.

### 4. Enable Automatic Deployments

1. In Netlify, go to "Site settings" > "Build & deploy" > "Continuous Deployment"
2. Make sure "Builds" are enabled
3. Configure the branch to deploy from (usually `main` or `master`)

### 5. (Optional) Set up a Custom Domain

1. Go to "Domain management" in your Netlify site
2. Click "Add custom domain"
3. Follow the instructions to verify domain ownership
4. Update your DNS settings as instructed

## Manual Deployment

If you prefer to deploy manually:

1. Install Netlify CLI:
   ```bash
   npm install -g netlify-cli
   ```

2. Build your project:
   ```bash
   npm run build
   ```

3. Deploy to Netlify:
   ```bash
   netlify deploy --prod
   ```

## Troubleshooting

- If the build fails, check the build logs in Netlify
- Make sure all environment variables are set correctly
- Verify that the build command and output directory match your project configuration

## Support

For additional help, please refer to the [Netlify Documentation](https://docs.netlify.com/).
