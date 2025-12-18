
interface Window {
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