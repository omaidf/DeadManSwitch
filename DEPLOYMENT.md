# Deployment Guide

## DigitalOcean App Platform

### Prerequisites
- DigitalOcean account
- GitHub repository with your code
- DigitalOcean CLI (optional)

### Deployment Steps

1. **Repository URL** in `.do/app.yaml` is already configured:
   ```yaml
   github:
     repo: 0xWizzzz/DeadManSwitch
     branch: main
   ```

2. **Deploy via DigitalOcean Console**:
   - Go to [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
   - Click "Create App"
   - Connect your GitHub repository
   - Select the repository and branch
   - DigitalOcean will auto-detect it's a Node.js app
   - Set the following:
     - **Build Command**: `npm run build`
     - **Run Command**: `npm start`
   - Deploy!

3. **Deploy via CLI** (if you have doctl):
   ```bash
   doctl apps create --spec .do/app.yaml
   ```

### Environment Variables

The app will automatically use:
- `NODE_ENV=production`
- `PORT` (set by DigitalOcean)

### Custom Domain

After deployment:
1. Go to your app in DigitalOcean Console
2. Navigate to "Settings" → "Domains"
3. Add your custom domain
4. Update DNS records as instructed

### Monitoring

- **Logs**: Available in DigitalOcean Console
- **Metrics**: CPU, memory, and request metrics
- **Health Checks**: Automatic health monitoring

### Troubleshooting

**Build Issues**:
- Ensure all dependencies are in `package.json`
- Check that `npm run build` works locally

**Runtime Issues**:
- Check logs in DigitalOcean Console
- Verify `npm start` works locally
- Ensure `serve` package is installed

**CSS/Asset Issues**:
- The app uses `serve` to serve static assets
- All assets should be in the `dist` folder after build 