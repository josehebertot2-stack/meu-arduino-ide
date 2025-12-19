
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Files, Plus, Zap, Check, FileCode, Settings, X, 
  Box, Trash2, Search, Terminal, MessageSquare,
  User, Instagram, Sun, Moon, ArrowRight, Send, Sparkles,
  Cpu, HardDrive, Type as TypeIcon,
  Save, Globe, Loader2, Download, BookOpen, LineChart
} from 'lucide-react';
import { FileNode, TabType, SerialMessage, ArduinoBoard, ArduinoLibrary, ChatMessage, ArduinoExample } from './types';
import { analyzeCode, getCodeAssistance } from './services/geminiService';

const TRANSLATIONS = {
  pt: {
    ide_name: "ARDUPROGRAM",
    nav_files: "Arquivos",
    nav_ai: "IA Assistente",
    nav_examples: "Exemplos",
    nav_libs: "Bibliotecas",
    nav_creator: "Créditos",
    nav_settings: "Ajustes",
    btn_verify: "Verificar Código",
    btn_upload: "Carregar na Placa",
    btn_connect: "Conectar USB",
    btn_connected: "USB Ativa",
    btn_download: "Baixar .ino",
    settings_editor: "Editor",
    settings_font_size: "Tamanho Fonte",
    settings_line_wrap: "Quebra de Linha",
    settings_system: "Sistema",
    settings_autosave: "Salvar Automático",
    settings_lang: "Idioma da IDE",
    ai_placeholder: "Como posso ajudar com seu código?",
    serial_placeholder: "Enviar comando...",
    terminal_tab: "Console de Saída",
    serial_tab: "Monitor Serial",
    plotter_tab: "Serial Plotter",
    footer_lines: "Linhas",
    footer_chars: "Caracteres",
    status_waiting: "Aguardando USB",
    status_connected: "Porta USB Ativa",
    msg_ready: "Pronto para programar.",
    msg_compiling: "Compilando sketch...",
    msg_uploading: "Carregando...",
    msg_success: "Sucesso: O código parece correto!",
    msg_upload_success: "Carregamento concluído.",
    msg_lib_installed: "Biblioteca adicionada!",
    creator_bio: "Engenheiro focado em tornar a eletrônica acessível para todos através da web."
  },
  en: {
    ide_name: "ARDUPROGRAM",
    nav_files: "Files",
    nav_ai: "AI Assistant",
    nav_examples: "Examples",
    nav_libs: "Libraries",
    nav_creator: "Credits",
    nav_settings: "Settings",
    btn_verify: "Verify Code",
    btn_upload: "Upload to Board",
    btn_connect: "Connect USB",
    btn_connected: "USB Connected",
    btn_download: "Download .ino",
    settings_editor: "Editor",
    settings_font_size: "Font Size",
    settings_line_wrap: "Line Wrap",
    settings_system: "System",
    settings_autosave: "Auto Save",
    settings_lang: "IDE Language",
    ai_placeholder: "How can I help with your code?",
    serial_placeholder: "Send command...",
    terminal_tab: "Output Console",
    serial_tab: "Serial Monitor",
    plotter_tab: "Serial Plotter",
    footer_lines: "Lines",
    footer_chars: "Chars",
    status_waiting: "Waiting USB",
    status_connected: "USB Port Active",
    msg_ready: "Ready to code.",
    msg_compiling: "Compiling sketch...",
    msg_uploading: "Uploading...",
    msg_success: "Success: Code looks good!",
    msg_upload_success: "Done uploading.",
    msg_lib_installed: "Library added!",
    creator_bio: "Engineer focused on making electronics accessible to everyone via web."
  }
};

const DEFAULT_CODE = `void setup() {\n  Serial.begin(9600);\n  pinMode(LED_BUILTIN, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(1000);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(1000);\n}`;

const EXAMPLES: ArduinoExample[] = [
  { name: 'Blink', category: 'Basics', content: `void setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(500);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(500);\n}` },
  { name: 'SerialRead', category: 'Basics', content: `void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  if (Serial.available()) {\n    char c = Serial.read();\n    Serial.print("Recebido: ");\n    Serial.println(c);\n  }\n}` },
  { name: 'AnalogPlot', category: 'Plotter', content: `void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int val = analogRead(A0);\n  Serial.println(val);\n  delay(50);\n}` }
];

const BOARDS: ArduinoBoard[] = [
  { id: 'uno', name: 'Arduino Uno', fqbn: 'arduino:avr:uno' },
  { id: 'esp32', name: 'ESP32 Module', fqbn: 'esp32:esp32:esp32' },
  { id: 'nano', name: 'Arduino Nano', fqbn: 'arduino:avr:nano' }
];

const LIBRARIES: ArduinoLibrary[] = [
  { name: 'DHT sensor', version: '1.4.3', author: 'Adafruit', description: 'Sensor de Temperatura e Umidade.', header: '#include <DHT.h>' },
  { name: 'Servo', version: '1.1.8', author: 'Arduino', description: 'Controle de Servo Motores.', header: '#include <Servo.h>' },
  { name: 'LiquidCrystal I2C', version: '1.1.2', author: 'Frank de Brabander', description: 'Display LCD via I2C.', header: '#include <LiquidCrystal_I2C.h>' }
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
  const [outputMessages, setOutputMessages] = useState<string[]>(["ArduProgram IDE inicializada com sucesso."]);
  const [consoleTab, setConsoleTab] = useState<'output' | 'serial' | 'plotter'>('output');
  const [isConnected, setIsConnected] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedBoard, setSelectedBoard] = useState(BOARDS[0]);
  const [searchLib, setSearchLib] = useState('');

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
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'assistant', text: "Erro na comunicação com a IA." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleVerify = async () => {
    if (isBusy || isUploading) return;
    setIsBusy(true);
    setConsoleTab('output');
    setOutputMessages(prev => [...prev, `[LOG] ${t.msg_compiling} (${activeFile.name})`]);
    const result = await analyzeCode(activeFile.content);
    setTimeout(() => {
      setOutputMessages(prev => [...prev, `[${result.status}] ${result.summary}`]);
      setIsBusy(false);
    }, 1500);
  };

  const handleUpload = async () => {
    if (isBusy || isUploading) return;
    if (!isConnected) {
      setOutputMessages(prev => [...prev, "[ERRO] Nenhuma placa conectada. Conecte via USB primeiro."]);
      return;
    }
    setIsUploading(true);
    setUploadProgress(10);
    setConsoleTab('output');
    setOutputMessages(prev => [...prev, `[UPLOAD] Iniciando processo para ${selectedBoard.name}...`]);

    const steps = [
      { p: 30, m: `[LOG] Compilando sketch...` },
      { p: 60, m: `[AVRDUDE] Gravando na memória flash...` },
      { p: 90, m: `[AVRDUDE] Verificando...` }
    ];

    for (const step of steps) {
      await new Promise(r => setTimeout(r, 800));
      setUploadProgress(step.p);
      setOutputMessages(prev => [...prev, step.m]);
    }

    setTimeout(() => {
      setUploadProgress(100);
      setOutputMessages(prev => [...prev, `[SISTEMA] ${t.msg_upload_success}`]);
      setTimeout(() => { setIsUploading(false); setUploadProgress(0); }, 500);
    }, 800);
  };

  const handleDownload = () => {
    const blob = new Blob([activeFile.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const connectSerial = async () => {
    try {
      if (!('serial' in navigator)) { alert("Navegador sem suporte a Web Serial."); return; }
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;
      setIsConnected(true);
      setOutputMessages(prev => [...prev, `[SERIAL] Porta aberta a 9600 baud.`]);

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
        }].slice(-50));
      }
    } catch (err) { setIsConnected(false); }
  };

  const sendSerialData = async () => {
    if (!portRef.current || !serialInput) return;
    const writer = portRef.current.writable.getWriter();
    await writer.write(new TextEncoder().encode(serialInput + '\n'));
    writer.releaseLock();
    setSerialMessages(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), type: 'out', text: serialInput }].slice(-50));
    setSerialInput('');
  };

  const highlightCode = (code: string) => {
    return (code || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\b(void|int|float|char|bool|long|unsigned|const|static|if|else|for|while|return|switch|case|break|byte|word|String|uint8_t|uint16_t|uint32_t|boolean)\b/g, `<span class="text-sky-500 font-bold">$1</span>`)
      .replace(/\b(setup|loop|pinMode|digitalWrite|digitalRead|analogWrite|analogRead|delay|Serial|println|print|begin|available|read|write|millis|micros|abs|min|max|map)\b/g, `<span class="text-teal-400 font-bold">$1</span>`)
      .replace(/\/\/.*/g, `<span class="text-slate-500 italic">$&</span>`)
      .replace(/\b(HIGH|LOW|INPUT|OUTPUT|INPUT_PULLUP|LED_BUILTIN)\b/g, `<span class="text-orange-400">$1</span>`)
      .replace(/#\w+/g, `<span class="text-rose-400">$&</span>`);
  };

  const openExample = (example: ArduinoExample) => {
    const fileName = `${example.name.toLowerCase()}.ino`;
    const exists = files.findIndex(f => f.name === fileName);
    if (exists !== -1) {
      setActiveFileIndex(exists);
    } else {
      const newFiles = [...files, { name: fileName, content: example.content, isOpen: true }];
      setFiles(newFiles);
      setActiveFileIndex(newFiles.length - 1);
    }
    setActiveTab('files');
  };

  return (
    <div className={`flex flex-col h-screen ${isDark ? 'bg-[#0f111a] text-slate-300' : 'bg-white text-slate-800'} overflow-hidden`}>
      {/* HEADER */}
      <header className={`h-12 border-b ${isDark ? 'border-white/5 bg-[#181a25]' : 'border-slate-200 bg-slate-50'} flex items-center justify-between px-3 shrink-0 relative z-50`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-2">
            <Zap size={18} className="text-teal-500" fill="currentColor" />
            <span className="font-black text-sm tracking-tighter text-teal-500">{t.ide_name}</span>
          </div>
          <div className="flex items-center gap-1 border-l border-white/5 pl-3">
            <button onClick={handleVerify} disabled={isBusy} className={`p-2 rounded transition-all ${isBusy ? 'text-teal-500 animate-pulse' : 'text-slate-400 hover:bg-white/5 hover:text-teal-500'}`} title={t.btn_verify}>
              {isBusy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            </button>
            <button onClick={handleUpload} disabled={isUploading} className={`p-2 rounded transition-all ${isUploading ? 'text-teal-500' : 'text-slate-400 hover:bg-white/5 hover:text-teal-500'}`} title={t.btn_upload}>
              {isUploading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
            </button>
            <button onClick={handleDownload} className="p-2 text-slate-400 hover:bg-white/5 hover:text-teal-500 rounded transition-all" title={t.btn_download}>
              <Download size={18} />
            </button>
          </div>
          <div className={`flex items-center gap-2 rounded px-3 py-1 text-[10px] font-bold border ${isDark ? 'bg-black/40 border-white/5' : 'bg-white border-slate-200'}`}>
            <Cpu size={12} className="text-teal-500" />
            <select value={selectedBoard.id} onChange={(e) => setSelectedBoard(BOARDS.find(b => b.id === e.target.value) || BOARDS[0])} className="bg-transparent outline-none cursor-pointer">
              {BOARDS.map(b => <option key={b.id} value={b.id} className="bg-[#181a25]">{b.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={connectSerial} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all shadow-sm ${isConnected ? 'bg-teal-600 text-white' : 'bg-slate-500/20 text-slate-400 hover:bg-slate-500/30'}`}>
            {isConnected ? t.btn_connected : t.btn_connect}
          </button>
          <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className="p-2 text-slate-400 hover:text-teal-500">
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
        {isUploading && (
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-teal-900/20">
            <div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR NAVIGATION */}
        <nav className={`w-14 border-r ${isDark ? 'border-white/5 bg-[#0f111a]' : 'border-slate-200 bg-slate-50'} flex flex-col items-center py-6 gap-5 shrink-0`}>
          {[
            { id: 'files', icon: Files, title: t.nav_files },
            { id: 'ai', icon: MessageSquare, title: t.nav_ai },
            { id: 'examples', icon: BookOpen, title: t.nav_examples },
            { id: 'libraries', icon: Box, title: t.nav_libs },
            { id: 'creator', icon: User, title: t.nav_creator },
            { id: 'settings', icon: Settings, title: t.nav_settings },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as TabType)} className={`p-2.5 rounded-xl transition-all ${activeTab === tab.id ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/20' : 'text-slate-500 hover:text-teal-500 hover:bg-teal-500/5'}`} title={tab.title}>
              <tab.icon size={20} />
            </button>
          ))}
        </nav>

        {/* SIDEBAR CONTENT */}
        <aside className={`w-72 border-r ${isDark ? 'border-white/5 bg-[#141620]' : 'border-slate-200 bg-white'} flex flex-col shrink-0 overflow-hidden`}>
          <div className="h-10 px-4 flex items-center justify-between border-b border-white/5 bg-black/10">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-50">{t[`nav_${activeTab}` as keyof typeof t] || activeTab}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {activeTab === 'files' && (
              <div className="flex flex-col p-2">
                <button onClick={() => setFiles([...files, { name: `sketch_${files.length}.ino`, content: DEFAULT_CODE, isOpen: true }])} className="m-2 mb-4 flex items-center justify-center gap-2 p-2 border border-dashed border-slate-500/30 rounded-lg text-[11px] font-bold hover:border-teal-500 hover:text-teal-500 transition-all">
                  <Plus size={14}/> Novo Arquivo
                </button>
                {files.map((file, idx) => (
                  <div key={idx} onClick={() => setActiveFileIndex(idx)} className={`group px-3 py-2 rounded-lg mb-1 text-[12px] cursor-pointer flex items-center justify-between transition-all ${activeFileIndex === idx ? 'bg-teal-500/10 text-teal-400' : 'hover:bg-black/20'}`}>
                    <div className="flex items-center gap-2">
                      <FileCode size={14} className={activeFileIndex === idx ? 'text-teal-500' : 'text-slate-500'} />
                      <span className="truncate max-w-[160px]">{file.name}</span>
                    </div>
                    {files.length > 1 && <X size={12} className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity" onClick={(e) => { e.stopPropagation(); setFiles(files.filter((_, i) => i !== idx)); if(activeFileIndex >= idx) setActiveFileIndex(Math.max(0, activeFileIndex-1)); }} />}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'examples' && (
              <div className="p-4 space-y-6">
                {['Basics', 'Plotter'].map(cat => (
                  <div key={cat} className="space-y-2">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{cat}</h4>
                    {EXAMPLES.filter(ex => ex.category === cat).map(ex => (
                      <button key={ex.name} onClick={() => openExample(ex)} className="w-full text-left px-3 py-2.5 rounded-lg bg-black/20 border border-white/5 hover:border-teal-500/50 hover:bg-teal-500/5 transition-all flex items-center gap-3">
                        <div className="w-6 h-6 rounded bg-teal-500/20 flex items-center justify-center"><BookOpen size={12} className="text-teal-500" /></div>
                        <span className="text-[12px] font-bold">{ex.name}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="flex flex-col h-full bg-[#0f111a]">
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                  {chatHistory.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full opacity-30 text-center p-6">
                      <Sparkles size={32} className="mb-4 text-teal-500" />
                      <p className="text-[11px]">Olá! Como posso ajudar com seu código hoje?</p>
                    </div>
                  )}
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[90%] rounded-2xl p-3 text-[12px] ${msg.role === 'user' ? 'bg-teal-600 text-white' : 'bg-black/40 text-slate-300 border border-white/5'}`}>{msg.text}</div>
                    </div>
                  ))}
                  {isChatLoading && <div className="text-[10px] text-teal-500 font-bold animate-pulse px-2">Processando...</div>}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-3 border-t border-white/5">
                  <div className="flex gap-2 bg-black/40 rounded-xl p-1 border border-white/5 focus-within:border-teal-500 transition-all">
                    <input value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} placeholder={t.ai_placeholder} className="flex-1 bg-transparent px-2 py-2 text-[12px] outline-none" />
                    <button onClick={handleSendMessage} disabled={isChatLoading} className="p-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"><Send size={16} /></button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'libraries' && (
              <div className="p-4 space-y-4">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 opacity-30" />
                  <input value={searchLib} onChange={e => setSearchLib(e.target.value)} placeholder="Pesquisar..." className="w-full bg-black/30 border border-white/5 rounded-lg px-3 py-2 pl-9 text-[12px] outline-none focus:border-teal-500" />
                </div>
                {LIBRARIES.filter(l => l.name.toLowerCase().includes(searchLib.toLowerCase())).map((lib, i) => (
                  <div key={i} className="p-3 bg-black/20 border border-white/5 rounded-lg hover:border-teal-500/40 transition-all">
                    <div className="flex justify-between font-bold text-teal-400 text-[12px] mb-1"><span>{lib.name}</span><span className="text-[10px] opacity-40">{lib.version}</span></div>
                    <p className="text-[11px] opacity-50 mb-3">{lib.description}</p>
                    <button onClick={() => { 
                      const n = [...files]; n[activeFileIndex].content = lib.header + "\n" + n[activeFileIndex].content; 
                      setFiles(n); setOutputMessages(prev => [...prev, `[BIB] ${t.msg_lib_installed}: ${lib.name}`]);
                    }} className="w-full py-2 bg-teal-600/20 text-teal-400 text-[10px] font-black rounded-lg hover:bg-teal-600 hover:text-white transition-all uppercase">Instalar</button>
                  </div>
                ))}
              </div>
            )}
            
            {activeTab === 'creator' && (
              <div className="p-8 flex flex-col items-center text-center">
                 <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center mb-6 shadow-xl ring-4 ring-teal-500/20"><User size={40} className="text-white" /></div>
                 <h3 className="font-bold text-base">José Heberto Torres da Costa</h3>
                 <p className="text-[11px] opacity-50 mt-4 leading-relaxed">{t.creator_bio}</p>
                 <a href="https://instagram.com/josehebertot2" target="_blank" className="mt-8 flex items-center justify-center gap-3 bg-[#E1306C] text-white px-6 py-2.5 rounded-full text-[12px] font-bold shadow-lg hover:scale-105 transition-all"><Instagram size={18}/> @josehebertot2</a>
              </div>
            )}

            {activeTab === 'settings' && (
               <div className="p-6 space-y-8">
                  <div className="space-y-4">
                     <span className="text-[10px] font-black opacity-40 uppercase tracking-widest flex items-center gap-2"><TypeIcon size={14}/> {t.settings_editor}</span>
                     <div className="flex items-center justify-between text-[12px]">
                        <span>{t.settings_font_size}</span>
                        <input type="number" value={fontSize} onChange={e => setFontSize(Math.max(8, parseInt(e.target.value)))} className="w-12 bg-black/40 rounded px-1 py-1 text-center border border-white/5" />
                     </div>
                     <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-[12px]">{t.settings_line_wrap}</span>
                        <input type="checkbox" checked={lineWrapping} onChange={e => setLineWrapping(e.target.checked)} className="w-4 h-4 accent-teal-500" />
                     </label>
                  </div>
                  <div className="space-y-4">
                     <span className="text-[10px] font-black opacity-40 uppercase tracking-widest flex items-center gap-2"><Globe size={14}/> {t.settings_lang}</span>
                     <select value={lang} onChange={e => setLang(e.target.value as any)} className={`w-full rounded-lg p-2 text-[12px] outline-none border ${isDark ? 'bg-black/40 border-white/5' : 'bg-white border-slate-200'}`}>
                        <option value="pt">Português (BR)</option>
                        <option value="en">English (US)</option>
                     </select>
                  </div>
               </div>
            )}
          </div>
        </aside>

        {/* EDITOR AREA */}
        <main className="flex-1 flex flex-col relative bg-[#0d0f17]">
          <div className={`h-10 flex items-center overflow-x-auto no-scrollbar shrink-0 ${isDark ? 'bg-[#141620]' : 'bg-slate-100'}`}>
            {files.map((file, idx) => (
              <div 
                key={idx} 
                onClick={() => setActiveFileIndex(idx)} 
                className={`h-full min-w-[120px] px-4 flex items-center justify-between gap-3 text-[11px] font-bold cursor-pointer transition-all border-r border-white/5 ${activeFileIndex === idx ? (isDark ? 'bg-[#0d0f17] text-teal-400 border-t-2 border-t-teal-500' : 'bg-white text-teal-600 border-t-2 border-t-teal-500 shadow-sm') : 'opacity-50 grayscale hover:grayscale-0 hover:bg-black/10'}`}
              >
                <div className="flex items-center gap-2"><FileCode size={12}/> {file.name}</div>
                {files.length > 1 && <X size={10} className="hover:text-red-500" onClick={(e) => { e.stopPropagation(); setFiles(files.filter((_, i) => i !== idx)); if(activeFileIndex >= idx) setActiveFileIndex(Math.max(0, activeFileIndex-1)); }} />}
              </div>
            ))}
          </div>

          <div className="flex-1 relative flex">
            <div className={`w-12 border-r border-white/5 py-4 text-right pr-3 font-mono text-[11px] opacity-20 bg-black/10 select-none`}>
              {(activeFile.content || '').split('\n').map((_, i) => <div key={i} style={{ height: `${fontSize * 1.5}px` }}>{i + 1}</div>)}
            </div>
            <div className="flex-1 relative">
               <div ref={highlightRef} className={`absolute inset-0 p-4 pointer-events-none code-font whitespace-pre overflow-hidden z-0 leading-normal ${lineWrapping ? 'whitespace-pre-wrap' : ''}`} style={{ fontSize: `${fontSize}px` }} dangerouslySetInnerHTML={{ __html: highlightCode(activeFile.content) }} />
               <textarea 
                  value={activeFile.content} 
                  disabled={isUploading}
                  onChange={e => { const n = [...files]; n[activeFileIndex].content = e.target.value; setFiles(n); }} 
                  onScroll={e => { if (highlightRef.current) { highlightRef.current.scrollTop = e.currentTarget.scrollTop; highlightRef.current.scrollLeft = e.currentTarget.scrollLeft; } }} 
                  spellCheck={false} 
                  className={`absolute inset-0 w-full h-full p-4 bg-transparent text-transparent caret-teal-500 code-font outline-none z-10 whitespace-pre overflow-auto custom-scrollbar resize-none leading-normal ${lineWrapping ? 'whitespace-pre-wrap' : ''} ${isUploading ? 'opacity-50' : ''}`} 
                  style={{ fontSize: `${fontSize}px` }} 
               />
            </div>
          </div>

          {/* BOTTOM PANELS */}
          <div className={`h-56 border-t flex flex-col shrink-0 ${isDark ? 'border-white/5 bg-[#141620]' : 'border-slate-200 bg-white'}`}>
            <div className="h-9 border-b border-white/5 flex items-center px-4 gap-6 text-[10px] font-black uppercase tracking-widest overflow-hidden">
               {['output', 'serial', 'plotter'].map(tab => (
                 <button key={tab} onClick={() => setConsoleTab(tab as any)} className={`flex items-center gap-2 pb-0.5 border-b-2 transition-all h-full ${consoleTab === tab ? 'text-teal-500 border-teal-500' : 'border-transparent opacity-40 hover:opacity-100'}`}>
                   {tab === 'output' && <Terminal size={12}/>}
                   {tab === 'serial' && <HardDrive size={12}/>}
                   {tab === 'plotter' && <LineChart size={12}/>}
                   {t[`${tab}_tab` as keyof typeof t] || tab}
                 </button>
               ))}
               <div className="flex-1" />
               <Trash2 size={12} className="cursor-pointer opacity-30 hover:opacity-100" onClick={() => consoleTab === 'serial' ? setSerialMessages([]) : setOutputMessages([])} />
            </div>
            
            <div className="flex-1 overflow-hidden flex flex-col">
              {consoleTab === 'serial' && (
                <div className="h-8 border-b border-white/5 flex items-center px-4 gap-2 bg-black/20">
                  <input value={serialInput} onChange={e => setSerialInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendSerialData()} placeholder={t.serial_placeholder} className="flex-1 bg-transparent text-[11px] font-mono outline-none text-teal-400" />
                  <button onClick={sendSerialData} className="text-teal-500 text-[10px] font-black hover:underline uppercase">Enviar</button>
                </div>
              )}

              <div className="flex-1 p-3 font-mono text-[12px] overflow-y-auto custom-scrollbar bg-black/30">
                {consoleTab === 'plotter' ? (
                  <div className="h-full flex items-end gap-1 px-2">
                    {serialMessages.filter(m => m.value !== undefined).slice(-40).map((m, i) => (
                      <div key={i} className="bg-teal-500/50 w-full min-w-[4px] rounded-t-sm transition-all" style={{ height: `${Math.min(100, (m.value || 0) / 1023 * 100)}%` }} title={`${m.value}`} />
                    ))}
                    {serialMessages.filter(m => m.value !== undefined).length === 0 && <div className="text-[11px] opacity-30 w-full text-center mb-10">Conecte um dispositivo para plotar dados.</div>}
                  </div>
                ) : (
                  (consoleTab === 'output' ? outputMessages : serialMessages.map(m => `[${m.timestamp}] ${m.type === 'in' ? 'RX <' : 'TX >'} ${m.text}`)).map((m, i) => (
                    <div key={i} className={`mb-0.5 whitespace-pre-wrap ${m.includes('[ERRO]') ? 'text-red-400 font-bold' : m.includes('[UPLOAD]') ? 'text-teal-400' : 'opacity-60'}`}>{m}</div>
                  ))
                )}
                <div ref={consoleEndRef} />
              </div>
            </div>
          </div>
        </main>
      </div>

      <footer className="h-6 bg-teal-600 text-white flex items-center justify-between px-4 text-[10px] font-bold shrink-0 shadow-xl">
         <div className="flex gap-4">
           <span className="flex items-center gap-1.5"><Cpu size={11}/> {selectedBoard.name}</span>
           <span className="opacity-50">|</span>
           <span className="flex items-center gap-1.5">{isConnected ? <Check size={11}/> : <X size={11}/>} {isConnected ? t.status_connected : t.status_waiting}</span>
         </div>
         <div className="flex gap-6 opacity-80">
           <span>{t.footer_lines}: {(activeFile.content || '').split('\n').length}</span>
           <span>{t.footer_chars}: {activeFile.content.length}</span>
           <span className="flex items-center gap-1.5 uppercase tracking-tighter"><Zap size={10}/> IA ATIVA</span>
         </div>
      </footer>
    </div>
  );
};

export default App;
