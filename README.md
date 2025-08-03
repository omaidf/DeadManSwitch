# Dead Man's Switch dApp - React Version

A pure React implementation of the Dead Man's Switch dApp, converted from the original Next.js version. This decentralized application allows users to create time-locked encrypted secrets that automatically reveal if they fail to reset the timer within a specified interval.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- NPM or Yarn
- A Solana wallet (Phantom or Solflare recommended)

### Installation

1. **Clone and navigate to the React app:**
```bash
cd react-app
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:
```env
VITE_SOLANA_NETWORK=devnet
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
VITE_PROGRAM_ID=f9kTeCnUyNX3Pg43d7DtjNixVYHLBynCY5ukfXDXcrs
VITE_LIT_NETWORK=datil-dev
```

3. **Start the development server:**
```bash
npm run dev
```

4. **Open your browser:**
Navigate to `http://localhost:3000`

## 📁 Project Structure

```
react-app/
├── src/
│   ├── components/          # React components
│   │   ├── WalletProvider.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── Layout.tsx
│   │   ├── Sidebar.tsx
│   │   ├── WalletButton.tsx
│   │   └── NetworkStatus.tsx
│   ├── pages/              # Page components
│   │   ├── HomePage.tsx
│   │   ├── CreatePage.tsx
│   │   ├── MyLocksPage.tsx
│   │   ├── PublicUnlocksPage.tsx
│   │   ├── HelpPage.tsx
│   │   └── AboutPage.tsx
│   ├── hooks/              # Custom React hooks
│   │   ├── useWalletAuth.ts
│   │   ├── useProgram.ts
│   │   ├── useLitProtocol.ts
│   │   ├── useIpfs.ts
│   │   ├── useNetworkStats.ts
│   │   └── useUserSwitches.ts
│   ├── lib/                # Utility libraries
│   │   ├── env-validation.ts
│   │   ├── time-utils.ts
│   │   ├── rate-limit.ts
│   │   ├── retry-utils.ts
│   │   └── wallet-utils.ts
│   ├── types/              # TypeScript type definitions
│   ├── App.tsx             # Main app component
│   ├── main.tsx            # React entry point
│   ├── index.css           # Global styles
│   └── idl.json            # Anchor program IDL
├── public/                 # Static assets
├── package.json            # Dependencies and scripts
├── vite.config.ts          # Vite configuration
├── tailwind.config.js      # Tailwind CSS configuration
└── tsconfig.json           # TypeScript configuration
```

## 🔄 Key Differences from Next.js Version

### Routing
- **Next.js:** File-based routing with `app/` directory
- **React:** React Router DOM with route definitions in `App.tsx`

### Environment Variables
- **Next.js:** `NEXT_PUBLIC_*` prefix
- **React:** `VITE_*` prefix for Vite

### Build System
- **Next.js:** Built-in webpack configuration
- **React:** Vite with custom configuration for Solana/crypto polyfills

### SSR/SSG
- **Next.js:** Server-side rendering and static generation
- **React:** Client-side rendering only

### Dynamic Imports
- **Next.js:** `next/dynamic` for code splitting
- **React:** React lazy loading and standard dynamic imports

## 🔧 Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run TypeScript checks
npm run lint

# Solana/Anchor commands (run from parent directory)
npm run anchor:build     # Build Anchor program
npm run anchor:deploy    # Deploy to devnet
npm run anchor:test      # Run tests
npm run check:deployment # Verify deployment
```

## 🌐 Environment Configuration

### Required Variables
```env
VITE_PROGRAM_ID=f9kTeCnUyNX3Pg43d7DtjNixVYHLBynCY5ukfXDXcrs
```

### Optional Variables
```env
VITE_SOLANA_NETWORK=devnet                    # mainnet-beta, testnet, devnet
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
VITE_LIT_NETWORK=datil-dev                    # datil-dev, datil-test
```

## 🔌 Browser Compatibility

The app includes polyfills for Node.js modules to work in browsers:
- `crypto` → `crypto-browserify`
- `stream` → `stream-browserify`
- `buffer` → `buffer`
- `process` → `process/browser`

## 🚧 Current Status

### ✅ Completed
- [x] Basic React app structure
- [x] Vite configuration with Solana polyfills
- [x] Environment variable setup
- [x] Component architecture
- [x] Routing with React Router
- [x] Wallet integration (WalletProvider, WalletButton)
- [x] Layout and navigation (Sidebar, Layout)
- [x] Error boundaries
- [x] TypeScript configuration
- [x] Tailwind CSS styling
- [x] Hooks migration (core utilities)

### 🚧 In Progress
- [ ] Core components migration
  - [ ] SwitchCreator component
  - [ ] SwitchDashboard component
  - [ ] PublicUnlocksClient component
  - [ ] RevealedSecrets component
  - [ ] InputValidation component
  - [ ] LoadingSpinner component

### 📋 Todo
- [ ] API routes migration (currently in Next.js `/api` directory)
- [ ] IPFS integration testing
- [ ] Lit Protocol integration testing
- [ ] Complete component testing
- [ ] Production deployment setup
- [ ] Performance optimization

## 🔄 Migration Guide

### For Developers

1. **Component Migration:**
   - Remove `'use client'` directives
   - Replace `next/link` with `react-router-dom`
   - Update `useRouter` with `useNavigate` and `useLocation`
   - Replace `process.env.NEXT_PUBLIC_*` with `import.meta.env.VITE_*`

2. **API Routes:**
   - Current API routes in `/api` directory need to be migrated to a separate backend
   - Or adapted to work with Vite's dev server proxy

3. **Dynamic Imports:**
   - Replace `next/dynamic` with React's `lazy()` and `Suspense`

### Example Migration

**Next.js:**
```tsx
'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
```

**React:**
```tsx
import { Link, useNavigate } from 'react-router-dom';

const network = import.meta.env.VITE_SOLANA_NETWORK;
const navigate = useNavigate();
```

## 📦 Deployment

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm run preview
```

### Static Hosting
The built app is a static site that can be deployed to:
- Vercel
- Netlify
- GitHub Pages
- AWS S3 + CloudFront
- Any static hosting service

## 🔗 Related

- **Original Next.js Version:** `../` (parent directory)
- **Solana Program:** `../solana/`
- **Deployment Scripts:** `../scripts/`

## ⚠️ Important Notes

1. **Experimental:** This is a migration in progress. Not all features are complete.

2. **Testnet Only:** Currently configured for Solana devnet. Don't use real funds.

3. **API Dependencies:** Some features depend on API routes that are still in the Next.js version.

4. **Security:** Always verify transactions and never share private keys.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see the main project's LICENSE file for details.

---

**Note:** This React version is actively being developed. Check the Next.js version in the parent directory for the most complete implementation. 