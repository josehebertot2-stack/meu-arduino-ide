
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Files, Plus, Zap, Check, FileCode, Settings, X, Sparkles, 
  Box, MessageSquare, Trash2, Search, Terminal,
  User, Instagram, Send, Sun, Moon, ArrowRight,
  Cpu, HardDrive, Type as TypeIcon,
  WrapText, Save, Globe
} from 'lucide-react';
import { FileNode, ChatMessage, TabType, SerialMessage, ArduinoBoard, ArduinoLibrary } from './types';
import { getCodeAssistance, analyzeCode } from './services/geminiService';

const TRANSLATIONS = {
  pt: {
    ide_name: "ARDUPROGRAM",
    nav_files: "Arquivos",
    nav_ai: "IA Chat",
    nav_libs: "Bibliotecas",
    nav_creator: "Créditos",
    nav_settings: "Ajustes",
    btn_verify: "Verificar",
    btn_upload: "Carregar",
    btn_connect: "USB",
    btn_connected: "Conectado",
    settings_editor: "Editor",
    settings_font_size: "Tamanho Fonte",
    settings_line_wrap: "Quebra de Linha",
    settings_ai: "Inteligência Artificial",
    settings_context: "Enviar Código no Chat",
    settings_system: "Sistema",
    settings_autosave: "Salvar Auto",
    settings_lang: "Idioma",
    ai_placeholder: "Pergunte algo sobre Arduino...",
    serial_placeholder: "Enviar para o Arduino...",
    terminal_tab: "Console",
    serial_tab: "Monitor Serial",
    footer_lines: "Linhas",
    footer_chars: "Chars",
    status_waiting: "Sem USB",
    status_connected: "Porta Ativa",
    msg_ready: "Sistema pronto.",
    msg_compiling: "Analisando...",
    msg_success: "Verificação concluída.",
    msg_lib_installed: "Biblioteca adicionada!",
    creator_bio: "Engenheiro focado em tornar a eletrônica acessível para todos."
  },
  en: {
    ide_name: "ARDUPROGRAM",
    nav_files: "Explorer",
    nav_ai: "AI Assistant",
    nav_libs: "Libraries",
    nav_creator: "Credits",
    nav_settings: "Settings",
    btn_verify: "Verify",
    btn_upload: "Upload",
    btn_connect: "USB",
    btn_connected: "Active",
    settings_editor: "Editor",
    settings_font_size: "Font Size",
    settings_line_wrap: "Line Wrap",
    settings_ai: "AI Settings",
    settings_context: "Include Code in Chat",
    settings_system: "System",
    settings_autosave: "Auto Save",
    settings_lang: "Language",
    ai_placeholder: "Ask anything about Arduino...",
    serial_placeholder: "Send to Arduino...",
    terminal_tab: "Console",
    serial_tab: "Serial Monitor",
    footer_lines: "Lines",
    footer_chars: "Chars",
    status_waiting: "Waiting USB",
    status_connected: "USB Ready",
    msg_ready: "Ready.",
    msg_compiling: "Analyzing...",
    msg_success: "Verification done.",
    msg_lib_installed: "Lib installed!",
    creator_bio: "Engineer focused on making electronics accessible to everyone."
  }
};

const DEFAULT_CODE = `void setup() {\n  Serial.begin(9600);\n  pinMode(LED_BUILTIN, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(1000);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(1000);\n}`;

const BOARDS: ArduinoBoard[] = [
  { id: 'uno', name: 'Arduino Uno', fqbn: 'arduino:avr:uno' },
  { id: 'esp32', name: 'ESP32 Module', fqbn: 'esp32:esp32:esp32' },
  { id: 'nano', name: 'Arduino Nano', fqbn: 'arduino:avr:nano' }
];

const LIBRARIES: ArduinoLibrary[] = [
  { name: 'DHT sensor', version: '1.4.3', author: 'Adafruit', description: 'Sensor de Temp/Hum.', header: '#include <DHT.h>' },
  { name: 'Servo', version: '1.1.8', author: 'Arduino', description: 'Controle de Servos.', header: '#include <Servo.h>' },
  { name: 'WiFiManager', version: '2.0.15', author: 'tzapu', description: 'Config WiFi dinâmica.', header: '#include <WiFiManager.h>' }
];

const App: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('ardu_theme') as any) || 'dark');
  const [lang, setLang] = useState<'pt' | 'en'>(() => (localStorage.getItem('ardu_lang') as any) || 'pt');
  const [fontSize, setFontSize] = useState(parseInt(localStorage.getItem('ardu_font_size') || '14'));
  const [lineWrapping, setLineWrapping] = useState(localStorage.getItem('ardu_line_wrap') === 'true');
  const [autoSave, setAutoSave] = useState(localStorage.getItem('ardu_auto_save') !== 'false');
  const [aiContext, setAiContext] = useState(localStorage.getItem('ardu_ai_context') !== 'false');

  const t = TRANSLATIONS[lang];
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<TabType>('ai');
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
  const [outputMessages, setOutputMessages] = useState<string[]>(["ArduProgram Ready"]);
  const [consoleTab, setConsoleTab] = useState<'output' | 'serial'>('output');
  const [isConnected, setIsConnected] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
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
    localStorage.setItem('ardu_ai_context', aiContext.toString());
    document.documentElement.classList.toggle('dark', isDark);
  }, [theme, lang, fontSize, lineWrapping, autoSave, aiContext, isDark]);

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

    const response = await getCodeAssistance(userMsg, aiContext ? activeFile.content : "");
    setChatHistory(prev => [...prev, { role: 'assistant', text: response }]);
    setIsChatLoading(false);
  };

  const handleVerify = async () => {
    if (isBusy) return;
    setIsBusy(true);
    setConsoleTab('output');
    setOutputMessages(prev => [...prev, `${t.msg_compiling} ${activeFile.name}`]);
    const result = await analyzeCode(activeFile.content);
    setOutputMessages(prev => [...prev, t.msg_success, result.summary]);
    setIsBusy(false);
  };

  const connectSerial = async () => {
    try {
      if (!('serial' in navigator)) return;
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;
      setIsConnected(true);
      const reader = port.readable.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = new TextDecoder().decode(value);
        setSerialMessages(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), type: 'in', text }]);
      }
    } catch (err) { setIsConnected(false); }
  };

  const highlightCode = (code: string) => {
    return (code || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\b(void|int|float|char|bool|long|unsigned|const|static|if|else|for|while|return|switch|case|break|byte|word|String)\b/g, `<span class="text-blue-500 font-bold">$1</span>`)
      .replace(/\b(setup|loop|pinMode|digitalWrite|digitalRead|analogWrite|analogRead|delay|Serial|println|print|begin|available|read|write|millis)\b/g, `<span class="text-purple-500 font-bold">$1</span>`)
      .replace(/\/\/.*/g, `<span class="text-slate-400 italic">$&</span>`)
      .replace(/\b(HIGH|LOW|INPUT|OUTPUT|INPUT_PULLUP|LED_BUILTIN)\b/g, `<span class="text-orange-500">$1</span>`);
  };

  return (
    <div className={`flex flex-col h-screen ${isDark ? 'bg-[#0f172a] text-slate-300' : 'bg-white text-slate-800'} overflow-hidden`}>
      <header className={`h-12 border-b ${isDark ? 'border-white/10 bg-[#1e293b]' : 'border-slate-200 bg-slate-50'} flex items-center justify-between px-3 shrink-0`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-2">
            <Zap size={18} className="text-[#2563eb]" fill="currentColor" />
            <span className="font-black text-sm tracking-tighter text-[#2563eb]">{t.ide_name}</span>
          </div>
          <div className="flex items-center gap-1 border-l border-white/10 pl-3">
            <button onClick={handleVerify} disabled={isBusy} className="p-2 hover:bg-black/5 rounded text-slate-400 hover:text-[#2563eb]"><Check size={18} /></button>
            <button className="p-2 hover:bg-black/5 rounded text-slate-400 hover:text-[#2563eb]"><ArrowRight size={18} /></button>
          </div>
          <div className={`flex items-center gap-2 rounded px-3 py-1 text-[11px] font-bold border ${isDark ? 'bg-[#0f172a] border-white/10' : 'bg-white border-slate-200'}`}>
            <Cpu size={12} className="text-blue-500" />
            <select value={selectedBoard.id} onChange={(e) => setSelectedBoard(BOARDS.find(b => b.id === e.target.value) || BOARDS[0])} className="bg-transparent outline-none cursor-pointer">
              {BOARDS.map(b => <option key={b.id} value={b.id} className="bg-[#1e293b]">{b.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={connectSerial} className={`px-4 py-1 rounded text-[10px] font-black uppercase transition-all ${isConnected ? 'bg-blue-600 text-white' : 'bg-slate-500/20 text-slate-400'}`}>
            {isConnected ? t.btn_connected : t.btn_connect}
          </button>
          <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className="p-2 text-slate-400 hover:text-blue-500">
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <nav className={`w-14 border-r ${isDark ? 'border-white/5 bg-[#0f172a]' : 'border-slate-200 bg-slate-50'} flex flex-col items-center py-6 gap-6 shrink-0`}>
          {[
            { id: 'ai', icon: MessageSquare, title: t.nav_ai },
            { id: 'files', icon: Files, title: t.nav_files },
            { id: 'libraries', icon: Box, title: t.nav_libs },
            { id: 'creator', icon: User, title: t.nav_creator },
            { id: 'settings', icon: Settings, title: t.nav_settings },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as TabType)} className={`p-2.5 rounded-xl transition-all ${activeTab === tab.id ? 'bg-[#2563eb] text-white' : 'text-slate-500 hover:text-[#2563eb]'}`}>
              <tab.icon size={22} />
            </button>
          ))}
        </nav>

        <aside className={`w-80 border-r ${isDark ? 'border-white/5 bg-[#1e293b]' : 'border-slate-200 bg-white'} flex flex-col shrink-0`}>
          <div className="h-10 px-4 flex items-center justify-between border-b border-white/5 bg-black/5">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-50">{t[`nav_${activeTab}` as keyof typeof t] || activeTab}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {activeTab === 'ai' && (
              <div className="flex flex-col h-full bg-[#0f172a]">
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[90%] rounded-xl p-3 text-[12px] ${msg.role === 'user' ? 'bg-[#2563eb] text-white' : 'bg-[#1e293b] text-slate-300 border border-white/5'}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {isChatLoading && <div className="text-[10px] text-blue-500 font-bold animate-pulse">...</div>}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-3 border-t border-white/5">
                  <div className="flex gap-2 bg-[#1e293b] rounded-lg p-1 border border-white/10">
                    <input value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} placeholder={t.ai_placeholder} className="flex-1 bg-transparent px-2 py-1.5 text-[12px] text-white outline-none" />
                    <button onClick={handleSendMessage} className="p-2 bg-[#2563eb] text-white rounded-md"><Send size={16} /></button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'files' && (
              <div className="flex flex-col">
                <button onClick={() => setFiles([...files, { name: `sketch_${files.length}.ino`, content: DEFAULT_CODE, isOpen: true }])} className="m-4 flex items-center justify-center gap-2 p-2 border border-dashed border-white/10 rounded text-[11px] hover:border-blue-500 transition-all"><Plus size={14}/> Novo Sketch</button>
                {files.map((file, idx) => (
                  <div key={idx} onClick={() => setActiveFileIndex(idx)} className={`px-5 py-3 text-[13px] cursor-pointer flex items-center gap-3 transition-all ${activeFileIndex === idx ? 'bg-blue-500/10 text-blue-400' : 'hover:bg-black/5'}`}>
                    <FileCode size={14} /> {file.name}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'libraries' && (
              <div className="p-4 space-y-4">
                <input value={searchLib} onChange={e => setSearchLib(e.target.value)} placeholder="Pesquisar bib..." className="w-full bg-[#0f172a] border border-white/10 rounded px-3 py-2 text-[12px] outline-none" />
                {LIBRARIES.map((lib, i) => (
                  <div key={i} className="p-3 bg-black/5 border border-white/5 rounded">
                    <div className="flex justify-between font-bold text-blue-500 text-[12px] mb-1"><span>{lib.name}</span> <span className="text-[10px] opacity-40">{lib.version}</span></div>
                    <p className="text-[11px] opacity-60 mb-2">{lib.description}</p>
                    <button onClick={() => {
                       const n = [...files];
                       n[activeFileIndex].content = lib.header + "\n" + n[activeFileIndex].content;
                       setFiles(n);
                    }} className="w-full py-1.5 bg-blue-500/10 text-blue-500 text-[10px] font-black rounded">ADICIONAR</button>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'creator' && (
              <div className="p-8 flex flex-col items-center text-center">
                 <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center mb-4">
                    <User size={40} className="text-white" />
                 </div>
                 <h3 className="font-bold text-sm">José Heberto Torres da Costa</h3>
                 <p className="text-[10px] opacity-50 mt-2">{t.creator_bio}</p>
                 <a href="https://instagram.com/josehebertot2" target="_blank" className="mt-6 flex items-center gap-2 text-blue-500 text-[12px] font-bold"><Instagram size={14}/> @josehebertot2</a>
              </div>
            )}
            
            {activeTab === 'settings' && (
               <div className="p-6 space-y-6">
                  <div className="space-y-2">
                     <span className="text-[11px] font-bold opacity-40 uppercase">{t.settings_editor}</span>
                     <div className="flex items-center justify-between text-[12px]">
                        <span>{t.settings_font_size}</span>
                        <input type="number" value={fontSize} onChange={e => setFontSize(parseInt(e.target.value))} className="w-12 bg-black/20 rounded px-1 text-center" />
                     </div>
                  </div>
                  <div className="space-y-2">
                     <span className="text-[11px] font-bold opacity-40 uppercase">{t.settings_lang}</span>
                     <select value={lang} onChange={e => setLang(e.target.value as any)} className="w-full bg-black/20 rounded p-2 text-[12px] outline-none border border-white/5">
                        <option value="pt">Português</option>
                        <option value="en">English</option>
                     </select>
                  </div>
               </div>
            )}
          </div>
        </aside>

        <main className="flex-1 flex flex-col">
          <div className={`h-8 border-b flex items-center px-2 shrink-0 ${isDark ? 'border-white/5 bg-[#1e293b]' : 'border-slate-200 bg-slate-50'}`}>
            <span className="text-[11px] px-3 font-bold text-blue-500 border-r border-white/5">{activeFile.name}</span>
          </div>

          <div className="flex-1 relative overflow-hidden flex">
            <div className={`w-12 border-r py-4 text-right pr-3 font-mono text-[11px] opacity-20 bg-black/5`}>
              {(activeFile.content || '').split('\n').map((_, i) => <div key={i} style={{ height: `${fontSize * 1.5}px` }}>{i + 1}</div>)}
            </div>
            <div className="flex-1 relative">
               <div ref={highlightRef} className="absolute inset-0 p-4 pointer-events-none code-font whitespace-pre overflow-hidden z-0 leading-normal" style={{ fontSize: `${fontSize}px` }} dangerouslySetInnerHTML={{ __html: highlightCode(activeFile.content) }} />
               <textarea value={activeFile.content} onChange={e => { const n = [...files]; n[activeFileIndex].content = e.target.value; setFiles(n); }} onScroll={e => { if (highlightRef.current) highlightRef.current.scrollTop = e.currentTarget.scrollTop; }} spellCheck={false} className="absolute inset-0 w-full h-full p-4 bg-transparent text-transparent caret-blue-500 code-font outline-none z-10 whitespace-pre overflow-auto custom-scrollbar resize-none leading-normal" style={{ fontSize: `${fontSize}px` }} />
            </div>
          </div>

          <div className={`h-48 border-t flex flex-col shrink-0 ${isDark ? 'border-white/5 bg-[#1e293b]' : 'border-slate-200 bg-white'}`}>
            <div className="h-8 border-b flex items-center px-4 gap-4 text-[10px] font-black uppercase opacity-50">
               <button onClick={() => setConsoleTab('output')} className={consoleTab === 'output' ? 'text-blue-500' : ''}>{t.terminal_tab}</button>
               <button onClick={() => setConsoleTab('serial')} className={consoleTab === 'serial' ? 'text-blue-500' : ''}>{t.serial_tab}</button>
               <div className="flex-1" />
               <Trash2 size={12} className="cursor-pointer" onClick={() => consoleTab === 'output' ? setOutputMessages([]) : setSerialMessages([])} />
            </div>
            
            <div className="flex-1 p-4 font-mono text-[12px] overflow-y-auto custom-scrollbar bg-black/10">
              {(consoleTab === 'output' ? outputMessages : serialMessages.map(m => `[${m.timestamp}] > ${m.text}`)).map((m, i) => (
                <div key={i} className="opacity-70">{m}</div>
              ))}
              <div ref={consoleEndRef} />
            </div>
          </div>
        </main>
      </div>

      <footer className="h-6 bg-blue-600 text-white flex items-center justify-between px-4 text-[10px] font-bold shrink-0">
         <div className="flex gap-4">
           <span>{selectedBoard.name}</span>
           <span className="opacity-50">|</span>
           <span>{isConnected ? t.status_connected : t.status_waiting}</span>
         </div>
         <div className="flex gap-4 opacity-70">
           <span>{t.footer_lines}: {(activeFile.content || '').split('\n').length}</span>
           <span>IA Ativa</span>
         </div>
      </footer>
    </div>
  );
};

export default App;
