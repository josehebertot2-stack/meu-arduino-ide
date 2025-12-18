
interface Window {}

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
