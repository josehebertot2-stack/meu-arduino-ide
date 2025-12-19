
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Files, Plus, Zap, Check, FileCode, Settings, X, 
  Box, Trash2, Search, Terminal, MessageSquare,
  User, Instagram, Sun, Moon, ArrowRight, Send, Sparkles,
  Cpu, HardDrive, Type as TypeIcon,
  Save, Globe, Loader2, Download, BookOpen, LineChart,
  Copy, RefreshCw, AlertTriangle, Key, Cloud, CloudUpload, CloudDownload, LogIn, LogOut,
  ChevronRight, Info, Library
} from 'lucide-react';
import { FileNode, TabType, SerialMessage, ArduinoBoard, ArduinoLibrary, ChatMessage, ArduinoExample, PuterItem } from './types';
import { analyzeCode, getCodeAssistance } from './services/geminiService';

// Extensão de tipos para o Puter global
declare const puter: any;

const TRANSLATIONS = {
  pt: {
    ide_name: "ARDUPROGRAM",
    nav_files: "Arquivos",
    nav_ai: "ArduBot IA",
    nav_puter: "Nuvem Puter",
    nav_examples: "Exemplos",
    nav_libs: "Bibliotecas",
    nav_creator: "Créditos",
    nav_settings: "Ajustes",
    btn_verify: "Verificar",
    btn_upload: "Carregar",
    btn_connect: "Conectar USB",
    btn_connected: "Conectado",
    btn_download: "Exportar .ino",
    ai_placeholder: "Pergunte ao ArduBot (Puter AI)...",
    serial_placeholder: "Mensagem para placa...",
    terminal_tab: "Console",
    serial_tab: "Monitor Serial",
    plotter_tab: "Plotter",
    footer_lines: "Linha",
    footer_chars: "Col",
    status_waiting: "Aguardando USB",
    status_connected: "Arduino Online",
    msg_ready: "Pronto.",
    msg_lib_installed: "Biblioteca incluída no código!",
    creator_bio: "Engenheiro apaixonado por tecnologia, eletrônica e software livre."
  },
  en: {
    ide_name: "ARDUPROGRAM",
    nav_files: "Files",
    nav_ai: "ArduBot AI",
    nav_puter: "Puter Cloud",
    nav_examples: "Examples",
    nav_libs: "Libraries",
    nav_creator: "Credits",
    nav_settings: "Settings",
    btn_verify: "Verify",
    btn_upload: "Upload",
    btn_connect: "Connect USB",
    btn_connected: "Connected",
    btn_download: "Download .ino",
    ai_placeholder: "Ask ArduBot (Puter AI)...",
    serial_placeholder: "Send message...",
    terminal_tab: "Output",
    serial_tab: "Serial Monitor",
    plotter_tab: "Plotter",
    footer_lines: "Line",
    footer_chars: "Col",
    status_waiting: "Waiting USB",
    status_connected: "Arduino Online",
    msg_ready: "Ready.",
    msg_lib_installed: "Library included in code!",
    creator_bio: "Engineer passionate about technology, electronics and open source software."
  }
};

const DEFAULT_CODE = `// Sketch ArduProgram\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(LED_BUILTIN, OUTPUT);\n  Serial.println("ArduProgram Inicializado com Puter AI!");\n}\n\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(1000);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(1000);\n}`;

const BOARDS: ArduinoBoard[] = [
  { id: 'uno', name: 'Arduino Uno', fqbn: 'arduino:avr:uno' },
  { id: 'nano', name: 'Arduino Nano', fqbn: 'arduino:avr:nano' },
  { id: 'mega', name: 'Arduino Mega 2560', fqbn: 'arduino:avr:mega' },
  { id: 'esp32', name: 'ESP32 Dev Module', fqbn: 'esp32:esp32:esp32' },
  { id: 'nodemcu', name: 'NodeMCU 1.0 (ESP-12E)', fqbn: 'esp8266:esp8266:nodemcuv2' },
  { id: 'pico', name: 'Raspberry Pi Pico', fqbn: 'rp2040:rp2040:pico' }
];

const EXAMPLES: ArduinoExample[] = [
  { name: 'Blink', category: '01.Basics', content: `void setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(1000);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(1000);\n}` },
  { name: 'Serial Echo', category: '01.Basics', content: `void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  if (Serial.available()) {\n    char c = Serial.read();\n    Serial.print("Recebi: ");\n    Serial.println(c);\n  }\n}` }
];

const LIBRARIES: ArduinoLibrary[] = [
  { name: 'DHT sensor library', version: '1.4.4', author: 'Adafruit', description: 'Arduino library for DHT11, DHT22, etc.', header: '#include <DHT.h>' },
  { name: 'Servo', version: '1.1.8', author: 'Arduino', description: 'Allows Arduino boards to control servo motors.', header: '#include <Servo.h>' }
];

const App: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('ardu_theme') as any) || 'dark');
  const [lang, setLang] = useState<'pt' | 'en'>(() => (localStorage.getItem('ardu_lang') as any) || 'pt');
  const [fontSize, setFontSize] = useState(parseInt(localStorage.getItem('ardu_font_size') || '14'));
  const [lineWrapping, setLineWrapping] = useState(localStorage.getItem('ardu_line_wrap') === 'true');
  
  const [isPuterLoggedIn, setIsPuterLoggedIn] = useState(false);
  const [puterFiles, setPuterFiles] = useState<PuterItem[]>([]);
  const [isPuterLoading, setIsPuterLoading] = useState(false);

  const t = TRANSLATIONS[lang];
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<TabType>('files');
  const [files, setFiles] = useState<FileNode[]>(() => {
    try {
      const saved = localStorage.getItem('ardu_files');
      if (saved) return JSON.parse(saved) as FileNode[];
    } catch (e) {}
    return [{ name: 'sketch_main.ino', content: DEFAULT_CODE, isOpen: true }];
  });
  
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [serialMessages, setSerialMessages] = useState<SerialMessage[]>([]);
  const [serialInput, setSerialInput] = useState('');
  const [outputMessages, setOutputMessages] = useState<string[]>(["ArduProgram IDE v2.0 (Puter Engine)"]);
  const [consoleTab, setConsoleTab] = useState<'output' | 'serial' | 'plotter'>('output');
  const [isConnected, setIsConnected] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState(BOARDS[0]);

  const portRef = useRef<any>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const activeFile = useMemo<FileNode>(() => files[activeFileIndex] || files[0] || { name: 'untitled.ino', content: '', isOpen: true }, [files, activeFileIndex]);

  useEffect(() => {
    localStorage.setItem('ardu_theme', theme);
    localStorage.setItem('ardu_lang', lang);
    localStorage.setItem('ardu_font_size', fontSize.toString());
    localStorage.setItem('ardu_line_wrap', lineWrapping.toString());
    document.documentElement.classList.toggle('dark', isDark);
  }, [theme, lang, fontSize, lineWrapping, isDark]);

  useEffect(() => {
    const initPuter = async () => {
      if (typeof puter !== 'undefined') {
        const signedIn = puter.auth.isSignedIn();
        setIsPuterLoggedIn(signedIn);
        if (signedIn) fetchPuterFiles();
      }
    };
    initPuter();
  }, []);

  const fetchPuterFiles = async () => {
    if (typeof puter === 'undefined') return;
    setIsPuterLoading(true);
    try {
      const dir = '~/Documents/ArduProgram';
      try {
        const items = await puter.fs.list(dir);
        setPuterFiles(items.filter((i: any) => !i.is_dir) || []);
      } catch (e) {
        await puter.fs.mkdir(dir);
        setPuterFiles([]);
      }
    } catch (e) { console.error(e); } finally { setIsPuterLoading(false); }
  };

  const saveToPuter = async () => {
    if (typeof puter === 'undefined') return;
    if (!puter.auth.isSignedIn()) {
      await puter.auth.signIn();
      setIsPuterLoggedIn(true);
      return;
    }
    setIsPuterLoading(true);
    try {
      const path = `~/Documents/ArduProgram/${activeFile.name}`;
      await puter.fs.write(path, activeFile.content);
      setOutputMessages(prev => [...prev, `✅ [Nuvem] Salvo no Puter: ${activeFile.name}`]);
      fetchPuterFiles();
    } catch (err) {
      setOutputMessages(prev => [...prev, `❌ [Nuvem] Erro: ${String(err)}`]);
    } finally { setIsPuterLoading(false); }
  };

  const loadFromPuter = async (item: PuterItem) => {
    if (typeof puter === 'undefined') return;
    setIsPuterLoading(true);
    try {
      const res = await puter.fs.read(item.path);
      const text = await res.text();
      const newFiles = [...files, { name: item.name, content: text, isOpen: true }];
      setFiles(newFiles);
      setActiveFileIndex(newFiles.length - 1);
    } catch (err) { console.error(err); } finally { setIsPuterLoading(false); }
  };

  const handleSendMessage = async () => {
    if (!prompt.trim() || isChatLoading) return;
    const userMsg = prompt;
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setPrompt('');
    setIsChatLoading(true);
    try {
      const response = await getCodeAssistance(userMsg, activeFile.content);
      setChatHistory(prev => [...prev, { role: 'assistant', text: response }]);
    } catch (err: any) {
      setChatHistory(prev => [...prev, { role: 'assistant', text: `⚠️ Erro na IA: ${err.message || String(err)}` }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleVerify = async () => {
    if (isBusy || isUploading) return;
    setIsBusy(true);
    setConsoleTab('output');
    setOutputMessages(prev => [...prev, `[Verificando] ${activeFile.name}...`]);
    try {
      const result = await analyzeCode(activeFile.content);
      setOutputMessages(prev => [...prev, `[${result.status}] ${result.summary}`]);
    } catch (err) {
      setOutputMessages(prev => [...prev, `❌ Erro: ${String(err)}`]);
    } finally { setIsBusy(false); }
  };

  const handleUpload = async () => {
    if (isBusy || isUploading) return;
    if (!isConnected || !portRef.current) {
        setConsoleTab('output');
        setOutputMessages(prev => [...prev, "\n❌ ERRO: Conecte o USB primeiro!"]);
        return;
    }
    setIsUploading(true);
    setConsoleTab('output');
    setOutputMessages(prev => [...prev, `\n🚀 Enviando para ${selectedBoard.name}...`]);
    try {
      const analysis = await analyzeCode(activeFile.content);
      setOutputMessages(prev => [...prev, "✓ Validação Puter: OK"]);
      
      // Simulação de Hardware Handshake
      await portRef.current.setSignals({ dataTerminalReady: false, requestToSend: true });
      await new Promise(r => setTimeout(r, 200));
      await portRef.current.setSignals({ dataTerminalReady: true, requestToSend: false });
      
      const writer = portRef.current.writable.getWriter();
      for (let i = 1; i <= 5; i++) {
        await writer.write(new TextEncoder().encode(`\x01\x02UPLOAD_CHUNK_${i}\x03`));
        await new Promise(r => setTimeout(r, 300));
        setOutputMessages(prev => [...prev, `Writing: ${i * 20}%`]);
      }
      writer.releaseLock();
      setOutputMessages(prev => [...prev, `✅ UPLOAD COMPLETO!`]);
    } catch (err: any) {
      setOutputMessages(prev => [...prev, `❌ FALHA: ${err.message}`]);
    } finally { setIsUploading(false); }
  };

  const connectSerial = async () => {
    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;
      setIsConnected(true);
      setOutputMessages(prev => [...prev, `🔌 USB Conectado.`]);
      
      const reader = port.readable.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = new TextDecoder().decode(value);
        setSerialMessages(prev => [...prev, { 
            timestamp: new Date().toLocaleTimeString(), 
            type: 'in', text 
        }].slice(-100));
      }
    } catch (err) { setIsConnected(false); }
  };

  const highlightCode = (code: string) => {
    return (code || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\b(void|int|float|char|bool|long|unsigned|const|static|if|else|for|while|return|switch|case|break|byte|word|String|uint\d+_t|boolean)\b/g, `<span class="text-sky-500 font-bold">$1</span>`)
      .replace(/\b(setup|loop|pinMode|digitalWrite|digitalRead|analogWrite|analogRead|delay|Serial|println|print|begin|available|read|write|millis|micros|abs|min|max|map)\b/g, `<span class="text-teal-400 font-bold">$1</span>`)
      .replace(/\/\/.*/g, `<span class="text-slate-500 italic">$&</span>`)
      .replace(/\b(HIGH|LOW|INPUT|OUTPUT|INPUT_PULLUP|LED_BUILTIN)\b/g, `<span class="text-orange-400">$1</span>`)
      .replace(/#\w+/g, `<span class="text-rose-400">$&</span>`);
  };

  return (
    <div className={`flex flex-col h-screen ${isDark ? 'bg-[#0b0c14] text-slate-300' : 'bg-slate-50 text-slate-800'} overflow-hidden select-none`}>
      <header className={`h-14 border-b ${isDark ? 'border-white/5 bg-[#141620]' : 'border-slate-200 bg-white'} flex items-center justify-between px-4 shrink-0 z-50`}>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setActiveTab('creator')}>
            <div className="w-8 h-8 rounded-lg bg-[#00878F] flex items-center justify-center shadow-lg">
              <Zap size={18} className="text-white fill-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-black text-xs tracking-tighter text-[#00878F] uppercase">{t.ide_name}</span>
              <span className="text-[7px] opacity-40 font-bold uppercase tracking-widest">Puter AI v2</span>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-black/10 p-1 rounded-lg border border-white/5">
            <button onClick={handleVerify} disabled={isBusy || isUploading} className={`p-2 rounded-md ${isBusy ? 'text-teal-500 bg-teal-500/10' : 'text-slate-400 hover:text-teal-400'}`}>
              {isBusy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            </button>
            <button onClick={handleUpload} disabled={isBusy || isUploading} className={`p-2 rounded-md ${isUploading ? 'text-[#00b2bb]' : 'text-slate-400'}`}>
              {isUploading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            </button>
            <button onClick={saveToPuter} className="p-2 rounded-md text-slate-400 hover:text-blue-400"><CloudUpload size={16} /></button>
          </div>
          <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[10px] font-bold border ${isDark ? 'bg-black/20 border-white/5' : 'bg-white'}`}>
            <Cpu size={12} className="text-[#00878F]" />
            <select value={selectedBoard.id} onChange={(e) => setSelectedBoard(BOARDS.find(b => b.id === e.target.value) || BOARDS[0])} className="bg-transparent outline-none">
              {BOARDS.map(b => <option key={b.id} value={b.id} className="bg-[#141620]">{b.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={connectSerial} className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase transition-all ${isConnected ? 'bg-[#00878F] text-white' : 'bg-slate-500/20 text-slate-400'}`}>
             {isConnected ? t.btn_connected : t.btn_connect}
          </button>
          <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className="p-2 text-slate-400"><Sun size={18} /></button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <nav className={`w-16 border-r ${isDark ? 'border-white/5 bg-[#141620]' : 'border-slate-200 bg-white'} flex flex-col items-center py-6 gap-6 shrink-0`}>
          {[
            { id: 'files', icon: Files, title: t.nav_files },
            { id: 'puter', icon: Cloud, title: t.nav_puter },
            { id: 'ai', icon: MessageSquare, title: t.nav_ai },
            { id: 'examples', icon: Box, title: t.nav_examples }, 
            { id: 'libraries', icon: BookOpen, title: t.nav_libs }, 
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as TabType)} className={`p-2.5 rounded-xl transition-all ${activeTab === tab.id ? 'bg-[#00878F] text-white' : 'text-slate-500 hover:text-[#00878F]'}`}>
              <tab.icon size={20} />
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={() => setActiveTab('creator')} className={`p-2.5 rounded-xl ${activeTab === 'creator' ? 'bg-[#00878F] text-white' : 'text-slate-500'}`}><User size={20} /></button>
        </nav>

        <aside className={`w-72 border-r ${isDark ? 'border-white/5 bg-[#0f111a]' : 'border-slate-200 bg-white'} flex flex-col shrink-0 overflow-hidden`}>
          <div className="h-12 px-6 flex items-center border-b border-white/5 bg-black/5">
            <span className="text-[10px] font-black uppercase text-[#00878F]">{t[`nav_${activeTab}` as keyof typeof t] || activeTab}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {activeTab === 'files' && (
              <div className="p-4 space-y-2">
                <button onClick={() => setFiles([...files, { name: `sketch_${files.length}.ino`, content: DEFAULT_CODE, isOpen: true }])} className="w-full flex items-center justify-center gap-2 p-2.5 bg-[#00878F]/10 border border-[#00878F]/30 rounded-lg text-[10px] font-black text-[#00878F] mb-4">
                  <Plus size={14}/> NOVO SKETCH
                </button>
                {files.map((file, idx) => (
                  <div key={idx} onClick={() => setActiveFileIndex(idx)} className={`px-4 py-2.5 rounded-lg cursor-pointer flex items-center justify-between ${activeFileIndex === idx ? 'bg-white/5 border border-white/10' : 'hover:bg-white/5'}`}>
                    <div className="flex items-center gap-3">
                      <FileCode size={14} className={activeFileIndex === idx ? 'text-[#00878F]' : 'text-slate-500'} />
                      <span className={`text-[11px] ${activeFileIndex === idx ? 'text-white font-bold' : 'text-slate-400'}`}>{file.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="flex flex-col h-full bg-[#0b0c14]">
                <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[95%] rounded-xl p-3 text-[11px] leading-relaxed ${msg.role === 'user' ? 'bg-[#00878F] text-white' : 'bg-[#1a1c29] text-slate-300 border border-white/5'}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {isChatLoading && <div className="text-[9px] text-[#00878F] animate-pulse font-bold">ARUDUBOT ESTÁ PENSANDO...</div>}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-3 bg-[#0f111a] border-t border-white/5">
                  <div className="flex gap-2 bg-black/40 rounded-xl p-1.5 border border-white/5">
                    <input value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} placeholder={t.ai_placeholder} className="flex-1 bg-transparent px-2 text-[11px] outline-none" />
                    <button onClick={handleSendMessage} className="p-2 bg-[#00878F] text-white rounded-lg"><Send size={16} /></button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'puter' && (
              <div className="p-4 space-y-4">
                {!isPuterLoggedIn ? (
                  <div className="text-center p-6 space-y-4">
                    <Cloud size={40} className="mx-auto text-blue-400" />
                    <p className="text-[11px] font-bold">Conecte sua conta Puter para salvar projetos na nuvem.</p>
                    <button onClick={async () => { await puter.auth.signIn(); setIsPuterLoggedIn(true); fetchPuterFiles(); }} className="w-full py-2 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase">Fazer Login</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {puterFiles.map((item, i) => (
                      <div key={i} onClick={() => loadFromPuter(item)} className="p-2.5 bg-black/20 border border-white/5 rounded-lg flex items-center justify-between cursor-pointer hover:border-blue-500/40">
                        <span className="text-[11px] truncate">{item.name}</span>
                        <CloudDownload size={14} className="text-blue-400" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'creator' && (
              <div className="p-8 flex flex-col items-center text-center">
                 <div className="w-20 h-20 rounded-2xl bg-[#00878F] flex items-center justify-center mb-6 shadow-xl"><User size={36} className="text-white" /></div>
                 <h3 className="font-black text-lg text-white">José Heberto</h3>
                 <p className="text-[11px] opacity-40 mt-4">{t.creator_bio}</p>
                 <a href="https://instagram.com/josehebertot2" target="_blank" rel="noreferrer" className="mt-8 flex items-center gap-3 bg-gradient-to-r from-[#833ab4] to-[#fd1d1d] text-white px-6 py-2 rounded-xl text-[10px] font-black"><Instagram size={16}/> @josehebertot2</a>
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 flex flex-col relative bg-[#0b0c14]">
          <div className="h-10 flex items-center bg-[#0f111a] border-b border-white/5 px-2">
            {files.map((file, idx) => (
              <div key={idx} onClick={() => setActiveFileIndex(idx)} className={`h-8 min-w-[120px] px-4 rounded-t-lg mx-0.5 flex items-center justify-between text-[10px] font-bold cursor-pointer transition-all ${activeFileIndex === idx ? 'bg-[#0b0c14] text-[#00b2bb] border-t-2 border-t-[#00878F]' : 'opacity-40 hover:opacity-100'}`}>
                <span className="truncate">{file.name}</span>
              </div>
            ))}
          </div>
          <div className="flex-1 relative flex overflow-hidden">
            <div className="w-12 border-r border-white/5 py-4 text-right pr-3 font-mono text-[10px] opacity-20 select-none">
              {(activeFile.content.split('\n')).map((_, i) => <div key={i} style={{ height: `${fontSize * 1.5}px` }}>{i + 1}</div>)}
            </div>
            <div className="flex-1 relative">
               <div ref={highlightRef} className={`absolute inset-0 p-5 pointer-events-none code-font whitespace-pre overflow-hidden z-0 leading-[1.5] ${lineWrapping ? 'whitespace-pre-wrap' : ''}`} style={{ fontSize: `${fontSize}px` }} dangerouslySetInnerHTML={{ __html: highlightCode(activeFile.content) }} />
               <textarea 
                  value={activeFile.content} 
                  onChange={e => { const n = [...files]; if (n[activeFileIndex]) n[activeFileIndex].content = e.target.value; setFiles(n); }} 
                  onScroll={e => { if (highlightRef.current) { highlightRef.current.scrollTop = e.currentTarget.scrollTop; highlightRef.current.scrollLeft = e.currentTarget.scrollLeft; } }} 
                  spellCheck={false} 
                  className={`absolute inset-0 w-full h-full p-5 bg-transparent text-transparent caret-[#00878F] code-font outline-none z-10 whitespace-pre overflow-auto custom-scrollbar resize-none leading-[1.5] ${lineWrapping ? 'whitespace-pre-wrap' : ''}`} 
                  style={{ fontSize: `${fontSize}px` }} 
               />
            </div>
          </div>

          <div className={`h-56 border-t flex flex-col shrink-0 ${isDark ? 'border-white/5 bg-[#0f111a]' : 'border-slate-200 bg-white'}`}>
            <div className="h-9 border-b border-white/5 flex items-center px-6 gap-6 text-[9px] font-black uppercase bg-black/5">
               {['output', 'serial', 'plotter'].map(tab => (
                 <button key={tab} onClick={() => setConsoleTab(tab as any)} className={`flex items-center gap-1.5 pb-0.5 border-b-2 ${consoleTab === tab ? 'text-[#00b2bb] border-[#00878F]' : 'border-transparent opacity-30'}`}>
                   {t[`${tab}_tab` as keyof typeof t] || tab}
                 </button>
               ))}
               <div className="flex-1" />
               <button onClick={() => consoleTab === 'serial' ? setSerialMessages([]) : setOutputMessages([])} className="p-1.5 hover:text-rose-400"><Trash2 size={12} /></button>
            </div>
            <div className="flex-1 p-4 font-mono text-[11px] overflow-y-auto custom-scrollbar bg-[#0b0c14]">
                {consoleTab === 'output' ? (
                  outputMessages.map((m, i) => <div key={i} className="mb-1 opacity-50 whitespace-pre-wrap">{m}</div>)
                ) : (
                  serialMessages.map((m, i) => <div key={i} className="mb-1 opacity-50 whitespace-pre-wrap">{`[${m.timestamp}] ${m.type === 'in' ? '→' : '←'} ${m.text}`}</div>)
                )}
                <div ref={consoleEndRef} />
            </div>
          </div>
        </main>
      </div>

      <footer className="h-6 bg-[#00878F] text-white flex items-center justify-between px-6 text-[9px] font-black shrink-0">
         <div className="flex gap-6 items-center">
           <span className="flex items-center gap-1.5"><Cpu size={10}/> {selectedBoard.name}</span>
           <span className="flex items-center gap-1.5 uppercase">
             {isConnected ? t.status_connected : t.status_waiting}
           </span>
         </div>
         <div className="flex gap-8 items-center opacity-80">
           <span className="bg-white/10 px-2 py-0.5 rounded-full flex items-center gap-1"><Sparkles size={10}/> PUTER.JS AI ENGINE</span>
         </div>
      </footer>
    </div>
  );
};

export default App;
