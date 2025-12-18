
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Files, Cpu, Bug, MessageSquare, Plus, Zap, Check, AlertTriangle, 
  FileCode, Copy, Settings, Trash2, X, Sparkles, Wand2, 
  Search, BookOpen, Layers, Play, Info, Cpu as BoardIcon,
  ArrowRight, Download, Terminal as TerminalIcon, ChevronRight, Save,
  RotateCcw, Github, ExternalLink, Sliders, Type as FontIcon, Monitor,
  HardDrive, Box, Sun, Moon, HelpCircle, Instagram, Key
} from 'lucide-react';
import { FileNode, ChatMessage, TabType, SerialMessage, ArduinoExample, ArduinoBoard, ArduinoLibrary } from './types';
import { getCodeAssistance, analyzeCode } from './services/geminiService';

const EXAMPLES: ArduinoExample[] = [
  { name: 'Blink', category: 'Basics', content: `// Sketch de exemplo: Piscar LED\nvoid setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(1000);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(1000);\n}` },
  { name: 'SerialRead', category: 'Communication', content: `void setup() {\n  Serial.begin(9600);\n  Serial.println("Sistema Iniciado...");\n}\n\nvoid loop() {\n  if (Serial.available()) {\n    char c = Serial.read();\n    Serial.print("Recebi: ");\n    Serial.println(c);\n  }\n}` },
  { name: 'AnalogReadSerial', category: 'Basics', content: `void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int sensorValue = analogRead(A0);\n  Serial.println(sensorValue);\n  delay(100);\n}` }
];

const BOARDS: ArduinoBoard[] = [
  { id: 'uno', name: 'Arduino Uno', fqbn: 'arduino:avr:uno' },
  { id: 'esp32', name: 'ESP32 Dev Module', fqbn: 'esp32:esp32:esp32' },
  { id: 'nano', name: 'Arduino Nano', fqbn: 'arduino:avr:nano' },
  { id: 'mega', name: 'Arduino Mega 2560', fqbn: 'arduino:avr:mega' }
];

const LIBRARIES: ArduinoLibrary[] = [
  { name: 'Adafruit Unified Sensor', version: '1.1.4', author: 'Adafruit', description: 'Required for all Adafruit Unified Sensor based libraries.', header: '#include <Adafruit_Sensor.h>' },
  { name: 'DHT sensor library', version: '1.4.3', author: 'Adafruit', description: 'Arduino library for DHT11, DHT22, etc.', header: '#include <DHT.h>' },
  { name: 'WiFi', version: '1.2.7', author: 'Arduino', description: 'Enables network connection (local and Internet).', header: '#include <WiFi.h>' },
  { name: 'LiquidCrystal', version: '1.0.7', author: 'Arduino', description: 'Allows communication with LCDs.', header: '#include <LiquidCrystal.h>' }
];

const App: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('arduino_theme');
    return (saved as 'dark' | 'light') || 'dark';
  });
  const [activeTab, setActiveTab] = useState<TabType>('files');
  const [files, setFiles] = useState<FileNode[]>(() => {
    const saved = localStorage.getItem('arduino_ide_files');
    return saved ? JSON.parse(saved) : [{ name: 'sketch_mar24a.ino', content: EXAMPLES[0].content, isOpen: true }];
  });
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [serialMessages, setSerialMessages] = useState<SerialMessage[]>([]);
  const [outputMessages, setOutputMessages] = useState<string[]>(["IDE Iniciada com sucesso.", "Pronto para programar."]);
  const [consoleTab, setConsoleTab] = useState<'output' | 'serial'>('output');
  const [isConnected, setIsConnected] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedBoard, setSelectedBoard] = useState(BOARDS[0]);
  const [hasApiKey, setHasApiKey] = useState(true);
  
  // Settings State
  const [fontSize, setFontSize] = useState(14);
  const [showLineNumbers, setShowLineNumbers] = useState(true);

  const portRef = useRef<any>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  const activeFile = useMemo(() => files[activeFileIndex] || files[0], [files, activeFileIndex]);

  useEffect(() => {
    const checkApiKey = async () => {
      try {
        // @ts-ignore
        if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
          // @ts-ignore
          const hasKey = await window.aistudio.hasSelectedApiKey();
          setHasApiKey(hasKey);
        }
      } catch (e) {
        console.warn("AI Studio key manager not available");
      }
    };
    checkApiKey();
    
    localStorage.setItem('arduino_ide_files', JSON.stringify(files));
    localStorage.setItem('arduino_theme', theme);
  }, [files, theme]);

  useEffect(() => {
    if (consoleEndRef.current) consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [serialMessages, outputMessages]);

  const handleOpenKeySelector = async () => {
    try {
      // @ts-ignore
      if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
        // @ts-ignore
        await window.aistudio.openSelectKey();
        setHasApiKey(true);
      } else {
        alert("Gerenciador de chaves não disponível no momento.");
      }
    } catch (e) {
      console.error("Failed to open key selector", e);
    }
  };

  const downloadFile = (file: FileNode) => {
    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name.endsWith('.ino') ? file.name : `${file.name}.ino`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleVerify = async () => {
    setIsBusy(true);
    setConsoleTab('output');
    setOutputMessages(prev => [...prev, `Verificando código: ${activeFile.name}...`]);
    
    for(let i=0; i<=100; i+=10) {
      setProgress(i);
      await new Promise(r => setTimeout(r, 100));
    }

    const result = await analyzeCode(activeFile.content);
    if (result.status === 'Ok') {
      setOutputMessages(prev => [...prev, "O sketch usa 444 bytes (1%) de espaço de armazenamento de programa.", "Variáveis globais usam 9 bytes de memória dinâmica."]);
    } else {
      setOutputMessages(prev => [...prev, `[ERRO] ${result.summary}`]);
      result.issues?.forEach((issue: any) => {
        setOutputMessages(prev => [...prev, `Linha ${issue.line || '?'}: ${issue.message}`]);
      });
    }
    
    setIsBusy(false);
    setProgress(0);
  };

  const handleUpload = async () => {
    if (!isConnected) {
      setOutputMessages(prev => [...prev, "Erro: Nenhuma placa selecionada ou porta não conectada."]);
      return;
    }
    setIsBusy(true);
    setConsoleTab('output');
    setOutputMessages(prev => [...prev, `Carregando para ${selectedBoard.name}...`]);
    for(let i=0; i<=100; i+=20) {
      setProgress(i);
      await new Promise(r => setTimeout(r, 150));
    }
    setOutputMessages(prev => [...prev, "Upload concluído!", "Reiniciando placa..."]);
    setIsBusy(false);
    setProgress(0);
  };

  const handleAskAI = async () => {
    if (!prompt.trim()) return;
    const userMsg: ChatMessage = { role: 'user', text: prompt };
    setChatHistory(prev => [...prev, userMsg]);
    setPrompt('');
    const response = await getCodeAssistance(prompt, activeFile.content);
    setChatHistory(prev => [...prev, { role: 'assistant', text: response }]);
  };

  const connectSerial = async () => {
    try {
      // @ts-ignore
      if (!navigator.serial) {
        alert("Web Serial API não suportada. Use Chrome ou Edge.");
        return;
      }
      // @ts-ignore
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;
      setIsConnected(true);
      setOutputMessages(prev => [...prev, `Porta Serial aberta a 9600 baud.`]);
      const reader = port.readable.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = new TextDecoder().decode(value);
        setSerialMessages(prev => [...prev, { 
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), 
          type: 'in', 
          text 
        }]);
      }
    } catch (err) {
      console.error(err);
      setIsConnected(false);
    }
  };

  const handleResetData = () => {
    if (confirm("⚠️ ATENÇÃO: Isso apagará permanentemente todos os seus sketches e configurações salvas. Deseja continuar?")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const highlightCode = (code: string) => {
    const isDark = theme === 'dark';
    return code
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\b(void|int|float|char|bool|long|unsigned|const|static|if|else|for|while|return|switch|case|break|byte|word|String)\b/g, `<span class="${isDark ? 'text-pink-400' : 'text-pink-600'} font-bold">$1</span>`)
      .replace(/\b(setup|loop|pinMode|digitalWrite|digitalRead|analogWrite|analogRead|delay|Serial|println|print|begin|available|read|write|millis)\b/g, `<span class="${isDark ? 'text-teal-400' : 'text-teal-600'} font-bold">$1</span>`)
      .replace(/\/\/.*/g, `<span class="${isDark ? 'text-slate-500' : 'text-slate-400'} italic">$&</span>`)
      .replace(/#\w+/g, `<span class="${isDark ? 'text-orange-400' : 'text-orange-600'}">$&</span>`)
      .replace(/"[^"]*"/g, `<span class="${isDark ? 'text-green-400' : 'text-green-700'}">$&</span>`)
      .replace(/\b(HIGH|LOW|INPUT|OUTPUT|INPUT_PULLUP|LED_BUILTIN)\b/g, `<span class="${isDark ? 'text-orange-300' : 'text-orange-500'} font-semibold">$1</span>`);
  };

  const createNewFile = () => {
    const name = `sketch_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '')}${files.length}.ino`;
    setFiles([...files, { name, content: '// Novo sketch\nvoid setup() {\n\n}\n\nvoid loop() {\n\n}', isOpen: true }]);
    setActiveFileIndex(files.length);
  };

  const bgMain = theme === 'dark' ? 'bg-[#0b0e14]' : 'bg-[#f6f6f6]';
  const bgToolbar = theme === 'dark' ? 'bg-[#1c1f24]' : 'bg-white shadow-sm';
  const bgSidebar = theme === 'dark' ? 'bg-[#0b0e14]' : 'bg-white';
  const bgActivityBar = theme === 'dark' ? 'bg-[#1c1f24]' : 'bg-[#f0f0f0]';
  const bgEditor = theme === 'dark' ? 'bg-[#0d1117]' : 'bg-white';
  const textMain = theme === 'dark' ? 'text-slate-300' : 'text-slate-800';
  const borderMain = theme === 'dark' ? 'border-white/5' : 'border-slate-200';
  const bgConsole = theme === 'dark' ? 'bg-[#0b0e14]' : 'bg-white';
  const bgConsoleInner = theme === 'dark' ? 'bg-[#05070a]' : 'bg-[#fbfbfb]';

  return (
    <div className={`flex flex-col h-screen ${bgMain} ${textMain} font-sans overflow-hidden transition-colors duration-200`}>
      {/* TOOLBAR */}
      <header className={`h-12 border-b ${borderMain} flex items-center justify-between px-4 ${bgToolbar} z-30 shrink-0`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 mr-4">
            <div className="w-8 h-8 bg-[#008184] rounded-lg flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform cursor-pointer">
              <Zap size={18} className="text-white" fill="currentColor" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleVerify} disabled={isBusy} className={`w-8 h-8 rounded-full border ${borderMain} flex items-center justify-center ${theme === 'dark' ? 'text-slate-400 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-100'} hover:text-teal-400 transition-all`} title="Verificar"><Check size={18} /></button>
            <button onClick={handleUpload} disabled={isBusy} className={`w-8 h-8 rounded-full border ${borderMain} flex items-center justify-center ${theme === 'dark' ? 'text-slate-400 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-100'} hover:text-teal-400 transition-all`} title="Carregar"><ArrowRight size={18} /></button>
          </div>
          <div className={`h-6 w-[1px] ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'} mx-2`} />
          <div className={`flex items-center gap-2 ${theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-slate-50 border-slate-200'} border rounded-full px-4 py-1.5 text-[11px] font-bold text-slate-400 hover:border-teal-500/50 transition-colors`}>
            <BoardIcon size={14} className="text-teal-500" />
            <select value={selectedBoard.id} onChange={(e) => setSelectedBoard(BOARDS.find(b => b.id === e.target.value) || BOARDS[0])} className="bg-transparent border-none focus:outline-none appearance-none cursor-pointer text-slate-500">
              {BOARDS.map(b => <option key={b.id} value={b.id} className={`${theme === 'dark' ? 'bg-[#1c1f24] text-white' : 'bg-white text-slate-800'}`}>{b.name}</option>)}
            </select>
          </div>
          <button onClick={connectSerial} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all flex items-center gap-2 ${isConnected ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30' : theme === 'dark' ? 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-teal-400 animate-pulse' : 'bg-slate-400'}`} />
            {isConnected ? 'Porta Ativa' : 'Desconectado'}
          </button>
        </div>
        {!hasApiKey && (
          <div className="flex-1 mx-4">
             <div onClick={handleOpenKeySelector} className="bg-orange-500/10 border border-orange-500/30 rounded-lg px-3 py-1 flex items-center justify-between cursor-pointer hover:bg-orange-500/20 transition-all animate-pulse">
                <span className="text-[10px] text-orange-400 font-bold flex items-center gap-2"><AlertTriangle size={14}/> Configuração Necessária: Clique para selecionar sua chave de API</span>
                <Key size={12} className="text-orange-400"/>
             </div>
          </div>
        )}
        <div className="flex items-center gap-4">
           <Github size={18} className="text-slate-500 cursor-pointer hover:text-teal-600 transition-colors"/>
        </div>
      </header>

      {progress > 0 && <div className="h-1 w-full bg-white/5 overflow-hidden"><div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${progress}%` }} /></div>}

      <div className="flex flex-1 overflow-hidden">
        {/* ACTIVITY BAR */}
        <nav className={`w-14 border-r ${borderMain} ${bgActivityBar} flex flex-col items-center py-6 gap-6 z-20 shrink-0`}>
          {[
            { id: 'files', icon: Files, label: 'Arquivos' },
            { id: 'boards', icon: Layers, label: 'Gerenciador de Placas' },
            { id: 'libraries', icon: Box, label: 'Gerenciador de Bibliotecas' },
            { id: 'examples', icon: BookOpen, label: 'Exemplos' },
            { id: 'ai', icon: MessageSquare, label: 'Gemini Copilot' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as TabType)} className={`p-2.5 rounded-xl transition-all relative group ${activeTab === tab.id ? 'text-teal-400 bg-teal-400/10' : theme === 'dark' ? 'text-slate-600 hover:text-slate-400' : 'text-slate-400 hover:text-slate-600'}`}>
              <tab.icon size={22}/>
              <span className="absolute left-full ml-4 px-2 py-1 bg-black text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">{tab.label}</span>
            </button>
          ))}
          <div className="mt-auto flex flex-col gap-6 pb-4">
            <button onClick={() => setActiveTab('settings')} className={`p-2.5 rounded-xl transition-all relative group ${activeTab === 'settings' ? 'text-teal-400 bg-teal-400/10' : theme === 'dark' ? 'text-slate-600 hover:text-slate-400' : 'text-slate-400 hover:text-slate-600'}`}>
              <Settings size={22}/>
            </button>
          </div>
        </nav>

        {/* SIDEBAR CONTENT */}
        <aside className={`w-72 border-r ${borderMain} ${bgSidebar} flex flex-col overflow-hidden animate-in fade-in duration-300 shrink-0`}>
          <div className={`p-4 border-b ${borderMain} flex justify-between items-center ${theme === 'dark' ? 'bg-black/20' : 'bg-slate-50'}`}>
            <h2 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
              {activeTab === 'ai' ? 'Gemini Copilot' : activeTab === 'settings' ? 'Preferências' : activeTab}
            </h2>
            {activeTab === 'files' && <Plus size={14} className="text-slate-500 cursor-pointer hover:text-teal-600 transition-colors" onClick={createNewFile} />}
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {activeTab === 'files' && (
              <div className="p-2 space-y-1">
                {files.map((file, idx) => (
                  <div key={idx} onClick={() => setActiveFileIndex(idx)} className={`flex items-center justify-between group px-3 py-2 rounded-lg cursor-pointer transition-all ${activeFileIndex === idx ? 'bg-teal-500/10 text-teal-400' : theme === 'dark' ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>
                    <div className="flex items-center gap-3 truncate">
                      <FileCode size={16} className={activeFileIndex === idx ? 'text-teal-400' : 'text-slate-400'} />
                      <span className="text-xs font-medium truncate">{file.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="p-6 space-y-8 animate-in slide-in-from-bottom-2 pb-10">
                 <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500">
                       <Key size={14}/> API Gemini
                    </div>
                    <button onClick={handleOpenKeySelector} className="w-full py-2.5 bg-teal-500 text-black rounded-lg text-[10px] font-black hover:bg-teal-400 transition-all flex items-center justify-center gap-2 shadow-lg">
                      {hasApiKey ? 'RECONFIGURAR CHAVE API' : 'CONFIGURAR CHAVE API'}
                    </button>
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-[9px] text-teal-500 hover:underline block text-center">Saiba mais sobre faturamento e limites</a>
                 </div>

                 <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500">
                       <Monitor size={14}/> Tema da Interface
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                       <button onClick={() => setTheme('dark')} className={`p-3 rounded-xl text-[10px] font-bold flex flex-col items-center gap-2 transition-all border ${theme === 'dark' ? 'bg-teal-500/10 border-teal-500 text-teal-400 active-glow' : 'bg-white/5 border-transparent text-slate-500 grayscale'}`}><Moon size={16}/> Escuro</button>
                       <button onClick={() => setTheme('light')} className={`p-3 rounded-xl text-[10px] font-bold flex flex-col items-center gap-2 transition-all border ${theme === 'light' ? 'bg-teal-500/10 border-teal-500 text-teal-600 active-glow' : 'bg-slate-100 border-transparent text-slate-400'}`}><Sun size={16}/> Claro</button>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500">
                       <FontIcon size={14}/> Editor
                    </div>
                    <div className="space-y-3">
                       <label className="text-xs text-slate-400 block">Tamanho da Fonte: <span className="text-teal-500 font-bold">{fontSize}px</span></label>
                       <input type="range" min="10" max="24" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="w-full accent-teal-500 h-1 bg-slate-300 rounded-full appearance-none"/>
                    </div>
                 </div>

                 <div className="space-y-4 pt-6 border-t border-slate-200/10">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500">
                       <Sliders size={14}/> Desenvolvedor
                    </div>
                    <div className={`p-4 rounded-2xl border ${theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'} space-y-4`}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px] shadow-lg">
                          <div className={`w-full h-full rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-[#0b0e14]' : 'bg-white'}`}>
                            <Instagram size={18} className="text-pink-500" />
                          </div>
                        </div>
                        <div>
                          <p className={`text-xs font-black uppercase tracking-tighter ${theme === 'dark' ? 'text-teal-400' : 'text-teal-600'}`}>José Heberto Torres da Costa</p>
                          <a href="https://instagram.com/josehebertot2" target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-slate-500 hover:text-pink-500 transition-colors flex items-center gap-1">@josehebertot2 <ExternalLink size={10} /></a>
                        </div>
                      </div>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <button onClick={handleResetData} className="w-full py-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg text-[10px] font-bold transition-all border border-red-500/20 flex items-center justify-center gap-2"><RotateCcw size={14}/> RESETAR TODOS OS DADOS</button>
                 </div>
              </div>
            )}

            {activeTab === 'ai' && (
              <div className={`flex flex-col h-full ${theme === 'dark' ? 'bg-[#0d1117]' : 'bg-white'}`}>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-[11px]">
                  {!hasApiKey && (
                    <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl text-center space-y-3">
                      <Key className="mx-auto text-orange-400" size={24}/>
                      <p className="text-orange-400 font-bold">API Gemini não configurada</p>
                      <button onClick={handleOpenKeySelector} className="px-4 py-2 bg-orange-500 text-white rounded-lg font-bold text-[10px]">SELECIONAR CHAVE</button>
                    </div>
                  )}
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`p-4 rounded-2xl ${msg.role === 'user' ? (theme === 'dark' ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200') : (theme === 'dark' ? 'bg-teal-500/5 border-teal-500/10' : 'bg-teal-50/50 border-teal-100')} border ${msg.role === 'user' ? 'ml-4' : 'mr-4'}`}>
                      <div className="font-black uppercase text-[8px] mb-2 opacity-50 flex items-center gap-2">{msg.role === 'user' ? <Info size={10}/> : <Sparkles size={10} className="text-teal-500"/>}{msg.role === 'user' ? 'Você' : 'Gemini AI'}</div>
                      <div className={`whitespace-pre-wrap leading-relaxed prose prose-invert max-w-none ${theme === 'light' ? 'text-slate-700' : ''}`}>{msg.text}</div>
                    </div>
                  ))}
                </div>
                <div className={`p-4 border-t ${borderMain} ${theme === 'dark' ? 'bg-black/20' : 'bg-slate-50'}`}>
                  <div className="relative">
                    <textarea value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleAskAI())} placeholder="Pergunte qualquer coisa..." className={`w-full ${theme === 'dark' ? 'bg-[#1c1f24] border-white/10' : 'bg-white border-slate-200'} border rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-teal-500/50 resize-none h-24 custom-scrollbar transition-all`} />
                    <button onClick={handleAskAI} className="absolute bottom-4 right-4 p-2 bg-teal-500 text-black rounded-xl hover:bg-teal-400 transition-all shadow-lg active:scale-95"><Wand2 size={16} /></button>
                  </div>
                </div>
              </div>
            )}
            {/* Library Manager Tab (Simplified representation) */}
            {activeTab === 'libraries' && (
              <div className="p-4 space-y-4">
                 {LIBRARIES.map((lib, i) => (
                   <div key={i} className={`p-4 rounded-xl border ${borderMain} ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'}`}>
                      <p className="text-xs font-black text-teal-500">{lib.name}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{lib.description}</p>
                      <button onClick={() => setFiles(prev => {
                        const next = [...prev];
                        if (!next[activeFileIndex].content.includes(lib.header)) {
                          next[activeFileIndex].content = lib.header + "\n" + next[activeFileIndex].content;
                        }
                        return next;
                      })} className="mt-3 w-full py-1.5 bg-teal-500/10 text-teal-500 border border-teal-500/20 rounded-lg text-[10px] font-bold uppercase hover:bg-teal-500 hover:text-black transition-all">Instalar</button>
                   </div>
                 ))}
              </div>
            )}
            {/* Examples Tab */}
            {activeTab === 'examples' && (
              <div className="p-2 space-y-1">
                {EXAMPLES.map((example, i) => (
                  <div key={i} onClick={() => {
                    const name = `${example.name}.ino`;
                    setFiles([...files, { name, content: example.content, isOpen: true }]);
                    setActiveFileIndex(files.length);
                  }} className={`px-4 py-3 rounded-xl border border-transparent hover:border-teal-500/30 cursor-pointer ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}>
                    <p className="text-[10px] font-black uppercase text-teal-500 mb-1">{example.category}</p>
                    <p className="text-xs font-bold">{example.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* EDITOR AREA */}
        <main className={`flex-1 flex flex-col ${bgEditor} relative`}>
          <div className={`h-9 ${theme === 'dark' ? 'bg-[#1c1f24]' : 'bg-[#f0f0f0]'} border-b ${borderMain} flex items-center px-1 overflow-x-auto no-scrollbar shrink-0`}>
            {files.map((file, idx) => (
              <div key={idx} onClick={() => setActiveFileIndex(idx)} className={`h-full flex items-center px-4 text-[11px] font-medium cursor-pointer transition-all border-r ${borderMain} whitespace-nowrap gap-3 group ${activeFileIndex === idx ? (theme === 'dark' ? 'bg-[#0d1117] text-teal-400' : 'bg-white text-teal-600') : 'text-slate-400 hover:text-slate-600'}`}>
                <FileCode size={14}/> <span>{file.name}</span>
                {files.length > 1 && <X size={12} className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity" onClick={(e) => { e.stopPropagation(); const newFiles = files.filter((_, i) => i !== idx); setFiles(newFiles); setActiveFileIndex(0); }}/>}
              </div>
            ))}
            <button onClick={createNewFile} className="p-2 text-slate-400 hover:text-teal-500"><Plus size={16}/></button>
          </div>

          <div className="flex-1 relative flex overflow-hidden group">
            {showLineNumbers && (
              <div className={`w-12 ${theme === 'dark' ? 'bg-[#1c1f24]/30' : 'bg-slate-50'} border-r ${borderMain} py-5 flex flex-col items-center text-slate-400 font-mono select-none`} style={{ fontSize: `${fontSize}px`, lineHeight: `${fontSize * 1.5}px` }}>
                {activeFile.content.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
              </div>
            )}
            <div className="flex-1 relative">
               <div ref={highlightRef} className="absolute inset-0 p-5 pointer-events-none code-font whitespace-pre overflow-hidden z-0" 
                    style={{ fontSize: `${fontSize}px`, lineHeight: `${fontSize * 1.5}px` }}
                    dangerouslySetInnerHTML={{ __html: highlightCode(activeFile.content) }} />
               <textarea 
                  value={activeFile.content} 
                  onChange={e => { const newFiles = [...files]; newFiles[activeFileIndex].content = e.target.value; setFiles(newFiles); }} 
                  onScroll={(e) => { if (highlightRef.current) { highlightRef.current.scrollTop = e.currentTarget.scrollTop; highlightRef.current.scrollLeft = e.currentTarget.scrollLeft; } }}
                  spellCheck={false}
                  style={{ fontSize: `${fontSize}px`, lineHeight: `${fontSize * 1.5}px` }}
                  className="absolute inset-0 w-full h-full p-5 bg-transparent text-transparent caret-teal-400 code-font resize-none focus:outline-none z-10 whitespace-pre overflow-auto custom-scrollbar"
               />
               <div className="absolute top-4 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => downloadFile(activeFile)} className={`p-2 ${theme === 'dark' ? 'bg-black/60' : 'bg-white shadow-lg'} hover:bg-teal-500 hover:text-black rounded-xl text-slate-400 border ${borderMain} backdrop-blur-md`} title="Salvar Local"><Save size={16}/></button>
               </div>
            </div>
          </div>

          {/* CONSOLE */}
          <div className={`h-64 border-t ${borderMain} ${bgConsole} flex flex-col shrink-0`}>
            <div className={`h-9 border-b ${borderMain} flex items-center justify-between px-4 ${theme === 'dark' ? 'bg-black/40' : 'bg-slate-50'} shrink-0`}>
              <div className="flex gap-6 h-full items-center">
                <button onClick={() => setConsoleTab('output')} className={`text-[10px] font-black uppercase h-full transition-all border-b-2 ${consoleTab === 'output' ? 'text-teal-500 border-teal-500' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>Output</button>
                <button onClick={() => setConsoleTab('serial')} className={`text-[10px] font-black uppercase h-full transition-all border-b-2 ${consoleTab === 'serial' ? 'text-teal-500 border-teal-500' : 'text-slate-400 border-transparent hover:text-slate-600'}`}>Serial Monitor</button>
              </div>
              <div className="flex items-center gap-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                <button onClick={() => consoleTab === 'output' ? setOutputMessages([]) : setSerialMessages([])} className="hover:text-teal-500 transition-colors flex items-center gap-1"><RotateCcw size={12}/> Limpar</button>
                <span className="opacity-30">|</span>
                <span>9600 Baud</span>
              </div>
            </div>
            <div className={`flex-1 overflow-y-auto p-4 font-mono text-[12px] custom-scrollbar ${bgConsoleInner}`}>
              {consoleTab === 'output' ? (
                <div className="space-y-1">
                  {outputMessages.map((m, i) => <div key={i} className={`${m.includes('[ERRO]') ? 'text-red-400' : theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}><span className="opacity-30 mr-2">></span> {m}</div>)}
                  {outputMessages.length === 0 && <div className="text-slate-400 italic">Console vazio.</div>}
                </div>
              ) : (
                <div className="space-y-1">
                  {serialMessages.length === 0 && <div className="text-slate-400 flex items-center gap-2 italic"><TerminalIcon size={14}/> Aguardando dados serial...</div>}
                  {serialMessages.map((msg, i) => <div key={i} className="flex gap-4 group"><span className="text-slate-400 shrink-0 font-bold">[{msg.timestamp}]</span><span className="text-teal-500">{msg.text}</span></div>)}
                </div>
              )}
              <div ref={consoleEndRef} />
            </div>
          </div>
        </main>
      </div>

      {/* FOOTER */}
      <footer className="h-6 bg-[#008184] text-white flex items-center justify-between px-4 text-[10px] font-bold uppercase tracking-wider shrink-0">
         <div className="flex gap-6 items-center">
           <span className="flex items-center gap-1.5"><BoardIcon size={12}/> {selectedBoard.name}</span>
           <span className="opacity-50">|</span>
           <span className="flex items-center gap-1.5"><div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-white animate-pulse' : 'bg-white/30'}`} />{isConnected ? 'Porta Serial Conectada' : 'Offline'}</span>
         </div>
         <div className="flex gap-6">
           <span>Ln {activeFile.content.split('\n').length}, Col 1</span>
           <span className="bg-black/20 px-2 rounded flex items-center gap-1"><Zap size={10}/> v2.1.2-Flash</span>
         </div>
      </footer>
    </div>
  );
};

export default App;
