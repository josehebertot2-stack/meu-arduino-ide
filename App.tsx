
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Files, Plus, Zap, Check, FileCode, Settings, X, 
  Box, Trash2, Search, Terminal, MessageSquare,
  User, Instagram, Sun, Moon, ArrowRight, Send, Sparkles,
  Cpu, HardDrive, Type as TypeIcon,
  Save, Globe, Loader2, Download, BookOpen, LineChart,
  Copy, RefreshCw, AlertTriangle, Key, Cloud, CloudUpload, CloudDownload, LogIn, LogOut
} from 'lucide-react';
import { FileNode, TabType, SerialMessage, ArduinoBoard, ArduinoLibrary, ChatMessage, ArduinoExample, PuterItem } from './types';
import { analyzeCode, getCodeAssistance } from './services/geminiService';

// Extensão de tipos para o Puter global injetado via script
declare const puter: any;

const TRANSLATIONS = {
  pt: {
    ide_name: "ARDUPROGRAM",
    nav_files: "Arquivos",
    nav_ai: "Assistente IA",
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
    ai_placeholder: "Pergunte ao ArduBot ou use Puter AI...",
    serial_placeholder: "Mensagem para placa...",
    terminal_tab: "Console",
    serial_tab: "Monitor Serial",
    plotter_tab: "Plotter",
    footer_lines: "Linha",
    footer_chars: "Col",
    status_waiting: "Aguardando USB",
    status_connected: "Arduino Online",
    msg_ready: "Pronto.",
    msg_lib_installed: "Biblioteca instalada!",
    creator_bio: "Engenheiro apaixonado por tecnologia, eletrônica e software livre."
  },
  en: {
    ide_name: "ARDUPROGRAM",
    nav_files: "Files",
    nav_ai: "AI Assistant",
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
    ai_placeholder: "Ask ArduBot or use Puter AI...",
    serial_placeholder: "Send message...",
    terminal_tab: "Output",
    serial_tab: "Serial Monitor",
    plotter_tab: "Plotter",
    footer_lines: "Line",
    footer_chars: "Col",
    status_waiting: "Waiting USB",
    status_connected: "Arduino Online",
    msg_ready: "Ready.",
    msg_lib_installed: "Lib installed!",
    creator_bio: "Engineer passionate about technology, electronics and open source software."
  }
};

const DEFAULT_CODE = `// Sketch ArduProgram\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(LED_BUILTIN, OUTPUT);\n  Serial.println("ArduProgram Inicializado!");\n}\n\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(1000);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(1000);\n}`;

const BOARDS: ArduinoBoard[] = [
  { id: 'uno', name: 'Arduino Uno', fqbn: 'arduino:avr:uno' },
  { id: 'esp32', name: 'ESP32 Dev Module', fqbn: 'esp32:esp32:esp32' },
  { id: 'nano', name: 'Arduino Nano', fqbn: 'arduino:avr:nano' }
];

const App: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('ardu_theme') as any) || 'dark');
  const [lang, setLang] = useState<'pt' | 'en'>(() => (localStorage.getItem('ardu_lang') as any) || 'pt');
  const [fontSize, setFontSize] = useState(parseInt(localStorage.getItem('ardu_font_size') || '14'));
  const [lineWrapping, setLineWrapping] = useState(localStorage.getItem('ardu_line_wrap') === 'true');
  const [autoSave, setAutoSave] = useState(localStorage.getItem('ardu_auto_save') !== 'false');
  const [hasApiKey, setHasApiKey] = useState(true);

  // Puter.js State
  const [isPuterLoggedIn, setIsPuterLoggedIn] = useState(false);
  const [puterFiles, setPuterFiles] = useState<PuterItem[]>([]);
  const [isPuterLoading, setIsPuterLoading] = useState(false);
  const [aiEngine, setAiEngine] = useState<'gemini' | 'puter'>('gemini');

  const t = TRANSLATIONS[lang];
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<TabType>('files');
  const [files, setFiles] = useState<FileNode[]>(() => {
    try {
      const saved = localStorage.getItem('ardu_files');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [{ name: 'sketch_main.ino', content: DEFAULT_CODE, isOpen: true }];
  });
  
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [serialMessages, setSerialMessages] = useState<SerialMessage[]>([]);
  const [serialInput, setSerialInput] = useState('');
  const [outputMessages, setOutputMessages] = useState<string[]>(["ArduProgram IDE v2.0 pronta."]);
  const [consoleTab, setConsoleTab] = useState<'output' | 'serial' | 'plotter'>('output');
  const [isConnected, setIsConnected] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState(BOARDS[0]);

  const portRef = useRef<any>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const activeFile = useMemo(() => files[activeFileIndex] || files[0], [files, activeFileIndex]);

  useEffect(() => {
    localStorage.setItem('ardu_theme', theme);
    localStorage.setItem('ardu_lang', lang);
    localStorage.setItem('ardu_font_size', fontSize.toString());
    localStorage.setItem('ardu_line_wrap', lineWrapping.toString());
    localStorage.setItem('ardu_auto_save', autoSave.toString());
    document.documentElement.classList.toggle('dark', isDark);
  }, [theme, lang, fontSize, lineWrapping, autoSave, isDark]);

  useEffect(() => {
    // Verificar Chave Gemini
    if (window.aistudio) {
      window.aistudio.hasSelectedApiKey().then(setHasApiKey);
    }

    // Inicializar Puter.js
    const initPuter = async () => {
      if (typeof puter !== 'undefined') {
        const signedIn = puter.auth.isSignedIn();
        setIsPuterLoggedIn(signedIn);
        if (signedIn) {
          fetchPuterFiles();
        }
      }
    };
    initPuter();
  }, []);

  const fetchPuterFiles = async () => {
    if (typeof puter === 'undefined') return;
    setIsPuterLoading(true);
    try {
      const dir = '~/Documents/ArduProgram';
      // Tentar listar, se falhar criar
      try {
        const items = await puter.fs.list(dir);
        setPuterFiles(items.filter((i: any) => !i.is_dir) || []);
      } catch (e) {
        await puter.fs.mkdir(dir);
        setPuterFiles([]);
      }
    } catch (e) {
      console.error("Puter FS Error:", e);
    } finally {
      setIsPuterLoading(false);
    }
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
      setOutputMessages(prev => [...prev, `❌ [Nuvem] Erro ao salvar: ${String(err)}`]);
    } finally {
      setIsPuterLoading(false);
    }
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
      setOutputMessages(prev => [...prev, `✅ [Nuvem] Aberto do Puter: ${item.name}`]);
    } catch (err) {
      setOutputMessages(prev => [...prev, `❌ [Nuvem] Erro ao carregar: ${String(err)}`]);
    } finally {
      setIsPuterLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!prompt.trim() || isChatLoading) return;
    
    const userMsg = prompt;
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setPrompt('');
    setIsChatLoading(true);

    try {
      let textResponse = "";
      
      if (aiEngine === 'puter' && typeof puter !== 'undefined') {
        // Usar Puter AI
        const response = await puter.ai.chat(
          `Aja como ArduBot, assistente especializado em Arduino. Responda em Português.
          Código Atual: ${activeFile.content}
          Pergunta: ${userMsg}`
        );
        textResponse = typeof response === 'string' ? response : (response?.text || JSON.stringify(response));
      } else {
        // Usar Gemini via service
        const response = await getCodeAssistance(userMsg, activeFile.content);
        textResponse = typeof response === 'string' ? response : String(response);
        if (textResponse.includes("Requested entity was not found")) setHasApiKey(false);
      }
      
      setChatHistory(prev => [...prev, { role: 'assistant', text: textResponse }]);
    } catch (err: any) {
      setChatHistory(prev => [...prev, { role: 'assistant', text: `⚠️ Erro no processamento: ${err?.message || String(err)}` }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleVerify = async () => {
    if (isBusy) return;
    setIsBusy(true);
    setConsoleTab('output');
    setOutputMessages(prev => [...prev, `[Verificando] ${activeFile.name}...`]);
    
    try {
      const result = await analyzeCode(activeFile.content);
      setOutputMessages(prev => [...prev, `[${result.status}] ${result.summary}`]);
    } catch (err) {
      setOutputMessages(prev => [...prev, `❌ Erro na análise: ${String(err)}`]);
    } finally {
      setIsBusy(false);
    }
  };

  const connectSerial = async () => {
    try {
      if (!('serial' in navigator)) { alert("Seu navegador não suporta Web Serial API."); return; }
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;
      setIsConnected(true);
      setOutputMessages(prev => [...prev, `🔌 [Serial] Conectado via USB.`]);
      
      const reader = port.readable.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = new TextDecoder().decode(value);
        const numeric = parseFloat(text.trim());
        setSerialMessages(prev => [...prev, { 
          timestamp: new Date().toLocaleTimeString(), 
          type: 'in', 
          text,
          value: isNaN(numeric) ? undefined : numeric
        }].slice(-100));
      }
    } catch (err) { setIsConnected(false); }
  };

  const sendSerialData = async () => {
    if (!serialInput.trim() || !portRef.current) return;
    try {
      const writer = portRef.current.writable.getWriter();
      await writer.write(new TextEncoder().encode(serialInput + '\n'));
      writer.releaseLock();
      setSerialMessages(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), type: 'out', text: serialInput }].slice(-100));
      setSerialInput('');
    } catch (err) { setOutputMessages(prev => [...prev, `❌ [Serial] Erro: ${String(err)}`]); }
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
      {/* HEADER DINÂMICO */}
      <header className={`h-14 border-b ${isDark ? 'border-white/5 bg-[#141620]' : 'border-slate-200 bg-white'} flex items-center justify-between px-4 shrink-0 z-50 shadow-md`}>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setActiveTab('creator')}>
            <div className="w-8 h-8 rounded-lg bg-[#00878F] flex items-center justify-center shadow-lg shadow-teal-500/10 transition-transform active:scale-95">
              <Zap size={18} className="text-white fill-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-black text-xs tracking-tighter text-[#00878F] uppercase">{t.ide_name}</span>
              <span className="text-[7px] opacity-40 font-bold uppercase tracking-widest">Powered by Puter</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-black/10 p-1 rounded-lg border border-white/5">
            <button onClick={handleVerify} disabled={isBusy} className={`p-2 rounded-md transition-all ${isBusy ? 'text-teal-500 bg-teal-500/10' : 'text-slate-400 hover:bg-white/5 hover:text-teal-400'}`} title={t.btn_verify}>
              {isBusy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            </button>
            <button className={`p-2 rounded-md transition-all text-slate-400 hover:bg-white/5 hover:text-teal-400`} title={t.btn_upload}>
              <ArrowRight size={16} />
            </button>
            <div className="w-[1px] h-4 bg-white/10 mx-1" />
            <button onClick={saveToPuter} className={`p-2 rounded-md transition-all ${isPuterLoading ? 'animate-pulse text-blue-400' : 'text-slate-400 hover:bg-white/5 hover:text-blue-400'}`} title="Sincronizar com Nuvem Puter">
              <CloudUpload size={16} />
            </button>
          </div>

          <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[10px] font-bold border ${isDark ? 'bg-black/20 border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
            <Cpu size={12} className="text-[#00878F]" />
            <select value={selectedBoard.id} onChange={(e) => setSelectedBoard(BOARDS.find(b => b.id === e.target.value) || BOARDS[0])} className="bg-transparent outline-none cursor-pointer text-slate-400 hover:text-white">
              {BOARDS.map(b => <option key={b.id} value={b.id} className="bg-[#141620]">{b.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/5 border border-blue-500/10">
             {isPuterLoggedIn ? (
               <div className="flex items-center gap-2 text-[9px] font-black text-blue-400">
                  <Cloud size={12} className="puter-pulse"/>
                  <span className="hidden sm:inline">PUTER CLOUD ONLINE</span>
                  <button onClick={() => { puter.auth.signOut(); setIsPuterLoggedIn(false); }} className="hover:text-rose-500 ml-1"><LogOut size={10}/></button>
               </div>
             ) : (
               <button onClick={async () => { await puter.auth.signIn(); setIsPuterLoggedIn(true); fetchPuterFiles(); }} className="flex items-center gap-2 text-[9px] font-black opacity-60 hover:opacity-100 hover:text-blue-400 transition-all">
                  <LogIn size={12}/>
                  <span className="hidden sm:inline">ENTRAR NA NUVEM</span>
               </button>
             )}
          </div>

          <button onClick={connectSerial} className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase transition-all shadow-md flex items-center gap-2 ${isConnected ? 'bg-[#00878F] text-white' : 'bg-slate-500/20 text-slate-400 hover:bg-slate-500/30'}`}>
             <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-white animate-pulse' : 'bg-slate-600'}`} />
             {isConnected ? t.btn_connected : t.btn_connect}
          </button>

          <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className="p-2 text-slate-400 hover:text-[#00878F] transition-colors">
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR NAVEGAÇÃO */}
        <nav className={`w-16 border-r ${isDark ? 'border-white/5 bg-[#141620]' : 'border-slate-200 bg-white'} flex flex-col items-center py-6 gap-6 shrink-0`}>
          {[
            { id: 'files', icon: Files, title: t.nav_files },
            { id: 'puter', icon: Cloud, title: t.nav_puter },
            { id: 'ai', icon: MessageSquare, title: t.nav_ai },
            { id: 'examples', icon: BookOpen, title: t.nav_examples },
            { id: 'libraries', icon: Box, title: t.nav_libs },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as TabType)} className={`group relative p-2.5 rounded-xl transition-all ${activeTab === tab.id ? 'bg-[#00878F] text-white shadow-lg' : 'text-slate-500 hover:text-[#00878F] hover:bg-teal-500/5'}`} title={tab.title}>
              <tab.icon size={20} />
              {activeTab === tab.id && <div className="absolute -left-16 w-1 h-6 bg-[#00878F] rounded-r-full" />}
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={() => setActiveTab('creator')} className={`p-2.5 rounded-xl transition-all ${activeTab === 'creator' ? 'bg-[#00878F] text-white shadow-md' : 'text-slate-500 hover:text-[#00878F]'}`}>
            <User size={20} />
          </button>
        </nav>

        {/* PAINEL LATERAL (DRAWER) */}
        <aside className={`w-72 border-r ${isDark ? 'border-white/5 bg-[#0f111a]' : 'border-slate-200 bg-white'} flex flex-col shrink-0 overflow-hidden`}>
          <div className="h-12 px-6 flex items-center justify-between border-b border-white/5 bg-black/5">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00878F]">{t[`nav_${activeTab}` as keyof typeof t] || activeTab}</span>
            {activeTab === 'ai' && (
              <div className="flex bg-black/20 p-0.5 rounded-lg border border-white/5">
                 <button onClick={() => setAiEngine('gemini')} className={`px-2 py-0.5 text-[8px] rounded-md font-bold uppercase ${aiEngine === 'gemini' ? 'bg-[#00878F] text-white' : 'opacity-40'}`}>Gemini</button>
                 <button onClick={() => setAiEngine('puter')} className={`px-2 py-0.5 text-[8px] rounded-md font-bold uppercase ${aiEngine === 'puter' ? 'bg-blue-600 text-white' : 'opacity-40'}`}>Puter</button>
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {activeTab === 'files' && (
              <div className="p-4 space-y-2">
                <button onClick={() => setFiles([...files, { name: `sketch_${files.length}.ino`, content: DEFAULT_CODE, isOpen: true }])} className="w-full flex items-center justify-center gap-2 p-2.5 bg-[#00878F]/10 border border-[#00878F]/30 rounded-lg text-[10px] font-black text-[#00878F] hover:bg-[#00878F] hover:text-white transition-all mb-4">
                  <Plus size={14}/> NOVO SKETCH
                </button>
                {files.map((file, idx) => (
                  <div key={idx} onClick={() => setActiveFileIndex(idx)} className={`group px-4 py-2.5 rounded-lg cursor-pointer flex items-center justify-between transition-all ${activeFileIndex === idx ? 'bg-white/5 border border-white/10' : 'hover:bg-white/5'}`}>
                    <div className="flex items-center gap-3">
                      <FileCode size={14} className={activeFileIndex === idx ? 'text-[#00878F]' : 'text-slate-500'} />
                      <span className={`text-[11px] font-medium ${activeFileIndex === idx ? 'text-white' : 'text-slate-400'}`}>{file.name}</span>
                    </div>
                    {files.length > 1 && <X size={12} className="opacity-0 group-hover:opacity-100 hover:text-red-500" onClick={(e) => { e.stopPropagation(); setFiles(files.filter((_, i) => i !== idx)); }} />}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'puter' && (
              <div className="p-4 space-y-4">
                {!isPuterLoggedIn ? (
                   <div className="flex flex-col items-center justify-center p-8 text-center bg-blue-500/5 rounded-2xl border border-blue-500/10">
                      <Cloud size={40} className="mb-4 text-blue-400 opacity-50" />
                      <p className="text-[11px] font-bold leading-relaxed">Conecte sua conta Puter para salvar seus projetos na nuvem.</p>
                      <button onClick={async () => { await puter.auth.signIn(); setIsPuterLoggedIn(true); fetchPuterFiles(); }} className="mt-6 w-full py-2.5 bg-blue-600 text-white rounded-lg font-black text-[9px] uppercase shadow-lg shadow-blue-900/30">Fazer Login Puter</button>
                   </div>
                ) : (
                  <div className="space-y-4">
                    <button onClick={fetchPuterFiles} className="w-full py-2 flex items-center justify-center gap-2 bg-white/5 rounded-lg text-[9px] font-bold hover:bg-white/10 transition-colors">
                      <RefreshCw size={12} className={isPuterLoading ? 'animate-spin' : ''}/> ATUALIZAR NUVEM
                    </button>
                    <div className="space-y-1.5">
                       {puterFiles.map((item, i) => (
                         <div key={i} onClick={() => loadFromPuter(item)} className="p-2.5 bg-black/20 border border-white/5 rounded-lg flex items-center justify-between hover:border-blue-500/40 cursor-pointer transition-all group">
                            <div className="flex items-center gap-3 overflow-hidden">
                               <FileCode size={13} className="text-blue-400 shrink-0" />
                               <span className="text-[11px] font-medium truncate">{item.name}</span>
                            </div>
                            <CloudDownload size={13} className="opacity-0 group-hover:opacity-100 text-blue-400 shrink-0" />
                         </div>
                       ))}
                       {puterFiles.length === 0 && !isPuterLoading && <p className="text-[10px] text-center opacity-30 p-4 font-bold uppercase tracking-widest">Nenhum arquivo na nuvem</p>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="flex flex-col h-full bg-[#0b0c14]">
                <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
                  {chatHistory.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full opacity-20 text-center px-6">
                      <Sparkles size={32} className="text-teal-400 mb-3" />
                      <p className="text-[11px] font-bold uppercase tracking-widest">ArduBot Assistente</p>
                      <p className="text-[9px] mt-2 opacity-60">Motor: {aiEngine.toUpperCase()}</p>
                    </div>
                  )}
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[95%] rounded-xl p-3 text-[11px] leading-relaxed relative ${msg.role === 'user' ? 'bg-[#00878F] text-white shadow-md' : 'bg-[#1a1c29] text-slate-300 border border-white/5 shadow-md'}`}>
                        {typeof msg.text === 'string' ? msg.text : JSON.stringify(msg.text)}
                        {msg.role === 'assistant' && (
                           <button onClick={() => navigator.clipboard.writeText(msg.text)} className="absolute -top-6 right-0 p-1 opacity-20 hover:opacity-100 text-teal-400">
                             <Copy size={10}/>
                           </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex items-center gap-2 text-[9px] font-black text-[#00878F] animate-pulse">
                      <RefreshCw size={10} className="animate-spin" /> PENSANDO...
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-3 border-t border-white/5 bg-[#0f111a]">
                  <div className="flex gap-2 bg-black/40 rounded-xl p-1.5 border border-white/5 focus-within:border-[#00878F] transition-all shadow-inner">
                    <input value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} placeholder={t.ai_placeholder} className="flex-1 bg-transparent px-2 py-1.5 text-[11px] outline-none placeholder:opacity-25" />
                    <button onClick={handleSendMessage} disabled={isChatLoading} className="p-2.5 bg-[#00878F] text-white rounded-lg hover:bg-[#006468] transition-all active:scale-90 shadow-md"><Send size={16} /></button>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'creator' && (
              <div className="p-8 flex flex-col items-center text-center">
                 <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#00878F] to-[#00b2bb] flex items-center justify-center mb-6 shadow-xl overflow-hidden ring-2 ring-white/5">
                    <User size={36} className="text-white" />
                 </div>
                 <h3 className="font-black text-lg text-white tracking-tight">José Heberto</h3>
                 <p className="text-[11px] opacity-40 mt-4 leading-relaxed font-medium">{t.creator_bio}</p>
                 <a href="https://instagram.com/josehebertot2" target="_blank" className="mt-8 flex items-center gap-3 bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] text-white px-6 py-2.5 rounded-xl text-[10px] font-black shadow-lg hover:translate-y-[-2px] transition-all"><Instagram size={16}/> @josehebertot2</a>
              </div>
            )}
          </div>
        </aside>

        {/* ÁREA DO EDITOR */}
        <main className="flex-1 flex flex-col relative bg-[#0b0c14]">
          <div className="h-10 flex items-center overflow-x-auto no-scrollbar shrink-0 bg-[#0f111a] border-b border-white/5 px-2">
            {files.map((file, idx) => (
              <div key={idx} onClick={() => setActiveFileIndex(idx)} className={`h-8 min-w-[120px] px-4 rounded-t-lg mx-0.5 flex items-center justify-between gap-3 text-[10px] font-bold cursor-pointer transition-all relative ${activeFileIndex === idx ? 'bg-[#0b0c14] text-[#00b2bb] border-t-2 border-t-[#00878F]' : 'opacity-40 grayscale hover:bg-white/5 hover:opacity-100'}`}>
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileCode size={12} className={activeFileIndex === idx ? 'text-[#00878F]' : ''}/> 
                  <span className="truncate">{file.name}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex-1 relative flex overflow-hidden">
            <div className={`w-12 border-r border-white/5 py-4 text-right pr-3 font-mono text-[10px] opacity-20 bg-black/5 select-none`}>
              {(activeFile.content || '').split('\n').map((_, i) => <div key={i} style={{ height: `${fontSize * 1.5}px` }}>{i + 1}</div>)}
            </div>
            <div className="flex-1 relative bg-[#0b0c14]">
               <div ref={highlightRef} className={`absolute inset-0 p-5 pointer-events-none code-font whitespace-pre overflow-hidden z-0 leading-[1.5] ${lineWrapping ? 'whitespace-pre-wrap' : ''}`} style={{ fontSize: `${fontSize}px` }} dangerouslySetInnerHTML={{ __html: highlightCode(activeFile.content) }} />
               <textarea 
                  value={activeFile.content} 
                  onChange={e => { const n = [...files]; n[activeFileIndex].content = e.target.value; setFiles(n); }} 
                  onScroll={e => { if (highlightRef.current) { highlightRef.current.scrollTop = e.currentTarget.scrollTop; highlightRef.current.scrollLeft = e.currentTarget.scrollLeft; } }} 
                  spellCheck={false} 
                  className={`absolute inset-0 w-full h-full p-5 bg-transparent text-transparent caret-[#00878F] code-font outline-none z-10 whitespace-pre overflow-auto custom-scrollbar resize-none leading-[1.5] ${lineWrapping ? 'whitespace-pre-wrap' : ''}`} 
                  style={{ fontSize: `${fontSize}px` }} 
               />
            </div>
          </div>

          {/* PAINÉIS INFERIORES */}
          <div className={`h-56 border-t flex flex-col shrink-0 ${isDark ? 'border-white/5 bg-[#0f111a]' : 'border-slate-200 bg-white shadow-2xl'}`}>
            <div className="h-9 border-b border-white/5 flex items-center px-6 gap-6 text-[9px] font-black uppercase tracking-widest bg-black/5">
               {['output', 'serial', 'plotter'].map(tab => (
                 <button key={tab} onClick={() => setConsoleTab(tab as any)} className={`flex items-center gap-1.5 pb-0.5 border-b-2 transition-all h-full ${consoleTab === tab ? 'text-[#00b2bb] border-[#00878F]' : 'border-transparent opacity-30 hover:opacity-100'}`}>
                   {tab === 'output' && <Terminal size={12}/>}
                   {tab === 'serial' && <HardDrive size={12}/>}
                   {tab === 'plotter' && <LineChart size={12}/>}
                   {t[`${tab}_tab` as keyof typeof t] || tab}
                 </button>
               ))}
               <div className="flex-1" />
               <button onClick={() => consoleTab === 'serial' ? setSerialMessages([]) : setOutputMessages([])} className="p-1.5 hover:bg-white/5 rounded-md text-slate-500 hover:text-rose-400 transition-colors" title="Limpar">
                 <Trash2 size={12} />
               </button>
            </div>
            
            <div className="flex-1 overflow-hidden flex flex-col bg-[#0b0c14]">
              {consoleTab === 'serial' && (
                <div className="h-10 border-b border-white/5 flex items-center px-4 gap-2 bg-black/20">
                  <input value={serialInput} onChange={e => setSerialInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendSerialData()} placeholder={t.serial_placeholder} className="flex-1 bg-transparent text-[10px] font-mono outline-none text-teal-400 placeholder:opacity-20 px-2" />
                  <button onClick={sendSerialData} className="px-3 py-1 bg-[#00878F] text-white text-[9px] font-black rounded hover:bg-[#006468] transition-all uppercase">Enviar</button>
                </div>
              )}

              <div className="flex-1 p-4 font-mono text-[11px] overflow-y-auto custom-scrollbar">
                {(consoleTab === 'output' ? outputMessages : serialMessages.map(m => `[${m.timestamp}] ${m.type === 'in' ? '→' : '←'} ${m.text}`)).map((m, i) => (
                    <div key={i} className={`mb-1 whitespace-pre-wrap font-medium tracking-tight opacity-40 hover:opacity-100 transition-opacity`}>
                      {typeof m === 'string' ? m : JSON.stringify(m)}
                    </div>
                ))}
                <div ref={consoleEndRef} />
              </div>
            </div>
          </div>
        </main>
      </div>

      <footer className="h-6 bg-[#00878F] text-white flex items-center justify-between px-6 text-[9px] font-black shrink-0 shadow-lg z-50">
         <div className="flex gap-6 items-center">
           <span className="flex items-center gap-1.5"><Cpu size={10}/> {selectedBoard.name}</span>
           <div className="w-[1px] h-2.5 bg-white/20" />
           <span className="flex items-center gap-1.5 uppercase tracking-tighter">
             {isConnected ? <Check size={10} className="text-teal-200"/> : <X size={10} className="text-rose-200"/>} 
             {isConnected ? t.status_connected : t.status_waiting}
           </span>
         </div>
         <div className="flex gap-8 items-center opacity-80 uppercase tracking-widest">
           <span className="flex items-center gap-1.5">
             <Cloud size={10} className={isPuterLoggedIn ? 'text-blue-300' : ''}/> 
             {isPuterLoggedIn ? 'CLOUD SYNC' : 'OFFLINE MODE'}
           </span>
           <span className="flex items-center gap-1.5 bg-white/10 px-2.5 py-0.5 rounded-full ring-1 ring-white/5">
             <Sparkles size={10} className="fill-white"/> {aiEngine.toUpperCase()} AI
           </span>
         </div>
      </footer>
    </div>
  );
};

export default App;
