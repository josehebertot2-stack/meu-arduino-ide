
export interface FileNode {
  name: string;
  content: string;
  isOpen: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  code?: string;
}

// Added 'settings' to the TabType union to allow correct type checking in the UI
export type TabType = 'files' | 'ai' | 'examples' | 'boards' | 'libraries' | 'debug' | 'creator' | 'settings';

export interface SerialMessage {
  timestamp: string;
  type: 'in' | 'out';
  text: string;
  value?: number;
}

export interface ArduinoExample {
  name: string;
  category: string;
  content: string;
}

export interface ArduinoBoard {
  id: string;
  name: string;
  fqbn: string;
}

export interface ArduinoLibrary {
  name: string;
  version: string;
  author: string;
  description: string;
  header: string;
}
