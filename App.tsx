
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Files, Plus, Zap, Check, FileCode, Settings, X, Sparkles, 
  Box, MessageSquare, Trash2, Download, Search, Terminal,
  User, Instagram, Send, Info, Award, Sun, Moon, ArrowRight,
  Cpu, Layout, Bug, HelpCircle, HardDrive, Type as TypeIcon,
  WrapText, Save, Globe
} from 'lucide-react';
import { FileNode, ChatMessage, TabType, SerialMessage, ArduinoExample, ArduinoBoard, ArduinoLibrary } from './types';
import { getCodeAssistance, analyzeCode } from './services/geminiService';

// --- LOCALIZATION DICTIONARY ---
const TRANSLATIONS = {
  pt: {
    ide_name: "ARDUPROGRAM",
    nav_files: "Gerenciador",
    nav_ai: "IA Assistente",
    nav_libs: "Bibliotecas",
    nav_creator: "Créditos",
    nav_settings: "Ajustes",
    btn_verify: "Compilar Código",
    btn_upload: "Carregar na Placa",
    btn_connect: "Conectar USB",
    btn_connected: "USB Ativa",
    settings_editor: "Editor de Código",
    settings_font_size: "Tamanho da Fonte",
    settings_line_wrap: "Quebra de Linha",
    settings_ai: "Inteligência Artificial",
    settings_context: "Enviar Código no Contexto",
    settings_system: "Sistema",
    settings_autosave: "Auto-save Local",
    settings_lang: "Idioma da IDE",
    ai_welcome_title: "Assistente Gemini",
    ai_welcome_desc: "Peça ajuda com circuitos ou lógica de programação Arduino.",
    ai_placeholder: "Perguntar ao Gemini...",
    serial_placeholder: "Comando Serial...",
    terminal_tab: "Terminal",
    serial_tab: "Monitor Serial",
    footer_lines: "Linha",
    footer_chars: "Caracteres",
    status_waiting: "Aguardando USB",
    status_connected: "USB Conectado",
    msg_ready: "Pronto para programar.",
    msg_compiling: "Compilando",
    msg_success: "Sucesso: Código verificado.",
    msg_lib_installed: "Biblioteca instalada com sucesso.",
    creator_bio: "Engenheiro de Sistemas focado em facilitar o acesso à eletrônica via Web."
  },
  en: {
    ide_name: "ARDUPROGRAM",
    nav_files: "Explorer",
    nav_ai: "AI Assistant",
    nav_libs: "Libraries",
    nav_creator: "Credits",
    nav_settings: "Settings",
    btn_verify: "Compile Code",
    btn_upload: "Upload to Board",
    btn_connect: "Connect USB",
    btn_connected: "USB Active",
    settings_editor: "Code Editor",
    settings_font_size: "Font Size",
    settings_line_wrap: "Line Wrapping",
    settings_ai: "Artificial Intelligence",
    settings_context: "Send Code in Context",
    settings_system: "System",
    settings_autosave: "Local Auto-save",
    settings_lang: "IDE Language",
    ai_welcome_title: "Gemini Assistant",
    ai_welcome_desc: "Ask for help with circuits or Arduino logic.",
    ai_placeholder: "Ask Gemini...",
    serial_placeholder: "Serial Command...",
    terminal_tab: "Terminal",
    serial_tab: "Serial Monitor",
    footer_lines: "Line",
    footer_chars: "Characters",
    status_waiting: "Waiting for USB",
    status_connected: "USB Connected",
    msg_ready: "Ready to code.",
    msg_compiling: "Compiling",
    msg_success: "Success: Code verified.",
    msg_lib_installed: "Library installed successfully.",
    creator_bio: "Systems Engineer focused on making electronics accessible via Web."
  }
};

const DEFAULT_CODE = `void setup() {
  // ARDUPROGRAM IDE - Setup
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  // Your main code here:
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000);
  digitalWrite(LED_BUILTIN, LOW);
  delay(1000);
}`;

const BOARDS: ArduinoBoard[] = [
  { id: 'uno', name: 'Arduino Uno', fqbn: 'arduino:avr:uno' },
  { id: 'esp32', name: 'ESP32 Dev Module', fqbn: 'esp32:esp32:esp32' },
  { id: 'esp8266', name: 'NodeMCU 1.0 (ESP-12E)', fqbn: 'esp8266:esp8266:nodemcuv2' },
  { id: 'nano', name: 'Arduino Nano', fqbn: 'arduino:avr:nano' }
];

const LIBRARIES: ArduinoLibrary[] = [
  { name: 'DHT sensor library', version: '1.4.3', author: 'Adafruit', description: 'Library for DHT11/DHT22 sensors.', header: '#include <DHT.h>' },
  { name: 'Servo', version: '1.1.8', author: 'Arduino', description: 'Standard Servo control.', header: '#include <Servo.h>' },
  { name: 'LiquidCrystal I2C', version: '1.1.2', author: 'Frank de Brabander', description: 'LCD displays via I2C.', header: '#include <LiquidCrystal_I2C.h>' },
  { name: 'WiFiManager', version: '2.0.15', author: 'tzapu', description: 'Dynamic WiFi config for ESP32/ESP8266.', header: '#include <WiFiManager.h>' }
];

const App: React.FC = () => {
  // IDE Configs
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('ardu_theme') as any) || 'dark');
  const [lang, setLang] = useState<'pt' | 'en'>(() => (localStorage.getItem('ardu_lang') as any) || 'pt');
  const [fontSize, setFontSize] = useState(parseInt(localStorage.getItem('ardu_font_size') || '14'));
  const [lineWrapping, setLineWrapping] = useState(localStorage.getItem('ardu_line_wrap') === 'true');
  const [autoSave, setAutoSave] = useState(localStorage.getItem('ardu_auto_save') !== 'false');
  const [aiContext, setAiContext] = useState(localStorage.getItem('ardu_ai_context') !== 'false');

  const t = TRANSLATIONS[lang];

  const [activeTab, setActiveTab] = useState<TabType>('files');
  const [files, setFiles] = useState<FileNode[]>(() => {
    try {
      const saved = localStorage.getItem('ardu_files');
      if (saved) return JSON.parse(saved);
    } catch (e) { console.error(e); }
    return [{ name: 'sketch_main.ino', content: DEFAULT_CODE, isOpen: true }];
  });
  
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [serialMessages, setSerialMessages] = useState<SerialMessage[]>([]);
  const [serialInput, setSerialInput] = useState('');
  const [outputMessages, setOutputMessages] = useState<string[]>(["ARDUPROGRAM IDE v1.0.0", t.msg_ready]);
  const [consoleTab, setConsoleTab] = useState<'output' | 'serial'>('output');
  const [isConnected, setIsConnected] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedBoard, setSelectedBoard] = useState(BOARDS[0]);
  const [searchLib, setSearchLib] = useState('');

  const portRef = useRef<any>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const activeFile = useMemo(() => files[activeFileIndex] || files[0], [files, activeFileIndex]);

  // Persist Configs
  useEffect(() => {
    localStorage.setItem('ardu_theme', theme);
    localStorage.setItem('ardu_lang', lang);
    localStorage.setItem('ardu_font_size', fontSize.toString());
    localStorage.setItem('ardu_line_wrap', lineWrapping.toString());
    localStorage.setItem('ardu_auto_save', autoSave.toString());
    localStorage.setItem('ardu_ai_context', aiContext.toString());
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme, lang, fontSize, lineWrapping, autoSave, aiContext]);

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
      const response = await getCodeAssistance(userMsg, aiContext ? activeFile.content : "");
      setChatHistory(prev => [...prev, { role: 'assistant', text: response }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'assistant', text: lang === 'pt' ? "Erro na conexão." : "Connection error." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleVerify = async () => {
    if (isBusy) return;
    setIsBusy(true);
    setConsoleTab('output');
    setOutputMessages(prev => [...prev, `[${t.msg_compiling}] ${activeFile.name}...`]);
    
    for(let i=0; i<=100; i+=25) { 
      setProgress(i); 
      await new Promise(r => setTimeout(r, 200)); 
    }
    
    try {
      const result = await analyzeCode(activeFile.content);
      if (result.status === 'Ok' || result.status === 'Alerta') {
        setOutputMessages(prev => [...prev, t.msg_success, `Info: ${result.summary}`]);
      } else {
        setOutputMessages(prev => [...prev, `[ERROR] ${result.summary}`]);
      }
    } catch (e) {
      setOutputMessages(prev => [...prev, "[ERROR] IA analysis failed."]);
    }
    
    setIsBusy(false);
    setProgress(0);
  };

  const connectSerial = async () => {
    try {
      if (!('serial' in navigator)) { alert("Web Serial not supported."); return; }
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 115200 });
      portRef.current = port;
      setIsConnected(true);
      setOutputMessages(prev => [...prev, `Serial Monitor opened @ 115200 bps.`]);
      
      const reader = port.readable.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = new TextDecoder().decode(value);
        setSerialMessages(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), type: 'in', text }]);
      }
    } catch (err) { setIsConnected(false); }
  };

  const sendSerialData = async () => {
    if (!portRef.current || !serialInput) return;
    const writer = portRef.current.writable.getWriter();
    await writer.write(new TextEncoder().encode(serialInput + '\n'));
    writer.releaseLock();
    setSerialMessages(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), type: 'out', text: serialInput }]);
    setSerialInput('');
  };

  const highlightCode = (code: string) => {
    return (code || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\b(void|int|float|char|bool|long|unsigned|const|static|if|else|for|while|return|switch|case|break|byte|word|String)\b/g, `<span class="text-[#2563eb] font-bold">$1</span>`)
      .replace(/\b(setup|loop|pinMode|digitalWrite|digitalRead|analogWrite|analogRead|delay|Serial|println|print|begin|available|read|write|millis)\b/g, `<span class="text-[#7c3aed] font-bold">$1</span>`)
      .replace(/\/\/.*/g, `<span class="text-slate-400 italic">$&</span>`)
      .replace(/"[^"]*"/g, `<span class="text-[#059669]">$&</span>`)
      .replace(/\b(HIGH|LOW|INPUT|OUTPUT|INPUT_PULLUP|LED_BUILTIN)\b/g, `<span class="text-[#ea580c] font-semibold">$1</span>`);
  };

  const isDark = theme === 'dark';

  return (
    <div className={`flex flex-col h-screen ${isDark ? 'bg-[#0f172a] text-slate-300' : 'bg-[#f8fafc] text-slate-800'} overflow-hidden transition-colors`}>
      {/* HEADER */}
      <header className={`h-12 border-b ${isDark ? 'border-white/10 bg-[#1e293b]' : 'border-slate-200 bg-white'} flex items-center justify-between px-3 shrink-0 z-50`}>
        <div className="flex items-center gap-2">
          <div className="flex items-center px-2 mr-6 gap-2.5">
             <div className="p-1.5 bg-[#2563eb] rounded-lg shadow-lg shadow-blue-500/20">
                <Zap size={18} className="text-white" fill="currentColor" />
             </div>
             <span className="font-extrabold text-[15px] tracking-tight uppercase text-[#2563eb] flex items-center">
                {t.ide_name} <span className="ml-5">IDE</span>
             </span>
          </div>
          
          <div className="flex items-center gap-1.5 border-l pl-3 border-white/5">
            <button onClick={handleVerify} title={t.btn_verify} disabled={isBusy} className={`p-2 rounded-lg transition-all ${isDark ? 'text-slate-400 hover:bg-white/5 hover:text-[#2563eb]' : 'text-slate-500 hover:bg-slate-100 hover:text-[#2563eb]'}`}>
              <Check size={20} strokeWidth={3} />
            </button>
            <button title={t.btn_upload} className={`p-2 rounded-lg transition-all ${isDark ? 'text-slate-400 hover:bg-white/5 hover:text-[#2563eb]' : 'text-slate-500 hover:bg-slate-100 hover:text-[#2563eb]'}`}>
              <ArrowRight size={20} strokeWidth={3} />
            </button>
          </div>

          <div className={`ml-6 flex items-center gap-2 rounded-lg px-4 py-1.5 text-[11px] font-bold border transition-all ${isDark ? 'bg-[#0f172a] border-white/10 hover:border-[#2563eb]' : 'bg-slate-50 border-slate-200 hover:border-[#2563eb]'}`}>
            <Cpu size={14} className="text-[#2563eb]" />
            <select value={selectedBoard.id} onChange={(e) => setSelectedBoard(BOARDS.find(b => b.id === e.target.value) || BOARDS[0])} className="bg-transparent outline-none cursor-pointer pr-4 appearance-none">
              {BOARDS.map(b => <option key={b.id} value={b.id} className={isDark ? 'bg-[#1e293b]' : 'bg-white'}>{b.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={connectSerial} className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all shadow-md ${isConnected ? 'bg-[#2563eb] text-white' : isDark ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
            {isConnected ? t.btn_connected : t.btn_connect}
          </button>
          <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className={`p-2.5 rounded-full transition-all ${isDark ? 'text-yellow-400 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-100'}`}>
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {/* PROGRESS */}
      {progress > 0 && <div className="h-[3px] w-full bg-black/10"><div className="h-full bg-[#2563eb] transition-all duration-300 shadow-[0_0_8px_#2563eb]" style={{ width: `${progress}%` }} /></div>}

      <div className="flex flex-1 overflow-hidden">
        {/* NAV BAR */}
        <nav className={`w-14 border-r ${isDark ? 'border-white/5 bg-[#0f172a]' : 'border-slate-200 bg-[#f1f5f9]'} flex flex-col items-center py-6 gap-6 shrink-0`}>
          {[
            { id: 'files', icon: Files, title: t.nav_files },
            { id: 'ai', icon: MessageSquare, title: t.nav_ai },
            { id: 'libraries', icon: Box, title: t.nav_libs },
            { id: 'creator', icon: User, title: t.nav_creator },
            { id: 'settings', icon: Settings, title: t.nav_settings },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as TabType)} title={tab.title} className={`p-2.5 rounded-xl transition-all relative ${activeTab === tab.id ? 'bg-[#2563eb] text-white shadow-lg shadow-blue-500/30' : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-700 hover:bg-white'}`}>
              <tab.icon size={22} strokeWidth={2} />
            </button>
          ))}
        </nav>

        {/* SIDE PANE */}
        <aside className={`w-80 border-r ${isDark ? 'border-white/5 bg-[#1e293b]' : 'border-slate-200 bg-white'} flex flex-col shrink-0 overflow-hidden`}>
          <div className="h-10 px-4 flex items-center justify-between border-b border-white/5 bg-black/5">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{t[`nav_${activeTab}` as keyof typeof t] || activeTab}</span>
            {activeTab === 'files' && <Plus size={18} className="cursor-pointer text-[#2563eb] hover:scale-110 transition-transform" onClick={() => {
              const name = `sketch_${Math.floor(Math.random()*1000)}.ino`;
              setFiles([...files, { name, content: DEFAULT_CODE, isOpen: true }]);
            }}/>}
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {activeTab === 'files' && files.map((file, idx) => (
              <div key={idx} onClick={() => setActiveFileIndex(idx)} className={`group flex items-center gap-3 px-5 py-3 cursor-pointer border-b border-white/5 transition-all ${activeFileIndex === idx ? (isDark ? 'bg-white/5 text-blue-400' : 'bg-blue-50 text-blue-700') : (isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-50')}`}>
                <FileCode size={16} />
                <span className="truncate text-[13px] font-medium flex-1">{file.name}</span>
              </div>
            ))}

            {activeTab === 'settings' && (
              <div className="p-6 space-y-8">
                <section>
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase mb-4 flex items-center gap-2"><TypeIcon size={14}/> {t.settings_editor}</h4>
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between text-[12px] font-medium">
                        <span>{t.settings_font_size}</span>
                        <span className="text-[#2563eb]">{fontSize}px</span>
                      </div>
                      <input type="range" min="12" max="24" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))} className="w-full accent-[#2563eb]" />
                    </div>
                    <label className="flex items-center justify-between cursor-pointer group">
                      <span className="text-[12px] font-medium flex items-center gap-2"><WrapText size={14} className="opacity-50"/> {t.settings_line_wrap}</span>
                      <input type="checkbox" checked={lineWrapping} onChange={e => setLineWrapping(e.target.checked)} className="w-4 h-4 rounded accent-[#2563eb]" />
                    </label>
                  </div>
                </section>

                <section>
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase mb-4 flex items-center gap-2"><Sparkles size={14}/> {t.settings_ai}</h4>
                  <div className="space-y-4">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-[12px] font-medium">{t.settings_context}</span>
                      <input type="checkbox" checked={aiContext} onChange={e => setAiContext(e.target.checked)} className="w-4 h-4 rounded accent-[#2563eb]" />
                    </label>
                  </div>
                </section>

                <section>
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase mb-4 flex items-center gap-2"><Save size={14}/> {t.settings_system}</h4>
                  <div className="space-y-4">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-[12px] font-medium">{t.settings_autosave}</span>
                      <input type="checkbox" checked={autoSave} onChange={e => setAutoSave(e.target.checked)} className="w-4 h-4 rounded accent-[#2563eb]" />
                    </label>
                    <div className="flex flex-col gap-2">
                       <span className="text-[12px] font-medium flex items-center gap-2"><Globe size={14} className="opacity-50"/> {t.settings_lang}</span>
                       <select value={lang} onChange={e => setLang(e.target.value as 'pt' | 'en')} className={`text-[12px] p-2 rounded border outline-none focus:border-[#2563eb] transition-all ${isDark ? 'bg-[#0f172a] border-white/10' : 'bg-white border-slate-200'}`}>
                          <option value="pt">Português (BR)</option>
                          <option value="en">English (US)</option>
                       </select>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="flex flex-col h-full bg-[#0f172a]">
                <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                  {chatHistory.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center py-10 opacity-30">
                      <div className="p-4 bg-blue-500/10 rounded-full mb-4">
                         <Sparkles size={32} className="text-[#2563eb]" />
                      </div>
                      <h4 className="font-bold text-sm mb-1 text-white">{t.ai_welcome_title}</h4>
                      <p className="text-[11px] px-8">{t.ai_welcome_desc}</p>
                    </div>
                  )}
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[90%] rounded-2xl p-4 text-[12px] leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-[#2563eb] text-white' : 'bg-[#1e293b] text-slate-300 border border-white/5'}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {isChatLoading && <div className="text-[10px] text-[#2563eb] font-bold animate-pulse px-2 uppercase tracking-widest">...</div>}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-4 border-t border-white/5 bg-[#0f172a]">
                  <div className="flex gap-2">
                    <input value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} placeholder={t.ai_placeholder} className="flex-1 bg-[#1e293b] border border-white/10 rounded-xl px-4 py-2.5 text-[12px] text-white outline-none focus:border-[#2563eb] transition-all" />
                    <button onClick={handleSendMessage} className="p-2.5 bg-[#2563eb] text-white rounded-xl hover:scale-105 transition-all"><Send size={16} /></button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'libraries' && (
              <div className="p-5 space-y-5">
                <div className="relative">
                  <Search size={14} className="absolute left-4 top-3 text-slate-500" />
                  <input value={searchLib} onChange={e => setSearchLib(e.target.value)} placeholder={`${t.nav_libs}...`} className={`w-full rounded-xl border px-4 py-2.5 pl-10 text-[12px] outline-none focus:border-[#2563eb] transition-all ${isDark ? 'bg-[#0f172a] border-white/10 text-white' : 'bg-white border-slate-200'}`} />
                </div>
                {LIBRARIES.filter(l => l.name.toLowerCase().includes(searchLib.toLowerCase())).map((lib, i) => (
                  <div key={i} className={`p-4 border rounded-xl shadow-sm transition-all hover:border-[#2563eb] ${isDark ? 'border-white/5 bg-[#1e293b]' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[12px] font-black text-[#2563eb]">{lib.name}</span>
                      <span className="text-[10px] opacity-40 font-mono italic">{lib.version}</span>
                    </div>
                    <p className="text-[11px] line-clamp-2 mb-3 opacity-70 leading-relaxed">{lib.description}</p>
                    <button onClick={() => {
                       const n = [...files];
                       n[activeFileIndex].content = lib.header + "\n" + n[activeFileIndex].content;
                       setFiles(n);
                       setOutputMessages(prev => [...prev, t.msg_lib_installed]);
                    }} className="w-full py-2 bg-blue-600/10 text-blue-500 rounded-lg text-[10px] font-black tracking-widest uppercase hover:bg-blue-600 hover:text-white transition-all">INSTALL</button>
                  </div>
                ))}
              </div>
            )}
            
            {activeTab === 'creator' && (
              <div className="p-8 flex flex-col items-center text-center">
                 <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#2563eb] to-blue-400 p-1 mb-6 shadow-xl shadow-blue-500/20">
                    <div className="w-full h-full rounded-full bg-[#1e293b] flex items-center justify-center overflow-hidden border-4 border-[#1e293b]">
                       <User size={48} className="text-blue-400" />
                    </div>
                 </div>
                 <h3 className="font-black text-base mb-2">José Heberto Torres da Costa</h3>
                 <p className="text-[11px] opacity-50 mb-8 leading-relaxed">{t.creator_bio}</p>
                 <a href="https://instagram.com/josehebertot2" target="_blank" rel="noopener" className="flex items-center gap-3 bg-gradient-to-r from-[#2563eb] to-blue-400 text-white px-6 py-3 rounded-2xl text-[12px] font-black shadow-lg shadow-blue-500/30 hover:scale-105 transition-all">
                    <Instagram size={18} /> @josehebertot2
                 </a>
              </div>
            )}
          </div>
        </aside>

        {/* EDITOR */}
        <main className={`flex-1 flex flex-col relative ${isDark ? 'bg-[#0f172a]' : 'bg-white'}`}>
          <div className={`h-10 border-b flex items-center px-1 shrink-0 ${isDark ? 'border-white/5 bg-[#1e293b]' : 'border-slate-200 bg-white'}`}>
            {files.map((file, idx) => (
              <div key={idx} onClick={() => setActiveFileIndex(idx)} className={`h-full flex items-center px-5 text-[12px] font-semibold cursor-pointer border-r transition-all ${isDark ? 'border-white/5' : 'border-slate-200'} ${activeFileIndex === idx ? (isDark ? 'bg-[#0f172a] text-[#2563eb] border-t-2 border-t-[#2563eb]' : 'bg-white text-[#2563eb] border-t-2 border-t-[#2563eb]') : 'opacity-40 hover:opacity-100'}`}>
                {file.name}
                {files.length > 1 && <X size={12} className="ml-4 hover:text-red-500 transition-colors" onClick={(e) => { e.stopPropagation(); setFiles(files.filter((_, i) => i !== idx)); }} />}
              </div>
            ))}
          </div>

          <div className="flex-1 relative overflow-hidden flex">
            <div className={`w-14 border-r select-none py-5 text-right pr-4 font-mono text-[12px] opacity-20 ${isDark ? 'bg-[#0f172a] border-white/5' : 'bg-slate-50 border-slate-100'}`}>
              {(activeFile.content || '').split('\n').map((_, i) => <div key={i} style={{ height: `${fontSize * 1.6}px` }}>{i + 1}</div>)}
            </div>
            <div className="flex-1 relative">
               <div ref={highlightRef} className={`absolute inset-0 p-5 pointer-events-none code-font whitespace-pre overflow-hidden z-0 leading-relaxed`} style={{ fontSize: `${fontSize}px` }} dangerouslySetInnerHTML={{ __html: highlightCode(activeFile.content) }} />
               <textarea value={activeFile.content} onChange={e => { const n = [...files]; n[activeFileIndex].content = e.target.value; setFiles(n); }} onScroll={e => { if (highlightRef.current) highlightRef.current.scrollTop = e.currentTarget.scrollTop; }} spellCheck={false} className={`absolute inset-0 w-full h-full p-5 bg-transparent text-transparent caret-[#2563eb] code-font outline-none z-10 whitespace-pre overflow-auto custom-scrollbar resize-none leading-relaxed ${lineWrapping ? 'whitespace-pre-wrap' : 'whitespace-pre'}`} style={{ fontSize: `${fontSize}px` }} />
            </div>
          </div>

          {/* CONSOLE */}
          <div className={`h-60 border-t flex flex-col shrink-0 ${isDark ? 'border-white/5 bg-[#1e293b]' : 'border-slate-200 bg-white'}`}>
            <div className={`h-10 border-b flex items-center px-5 gap-8 text-[10px] font-black uppercase tracking-widest ${isDark ? 'border-white/5 text-slate-500' : 'border-slate-200 text-slate-600'}`}>
               <button onClick={() => setConsoleTab('output')} className={`flex items-center gap-2 border-b-2 py-3 transition-all ${consoleTab === 'output' ? 'text-[#2563eb] border-[#2563eb]' : 'border-transparent'}`}><Terminal size={14}/> {t.terminal_tab}</button>
               <button onClick={() => setConsoleTab('serial')} className={`flex items-center gap-2 border-b-2 py-3 transition-all ${consoleTab === 'serial' ? 'text-[#2563eb] border-[#2563eb]' : 'border-transparent'}`}><HardDrive size={14}/> {t.serial_tab}</button>
               <div className="flex-1" />
               <button onClick={() => consoleTab === 'output' ? setOutputMessages([]) : setSerialMessages([])} className="hover:text-red-500 opacity-60"><Trash2 size={14} /></button>
            </div>
            
            {consoleTab === 'serial' && (
              <div className={`h-10 border-b flex px-5 items-center gap-4 ${isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                <input value={serialInput} onChange={e => setSerialInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendSerialData()} placeholder={t.serial_placeholder} className="flex-1 bg-transparent text-[12px] font-mono outline-none" />
                <button onClick={sendSerialData} className="text-[#2563eb] text-[11px] font-black hover:underline uppercase tracking-tighter">Send</button>
              </div>
            )}

            <div className="flex-1 p-5 font-mono text-[13px] overflow-y-auto custom-scrollbar bg-black/5 leading-relaxed">
              {(consoleTab === 'output' ? outputMessages : serialMessages.map(m => `[${m.timestamp}] ${m.type === 'in' ? 'RX' : 'TX'} > ${m.text}`)).map((m, i) => (
                <div key={i} className={`${m.includes('[ERROR]') || m.includes('[ERRO]') ? 'text-red-400' : isDark ? 'text-slate-400' : 'text-slate-600'}`}>{m}</div>
              ))}
              <div ref={consoleEndRef} />
            </div>
          </div>
        </main>
      </div>

      {/* FOOTER */}
      <footer className="h-7 bg-[#2563eb] text-white flex items-center justify-between px-5 text-[10px] font-black tracking-widest uppercase shadow-[0_-4px_10px_rgba(37,99,235,0.2)] shrink-0">
         <div className="flex gap-6 items-center">
           <span className="flex items-center gap-2"><Cpu size={12} strokeWidth={3} /> {selectedBoard.name}</span>
           <span className="flex items-center gap-2 opacity-80"><Zap size={12} /> {isConnected ? t.status_connected : t.status_waiting}</span>
         </div>
         <div className="flex gap-6 items-center opacity-70">
           <span>{t.footer_lines} {(activeFile.content || '').split('\n').length}, {t.footer_chars} {activeFile.content.length}</span>
           <span className="flex items-center gap-1.5"><Sparkles size={11} /> Gemini 3 Pro</span>
         </div>
      </footer>
    </div>
  );
};

export default App;
