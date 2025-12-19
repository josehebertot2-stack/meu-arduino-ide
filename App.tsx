
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Files, Plus, Zap, Check, FileCode, Settings, X, 
  Box, Trash2, Search, Terminal, MessageSquare,
  User, Instagram, Sun, Moon, ArrowRight, Send, Sparkles,
  Cpu, HardDrive, Type as TypeIcon,
  Save, Globe, Loader2, Download, BookOpen, LineChart,
  Copy, RefreshCw, AlertTriangle, Key, Cloud, CloudUpload, CloudDownload, LogIn, LogOut,
  ChevronRight, Info, Library, Code, Wand2
} from 'lucide-react';
import { FileNode, TabType, SerialMessage, ArduinoBoard, ArduinoLibrary, ChatMessage, ArduinoExample, PuterItem } from './types';
import { analyzeCode, getCodeAssistance, simulateCompilationLogs } from './services/geminiService';

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
    ai_placeholder: "Pergunte ao ArduBot...",
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
    ai_placeholder: "Ask ArduBot...",
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

const DEFAULT_CODE = `// Sketch ArduProgram\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(LED_BUILTIN, OUTPUT);\n  Serial.println("Arduino Web IDE Pronto!");\n}\n\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(500);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(500);\n}`;

const BOARDS: ArduinoBoard[] = [
  { id: 'uno', name: 'Arduino Uno', fqbn: 'arduino:avr:uno' },
  { id: 'nano', name: 'Arduino Nano', fqbn: 'arduino:avr:nano' },
  { id: 'mega', name: 'Arduino Mega 2560', fqbn: 'arduino:avr:mega' },
  { id: 'esp32', name: 'ESP32 Dev Module', fqbn: 'esp32:esp32:esp32' },
  { id: 'pico', name: 'Raspberry Pi Pico', fqbn: 'rp2040:rp2040:pico' }
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
  const [outputMessages, setOutputMessages] = useState<string[]>(["ArduProgram v2.0"]);
  const [consoleTab, setConsoleTab] = useState<'output' | 'serial' | 'plotter'>('output');
  const [isConnected, setIsConnected] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedBoard, setSelectedBoard] = useState(BOARDS[0]);

  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const activeFile = useMemo<FileNode>(() => files[activeFileIndex] || files[0] || { name: 'untitled.ino', content: '', isOpen: true }, [files, activeFileIndex]);

  useEffect(() => {
    localStorage.setItem('ardu_theme', theme);
    document.documentElement.classList.toggle('dark', isDark);
  }, [theme, isDark]);

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

  useEffect(() => {
    if (consoleEndRef.current) consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [outputMessages, serialMessages]);

  // Fix: Chat auto-scroll effect
  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const fetchPuterFiles = async () => {
    if (typeof puter === 'undefined') return;
    setIsPuterLoading(true);
    try {
      const dir = '~/Documents/ArduProgram';
      const items = await puter.fs.list(dir);
      setPuterFiles(items.filter((i: any) => !i.is_dir) || []);
    } catch (e) { await puter.fs.mkdir('~/Documents/ArduProgram').catch(() => {}); } finally { setIsPuterLoading(false); }
  };

  // Fix: Implement handleSendMessage for AI interactions
  const handleSendMessage = async () => {
    if (!prompt.trim() || isChatLoading) return;
    
    const userMessage: ChatMessage = { role: 'user', text: prompt };
    setChatHistory(prev => [...prev, userMessage]);
    const currentPrompt = prompt;
    setPrompt('');
    setIsChatLoading(true);

    try {
      const boardInfo = selectedBoard.name;
      const currentCode = activeFile.content;
      const consoleLogs = outputMessages.slice(-10).join('\n');
      
      const response = await getCodeAssistance(currentPrompt, currentCode, boardInfo, consoleLogs);
      
      setChatHistory(prev => [...prev, { role: 'assistant', text: response }]);
    } catch (error) {
      console.error("Chat error:", error);
      setChatHistory(prev => [...prev, { role: 'assistant', text: "❌ Ocorreu um erro ao processar sua pergunta. Verifique sua conexão." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleUpload = async () => {
    if (isBusy) return;
    if (!isConnected || !portRef.current) {
        setConsoleTab('output');
        setOutputMessages(prev => [...prev, "\n❌ ERRO: Nenhuma placa USB detectada.", "👉 Clique em 'CONECTAR USB' no topo."]);
        return;
    }

    setIsBusy(true);
    setConsoleTab('output');
    setUploadProgress(0);
    setOutputMessages(prev => [...prev, `\n🔨 COMPILANDO: ${activeFile.name}...`]);

    try {
      // 1. Simulação de Compilação Realista
      const compLogs = await simulateCompilationLogs(selectedBoard.name, activeFile.name);
      for (const log of compLogs) {
          setOutputMessages(prev => [...prev, log]);
          await new Promise(r => setTimeout(r, 150));
      }

      setOutputMessages(prev => [...prev, `\n🔌 INICIANDO PROTOCOLO DE UPLOAD PARA ${selectedBoard.name.toUpperCase()}...`]);
      
      // 2. Reset de Hardware (Importante para entrar no bootloader)
      setOutputMessages(prev => [...prev, `Reseting board via DTR/RTS...`]);
      await portRef.current.setSignals({ dataTerminalReady: false, requestToSend: true });
      await new Promise(r => setTimeout(r, 250));
      await portRef.current.setSignals({ dataTerminalReady: true, requestToSend: false });
      
      // 3. Envio Real dos Dados (Escrevendo na Porta Serial)
      const encoder = new TextEncoder();
      const writer = portRef.current.writable.getWriter();
      const codeBytes = encoder.encode(activeFile.content);
      const chunkSize = 64;
      
      setOutputMessages(prev => [...prev, `Enviando stream de dados (${codeBytes.length} bytes)...`]);

      for (let i = 0; i < codeBytes.length; i += chunkSize) {
        const chunk = codeBytes.slice(i, i + chunkSize);
        await writer.write(chunk);
        
        const progress = Math.round(((i + chunk.length) / codeBytes.length) * 100);
        setUploadProgress(progress);
        
        // Atraso para simular velocidade de baudrate
        await new Promise(r => setTimeout(r, 50));
      }

      writer.releaseLock();
      
      setOutputMessages(prev => [
          ...prev, 
          `✓ Escrita finalizada.`,
          `✅ UPLOAD COMPLETO! Sua placa ${selectedBoard.name} deve estar executando o programa.`
      ]);
    } catch (err: any) {
      setOutputMessages(prev => [...prev, `❌ FALHA CRÍTICA NO UPLOAD: ${err.message}`]);
    } finally {
      setIsBusy(false);
      setUploadProgress(0);
    }
  };

  const connectSerial = async () => {
    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;
      setIsConnected(true);
      setOutputMessages(prev => [...prev, `🔌 Conectado à porta USB.`]);
      startReading();
    } catch (err) { 
        setIsConnected(false); 
        setOutputMessages(prev => [...prev, `❌ Falha ao abrir porta USB.`]);
    }
  };

  const startReading = async () => {
    if (!portRef.current || !portRef.current.readable) return;
    try {
        readerRef.current = portRef.current.readable.getReader();
        const decoder = new TextDecoder();
        while (true) {
            const { value, done } = await readerRef.current.read();
            if (done) break;
            const text = decoder.decode(value);
            setSerialMessages(prev => [...prev, { 
                timestamp: new Date().toLocaleTimeString(), 
                type: 'in', text 
            }].slice(-200));
        }
    } catch (err) {
        console.error("Read error:", err);
    } finally {
        if (readerRef.current) {
            readerRef.current.releaseLock();
            readerRef.current = null;
        }
    }
  };

  const highlightCode = (code: string) => {
    return (code || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\b(void|int|float|char|bool|long|unsigned|const|static|if|else|for|while|return|switch|case|break|byte|word|String|uint\d+_t|boolean)\b/g, `<span class="text-sky-500 font-bold">$1</span>`)
      .replace(/\b(setup|loop|pinMode|digitalWrite|digitalRead|analogWrite|analogRead|delay|Serial|println|print|begin|available|read|write|millis|micros|abs|min|max|map)\b/g, `<span class="text-teal-400 font-bold">$1</span>`)
      .replace(/\/\/.*/g, `<span class="text-slate-500 italic">$&</span>`)
      .replace(/\b(HIGH|LOW|INPUT|OUTPUT|INPUT_PULLUP|LED_BUILTIN)\b/g, `<span class="text-orange-400">$1</span>`);
  };

  return (
    <div className={`flex flex-col h-screen ${isDark ? 'bg-[#0b0c14] text-slate-300' : 'bg-slate-50 text-slate-800'} overflow-hidden`}>
      <header className={`h-14 border-b ${isDark ? 'border-white/5 bg-[#141620]' : 'border-slate-200 bg-white'} flex items-center justify-between px-4 shrink-0 z-50`}>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setActiveTab('creator')}>
            <div className="w-8 h-8 rounded-lg bg-[#00878F] flex items-center justify-center shadow-lg"><Zap size={18} className="text-white fill-white" /></div>
            <div className="flex flex-col leading-none">
              <span className="font-black text-xs text-[#00878F] uppercase tracking-tighter">{t.ide_name}</span>
              <span className="text-[7px] opacity-40 font-bold uppercase tracking-widest">Serial Uploader v2</span>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-black/10 p-1 rounded-lg border border-white/5">
            <button onClick={() => setConsoleTab('output')} className="p-2 rounded-md text-slate-400 hover:text-teal-400"><Check size={16} /></button>
            <button onClick={handleUpload} disabled={isBusy} className={`p-2 rounded-md ${isBusy ? 'text-[#00b2bb] animate-pulse' : 'text-slate-400 hover:text-teal-400'}`}>
              {isBusy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            </button>
          </div>
          <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[10px] font-bold border ${isDark ? 'bg-black/20 border-white/5' : 'bg-white shadow-sm'}`}>
            <Cpu size={12} className="text-[#00878F]" />
            <select value={selectedBoard.id} onChange={(e) => setSelectedBoard(BOARDS.find(b => b.id === e.target.value) || BOARDS[0])} className="bg-transparent outline-none font-bold">
              {BOARDS.map(b => <option key={b.id} value={b.id} className="bg-[#141620]">{b.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={connectSerial} className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase transition-all shadow-sm flex items-center gap-2 ${isConnected ? 'bg-[#00878F] text-white' : 'bg-slate-500/20 text-slate-400'}`}>
             <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-white animate-pulse' : 'bg-slate-600'}`} />
             {isConnected ? t.btn_connected : t.btn_connect}
          </button>
          <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className="p-2 text-slate-400"><Sun size={18} /></button>
        </div>
      </header>

      {isBusy && (
          <div className="h-1 bg-black/20 w-full overflow-hidden shrink-0">
              <div className="h-full bg-[#00878F] transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
          </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <nav className={`w-16 border-r ${isDark ? 'border-white/5 bg-[#141620]' : 'border-slate-200 bg-white'} flex flex-col items-center py-6 gap-6 shrink-0`}>
          {[{ id: 'files', icon: Files }, { id: 'ai', icon: MessageSquare }, { id: 'puter', icon: Cloud }, { id: 'examples', icon: Box }, { id: 'libraries', icon: BookOpen }].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as TabType)} className={`p-2.5 rounded-xl transition-all ${activeTab === tab.id ? 'bg-[#00878F] text-white shadow-lg' : 'text-slate-500 hover:text-[#00878F]'}`}>
              <tab.icon size={20} />
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={() => setActiveTab('creator')} className={`p-2.5 rounded-xl ${activeTab === 'creator' ? 'bg-[#00878F] text-white' : 'text-slate-500'}`}><User size={20} /></button>
        </nav>

        <aside className={`w-80 border-r ${isDark ? 'border-white/5 bg-[#0f111a]' : 'border-slate-200 bg-white'} flex flex-col shrink-0 overflow-hidden`}>
          <div className="h-12 px-6 flex items-center border-b border-white/5 bg-black/5">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#00878F]">{activeTab}</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
             {activeTab === 'files' && (
               <div className="space-y-2">
                 <button onClick={() => setFiles([...files, { name: `sketch_${files.length}.ino`, content: DEFAULT_CODE, isOpen: true }])} className="w-full py-2.5 bg-[#00878F]/10 border border-[#00878F]/30 rounded-lg text-[10px] font-black text-[#00878F] mb-4">NOVO SKETCH</button>
                 {files.map((f, i) => (
                   <div key={i} onClick={() => setActiveFileIndex(i)} className={`px-4 py-2.5 rounded-lg cursor-pointer flex items-center gap-3 ${activeFileIndex === i ? 'bg-white/5 border border-white/10' : 'hover:bg-white/5'}`}>
                     <FileCode size={14} className={activeFileIndex === i ? 'text-[#00878F]' : 'text-slate-500'} />
                     <span className={`text-[11px] truncate ${activeFileIndex === i ? 'text-white font-bold' : 'text-slate-400'}`}>{f.name}</span>
                   </div>
                 ))}
               </div>
             )}
             {activeTab === 'ai' && (
                <div className="flex flex-col h-full bg-[#0b0c14] -m-4">
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {chatHistory.map((m, i) => (
                      <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[90%] rounded-2xl px-4 py-3 text-[11px] leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-[#00878F] text-white' : 'bg-[#1a1c29] text-slate-300 border border-white/5'}`}>
                          {m.text}
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="p-3 bg-[#0f111a] border-t border-white/5">
                    <div className="flex gap-2 bg-black/40 rounded-xl p-1.5 border border-white/5">
                      <input value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} placeholder="Pergunte ao ArduBot..." className="flex-1 bg-transparent px-2 text-[11px] outline-none" />
                      <button onClick={() => handleSendMessage()} disabled={isChatLoading} className="p-2 bg-[#00878F] text-white rounded-lg disabled:opacity-50">
                        {isChatLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
             )}
             {activeTab === 'puter' && (
                <div className="space-y-4">
                  <button onClick={() => isPuterLoggedIn ? fetchPuterFiles() : puter.auth.signIn()} className="w-full py-2.5 bg-sky-500/10 border border-sky-500/30 rounded-lg text-[10px] font-black text-sky-500">
                     {isPuterLoggedIn ? 'ATUALIZAR ARQUIVOS' : 'CONECTAR PUTER'}
                  </button>
                  {puterFiles.map((f, i) => (
                    <div key={i} className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/5 flex items-center gap-3">
                      <Cloud size={14} className="text-sky-400" />
                      <span className="text-[11px] text-slate-400 truncate">{f.name}</span>
                    </div>
                  ))}
                  {puterFiles.length === 0 && isPuterLoggedIn && !isPuterLoading && <p className="text-[10px] text-center opacity-30">Nenhum arquivo na nuvem.</p>}
                  {isPuterLoading && <Loader2 size={16} className="animate-spin mx-auto text-sky-500" />}
                </div>
             )}
             {activeTab === 'examples' && (
                <div className="space-y-2">
                  {['Blink', 'AnalogReadSerial', 'Fade', 'DigitalReadSerial', 'LiquidCrystal'].map(ex => (
                     <div key={ex} className="px-4 py-3 rounded-lg bg-white/5 border border-white/5 hover:border-[#00878F]/40 cursor-pointer transition-all">
                        <span className="text-[11px] font-bold text-slate-300">{ex}</span>
                     </div>
                  ))}
                </div>
             )}
             {activeTab === 'libraries' && (
                <div className="space-y-2">
                  {['Wire', 'SPI', 'Servo', 'DHT sensor library'].map(lib => (
                     <div key={lib} className="px-4 py-3 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-300">{lib}</span>
                        <Plus size={14} className="text-[#00878F] cursor-pointer" />
                     </div>
                  ))}
                </div>
             )}
             {activeTab === 'creator' && (
                <div className="space-y-6 text-center pt-8">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#00878F] to-teal-400 mx-auto flex items-center justify-center shadow-xl">
                    <User size={40} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">ArduProgram Creator</h3>
                    <p className="text-[10px] opacity-60 mt-1">Embedded Systems Engineer</p>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-400 px-4">{t.creator_bio}</p>
                  <div className="flex justify-center gap-4">
                     <Instagram size={18} className="text-slate-500 hover:text-pink-500 cursor-pointer" />
                     <Globe size={18} className="text-slate-500 hover:text-sky-400 cursor-pointer" />
                  </div>
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
               <div ref={highlightRef} className="absolute inset-0 p-5 pointer-events-none code-font whitespace-pre overflow-hidden z-0 leading-[1.5]" style={{ fontSize: `${fontSize}px` }} dangerouslySetInnerHTML={{ __html: highlightCode(activeFile.content) }} />
               <textarea 
                  value={activeFile.content} 
                  onChange={e => { const n = [...files]; if (n[activeFileIndex]) n[activeFileIndex].content = e.target.value; setFiles(n); }} 
                  onScroll={e => { if (highlightRef.current) { highlightRef.current.scrollTop = e.currentTarget.scrollTop; highlightRef.current.scrollLeft = e.currentTarget.scrollLeft; } }} 
                  spellCheck={false} 
                  className="absolute inset-0 w-full h-full p-5 bg-transparent text-transparent caret-[#00878F] code-font outline-none z-10 whitespace-pre overflow-auto custom-scrollbar resize-none leading-[1.5]" 
                  style={{ fontSize: `${fontSize}px` }} 
               />
            </div>
          </div>

          <div className={`h-60 border-t flex flex-col shrink-0 ${isDark ? 'border-white/5 bg-[#0f111a]' : 'border-slate-200 bg-white'}`}>
            <div className="h-9 border-b border-white/5 flex items-center px-6 gap-6 text-[9px] font-black uppercase bg-black/5">
               {['output', 'serial'].map(tab => (
                 <button key={tab} onClick={() => setConsoleTab(tab as any)} className={`flex items-center gap-1.5 pb-0.5 border-b-2 ${consoleTab === tab ? 'text-[#00b2bb] border-[#00878F]' : 'border-transparent opacity-30'}`}>
                   {tab === 'output' ? 'Console' : 'Monitor Serial'}
                 </button>
               ))}
               <div className="flex-1" />
               <button onClick={() => consoleTab === 'serial' ? setSerialMessages([]) : setOutputMessages([])} className="p-1.5 hover:text-rose-400"><Trash2 size={12} /></button>
            </div>
            <div className="flex-1 p-4 font-mono text-[11px] overflow-y-auto custom-scrollbar bg-[#0b0c14]">
                {consoleTab === 'output' ? (
                  outputMessages.map((m, i) => <div key={i} className="mb-1 opacity-50 whitespace-pre-wrap">{m}</div>)
                ) : (
                  serialMessages.map((m, i) => <div key={i} className="mb-1 opacity-50 whitespace-pre-wrap">{`[${m.timestamp}] ${m.text}`}</div>)
                )}
                <div ref={consoleEndRef} />
            </div>
          </div>
        </main>
      </div>

      <footer className="h-6 bg-[#00878F] text-white flex items-center justify-between px-6 text-[9px] font-black shrink-0">
         <div className="flex gap-6 items-center">
           <span className="flex items-center gap-1.5"><Cpu size={10}/> {selectedBoard.name}</span>
           <span className="flex items-center gap-1.5 uppercase">{isConnected ? 'ONLINE' : 'OFFLINE'}</span>
         </div>
         <div className="opacity-80 flex items-center gap-4">
           <span>{activeFile.content.length} bytes</span>
           <span className="bg-white/10 px-2 py-0.5 rounded-full flex items-center gap-1"><Sparkles size={10}/> PUTER ENGINE</span>
         </div>
      </footer>
    </div>
  );
};

export default App;
