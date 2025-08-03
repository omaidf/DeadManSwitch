// Global type declarations for browser polyfills

declare global {
  interface Window {
    Buffer?: typeof Buffer;
    process?: NodeJS.Process;
  }

  var Buffer: {
    from(data: any): Uint8Array;
    alloc(size: number): Uint8Array;
    isBuffer(obj: any): boolean;
  };

  var process: {
    env: {
      NODE_DEBUG?: string;
      NODE_ENV?: string;
      BROWSER?: string;
      [key: string]: string | undefined;
    };
    browser: boolean;
    version: string;
    versions: Record<string, string>;
    platform: string;
    argv: string[];
    exit: (code?: number) => void;
    nextTick: (callback: Function) => void;
    cwd: () => string;
    chdir: (directory: string) => void;
    title: string;
    pid: number;
    ppid: number;
  };
}

// Vite environment variables
interface ImportMetaEnv {
  readonly VITE_SOLANA_NETWORK: string;
  readonly VITE_SOLANA_RPC_URL: string;
  readonly VITE_PROGRAM_ID: string;
  readonly VITE_LIT_NETWORK: string;
  readonly NODE_DEBUG?: string;
  readonly NODE_ENV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};