
interface Window {
  // Fix: Added '?' to make aistudio optional to match other declarations in the environment
  aistudio?: {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  };
}

interface Navigator {
  serial: {
    requestPort: () => Promise<any>;
    getPorts: () => Promise<any[]>;
  };
}

declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
  }
}
