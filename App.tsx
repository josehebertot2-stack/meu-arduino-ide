import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Files, Plus, Zap, Check, AlertTriangle, 
  FileCode, Settings, X, Sparkles, Wand2, 
  BookOpen, Layers, Info, Cpu as BoardIcon,
  ArrowRight, Save, RotateCcw, Github, ExternalLink, 
  Sliders, Type as FontIcon, Monitor, Box, Sun, Moon, Instagram,
  Terminal as TerminalIcon, MessageSquare, Trash2, Download, Search
} from 'lucide-react';
import { FileNode, ChatMessage, TabType, SerialMessage, ArduinoExample, ArduinoBoard, ArduinoLibrary } from './types';
import { getCodeAssistance, analyzeCode } from './services/geminiService';

const EXAMPLES: ArduinoExample[] = [
  { name: 'Blink', category: 'Basics', content: '// Sketch de exemplo: Piscar LED\nvoid setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(1000);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(1000);\n}' },
  { name: 'SerialRead', category: 'Communication', content: 'void setup() {\n  Serial.begin(9600);\n  Serial.println("Sistema Iniciado...");\n}\n\nvoid loop() {\n  if (Serial.available()) {\n    char c = Serial.read();\n    Serial.print("Recebi: ");\n    Serial.println(c);\n  }\n}' },
  { name: 'AnalogReadSerial', category: 'Basics', content: 'void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int sensorValue = analogRead(A0);\n  Serial.println(sensorValue);\n  delay(100);\n}' }
];

const BOARDS: ArduinoBoard[] = [
  { id: 'uno', name: 'Arduino Uno', fqbn: 'arduino:avr:uno' },
  { id: 'esp32', name: 'ESP32 Dev Module', fqbn: 'esp32:esp32:esp32' },
  { id: 'nano', name: 'Arduino Nano', fqbn: 'arduino:avr:nano' },
  { id: 'mega', name: 'Arduino Mega 2560', fqbn: 'arduino:avr:mega' }
];

const LIBRARIES: ArduinoLibrary[] = [
  { name: 'Adafruit Unified Sensor', version: '1.1.4', author: 'Adafruit', description: 'Obrigatória para sensores baseados em Adafruit Unified.', header: '#include <Adafruit_Sensor.h>' },
  { name: 'DHT sensor library', version: '1.4.3', author: 'Adafruit', description: 'Biblioteca para DHT11, DHT22, etc.', header: '#include <DHT.h>' },
  { name: 'WiFi', version: '1.2.7', author: 'Arduino', description: 'Habilita conexões de rede locais e internet.', header: '#include <WiFi.h>' }
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
  const [outputMessages, setOutputMessages] = useState<string[]>(["IDE Iniciada.", "Selecione uma placa para começar."]);
  const [consoleTab, setConsoleTab] = useState<'output' | 'serial'>('output');
  const [isConnected, setIsConnected] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedBoard, setSelectedBoard] = useState(BOARDS[0]);
  const [fontSize, setFontSize] = useState(14);

  const portRef = useRef<any>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  const activeFile = useMemo(() => files[activeFileIndex] || files[0], [files, activeFileIndex]);

  useEffect(() => {
    localStorage.setItem('arduino_ide_files', JSON.stringify(files));
    localStorage.setItem('arduino_theme', theme);
  }, [files, theme]);

  useEffect(() => {
    if (consoleEndRef.current) consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [serialMessages, outputMessages]);

  const downloadFile = (file: FileNode) => {
    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleVerify = async () => {
    setIsBusy(true);
    setConsoleTab('output');
    setOutputMessages(prev => [...prev, `Verificando ${activeFile.name}...`]);
    for(let i=0; i<=100; i+=25) { setProgress(i); await new Promise(r => setTimeout(r, 100)); }
    const result = await analyzeCode(activeFile.content);
    if (result.status === 'Ok' || result.status === 'Alerta') {
      setOutputMessages(prev => [...prev, "Compilação concluída!", `Resumo: ${result.summary}`]);
    } else {
      setOutputMessages(prev => [...prev, `[ERRO] ${result.summary}`]);
      result.issues?.forEach((issue: any) => setOutputMessages(prev => [...prev, `Linha ${issue.line}: ${issue.message}`]));
    }
    setIsBusy(false);
    setProgress(0);
  };

  const handleUpload = async () => {
    if (!isConnected) { setOutputMessages(prev => [...prev, "Erro: Nenhuma porta serial ativa."]); return; }
    setIsBusy(true);
    setConsoleTab('output');
    setOutputMessages(prev => [...prev, `Carregando para ${selectedBoard.name}...`]);
    for(let i=0; i<=100; i+=20) { setProgress(i); await new Promise(r => setTimeout(r, 150)); }
    setOutputMessages(prev => [...prev, "Upload finalizado com sucesso!"]);
    setIsBusy(false);
    setProgress(0);
  };

  const handleAskAI = async () => {
    if (!prompt.trim()) return;
    const userMsg: ChatMessage = { role: 'user', text: prompt };
    setChatHistory(prev => [...prev, userMsg]);
    const currentPrompt = prompt;
    setPrompt('');
    const response = await getCodeAssistance(currentPrompt, activeFile.content);
    setChatHistory(prev => [...prev, { role: 'assistant', text: response }]);
  };

  const connectSerial = async () => {
    try {
      if (!navigator.serial) { alert("Seu navegador não suporta Web Serial."); return; }
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;
      setIsConnected(true);
      setOutputMessages(prev => [...prev, "Conexão serial estabelecida."]);
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
    const isDark = theme === 'dark';
    return code
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\b(void|int|float|char|bool|long|unsigned|const|static|if|else|for|while|return|switch|case|break|byte|word|String)\b/g, `<span class="${isDark ? 'text-pink-400' : 'text-pink-600'} font-bold">$1</span>`)
      .replace(/\b(setup|loop|pinMode|digitalWrite|digitalRead|analogWrite|analogRead|delay|Serial|println|print|begin|available|read|write|millis)\b/g, `<span class="${isDark ? 'text-teal-400' : 'text-teal-600'} font-bold">$1</span>`)
      .replace(/\/\/.*/g, `<span class="${isDark ? 'text-slate-500' : 'text-slate-400'} italic">$&</span>`)
      .replace(/"[^"]*"/g, `<span class="${isDark ? 'text-green-400' : 'text-green-700'}">$&</span>`)
      .replace(/\b(HIGH|LOW|INPUT|OUTPUT|INPUT_PULLUP|LED_BUILTIN)\b/g, `<span class="${isDark ? 'text-orange-300' : 'text-orange-500'} font-semibold">$1</span>`);
  };

  const bgMain = theme === 'dark' ? 'bg-[#0b0e14]' : 'bg-[#f6f6f6]';
  const borderMain = theme === 'dark' ? 'border-white/5' : 'border-slate-200';
  const bgEditor = theme === 'dark' ? 'bg-[#0d1117]' : 'bg-white';
  const textTitle = theme === 'dark' ? 'text-slate-500' : 'text-slate-400';

  return (
    <div className={`flex flex-col h-screen ${bgMain} text-slate-300 font-sans overflow-hidden`}>
      {/* Top Header */}
      <header className={`h-12 border-b ${borderMain} flex items-center justify-between px-4 bg-[#1c1f24] shrink-0 z-50`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Zap size={20} className="text-[#008184]" fill="currentColor" />
            <span className="text-[10px] font-black tracking-tighter text-[#008184]">GEMINI IDE</span>
          </div>
          <div className="h-6 w-[1px] bg-white/10 mx-2" />
          <div className="flex items-center gap-1">
            <button onClick={handleVerify} title="Verificar" disabled={isBusy} className="p-2 hover:bg-white/5 rounded-md text-slate-400 hover:text-teal-400 transition-all active:scale-95"><Check size={18} /></button>
            <button onClick={handleUpload} title="Carregar" disabled={isBusy} className="p-2 hover:bg-white/5 rounded-md text-slate-400 hover:text-teal-400 transition-all active:scale-95"><ArrowRight size={18} /></button>
          </div>
          <div className="flex items-center gap-2 bg-black/30 border border-white/5 rounded-full pl-3 pr-2 py-1">
            <BoardIcon size={12} className="text-teal-500" />
            <select value={selectedBoard.id} onChange={(e) => setSelectedBoard(BOARDS.find(b => b.id === e.target.value) || BOARDS[0])} className="bg-transparent text-[10px] font-bold outline-none cursor-pointer text-slate-300">
              {BOARDS.map(b => <option key={b.id} value={b.id} className="bg-[#1c1f24]">{b.name}</option>)}
            </select>
          </div>
          <button onClick={connectSerial} className={`px-4 py-1 rounded-full text-[9px] font-black uppercase transition-all ${isConnected ? 'bg-teal-500 text-black' : 'bg-white/5 text-slate-500 hover:text-slate-300'}`}>
            {isConnected ? 'Porta Ativa' : 'Conectar Porta'}
          </button>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 rounded-md px-2 py-1">
            <Sparkles size={12} className="text-teal-400 animate-pulse"/>
            <span className="text-[9px] text-teal-400 font-bold uppercase">IA Conectada</span>
          </div>
          <Github size={18} className="text-slate-600 hover:text-white cursor-pointer transition-colors" />
        </div>
      </header>

      {progress > 0 && <div className="h-[2px] w-full bg-white/5"><div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${progress}%` }} /></div>}

      <div className="flex flex-1 overflow-hidden">
        {/* Activity Bar (Vertical) */}
        <nav className={`w-14 border-r ${borderMain} bg-[#1c1f24] flex flex-col items-center py-4 gap-4 shrink-0`}>
          {[
            { id: 'files', icon: Files, label: 'Arquivos' },
            { id: 'ai', icon: MessageSquare, label: 'Gemini' },
            { id: 'libraries', icon: Box, label: 'Bibliotecas' },
            { id: 'examples', icon: BookOpen, label: 'Exemplos' },
            { id: 'settings', icon: Settings, label: 'Ajustes' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as TabType)} className={`group relative p-3 rounded-xl transition-all ${activeTab === tab.id ? 'text-teal-400 bg-teal-400/10' : 'text-slate-600 hover:text-slate-300'}`}>
              <tab.icon size={22}/>
              {activeTab === tab.id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-teal-500 rounded-r-full" />}
              <span className="absolute left-16 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Sidebar Panel */}
        <aside className={`w-72 border-r ${borderMain} bg-[#0b0e14] flex flex-col shrink-0 overflow-hidden`}>
          <div className="h-10 px-4 border-b border-white/5 flex justify-between items-center bg-black/10">
            <span className={`text-[10px] font-black uppercase tracking-widest ${textTitle}`}>{activeTab}</span>
            {activeTab === 'files' && <Plus size={14} className="cursor-pointer hover:text-white" onClick={() => {
              const name = `sketch_${Date.now().toString().slice(-4)}.ino`;
              setFiles([...files, { name, content: 'void setup() {\n  \n}\n\nvoid loop() {\n  \n}', isOpen: true }]);
              setActiveFileIndex(files.length);
            }}/>}
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {activeTab === 'files' && (
              <div className="p-2 space-y-1">
                {files.map((file, idx) => (
                  <div key={idx} onClick={() => setActiveFileIndex(idx)} className={`flex items-center justify-between group px-3 py-2 rounded-lg cursor-pointer ${activeFileIndex === idx ? 'bg-teal-500/10 text-teal-400' : 'hover:bg-white/5 text-slate-500'}`}>
                    <div className="flex items-center gap-2 truncate">
                      <FileCode size={16} className={activeFileIndex === idx ? 'text-teal-400' : 'text-slate-600'}/>
                      <span className="text-xs truncate">{file.name}</span>
                    </div>
                    {files.length > 1 && (
                      <X size={12} className="opacity-0 group-hover:opacity-100 hover:text-red-400" onClick={(e) => {
                        e.stopPropagation();
                        const newFiles = files.filter((_, i) => i !== idx);
                        setFiles(newFiles);
                        setActiveFileIndex(0);
                      }}/>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {activeTab === 'ai' && (
              <div className="h-full flex flex-col">
                <div className="flex-1 overflow-y-auto p-4 space-y-4 text-[11px] custom-scrollbar">
                  {chatHistory.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-30 px-6">
                      <Sparkles size={32} className="mb-4 text-teal-500"/>
                      <p className="font-bold">Assistente Gemini</p>
                      <p className="text-[10px] mt-2 leading-relaxed">Peça ajuda com o código, pinagem ou lógica do seu projeto.</p>
                    </div>
                  )}
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`p-3 rounded-xl border ${msg.role === 'user' ? 'bg-white/5 border-white/5' : 'bg-teal-500/5 border-teal-500/20'}`}>
                      <div className="text-[8px] font-black uppercase mb-1 opacity-50 flex items-center gap-1">
                        {msg.role === 'user' ? <Monitor size={8}/> : <Sparkles size={8}/>}
                        {msg.role === 'user' ? 'Você' : 'Gemini AI'}
                      </div>
                      <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                    </div>
                  ))}
                </div>
                <div className="p-3 bg-black/40 border-t border-white/5">
                  <div className="relative">
                    <textarea 
                      value={prompt} 
                      onChange={e => setPrompt(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleAskAI())}
                      placeholder="Como posso ajudar?" 
                      className="w-full bg-[#1c1f24] border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-teal-500/50 resize-none h-20 custom-scrollbar" 
                    />
                    <button onClick={handleAskAI} className="absolute bottom-3 right-3 p-1.5 bg-teal-500 text-black rounded-lg hover:bg-teal-400 transition-all"><Wand2 size={14} /></button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'libraries' && (
              <div className="p-4 space-y-4">
                 <div className="relative mb-2">
                   <input type="text" placeholder="Buscar bibliotecas..." className="w-full bg-white/5 border border-white/5 rounded-md px-8 py-2 text-[10px] outline-none focus:border-teal-500/50" />
                   <Search size={12} className="absolute left-3 top-2.5 text-slate-600" />
                 </div>
                 {LIBRARIES.map((lib, i) => (
                   <div key={i} className="p-3 rounded-xl border border-white/5 bg-white/5 group hover:border-teal-500/30 transition-all">
                      <div className="flex justify-between items-start">
                        <p className="text-[11px] font-bold text-teal-400">{lib.name}</p>
                        <span className="text-[8px] bg-white/5 px-1 rounded text-slate-500">v{lib.version}</span>
                      </div>
                      <p className="text-[9px] text-slate-500 mt-1 leading-relaxed">{lib.description}</p>
                      <button onClick={() => {
                        const newFiles = [...files];
                        if (!newFiles[activeFileIndex].content.includes(lib.header)) {
                          newFiles[activeFileIndex].content = lib.header + "\n" + newFiles[activeFileIndex].content;
                          setFiles(newFiles);
                        }
                      }} className="mt-3 w-full py-1.5 bg-teal-500/10 text-teal-500 rounded text-[9px] font-black uppercase hover:bg-teal-500 hover:text-black transition-all">Instalar no Sketch</button>
                   </div>
                 ))}
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="p-6 space-y-8">
                <div className="space-y-4">
                   <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest"><Monitor size={14}/> Tema</div>
                   <div className="grid grid-cols-2 gap-2">
                     <button onClick={() => setTheme('dark')} className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${theme === 'dark' ? 'border-teal-500 bg-teal-500/10 text-teal-400' : 'border-white/5 text-slate-600'}`}>Escuro</button>
                     <button onClick={() => setTheme('light')} className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${theme === 'light' ? 'border-teal-500 bg-teal-500/10 text-teal-600' : 'border-white/5 text-slate-600'}`}>Claro</button>
                   </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest"><FontIcon size={14}/> Tamanho da Fonte</div>
                  <div className="flex items-center gap-4">
                    <input type="range" min="10" max="24" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="flex-1 accent-teal-500 h-1 bg-white/10 rounded-full appearance-none"/>
                    <span className="text-xs font-mono text-teal-500">{fontSize}px</span>
                  </div>
                </div>
                <div className="pt-8 border-t border-white/5 space-y-4">
                   <button onClick={() => { if(confirm("Isso apagará todos os seus arquivos salvos. Continuar?")) { localStorage.clear(); window.location.reload(); } }} className="w-full py-2 border border-red-500/20 text-red-500 rounded-lg text-[10px] font-bold hover:bg-red-500 hover:text-white transition-all">Limpar Tudo</button>
                   <div className="flex flex-col items-center gap-3 py-4 opacity-50">
                     <Instagram size={20} className="text-pink-500"/>
                     <span className="text-[10px] font-black text-teal-500 tracking-tighter">@JOSEHEBERTOT2</span>
                   </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main Editor Area */}
        <main className={`flex-1 flex flex-col ${bgEditor} relative`}>
          {/* File Tabs */}
          <div className="h-9 bg-black/30 border-b border-white/5 flex items-center px-2 overflow-x-auto no-scrollbar shrink-0">
            {files.map((file, idx) => (
              <div key={idx} onClick={() => setActiveFileIndex(idx)} className={`h-full flex items-center px-4 text-[11px] font-medium cursor-pointer border-r border-white/5 gap-3 transition-colors ${activeFileIndex === idx ? 'bg-[#0d1117] text-teal-400 border-t-2 border-t-teal-500' : 'text-slate-600 hover:text-slate-400'}`}>
                <FileCode size={12}/> {file.name}
              </div>
            ))}
          </div>

          {/* Editor Container */}
          <div className="flex-1 relative overflow-hidden group">
            {/* Gutter / Line Numbers */}
            <div className="absolute left-0 top-0 w-12 h-full bg-black/10 border-r border-white/5 py-5 flex flex-col items-center text-slate-700 font-mono select-none" style={{ fontSize: `${fontSize}px`, lineHeight: `${fontSize * 1.5}px` }}>
              {activeFile.content.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
            </div>
            
            <div className="ml-12 h-full relative">
               {/* Syntax Highlight Overlay */}
               <div ref={highlightRef} className="absolute inset-0 p-5 pointer-events-none code-font whitespace-pre overflow-hidden z-0" 
                    style={{ fontSize: `${fontSize}px`, lineHeight: `${fontSize * 1.5}px`, color: theme === 'dark' ? '#d1d5db' : '#1f2937' }}
                    dangerouslySetInnerHTML={{ __html: highlightCode(activeFile.content) }} />
               
               {/* Invisible Textarea for Editing */}
               <textarea 
                  value={activeFile.content} 
                  onChange={e => { const newFiles = [...files]; newFiles[activeFileIndex].content = e.target.value; setFiles(newFiles); }} 
                  onScroll={(e) => { if (highlightRef.current) { highlightRef.current.scrollTop = e.currentTarget.scrollTop; highlightRef.current.scrollLeft = e.currentTarget.scrollLeft; } }}
                  spellCheck={false}
                  autoFocus
                  style={{ fontSize: `${fontSize}px`, lineHeight: `${fontSize * 1.5}px` }}
                  className="absolute inset-0 w-full h-full p-5 bg-transparent text-transparent caret-teal-400 code-font outline-none z-10 whitespace-pre overflow-auto custom-scrollbar resize-none"
               />

               {/* Editor Actions Overlay */}
               <div className="absolute top-4 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-all z-20">
                 <button onClick={() => downloadFile(activeFile)} className="p-2 bg-black/60 hover:bg-teal-500 hover:text-black rounded-lg text-slate-400 border border-white/10" title="Baixar .ino"><Download size={16}/></button>
               </div>
            </div>
          </div>

          {/* Console / Output Area */}
          <div className={`h-48 border-t ${borderMain} bg-black/20 flex flex-col shrink-0`}>
            <div className="h-9 border-b border-white/5 flex items-center justify-between px-4 bg-black/20 shrink-0">
              <div className="flex gap-6 h-full">
                <button onClick={() => setConsoleTab('output')} className={`text-[10px] font-black uppercase px-2 h-full flex items-center gap-2 border-b-2 transition-all ${consoleTab === 'output' ? 'text-teal-500 border-teal-500' : 'text-slate-600 border-transparent'}`}><TerminalIcon size={12}/> Saída</button>
                <button onClick={() => setConsoleTab('serial')} className={`text-[10px] font-black uppercase px-2 h-full flex items-center gap-2 border-b-2 transition-all ${consoleTab === 'serial' ? 'text-teal-500 border-teal-500' : 'text-slate-600 border-transparent'}`}><Monitor size={12}/> Serial Monitor</button>
              </div>
              <button onClick={() => consoleTab === 'output' ? setOutputMessages([]) : setSerialMessages([])} className="text-slate-600 hover:text-teal-500 transition-colors p-1" title="Limpar console"><Trash2 size={14}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] custom-scrollbar bg-black/30">
              {consoleTab === 'output' ? (
                <div className="space-y-1">
                  {outputMessages.map((m, i) => (
                    <div key={i} className={m.includes('[ERRO]') ? 'text-red-400' : 'text-slate-400'}>
                      <span className="opacity-10 mr-2 select-none">&gt;</span> {m}
                    </div>
                  ))}
                  {outputMessages.length === 0 && <div className="text-slate-700 italic text-[10px]">Sem novas mensagens de saída.</div>}
                </div>
              ) : (
                <div className="space-y-1">
                  {serialMessages.map((msg, i) => (
                    <div key={i} className="flex gap-4">
                      <span className="text-slate-700 select-none">[{msg.timestamp}]</span>
                      <span className="text-teal-500">{msg.text}</span>
                    </div>
                  ))}
                  {serialMessages.length === 0 && <div className="text-slate-700 italic text-[10px]">Aguardando dados seriais em 9600 baud...</div>}
                </div>
              )}
              <div ref={consoleEndRef} />
            </div>
          </div>
        </main>
      </div>

      {/* Footer Status Bar */}
      <footer className="h-6 bg-[#008184] text-white flex items-center justify-between px-4 text-[9px] font-black uppercase shrink-0 select-none">
         <div className="flex gap-6">
           <span className="flex items-center gap-1.5"><BoardIcon size={11}/> {selectedBoard.name}</span>
           <span className="flex items-center gap-1.5"><div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-white animate-pulse' : 'bg-white/20'}`} /> {isConnected ? 'USB Conectado' : 'Aguardando Porta Serial'}</span>
         </div>
         <div className="flex gap-6 opacity-80">
           <span>{activeFile.name}</span>
           <span className="font-mono">LN: {activeFile.content.split('\n').length} | COL: 0</span>
           <span>UTF-8 | LF</span>
         </div>
      </footer>
    </div>
  );
};

export default App;