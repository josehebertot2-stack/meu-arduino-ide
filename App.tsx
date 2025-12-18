import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Files, Plus, Zap, Check, FileCode, Settings, X, 
  Box, Trash2, Search, Terminal,
  User, Instagram, Sun, Moon, ArrowRight,
  Cpu, HardDrive, Type as TypeIcon,
  WrapText, Save, Globe
} from 'lucide-react';
import { FileNode, TabType, SerialMessage, ArduinoBoard, ArduinoLibrary } from './types';
import { analyzeCode } from './services/geminiService';

const TRANSLATIONS = {
  pt: {
    ide_name: "ARDUPROGRAM",
    nav_files: "Arquivos",
    nav_libs: "Bibliotecas",
    nav_creator: "Créditos",
    nav_settings: "Ajustes",
    btn_verify: "Verificar Código",
    btn_upload: "Carregar na Placa",
    btn_connect: "Conectar USB",
    btn_connected: "USB Ativa",
    settings_editor: "Editor",
    settings_font_size: "Tamanho Fonte",
    settings_line_wrap: "Quebra de Linha",
    settings_system: "Sistema",
    settings_autosave: "Salvar Automático",
    settings_lang: "Idioma da IDE",
    serial_placeholder: "Enviar comando para o Arduino...",
    terminal_tab: "Console de Saída",
    serial_tab: "Monitor Serial",
    footer_lines: "Linhas",
    footer_chars: "Caracteres",
    status_waiting: "Aguardando USB",
    status_connected: "Porta USB Ativa",
    msg_ready: "Pronto para programar.",
    msg_compiling: "Verificando código...",
    msg_success: "Sucesso: O código parece correto!",
    msg_lib_installed: "Biblioteca adicionada ao cabeçalho!",
    creator_bio: "Engenheiro focado em tornar a eletrônica acessível para todos através da web."
  },
  en: {
    ide_name: "ARDUPROGRAM",
    nav_files: "Files",
    nav_libs: "Libraries",
    nav_creator: "Credits",
    nav_settings: "Settings",
    btn_verify: "Verify Code",
    btn_upload: "Upload to Board",
    btn_connect: "Connect USB",
    btn_connected: "USB Connected",
    settings_editor: "Editor",
    settings_font_size: "Font Size",
    settings_line_wrap: "Line Wrap",
    settings_system: "System",
    settings_autosave: "Auto Save",
    settings_lang: "IDE Language",
    serial_placeholder: "Send command to Arduino...",
    terminal_tab: "Output Console",
    serial_tab: "Serial Monitor",
    footer_lines: "Lines",
    footer_chars: "Chars",
    status_waiting: "Waiting USB",
    status_connected: "USB Port Active",
    msg_ready: "Ready to code.",
    msg_compiling: "Verifying code...",
    msg_success: "Success: Code looks good!",
    msg_lib_installed: "Library added to header!",
    creator_bio: "Engineer focused on making electronics accessible to everyone via web."
  }
};

const DEFAULT_CODE = `void setup() {
  // Inicialização
  Serial.begin(9600);
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  // Código principal
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000);
  digitalWrite(LED_BUILTIN, LOW);
  delay(1000);
}`;

const BOARDS: ArduinoBoard[] = [
  { id: 'uno', name: 'Arduino Uno', fqbn: 'arduino:avr:uno' },
  { id: 'esp32', name: 'ESP32 Module', fqbn: 'esp32:esp32:esp32' },
  { id: 'nano', name: 'Arduino Nano', fqbn: 'arduino:avr:nano' }
];

const LIBRARIES: ArduinoLibrary[] = [
  { name: 'DHT sensor', version: '1.4.3', author: 'Adafruit', description: 'Sensor de Temperatura e Umidade.', header: '#include <DHT.h>' },
  { name: 'Servo', version: '1.1.8', author: 'Arduino', description: 'Controle de Servo Motores.', header: '#include <Servo.h>' },
  { name: 'WiFiManager', version: '2.0.15', author: 'tzapu', description: 'Configuração WiFi dinâmica.', header: '#include <WiFiManager.h>' },
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
  const [serialMessages, setSerialMessages] = useState<SerialMessage[]>([]);
  const [serialInput, setSerialInput] = useState('');
  const [outputMessages, setOutputMessages] = useState<string[]>(["ArduProgram IDE iniciada com sucesso (Modo Offline)."]);
  const [consoleTab, setConsoleTab] = useState<'output' | 'serial'>('output');
  const [isConnected, setIsConnected] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [selectedBoard, setSelectedBoard] = useState(BOARDS[0]);
  const [searchLib, setSearchLib] = useState('');

  const portRef = useRef<any>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

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

  const handleVerify = async () => {
    if (isBusy) return;
    setIsBusy(true);
    setConsoleTab('output');
    setOutputMessages(prev => [...prev, `[LOG] ${t.msg_compiling} (${activeFile.name})`]);
    
    const result = await analyzeCode(activeFile.content);
    
    setTimeout(() => {
      setOutputMessages(prev => [...prev, `[${result.status}] ${result.summary}`]);
      setIsBusy(false);
    }, 1000);
  };

  const connectSerial = async () => {
    try {
      if (!('serial' in navigator)) {
        alert("Seu navegador não suporta Web Serial. Use Chrome ou Edge.");
        return;
      }
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;
      setIsConnected(true);
      setOutputMessages(prev => [...prev, `[SERIAL] Conectado na porta USB.`]);

      const reader = port.readable.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = new TextDecoder().decode(value);
        setSerialMessages(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), type: 'in', text }]);
      }
    } catch (err) { 
      setIsConnected(false); 
      setOutputMessages(prev => [...prev, `[ERRO] Falha ao conectar USB.`]);
    }
  };

  const sendSerialData = async () => {
    if (!portRef.current || !serialInput) return;
    try {
      const writer = portRef.current.writable.getWriter();
      await writer.write(new TextEncoder().encode(serialInput + '\n'));
      writer.releaseLock();
      setSerialMessages(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), type: 'out', text: serialInput }]);
      setSerialInput('');
    } catch (e) {
      setOutputMessages(prev => [...prev, `[ERRO] Erro ao enviar dados seriais.`]);
    }
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
      {/* CABEÇALHO */}
      <header className={`h-12 border-b ${isDark ? 'border-white/10 bg-[#1e293b]' : 'border-slate-200 bg-slate-50'} flex items-center justify-between px-3 shrink-0`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-2">
            <Zap size={18} className="text-[#2563eb]" fill="currentColor" />
            <span className="font-black text-sm tracking-tighter text-[#2563eb]">{t.ide_name}</span>
          </div>
          <div className="flex items-center gap-1 border-l border-white/10 pl-3">
            <button onClick={handleVerify} title={t.btn_verify} disabled={isBusy} className="p-2 hover:bg-black/5 rounded text-slate-400 hover:text-[#2563eb] transition-colors"><Check size={18} /></button>
            <button title={t.btn_upload} className="p-2 hover:bg-black/5 rounded text-slate-400 hover:text-[#2563eb] transition-colors"><ArrowRight size={18} /></button>
          </div>
          <div className={`flex items-center gap-2 rounded px-3 py-1 text-[11px] font-bold border ${isDark ? 'bg-[#0f172a] border-white/10' : 'bg-white border-slate-200'}`}>
            <Cpu size={12} className="text-blue-500" />
            <select value={selectedBoard.id} onChange={(e) => setSelectedBoard(BOARDS.find(b => b.id === e.target.value) || BOARDS[0])} className="bg-transparent outline-none cursor-pointer">
              {BOARDS.map(b => <option key={b.id} value={b.id} className="bg-[#1e293b]">{b.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={connectSerial} className={`px-4 py-1 rounded text-[10px] font-black uppercase transition-all shadow-sm ${isConnected ? 'bg-blue-600 text-white' : 'bg-slate-500/20 text-slate-400'}`}>
            {isConnected ? t.btn_connected : t.btn_connect}
          </button>
          <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className="p-2 text-slate-400 hover:text-blue-500 transition-colors">
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* BARRA DE NAVEGAÇÃO LATERAL */}
        <nav className={`w-14 border-r ${isDark ? 'border-white/5 bg-[#0f172a]' : 'border-slate-200 bg-slate-50'} flex flex-col items-center py-6 gap-6 shrink-0`}>
          {[
            { id: 'files', icon: Files, title: t.nav_files },
            { id: 'libraries', icon: Box, title: t.nav_libs },
            { id: 'creator', icon: User, title: t.nav_creator },
            { id: 'settings', icon: Settings, title: t.nav_settings },
          ].map(tab => (
            <button key={tab.id} title={tab.title} onClick={() => setActiveTab(tab.id as TabType)} className={`p-2.5 rounded-xl transition-all ${activeTab === tab.id ? 'bg-[#2563eb] text-white' : 'text-slate-500 hover:text-[#2563eb]'}`}>
              <tab.icon size={22} />
            </button>
          ))}
        </nav>

        {/* PAINEL LATERAL DE CONTEÚDO */}
        <aside className={`w-80 border-r ${isDark ? 'border-white/5 bg-[#1e293b]' : 'border-slate-200 bg-white'} flex flex-col shrink-0 overflow-hidden`}>
          <div className="h-10 px-4 flex items-center justify-between border-b border-white/5 bg-black/5">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-50">{t[`nav_${activeTab}` as keyof typeof t] || activeTab}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {activeTab === 'files' && (
              <div className="flex flex-col">
                <button onClick={() => setFiles([...files, { name: `sketch_${files.length}.ino`, content: DEFAULT_CODE, isOpen: true }])} className="m-4 flex items-center justify-center gap-2 p-2 border border-dashed border-slate-500/30 rounded text-[11px] font-bold hover:border-blue-500 transition-all"><Plus size={14}/> Novo Arquivo</button>
                {files.map((file, idx) => (
                  <div key={idx} onClick={() => setActiveFileIndex(idx)} className={`px-5 py-3 text-[13px] cursor-pointer flex items-center justify-between transition-all ${activeFileIndex === idx ? 'bg-blue-500/10 text-blue-400 border-r-2 border-blue-500' : 'hover:bg-black/5'}`}>
                    <div className="flex items-center gap-3">
                      <FileCode size={14} /> <span>{file.name}</span>
                    </div>
                    {files.length > 1 && <X size={14} className="hover:text-red-500" onClick={(e) => { e.stopPropagation(); setFiles(files.filter((_, i) => i !== idx)); if(activeFileIndex >= idx) setActiveFileIndex(Math.max(0, activeFileIndex-1)); }} />}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'libraries' && (
              <div className="p-4 space-y-4">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 opacity-30" />
                  <input value={searchLib} onChange={e => setSearchLib(e.target.value)} placeholder="Pesquisar..." className="w-full bg-black/10 border border-white/5 rounded px-3 py-2 pl-9 text-[12px] outline-none focus:border-blue-500" />
                </div>
                {LIBRARIES.filter(l => l.name.toLowerCase().includes(searchLib.toLowerCase())).map((lib, i) => (
                  <div key={i} className="p-3 bg-black/5 border border-white/5 rounded hover:border-blue-500/50 transition-all">
                    <div className="flex justify-between font-bold text-blue-500 text-[12px] mb-1"><span>{lib.name}</span> <span className="text-[10px] opacity-40">{lib.version}</span></div>
                    <p className="text-[11px] opacity-60 mb-3">{lib.description}</p>
                    <button onClick={() => {
                       const n = [...files];
                       n[activeFileIndex].content = lib.header + "\n" + n[activeFileIndex].content;
                       setFiles(n);
                       setOutputMessages(prev => [...prev, `[SISTEMA] ${t.msg_lib_installed}`]);
                    }} className="w-full py-2 bg-blue-500 text-white text-[10px] font-black rounded hover:bg-blue-600 transition-all">ADICIONAR</button>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'creator' && (
              <div className="p-8 flex flex-col items-center text-center">
                 <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-600 to-purple-500 flex items-center justify-center mb-6 shadow-xl">
                    <User size={48} className="text-white" />
                 </div>
                 <h3 className="font-bold text-base">José Heberto Torres da Costa</h3>
                 <p className="text-[11px] opacity-60 mt-4 leading-relaxed px-4">{t.creator_bio}</p>
                 <div className="mt-8 flex flex-col gap-3 w-full">
                    <a href="https://instagram.com/josehebertot2" target="_blank" className="flex items-center justify-center gap-3 bg-[#E1306C] text-white px-6 py-2.5 rounded-full text-[12px] font-bold shadow-lg hover:scale-105 transition-all"><Instagram size={18}/> @josehebertot2</a>
                 </div>
              </div>
            )}
            
            {activeTab === 'settings' && (
               <div className="p-6 space-y-8">
                  <div className="space-y-4">
                     <span className="text-[11px] font-bold opacity-40 uppercase tracking-widest flex items-center gap-2"><TypeIcon size={14}/> {t.settings_editor}</span>
                     <div className="flex items-center justify-between text-[12px]">
                        <span>{t.settings_font_size}</span>
                        <div className="flex items-center gap-2">
                           <input type="number" value={fontSize} onChange={e => setFontSize(Math.max(8, parseInt(e.target.value)))} className="w-12 bg-black/20 rounded px-1 py-1 text-center outline-none border border-white/10" />
                           <span className="opacity-40">px</span>
                        </div>
                     </div>
                     <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-[12px]">{t.settings_line_wrap}</span>
                        <input type="checkbox" checked={lineWrapping} onChange={e => setLineWrapping(e.target.checked)} className="w-4 h-4 accent-blue-500" />
                     </label>
                  </div>
                  
                  <div className="space-y-4">
                     <span className="text-[11px] font-bold opacity-40 uppercase tracking-widest flex items-center gap-2"><Globe size={14}/> {t.settings_lang}</span>
                     <select value={lang} onChange={e => setLang(e.target.value as any)} className={`w-full rounded p-2 text-[12px] outline-none border ${isDark ? 'bg-black/20 border-white/10' : 'bg-white border-slate-200'}`}>
                        <option value="pt">Português (BR)</option>
                        <option value="en">English (US)</option>
                     </select>
                  </div>

                  <div className="space-y-4">
                     <span className="text-[11px] font-bold opacity-40 uppercase tracking-widest flex items-center gap-2"><Save size={14}/> {t.settings_system}</span>
                     <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-[12px]">{t.settings_autosave}</span>
                        <input type="checkbox" checked={autoSave} onChange={e => setAutoSave(e.target.checked)} className="w-4 h-4 accent-blue-500" />
                     </label>
                  </div>
               </div>
            )}
          </div>
        </aside>

        {/* ÁREA DO EDITOR DE CÓDIGO */}
        <main className="flex-1 flex flex-col relative">
          <div className={`h-8 border-b flex items-center px-4 shrink-0 ${isDark ? 'border-white/5 bg-[#1e293b]' : 'border-slate-200 bg-slate-50'}`}>
            <span className="text-[11px] font-bold text-blue-500 flex items-center gap-2"><FileCode size={12}/> {activeFile.name}</span>
          </div>

          <div className="flex-1 relative overflow-hidden flex">
            {/* Números de Linha */}
            <div className={`w-12 border-r py-4 text-right pr-3 font-mono text-[11px] opacity-20 bg-black/5 overflow-hidden`}>
              {(activeFile.content || '').split('\n').map((_, i) => <div key={i} style={{ height: `${fontSize * 1.5}px` }}>{i + 1}</div>)}
            </div>
            
            {/* Editor Textarea + Highlight */}
            <div className="flex-1 relative overflow-hidden">
               <div ref={highlightRef} className={`absolute inset-0 p-4 pointer-events-none code-font whitespace-pre overflow-hidden z-0 leading-normal ${lineWrapping ? 'whitespace-pre-wrap' : ''}`} style={{ fontSize: `${fontSize}px` }} dangerouslySetInnerHTML={{ __html: highlightCode(activeFile.content) }} />
               <textarea 
                  value={activeFile.content} 
                  onChange={e => { const n = [...files]; n[activeFileIndex].content = e.target.value; setFiles(n); }} 
                  onScroll={e => { if (highlightRef.current) highlightRef.current.scrollTop = e.currentTarget.scrollTop; if (highlightRef.current) highlightRef.current.scrollLeft = e.currentTarget.scrollLeft; }} 
                  spellCheck={false} 
                  className={`absolute inset-0 w-full h-full p-4 bg-transparent text-transparent caret-blue-500 code-font outline-none z-10 whitespace-pre overflow-auto custom-scrollbar resize-none leading-normal ${lineWrapping ? 'whitespace-pre-wrap' : ''}`} 
                  style={{ fontSize: `${fontSize}px` }} 
               />
            </div>
          </div>

          {/* PAINEL DE CONSOLE / MONITOR SERIAL */}
          <div className={`h-48 border-t flex flex-col shrink-0 ${isDark ? 'border-white/5 bg-[#1e293b]' : 'border-slate-200 bg-white'}`}>
            <div className="h-8 border-b flex items-center px-4 gap-6 text-[10px] font-black uppercase tracking-widest">
               <button onClick={() => setConsoleTab('output')} className={`flex items-center gap-2 pb-0.5 border-b-2 transition-all ${consoleTab === 'output' ? 'text-blue-500 border-blue-500' : 'border-transparent opacity-40 hover:opacity-100'}`}><Terminal size={12}/> {t.terminal_tab}</button>
               <button onClick={() => setConsoleTab('serial')} className={`flex items-center gap-2 pb-0.5 border-b-2 transition-all ${consoleTab === 'serial' ? 'text-blue-500 border-blue-500' : 'border-transparent opacity-40 hover:opacity-100'}`}><HardDrive size={12}/> {t.serial_tab}</button>
               <div className="flex-1" />
               <Trash2 size={12} className="cursor-pointer opacity-30 hover:opacity-100 transition-opacity" onClick={() => consoleTab === 'output' ? setOutputMessages([]) : setSerialMessages([])} />
            </div>
            
            {consoleTab === 'serial' && (
              <div className="h-8 border-b flex items-center px-4 gap-2 bg-black/5">
                <input 
                   value={serialInput} 
                   onChange={e => setSerialInput(e.target.value)} 
                   onKeyDown={e => e.key === 'Enter' && sendSerialData()} 
                   placeholder={t.serial_placeholder} 
                   className="flex-1 bg-transparent text-[11px] font-mono outline-none" 
                />
                <button onClick={sendSerialData} className="text-blue-500 text-[10px] font-bold hover:underline">ENVIAR</button>
              </div>
            )}

            <div className="flex-1 p-4 font-mono text-[12px] overflow-y-auto custom-scrollbar bg-black/10">
              {(consoleTab === 'output' ? outputMessages : serialMessages.map(m => `[${m.timestamp}] ${m.type === 'in' ? 'RX <' : 'TX >'} ${m.text}`)).map((m, i) => (
                <div key={i} className={`mb-0.5 ${m.includes('[ERRO]') ? 'text-red-400' : 'opacity-60'}`}>{m}</div>
              ))}
              <div ref={consoleEndRef} />
            </div>
          </div>
        </main>
      </div>

      {/* RODAPÉ */}
      <footer className="h-6 bg-blue-600 text-white flex items-center justify-between px-4 text-[10px] font-bold shrink-0 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
         <div className="flex gap-4">
           <span className="flex items-center gap-1.5"><Cpu size={11}/> {selectedBoard.name}</span>
           <span className="opacity-50">|</span>
           <span className="flex items-center gap-1.5">{isConnected ? <Check size={11}/> : <X size={11}/>} {isConnected ? t.status_connected : t.status_waiting}</span>
         </div>
         <div className="flex gap-6 opacity-80">
           <span>{t.footer_lines}: {(activeFile.content || '').split('\n').length}</span>
           <span>{t.footer_chars}: {activeFile.content.length}</span>
           <span className="flex items-center gap-1.5 uppercase tracking-tighter"><Save size={10}/> Modo Local</span>
         </div>
      </footer>
    </div>
  );
};

export default App;