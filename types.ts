
export interface FileNode {
  name: string;
  content: string;
  isOpen: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  text: string;
  code?: string;
}

export type TabType = 'files' | 'ai' | 'examples' | 'libraries' | 'creator' | 'settings' | 'puter';

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

export interface PuterItem {
  name: string;
  path: string;
  is_dir: boolean;
}
