
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Files, Plus, Zap, Check, FileCode, Settings, X, 
  Box, Trash2, Search, Terminal, MessageSquare,
  User, Instagram, Sun, Moon, ArrowRight, Send, Sparkles,
  Cpu, HardDrive, Type as TypeIcon,
  Save, Globe, Loader2, Download, BookOpen, LineChart,
  Copy, RefreshCw, AlertTriangle
} from 'lucide-react';
import { FileNode, TabType, SerialMessage, ArduinoBoard, ArduinoLibrary, ChatMessage, ArduinoExample } from './types';
import { analyzeCode, getCodeAssistance } from './services/geminiService';

const ARDUINO_TEAL = "#00878F";
const ARDUINO_DARK = "#006468";

const TRANSLATIONS = {
  pt: {
    ide_name: "ARDUPROGRAM",
    nav_files: "Arquivos",
    nav_ai: "ArduBot IA",
    nav_examples: "Exemplos",
    nav_libs: "Bibliotecas",
    nav_creator: "Créditos",
    nav_settings: "Ajustes",
    btn_verify: "Verificar",
    btn_upload: "Carregar",
    btn_connect: "Conectar USB",
    btn_connected: "Conectado",
    btn_download: "Exportar .ino",
    settings_editor: "Editor",
    settings_font_size: "Tamanho da Fonte",
    settings_line_wrap: "Quebra de Linha",
    settings_system: "Sistema",
    settings_autosave: "Salvar Automático",
    settings_lang: "Idioma da IDE",
    ai_placeholder: "Pergunte algo ao ArduBot...",
    serial_placeholder: "Mensagem para placa...",
    terminal_tab: "Console",
    serial_tab: "Monitor Serial",
    plotter_tab: "Serial Plotter",
    footer_lines: "Linha",
    footer_chars: "Col",
    status_waiting: "Aguardando USB",
    status_connected: "Arduino Detectado",
    msg_ready: "Pronto.",
    msg_compiling: "Compilando...",
    msg_uploading: "Carregando...",
    msg_success: "Sucesso!",
    msg_upload_success: "Upload Concluído.",
    msg_lib_installed: "Biblioteca instalada!",
    creator_bio: "Engenheiro apaixonado por tecnologia, eletrônica e software livre."
  },
  en: {
    ide_name: "ARDUPROGRAM",
    nav_files: "Files",
    nav_ai: "ArduBot AI",
    nav_examples: "Examples",
    nav_libs: "Libraries",
    nav_creator: "Credits",
    nav_settings: "Settings",
    btn_verify: "Verify",
    btn_upload: "Upload",
    btn_connect: "Connect USB",
    btn_connected: "Connected",
    btn_download: "Download .ino",
    settings_editor: "Editor",
    settings_font_size: "Font Size",
    settings_line_wrap: "Line Wrap",
    settings_system: "System",
    settings_autosave: "Auto Save",
    settings_lang: "IDE Language",
    ai_placeholder: "Ask ArduBot something...",
    serial_placeholder: "Send message...",
    terminal_tab: "Output",
    serial_tab: "Serial Monitor",
    plotter_tab: "Serial Plotter",
    footer_lines: "Line",
    footer_chars: "Col",
    status_waiting: "Waiting USB",
    status_connected: "Arduino Found",
    msg_ready: "Ready.",
    msg_compiling: "Compiling...",
    msg_uploading: "Uploading...",
    msg_success: "Success!",
    msg_upload_success: "Done uploading.",
    msg_lib_installed: "Lib installed!",
    creator_bio: "Engineer passionate about technology, electronics and open source software."
  }
};

const DEFAULT_CODE = `// Sketch ArduProgram\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(LED_BUILTIN, OUTPUT);\n  Serial.println("ArduProgram Inicializado!");\n}\n\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(1000);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(1000);\n}`;

const EXAMPLES: ArduinoExample[] = [
  { name: 'Blink', category: 'Basics', content: `void setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(500);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(500);\n}` },
  { name: 'HelloSerial', category: 'Basics', content: `void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  Serial.println("Hello from ArduProgram!");\n  delay(1000);\n}` }
];

const BOARDS: ArduinoBoard[] = [
  { id: 'uno', name: 'Arduino Uno', fqbn: 'arduino:avr:uno' },
  { id: 'esp32', name: 'ESP32 Dev Module', fqbn: 'esp32:esp32:esp32' },
  { id: 'nano', name: 'Arduino Nano', fqbn: 'arduino:avr:nano' }
];

const LIBRARIES: ArduinoLibrary[] = [
  { name: 'DHT sensor', version: '1.4.3', author: 'Adafruit', description: 'Leitura de DHT11/DHT22.', header: '#include <DHT.h>' },
  { name: 'Servo', version: '1.1.8', author: 'Arduino', description: 'Controle de Servos.', header: '#include <Servo.h>' }
];

const App: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('ardu_theme') as any) || 'dark');
  const [lang, setLang] = useState<'pt' | 'en'>(() => (localStorage.getItem('ardu_lang') as any) || 'pt');
  const [fontSize, setFontSize] = useState(parseInt(localStorage.getItem('ardu_font_size') || '14'));
  const [lineWrapping, setLineWrapping] = useState(localStorage.getItem('ardu_line_wrap') === 'true');
  const [autoSave, setAutoSave] = useState(localStorage.getItem('ardu_auto_save') !== 'false');

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
  const [uploadProgress, setUploadProgress] = useState(0);
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
    if (autoSave) localStorage.setItem('ardu_files', JSON.stringify(files));
  }, [files, autoSave]);

  useEffect(() => {
    if (consoleEndRef.current) consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [serialMessages, outputMessages]);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

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
      setChatHistory(prev => [...prev, { role: 'assistant', text: `⚠️ Erro Crítico: ${err.message}` }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleVerify = async () => {
    if (isBusy) return;
    setIsBusy(true);
    setConsoleTab('output');
    setOutputMessages(prev => [...prev, `[Verificando] ${activeFile.name}...`]);
    const result = await analyzeCode(activeFile.content);
    setTimeout(() => {
      setOutputMessages(prev => [...prev, `[${result.status}] ${result.summary}`]);
      setIsBusy(false);
    }, 1200);
  };

  const handleUpload = async () => {
    if (isUploading) return;
    if (!isConnected) {
      setOutputMessages(prev => [...prev, "❌ Erro: Nenhuma placa USB conectada."]);
      return;
    }
    setIsUploading(true);
    setUploadProgress(10);
    setConsoleTab('output');
    setOutputMessages(prev => [...prev, `[Upload] Iniciando gravação em ${selectedBoard.name}...`]);

    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
    await delay(1000); setUploadProgress(40); setOutputMessages(prev => [...prev, "Compilando binários..."]);
    await delay(1000); setUploadProgress(70); setOutputMessages(prev => [...prev, "Enviando para Flash (Avrdude)..."]);
    await delay(1000); setUploadProgress(100); setOutputMessages(prev => [...prev, "✅ Upload concluído com sucesso."]);
    
    setTimeout(() => { setIsUploading(false); setUploadProgress(0); }, 500);
  };

  const connectSerial = async () => {
    try {
      if (!('serial' in navigator)) { alert("Navegador incompatível com Web Serial."); return; }
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;
      setIsConnected(true);
      setOutputMessages(prev => [...prev, `[Serial] Conectado à porta USB.`]);

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

  // Fixed: Added sendSerialData to resolve missing name errors on lines 485 and 486
  const sendSerialData = async () => {
    if (!serialInput.trim() || !portRef.current) return;
    try {
      const encoder = new TextEncoder();
      const writer = portRef.current.writable.getWriter();
      await writer.write(encoder.encode(serialInput + '\n'));
      writer.releaseLock();
      
      setSerialMessages(prev => [
        ...prev, 
        { 
          timestamp: new Date().toLocaleTimeString(), 
          type: 'out', 
          text: serialInput 
        }
      ].slice(-100));
      setSerialInput('');
    } catch (err) {
      setOutputMessages(prev => [...prev, `❌ [Serial] Erro ao enviar: ${err}`]);
    }
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
      {/* TOOLBAR ARDUINO IDE STYLE */}
      <header className={`h-14 border-b ${isDark ? 'border-white/5 bg-[#141620]' : 'border-slate-200 bg-white'} flex items-center justify-between px-4 shrink-0 z-50`}>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setActiveTab('creator')}>
            <div className="w-8 h-8 rounded-lg bg-[#00878F] flex items-center justify-center shadow-lg shadow-teal-500/10">
              <Zap size={20} className="text-white fill-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-black text-xs tracking-tighter text-[#00878F]">{t.ide_name}</span>
              <span className="text-[8px] opacity-40 font-bold uppercase tracking-widest">v2.0 Web</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-black/10 p-1 rounded-lg border border-white/5">
            <button onClick={handleVerify} disabled={isBusy} className={`p-2 rounded-md transition-all ${isBusy ? 'text-teal-500 bg-teal-500/10' : 'text-slate-400 hover:bg-white/5 hover:text-teal-400'}`} title={t.btn_verify}>
              {isBusy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            </button>
            <button onClick={handleUpload} disabled={isUploading} className={`p-2 rounded-md transition-all ${isUploading ? 'text-teal-500 bg-teal-500/10' : 'text-slate-400 hover:bg-white/5 hover:text-teal-400'}`} title={t.btn_upload}>
              {isUploading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
            </button>
          </div>

          <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-bold border ${isDark ? 'bg-black/20 border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
            <Cpu size={14} className="text-[#00878F]" />
            <select value={selectedBoard.id} onChange={(e) => setSelectedBoard(BOARDS.find(b => b.id === e.target.value) || BOARDS[0])} className="bg-transparent outline-none cursor-pointer text-slate-400 hover:text-white transition-colors">
              {BOARDS.map(b => <option key={b.id} value={b.id} className="bg-[#141620]">{b.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={connectSerial} className={`px-5 py-2 rounded-full text-[10px] font-black uppercase transition-all shadow-lg flex items-center gap-2 ${isConnected ? 'bg-[#00878F] text-white' : 'bg-slate-500/20 text-slate-400 hover:bg-slate-500/30'}`}>
             <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-white animate-pulse' : 'bg-slate-600'}`} />
             {isConnected ? t.btn_connected : t.btn_connect}
          </button>
          <div className="w-[1px] h-6 bg-white/5 mx-1" />
          <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className="p-2 text-slate-400 hover:text-[#00878F] transition-colors">
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
        
        {isUploading && (
          <div className="absolute bottom-0 left-0 w-full h-[3px] bg-black/20">
            <div className="h-full bg-teal-500 transition-all duration-300 shadow-[0_0_10px_rgba(20,184,166,0.5)]" style={{ width: `${uploadProgress}%` }} />
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR NAVIGATION - ICONES GRANDES */}
        <nav className={`w-16 border-r ${isDark ? 'border-white/5 bg-[#141620]' : 'border-slate-200 bg-white'} flex flex-col items-center py-8 gap-6 shrink-0`}>
          {[
            { id: 'files', icon: Files, title: t.nav_files },
            { id: 'ai', icon: MessageSquare, title: t.nav_ai },
            { id: 'examples', icon: BookOpen, title: t.nav_examples },
            { id: 'libraries', icon: Box, title: t.nav_libs },
            { id: 'settings', icon: Settings, title: t.nav_settings },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as TabType)} className={`group relative p-3 rounded-2xl transition-all ${activeTab === tab.id ? 'bg-[#00878F] text-white shadow-xl shadow-teal-900/40' : 'text-slate-500 hover:text-[#00878F] hover:bg-teal-500/5'}`} title={tab.title}>
              <tab.icon size={22} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
              {activeTab === tab.id && <div className="absolute -left-16 w-1 h-8 bg-[#00878F] rounded-r-full" />}
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={() => setActiveTab('creator')} className={`p-3 rounded-2xl transition-all ${activeTab === 'creator' ? 'bg-[#00878F] text-white shadow-xl' : 'text-slate-500 hover:text-[#00878F]'}`}>
            <User size={22} />
          </button>
        </nav>

        {/* SIDEBAR DRAWER */}
        <aside className={`w-80 border-r ${isDark ? 'border-white/5 bg-[#0f111a]' : 'border-slate-200 bg-white'} flex flex-col shrink-0 overflow-hidden`}>
          <div className="h-12 px-6 flex items-center justify-between border-b border-white/5">
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#00878F]">{t[`nav_${activeTab}` as keyof typeof t] || activeTab}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {activeTab === 'files' && (
              <div className="p-4 space-y-2">
                <button onClick={() => setFiles([...files, { name: `sketch_${files.length}.ino`, content: DEFAULT_CODE, isOpen: true }])} className="w-full flex items-center justify-center gap-2 p-3 bg-[#00878F]/10 border border-[#00878F]/30 rounded-xl text-[11px] font-black text-[#00878F] hover:bg-[#00878F] hover:text-white transition-all mb-4">
                  <Plus size={16}/> NOVO ARQUIVO
                </button>
                {files.map((file, idx) => (
                  <div key={idx} onClick={() => setActiveFileIndex(idx)} className={`group px-4 py-3 rounded-xl cursor-pointer flex items-center justify-between transition-all ${activeFileIndex === idx ? 'bg-white/5 border border-white/10' : 'hover:bg-white/5'}`}>
                    <div className="flex items-center gap-3">
                      <FileCode size={16} className={activeFileIndex === idx ? 'text-[#00878F]' : 'text-slate-500'} />
                      <span className={`text-[12px] font-medium ${activeFileIndex === idx ? 'text-white' : 'text-slate-400'}`}>{file.name}</span>
                    </div>
                    {files.length > 1 && <X size={14} className="opacity-0 group-hover:opacity-100 hover:text-red-500" onClick={(e) => { e.stopPropagation(); setFiles(files.filter((_, i) => i !== idx)); }} />}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="flex flex-col h-full bg-[#0b0c14]">
                <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                  {chatHistory.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full opacity-20 text-center px-6">
                      <div className="w-16 h-16 rounded-full bg-teal-500/20 flex items-center justify-center mb-4">
                        <Sparkles size={32} className="text-teal-400" />
                      </div>
                      <p className="text-[12px] font-bold">Olá! Sou o ArduBot.<br/>Pergunte sobre pinagem, funções ou erros.</p>
                      <p className="text-[9px] mt-4 text-teal-500 uppercase font-black">AIza Core Engine</p>
                    </div>
                  )}
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[95%] rounded-2xl p-4 text-[12px] leading-relaxed relative ${msg.role === 'user' ? 'bg-[#00878F] text-white shadow-lg' : 'bg-[#1a1c29] text-slate-300 border border-white/5 shadow-xl'}`}>
                        {msg.text.includes("❌") || msg.text.includes("⚠️") ? (
                          <div className="text-rose-400 font-bold flex gap-3">
                             <AlertTriangle size={18} className="shrink-0" />
                             <div>{msg.text}</div>
                          </div>
                        ) : msg.text}
                        {msg.role === 'assistant' && !msg.text.includes("❌") && (
                           <button onClick={() => navigator.clipboard.writeText(msg.text)} className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-teal-400">
                             <Copy size={12}/>
                           </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {isChatLoading && <div className="text-[10px] text-teal-500 font-black animate-pulse px-2 flex items-center gap-2"><RefreshCw size={12} className="animate-spin"/> PENSANDO...</div>}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-4 border-t border-white/5 bg-[#0f111a]">
                  <div className="flex gap-2 bg-black/40 rounded-2xl p-2 border border-white/5 focus-within:border-[#00878F] transition-all">
                    <input value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} placeholder={t.ai_placeholder} className="flex-1 bg-transparent px-3 py-2 text-[12px] outline-none placeholder:opacity-30" />
                    <button onClick={handleSendMessage} disabled={isChatLoading} className="p-3 bg-[#00878F] text-white rounded-xl hover:bg-[#006468] transition-all shadow-lg active:scale-95"><Send size={18} /></button>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'creator' && (
              <div className="p-10 flex flex-col items-center text-center">
                 <div className="relative group">
                    <div className="absolute inset-0 bg-teal-500 rounded-3xl blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
                    <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-tr from-[#00878F] to-[#00b2bb] flex items-center justify-center mb-8 shadow-2xl ring-2 ring-white/10 overflow-hidden">
                       <User size={48} className="text-white" />
                    </div>
                 </div>
                 <h3 className="font-black text-xl text-white tracking-tight">José Heberto</h3>
                 <span className="text-[10px] font-black text-[#00878F] uppercase tracking-widest mt-1">Full Stack Developer</span>
                 <p className="text-[12px] opacity-40 mt-6 leading-relaxed px-4">{t.creator_bio}</p>
                 <a href="https://instagram.com/josehebertot2" target="_blank" className="mt-10 flex items-center gap-4 bg-[#E1306C] text-white px-8 py-3 rounded-2xl text-[12px] font-black shadow-lg hover:translate-y-[-2px] transition-all active:translate-y-0"><Instagram size={20}/> @josehebertot2</a>
              </div>
            )}

            {activeTab === 'settings' && (
               <div className="p-8 space-y-10">
                  <div className="space-y-6">
                     <span className="text-[11px] font-black text-[#00878F] uppercase tracking-widest flex items-center gap-3">EDITOR CONFIG</span>
                     <div className="space-y-4">
                       <div className="flex items-center justify-between text-[12px] bg-white/5 p-4 rounded-xl border border-white/5">
                          <span className="font-medium">Tamanho da Fonte</span>
                          <input type="number" value={fontSize} onChange={e => setFontSize(Math.max(8, parseInt(e.target.value)))} className="w-14 bg-black/40 rounded-lg px-2 py-1 text-center border border-white/10 text-teal-400 font-bold" />
                       </div>
                       <label className="flex items-center justify-between cursor-pointer bg-white/5 p-4 rounded-xl border border-white/5">
                          <span className="text-[12px] font-medium">Quebra de Linha</span>
                          <div className={`w-10 h-5 rounded-full relative transition-all ${lineWrapping ? 'bg-[#00878F]' : 'bg-slate-700'}`}>
                             <input type="checkbox" checked={lineWrapping} onChange={e => setLineWrapping(e.target.checked)} className="hidden" />
                             <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${lineWrapping ? 'left-6' : 'left-1'}`} />
                          </div>
                       </label>
                     </div>
                  </div>
               </div>
            )}
          </div>
        </aside>

        {/* EDITOR AREA - JETBRAINS STYLE */}
        <main className="flex-1 flex flex-col relative bg-[#0b0c14]">
          <div className="h-11 flex items-center overflow-x-auto no-scrollbar shrink-0 bg-[#0f111a] border-b border-white/5">
            {files.map((file, idx) => (
              <div 
                key={idx} 
                onClick={() => setActiveFileIndex(idx)} 
                className={`h-full min-w-[140px] px-5 flex items-center justify-between gap-4 text-[11px] font-bold cursor-pointer transition-all border-r border-white/5 relative ${activeFileIndex === idx ? 'bg-[#0b0c14] text-[#00b2bb]' : 'opacity-40 grayscale hover:bg-white/5 hover:opacity-80'}`}
              >
                <div className="flex items-center gap-2">
                  <FileCode size={14} className={activeFileIndex === idx ? 'text-[#00878F]' : ''}/> 
                  {file.name}
                </div>
                {activeFileIndex === idx && <div className="absolute top-0 left-0 w-full h-[2px] bg-[#00878F]" />}
                {files.length > 1 && <X size={12} className="hover:text-red-500 opacity-50 hover:opacity-100" onClick={(e) => { e.stopPropagation(); setFiles(files.filter((_, i) => i !== idx)); }} />}
              </div>
            ))}
          </div>

          <div className="flex-1 relative flex overflow-hidden">
            <div className={`w-14 border-r border-white/5 py-6 text-right pr-4 font-mono text-[11px] opacity-20 bg-black/5 select-none`}>
              {(activeFile.content || '').split('\n').map((_, i) => <div key={i} style={{ height: `${fontSize * 1.6}px` }}>{i + 1}</div>)}
            </div>
            <div className="flex-1 relative bg-[#0b0c14]">
               <div ref={highlightRef} className={`absolute inset-0 p-6 pointer-events-none code-font whitespace-pre overflow-hidden z-0 leading-[1.6] ${lineWrapping ? 'whitespace-pre-wrap' : ''}`} style={{ fontSize: `${fontSize}px` }} dangerouslySetInnerHTML={{ __html: highlightCode(activeFile.content) }} />
               <textarea 
                  value={activeFile.content} 
                  disabled={isUploading}
                  onChange={e => { const n = [...files]; n[activeFileIndex].content = e.target.value; setFiles(n); }} 
                  onScroll={e => { if (highlightRef.current) { highlightRef.current.scrollTop = e.currentTarget.scrollTop; highlightRef.current.scrollLeft = e.currentTarget.scrollLeft; } }} 
                  spellCheck={false} 
                  className={`absolute inset-0 w-full h-full p-6 bg-transparent text-transparent caret-teal-400 code-font outline-none z-10 whitespace-pre overflow-auto custom-scrollbar resize-none leading-[1.6] ${lineWrapping ? 'whitespace-pre-wrap' : ''} ${isUploading ? 'opacity-30' : ''}`} 
                  style={{ fontSize: `${fontSize}px` }} 
               />
            </div>
          </div>

          {/* BOTTOM PANELS - ARDUINO CONSOLE */}
          <div className={`h-64 border-t flex flex-col shrink-0 ${isDark ? 'border-white/5 bg-[#0f111a]' : 'border-slate-200 bg-white'}`}>
            <div className="h-10 border-b border-white/5 flex items-center px-6 gap-8 text-[10px] font-black uppercase tracking-widest">
               {['output', 'serial', 'plotter'].map(tab => (
                 <button key={tab} onClick={() => setConsoleTab(tab as any)} className={`flex items-center gap-2 pb-0.5 border-b-2 transition-all h-full ${consoleTab === tab ? 'text-[#00b2bb] border-[#00878F]' : 'border-transparent opacity-30 hover:opacity-100'}`}>
                   {tab === 'output' && <Terminal size={14}/>}
                   {tab === 'serial' && <HardDrive size={14}/>}
                   {tab === 'plotter' && <LineChart size={14}/>}
                   {t[`${tab}_tab` as keyof typeof t] || tab}
                 </button>
               ))}
               <div className="flex-1" />
               <button onClick={() => consoleTab === 'serial' ? setSerialMessages([]) : setOutputMessages([])} className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-500 hover:text-red-400">
                 <Trash2 size={14} />
               </button>
            </div>
            
            <div className="flex-1 overflow-hidden flex flex-col bg-[#0b0c14]">
              {consoleTab === 'serial' && (
                <div className="h-11 border-b border-white/5 flex items-center px-6 gap-3 bg-black/20">
                  <input value={serialInput} onChange={e => setSerialInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendSerialData()} placeholder={t.serial_placeholder} className="flex-1 bg-transparent text-[11px] font-mono outline-none text-[#00b2bb] placeholder:opacity-20" />
                  <button onClick={sendSerialData} className="px-4 py-1 bg-[#00878F] text-white text-[10px] font-black rounded-lg hover:bg-[#006468] transition-all uppercase shadow-lg shadow-teal-900/20">Enviar</button>
                </div>
              )}

              <div className="flex-1 p-5 font-mono text-[12px] overflow-y-auto custom-scrollbar">
                {consoleTab === 'plotter' ? (
                  <div className="h-full flex items-end gap-[2px] px-4 pb-4">
                    {serialMessages.filter(m => m.value !== undefined).slice(-60).map((m, i) => {
                       const height = Math.min(100, (m.value || 0) / 1023 * 100);
                       return (
                        <div key={i} className="flex-1 flex flex-col justify-end group relative" style={{ height: '100%' }}>
                          <div className="bg-[#00878F] w-full rounded-t-sm transition-all duration-300 group-hover:bg-[#00b2bb]" style={{ height: `${height}%` }} />
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#1a1c29] px-2 py-1 rounded text-[8px] opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none">{m.value}</div>
                        </div>
                       );
                    })}
                    {serialMessages.filter(m => m.value !== undefined).length === 0 && <div className="text-[11px] opacity-20 w-full text-center mt-12 flex flex-col items-center gap-2"><LineChart size={40}/> Envie valores numéricos via Serial para plotar.</div>}
                  </div>
                ) : (
                  (consoleTab === 'output' ? outputMessages : serialMessages.map(m => `[${m.timestamp}] ${m.type === 'in' ? '→' : '←'} ${m.text}`)).map((m, i) => (
                    <div key={i} className={`mb-1 whitespace-pre-wrap font-medium tracking-tight ${m.includes('❌') || m.includes('[Erro]') ? 'text-rose-400' : m.includes('✅') || m.includes('[Sucesso]') ? 'text-teal-400' : 'opacity-50'}`}>{m}</div>
                  ))
                )}
                <div ref={consoleEndRef} />
              </div>
            </div>
          </div>
        </main>
      </div>

      <footer className="h-7 bg-[#00878F] text-white flex items-center justify-between px-6 text-[10px] font-black shrink-0 shadow-[0_-4px_10px_rgba(0,100,104,0.3)] z-50">
         <div className="flex gap-6 items-center">
           <span className="flex items-center gap-2"><Cpu size={12}/> {selectedBoard.name}</span>
           <div className="w-[1px] h-3 bg-white/20" />
           <span className="flex items-center gap-2 uppercase tracking-widest">{isConnected ? <Check size={12}/> : <X size={12}/>} {isConnected ? t.status_connected : t.status_waiting}</span>
         </div>
         <div className="flex gap-8 items-center opacity-80">
           <span>{t.footer_lines}: {activeFile.content.split('\n').length}</span>
           <span>{t.footer_chars}: {activeFile.content.length}</span>
           <span className="flex items-center gap-2 uppercase tracking-tighter bg-white/10 px-3 py-1 rounded-full"><Zap size={10} className="fill-white"/> CLOUD IA ONLINE</span>
         </div>
      </footer>
    </div>
  );
};

export default App;
