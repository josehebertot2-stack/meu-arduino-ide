import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Files, Plus, Zap, Check, FileCode, Settings, X, Sparkles, Wand2, 
  BookOpen, Cpu as BoardIcon, ArrowRight, Type as FontIcon, 
  Monitor, Box, MessageSquare, Trash2, Download, Search, Terminal as TerminalIcon,
  User, Instagram, Send, Info, Award, Sun, Moon
} from 'lucide-react';
import { FileNode, ChatMessage, TabType, SerialMessage, ArduinoExample, ArduinoBoard, ArduinoLibrary } from './types';
import { getCodeAssistance, analyzeCode } from './services/geminiService';

const DEFAULT_CODE = `void setup() {
  // put your setup code here, to run once:

}

void loop() {
  // put your main code here, to run repeatedly:

}`;

const EXAMPLES: ArduinoExample[] = [
  { 
    name: 'Blink', 
    category: 'Basics', 
    content: '// Sketch de exemplo: Piscar LED\nvoid setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(1000);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(1000);\n}' 
  },
  { 
    name: 'SerialRead', 
    category: 'Communication', 
    content: 'void setup() {\n  Serial.begin(9600);\n  Serial.println("Iniciado.");\n}\n\nvoid loop() {\n  if (Serial.available() > 0) {\n    char c = Serial.read();\n    Serial.print("Recebi: ");\n    Serial.println(c);\n  }\n}' 
  }
];

const BOARDS: ArduinoBoard[] = [
  { id: 'uno', name: 'Arduino Uno', fqbn: 'arduino:avr:uno' },
  { id: 'esp32', name: 'ESP32 Dev Module', fqbn: 'esp32:esp32:esp32' },
  { id: 'nano', name: 'Arduino Nano', fqbn: 'arduino:avr:nano' }
];

const LIBRARIES: ArduinoLibrary[] = [
  { name: 'DHT sensor library', version: '1.4.3', author: 'Adafruit', description: 'Biblioteca para sensores DHT11/DHT22.', header: '#include <DHT.h>' },
  { name: 'Servo', version: '1.1.8', author: 'Arduino', description: 'Controle de servos.', header: '#include <Servo.h>' }
];

const App: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('arduino_theme') : 'dark';
    return (saved as 'dark' | 'light') || 'dark';
  });
  
  const [activeTab, setActiveTab] = useState<TabType>('files');
  const [files, setFiles] = useState<FileNode[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('arduino_ide_files') : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) { console.error("Error loading files", e); }
    return [{ name: 'sketch_mar24a.ino', content: DEFAULT_CODE, isOpen: true }];
  });
  
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [serialMessages, setSerialMessages] = useState<SerialMessage[]>([]);
  const [outputMessages, setOutputMessages] = useState<string[]>(["IDE Pronta.", "Conecte sua placa via USB para monitoramento."]);
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

  const activeFile = useMemo<FileNode>(() => {
    return files[activeFileIndex] || files[0] || { name: 'unnamed.ino', content: DEFAULT_CODE, isOpen: true };
  }, [files, activeFileIndex]);

  useEffect(() => {
    localStorage.setItem('arduino_ide_files', JSON.stringify(files));
    localStorage.setItem('arduino_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [files, theme]);

  useEffect(() => {
    if (consoleEndRef.current) consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [serialMessages, outputMessages]);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleSendMessage = async () => {
    if (!prompt.trim() || isChatLoading) return;
    
    const userMessage = { role: 'user' as const, text: prompt };
    setChatHistory(prev => [...prev, userMessage]);
    setPrompt('');
    setIsChatLoading(true);

    try {
      const response = await getCodeAssistance(prompt, activeFile.content);
      setChatHistory(prev => [...prev, { role: 'assistant' as const, text: response }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'assistant' as const, text: "Erro ao conectar com a IA." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleVerify = async () => {
    if (isBusy) return;
    setIsBusy(true);
    setConsoleTab('output');
    setOutputMessages(prev => [...prev, `Verificando ${activeFile.name}...`]);
    
    for(let i=0; i<=100; i+=25) { 
      setProgress(i); 
      await new Promise(r => setTimeout(r, 100)); 
    }
    
    try {
      const result = await analyzeCode(activeFile.content);
      if (result.status === 'Ok' || result.status === 'Alerta') {
        setOutputMessages(prev => [...prev, "Compilação concluída!", `Resumo: ${result.summary}`]);
      } else {
        setOutputMessages(prev => [...prev, `[ERRO] ${result.summary}`]);
      }
    } catch (e) {
      setOutputMessages(prev => [...prev, "[ERRO] Falha na análise de código."]);
    }
    
    setIsBusy(false);
    setProgress(0);
  };

  const connectSerial = async () => {
    try {
      if (!navigator || !('serial' in navigator)) {
        alert("Navegador não suporta Web Serial API. Use Chrome ou Edge.");
        return;
      }
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;
      setIsConnected(true);
      setOutputMessages(prev => [...prev, "Conectado à porta serial."]);
      
      const reader = port.readable.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const text = new TextDecoder().decode(value);
          setSerialMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.type === 'in' && !last.text.endsWith('\n')) {
              return [...prev.slice(0, -1), { ...last, text: last.text + text }];
            }
            return [...prev, { timestamp: new Date().toLocaleTimeString(), type: 'in', text }];
          });
        }
      } finally {
        reader.releaseLock();
      }
    } catch (err) {
      console.error(err);
      setIsConnected(false);
    }
  };

  const highlightCode = (code: string) => {
    const isDark = theme === 'dark';
    const c = code || '';
    return c
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\b(void|int|float|char|bool|long|unsigned|const|static|if|else|for|while|return|switch|case|break|byte|word|String)\b/g, `<span class="${isDark ? 'text-pink-400' : 'text-pink-600'} font-bold">$1</span>`)
      .replace(/\b(setup|loop|pinMode|digitalWrite|digitalRead|analogWrite|analogRead|delay|Serial|println|print|begin|available|read|write|millis)\b/g, `<span class="${isDark ? 'text-teal-400' : 'text-teal-600'} font-bold">$1</span>`)
      .replace(/\/\/.*/g, `<span class="${isDark ? 'text-slate-500' : 'text-slate-400'} italic">$&</span>`)
      .replace(/"[^"]*"/g, `<span class="${isDark ? 'text-green-400' : 'text-green-700'}">$&</span>`)
      .replace(/\b(HIGH|LOW|INPUT|OUTPUT|INPUT_PULLUP|LED_BUILTIN)\b/g, `<span class="${isDark ? 'text-orange-300' : 'text-orange-500'} font-semibold">$1</span>`);
  };

  const isDark = theme === 'dark';

  return (
    <div className={`flex flex-col h-screen ${isDark ? 'bg-[#0b0e14] text-slate-300' : 'bg-[#f6f6f6] text-slate-800'} overflow-hidden transition-colors duration-200`}>
      <header className={`h-12 border-b ${isDark ? 'border-white/5 bg-[#1c1f24]' : 'border-slate-200 bg-white'} flex items-center justify-between px-4 shrink-0 z-50`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => window.location.reload()}>
            <Zap size={20} className="text-[#008184]" fill="currentColor" />
            <span className={`text-[12px] font-black tracking-tighter text-[#008184]`}>ARDUPROGRAM IDE</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleVerify} title="Verificar" disabled={isBusy} className={`p-2 rounded-md transition-colors ${isDark ? 'text-slate-400 hover:bg-white/5 hover:text-teal-400' : 'text-slate-600 hover:bg-slate-100 hover:text-teal-600'}`}><Check size={18} /></button>
            <button onClick={connectSerial} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${isConnected ? 'bg-teal-500 text-black' : isDark ? 'bg-white/5 text-slate-500 hover:bg-white/10' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
              {isConnected ? 'Conectado' : 'Conectar'}
            </button>
          </div>
          <div className={`flex items-center gap-2 rounded-full px-3 py-1 ${isDark ? 'bg-black/30 border border-white/5' : 'bg-slate-100 border border-slate-200'}`}>
            <BoardIcon size={12} className="text-teal-500" />
            <select value={selectedBoard.id} onChange={(e) => setSelectedBoard(BOARDS.find(b => b.id === e.target.value) || BOARDS[0])} className="bg-transparent text-[10px] font-bold outline-none cursor-pointer">
              {BOARDS.map(b => <option key={b.id} value={b.id} className={`${isDark ? 'bg-[#1c1f24]' : 'bg-white text-slate-800'}`}>{b.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={toggleTheme} title={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"} className={`p-2 rounded-lg transition-all ${isDark ? 'text-slate-400 hover:bg-white/5 hover:text-yellow-400' : 'text-slate-600 hover:bg-slate-100 hover:text-indigo-600'}`}>
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className={`flex items-center gap-2 rounded-md px-3 py-1 ${isDark ? 'bg-teal-500/10 border border-teal-500/20' : 'bg-teal-50 border border-teal-200'}`}>
            <Sparkles size={12} className="text-teal-400 animate-pulse"/>
            <span className="text-[9px] text-teal-400 font-bold uppercase">Gemini AI</span>
          </div>
        </div>
      </header>

      {progress > 0 && <div className={`h-[2px] w-full ${isDark ? 'bg-white/5' : 'bg-slate-200'}`}><div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${progress}%` }} /></div>}

      <div className="flex flex-1 overflow-hidden">
        <nav className={`w-14 border-r ${isDark ? 'border-white/5 bg-[#1c1f24]' : 'border-slate-200 bg-slate-100'} flex flex-col items-center py-4 gap-4 shrink-0`}>
          {[
            { id: 'files', icon: Files },
            { id: 'ai', icon: MessageSquare },
            { id: 'libraries', icon: Box },
            { id: 'creator', icon: User },
            { id: 'settings', icon: Settings },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as TabType)} className={`p-3 rounded-xl transition-all ${activeTab === tab.id ? 'text-teal-400 bg-teal-400/10' : isDark ? 'text-slate-600 hover:text-slate-300' : 'text-slate-400 hover:text-slate-700'}`}>
              <tab.icon size={20}/>
            </button>
          ))}
        </nav>

        <aside className={`w-80 border-r ${isDark ? 'border-white/5 bg-[#0b0e14]' : 'border-slate-200 bg-white'} flex flex-col shrink-0 overflow-hidden`}>
          <div className={`h-10 px-4 border-b ${isDark ? 'border-white/5 bg-black/10' : 'border-slate-100 bg-slate-50'} flex justify-between items-center`}>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{activeTab === 'ai' ? 'Gemini AI' : activeTab === 'creator' ? 'Criador' : activeTab}</span>
            {activeTab === 'files' && <Plus size={16} className="cursor-pointer hover:text-teal-500" onClick={() => {
              const name = `sketch_${Date.now().toString().slice(-4)}.ino`;
              setFiles([...files, { name, content: DEFAULT_CODE, isOpen: true }]);
            }}/>}
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
            {activeTab === 'files' && files.map((file, idx) => (
              <div key={idx} onClick={() => setActiveFileIndex(idx)} className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${activeFileIndex === idx ? 'bg-teal-500/10 text-teal-400' : isDark ? 'hover:bg-white/5 text-slate-500' : 'hover:bg-slate-50 text-slate-600'}`}>
                <FileCode size={14} />
                <span className="text-xs truncate">{file.name}</span>
              </div>
            ))}

            {activeTab === 'ai' && (
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                  {chatHistory.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-4 opacity-40">
                      <Sparkles size={48} className="text-teal-400" />
                      <p className="text-xs font-medium">Como posso ajudar com o seu projeto Arduino hoje?</p>
                    </div>
                  )}
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${msg.role === 'user' ? 'bg-teal-600 text-white shadow-lg' : isDark ? 'bg-white/5 text-slate-300 border border-white/5' : 'bg-slate-100 text-slate-800 border border-slate-200'}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex items-center gap-2 text-[10px] text-teal-400 animate-pulse px-2">
                       <Sparkles size={12} /> IA pensando...
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className={`p-4 border-t ${isDark ? 'border-white/5 bg-black/20' : 'border-slate-100 bg-slate-50'}`}>
                  <div className="flex gap-2">
                    <input 
                      value={prompt} 
                      onChange={e => setPrompt(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Pergunte à IA..." 
                      className={`flex-1 rounded-lg px-3 py-2 text-xs outline-none focus:border-teal-500 transition-colors ${isDark ? 'bg-black/40 border border-white/10' : 'bg-white border border-slate-300 text-slate-800'}`}
                    />
                    <button onClick={handleSendMessage} disabled={isChatLoading} className="p-2 bg-teal-500 text-black rounded-lg hover:bg-teal-400 transition-colors shadow-md shadow-teal-500/10">
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'libraries' && (
              <div className="p-4 space-y-4">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
                  <input value={searchLib} onChange={e => setSearchLib(e.target.value)} placeholder="Buscar bibliotecas..." className={`w-full rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:border-teal-500 ${isDark ? 'bg-black/40 border border-white/10' : 'bg-white border border-slate-300 text-slate-800'}`} />
                </div>
                <div className="space-y-3">
                  {LIBRARIES.filter(l => l.name.toLowerCase().includes(searchLib.toLowerCase())).map((lib, i) => (
                    <div key={i} className={`p-3 border rounded-xl hover:border-teal-500/50 transition-all cursor-pointer group ${isDark ? 'bg-white/5 border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[11px] font-bold text-teal-400">{lib.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>{lib.version}</span>
                      </div>
                      <p className={`text-[10px] line-clamp-2 mb-2 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>{lib.description}</p>
                      <button onClick={() => {
                        const newFiles = [...files];
                        newFiles[activeFileIndex].content = lib.header + "\n" + newFiles[activeFileIndex].content;
                        setFiles(newFiles);
                        setOutputMessages(prev => [...prev, `Biblioteca ${lib.name} incluída.`]);
                      }} className={`w-full py-1.5 rounded text-[10px] font-bold uppercase transition-all ${isDark ? 'bg-white/5 hover:bg-teal-500 hover:text-black' : 'bg-slate-100 hover:bg-teal-500 hover:text-white'}`}>Instalar</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'creator' && (
              <div className="p-6 flex flex-col items-center text-center space-y-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-400 p-1">
                    <div className={`w-full h-full rounded-full flex items-center justify-center overflow-hidden ${isDark ? 'bg-[#0b0e14]' : 'bg-white'}`}>
                       <User size={48} className="text-teal-400 opacity-80" />
                    </div>
                  </div>
                  <div className={`absolute -bottom-1 -right-1 bg-teal-500 p-1.5 rounded-full border-4 ${isDark ? 'border-[#0b0e14]' : 'border-white'}`}>
                    <Award size={14} className="text-black" />
                  </div>
                </div>
                
                <div className="space-y-1">
                  <h2 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>José Heberto Torres da Costa</h2>
                  <p className="text-[10px] text-teal-400 font-bold uppercase tracking-widest">Fullstack Developer & Maker</p>
                </div>

                <div className={`p-4 border rounded-2xl text-[11px] leading-relaxed ${isDark ? 'bg-white/5 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                  "Desenvolvi a ArduProgram IDE com o objetivo de democratizar o acesso à programação de hardware, trazendo inteligência artificial e portabilidade para o ecossistema Arduino."
                </div>

                <div className="flex flex-col w-full gap-2">
                  <a href="https://instagram.com/josehebertot2" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 w-full py-3 bg-gradient-to-r from-purple-600 via-blue-600 to-red-600 text-white rounded-xl font-bold text-xs hover:scale-[1.02] transition-all shadow-lg">
                    <span className="flex items-center gap-3"><Instagram size={18} /> @josehebertot2</span>
                  </a>
                </div>

                <div className="pt-4 border-t border-white/5 w-full">
                   <div className="flex items-center justify-center gap-2 text-[9px] text-slate-600 font-bold uppercase">
                     <Info size={12} /> v1.2.0 Stable Build
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Personalização</label>
                  <button onClick={toggleTheme} className={`w-full py-3 rounded-xl border flex items-center justify-center gap-3 text-xs font-medium transition-all ${isDark ? 'border-white/5 bg-white/5 hover:bg-white/10' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                    {isDark ? <Sun size={14} /> : <Moon size={14} />}
                    Alternar para Tema {isDark ? 'Claro' : 'Escuro'}
                  </button>
                  <button onClick={() => {
                    if (confirm("Deseja resetar todos os arquivos para o padrão?")) {
                      localStorage.removeItem('arduino_ide_files');
                      window.location.reload();
                    }
                  }} className={`w-full py-2 rounded-lg text-[10px] font-bold uppercase ${isDark ? 'text-red-400/50 hover:text-red-400' : 'text-red-600/50 hover:text-red-600'}`}>
                    Resetar Todos os Arquivos
                  </button>
                </div>
                <div className={`pt-4 border-t space-y-2 ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
                   <label className="text-[10px] font-bold text-slate-500 uppercase">Projeto</label>
                   <button onClick={() => {
                     const blob = new Blob([activeFile.content], {type: 'text/plain'});
                     const url = window.URL.createObjectURL(blob);
                     const a = document.createElement('a');
                     a.href = url;
                     a.download = activeFile.name;
                     a.click();
                   }} className="w-full py-3 rounded-xl bg-teal-500 text-black text-xs font-black uppercase hover:bg-teal-400 transition-all flex items-center justify-center gap-2 shadow-md shadow-teal-500/20">
                     <Download size={16} /> Baixar .INO
                   </button>
                </div>
              </div>
            )}
          </div>
        </aside>

        <main className={`flex-1 flex flex-col relative transition-colors duration-200 ${isDark ? 'bg-[#0d1117]' : 'bg-[#fcfcfc]'}`}>
          <div className={`h-9 border-b flex items-center px-2 shrink-0 overflow-x-auto no-scrollbar ${isDark ? 'bg-black/30 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
            {files.map((file, idx) => (
              <div key={idx} onClick={() => setActiveFileIndex(idx)} className={`h-full flex items-center px-4 text-[11px] font-medium cursor-pointer border-r gap-3 transition-all ${isDark ? 'border-white/5' : 'border-slate-200'} ${activeFileIndex === idx ? (isDark ? 'bg-[#0d1117] text-teal-400 border-t-2 border-t-teal-500' : 'bg-white text-teal-600 border-t-2 border-t-teal-600') : (isDark ? 'text-slate-600 bg-black/5' : 'text-slate-400 bg-slate-50')}`}>
                {file.name}
                {files.length > 1 && (
                  <X size={10} className="hover:text-red-400 transition-colors" onClick={(e) => {
                    e.stopPropagation();
                    const newFiles = files.filter((_, i) => i !== idx);
                    setFiles(newFiles);
                    if (activeFileIndex >= newFiles.length) setActiveFileIndex(Math.max(0, newFiles.length - 1));
                  }} />
                )}
              </div>
            ))}
          </div>
          <div className="flex-1 relative overflow-hidden">
            <div className={`absolute left-0 top-0 w-12 h-full border-r py-5 flex flex-col items-center font-mono text-[13px] select-none ${isDark ? 'bg-black/5 border-white/5 text-slate-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
              {(activeFile.content || '').split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
            </div>
            <div className="ml-12 h-full relative">
               <div ref={highlightRef} className="absolute inset-0 p-5 pointer-events-none code-font whitespace-pre overflow-hidden z-0 leading-relaxed text-[14px]" dangerouslySetInnerHTML={{ __html: highlightCode(activeFile.content) }} />
               <textarea value={activeFile.content} onChange={e => { const n = [...files]; if(n[activeFileIndex]) n[activeFileIndex].content = e.target.value; setFiles(n); }} onScroll={(e) => { if (highlightRef.current) highlightRef.current.scrollTop = e.currentTarget.scrollTop; }} spellCheck={false} className="absolute inset-0 w-full h-full p-5 bg-transparent text-transparent caret-teal-400 code-font outline-none z-10 whitespace-pre overflow-auto custom-scrollbar resize-none leading-relaxed text-[14px]" />
            </div>
          </div>
          <div className={`h-44 border-t flex flex-col shrink-0 ${isDark ? 'border-white/5 bg-black/20' : 'border-slate-200 bg-white shadow-inner'}`}>
            <div className={`h-8 border-b flex items-center px-4 gap-6 text-[10px] font-bold uppercase ${isDark ? 'border-white/5 text-slate-500' : 'border-slate-100 text-slate-400'}`}>
               <button onClick={() => setConsoleTab('output')} className={consoleTab === 'output' ? 'text-teal-400' : ''}>Saída</button>
               <button onClick={() => setConsoleTab('serial')} className={consoleTab === 'serial' ? 'text-teal-400' : ''}>Serial</button>
               <div className="flex-1" />
               <button onClick={() => consoleTab === 'output' ? setOutputMessages([]) : setSerialMessages([])} className="hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
            </div>
            <div className="flex-1 p-3 font-mono text-[11px] overflow-y-auto custom-scrollbar">
              {(consoleTab === 'output' ? outputMessages : serialMessages.map(m => `[${m.timestamp}] ${m.text}`)).map((m, i) => <div key={i} className={isDark ? 'text-slate-400' : 'text-slate-600'}>{m}</div>)}
              <div ref={consoleEndRef} />
            </div>
          </div>
        </main>
      </div>

      <footer className="h-6 bg-[#008184] text-white flex items-center justify-between px-4 text-[9px] font-black uppercase shrink-0">
         <div className="flex gap-4">
           <span className="flex items-center gap-1"><BoardIcon size={10} /> {selectedBoard.name}</span>
           <span className="flex items-center gap-1"><Monitor size={10} /> {isConnected ? 'Serial: Conectado' : 'Monitor Desconectado'}</span>
         </div>
         <div className="flex gap-4 opacity-70">
           <span>Linhas: {(activeFile.content || '').split('\n').length}</span>
           <span>Caractere: {activeFile.content.length}</span>
           <span>UTF-8</span>
         </div>
      </footer>
    </div>
  );
};

export default App;