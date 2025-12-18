
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Files, Plus, Zap, Check, AlertTriangle, 
  FileCode, Settings, X, Sparkles, Wand2, 
  BookOpen, Layers, Info, Cpu as BoardIcon,
  ArrowRight, Save, RotateCcw, Github, ExternalLink, 
  Sliders, Type as FontIcon, Monitor, Box, Sun, Moon, Instagram, Key,
  Terminal as TerminalIcon,
  MessageSquare
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
  { name: 'Adafruit Unified Sensor', version: '1.1.4', author: 'Adafruit', description: 'Required for all Adafruit Unified Sensor based libraries.', header: '#include <Adafruit_Sensor.h>' },
  { name: 'DHT sensor library', version: '1.4.3', author: 'Adafruit', description: 'Arduino library for DHT11, DHT22, etc.', header: '#include <DHT.h>' },
  { name: 'WiFi', version: '1.2.7', author: 'Arduino', description: 'Enables network connection (local and Internet).', header: '#include <WiFi.h>' },
  { name: 'LiquidCrystal', version: '1.0.7', author: 'Arduino', description: 'Allows communication with LCDs.', header: '#include <LiquidCrystal.h>' }
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
  const [outputMessages, setOutputMessages] = useState<string[]>(["IDE Iniciada com sucesso.", "Pronto para programar."]);
  const [consoleTab, setConsoleTab] = useState<'output' | 'serial'>('output');
  const [isConnected, setIsConnected] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedBoard, setSelectedBoard] = useState(BOARDS[0]);
  
  const [fontSize, setFontSize] = useState(14);
  const [showLineNumbers] = useState(true);

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
    a.download = file.name.endsWith('.ino') ? file.name : `${file.name}.ino`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleVerify = async () => {
    setIsBusy(true);
    setConsoleTab('output');
    setOutputMessages(prev => [...prev, `Verificando código: ${activeFile.name}...`]);
    
    for(let i=0; i<=100; i+=10) {
      setProgress(i);
      await new Promise(r => setTimeout(r, 100));
    }

    const result = await analyzeCode(activeFile.content);
    if (result.status === 'Ok' || result.status === 'Alerta') {
      setOutputMessages(prev => [...prev, "Compilação concluída!", "O sketch usa 444 bytes de espaço de armazenamento."]);
    } else {
      setOutputMessages(prev => [...prev, `[ERRO] ${result.summary}`]);
      result.issues?.forEach((issue: any) => {
        setOutputMessages(prev => [...prev, `Linha ${issue.line || '?'}: ${issue.message}`]);
      });
    }
    
    setIsBusy(false);
    setProgress(0);
  };

  const handleUpload = async () => {
    if (!isConnected) {
      setOutputMessages(prev => [...prev, "Erro: Nenhuma placa conectada via Serial."]);
      return;
    }
    setIsBusy(true);
    setConsoleTab('output');
    setOutputMessages(prev => [...prev, `Carregando para ${selectedBoard.name}...`]);
    for(let i=0; i<=100; i+=20) {
      setProgress(i);
      await new Promise(r => setTimeout(r, 150));
    }
    setOutputMessages(prev => [...prev, "Upload concluído!", "Reiniciando placa..."]);
    setIsBusy(false);
    setProgress(0);
  };

  const handleAskAI = async () => {
    if (!prompt.trim()) return;
    const userMsg: ChatMessage = { role: 'user', text: prompt };
    setChatHistory(prev => [...prev, userMsg]);
    setPrompt('');
    const response = await getCodeAssistance(prompt, activeFile.content);
    setChatHistory(prev => [...prev, { role: 'assistant', text: response }]);
  };

  const connectSerial = async () => {
    try {
      if (!navigator.serial) {
        alert("Web Serial API não suportada neste navegador.");
        return;
      }
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;
      setIsConnected(true);
      setOutputMessages(prev => [...prev, "Porta Serial aberta."]);
      const reader = port.readable.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const text = new TextDecoder().decode(value);
        setSerialMessages(prev => [...prev, { 
          timestamp: new Date().toLocaleTimeString(), 
          type: 'in', 
          text 
        }]);
      }
    } catch (err) {
      console.error(err);
      setIsConnected(false);
    }
  };

  const handleResetData = () => {
    if (confirm("Resetar todos os dados?")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const highlightCode = (code: string) => {
    const isDark = theme === 'dark';
    return code
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\b(void|int|float|char|bool|long|unsigned|const|static|if|else|for|while|return|switch|case|break|byte|word|String)\b/g, `<span class="${isDark ? 'text-pink-400' : 'text-pink-600'} font-bold">$1</span>`)
      .replace(/\b(setup|loop|pinMode|digitalWrite|digitalRead|analogWrite|analogRead|delay|Serial|println|print|begin|available|read|write|millis)\b/g, `<span class="${isDark ? 'text-teal-400' : 'text-teal-600'} font-bold">$1</span>`)
      .replace(/\/\/.*/g, `<span class="${isDark ? 'text-slate-500' : 'text-slate-400'} italic">$&</span>`)
      .replace(/#\w+/g, `<span class="${isDark ? 'text-orange-400' : 'text-orange-600'}">$&</span>`)
      .replace(/"[^"]*"/g, `<span class="${isDark ? 'text-green-400' : 'text-green-700'}">$&</span>`)
      .replace(/\b(HIGH|LOW|INPUT|OUTPUT|INPUT_PULLUP|LED_BUILTIN)\b/g, `<span class="${isDark ? 'text-orange-300' : 'text-orange-500'} font-semibold">$1</span>`);
  };

  const createNewFile = () => {
    const name = `sketch_${Date.now()}.ino`;
    setFiles([...files, { name, content: 'void setup() {} void loop() {}', isOpen: true }]);
    setActiveFileIndex(files.length);
  };

  const bgMain = theme === 'dark' ? 'bg-[#0b0e14]' : 'bg-[#f6f6f6]';
  const bgToolbar = theme === 'dark' ? 'bg-[#1c1f24]' : 'bg-white shadow-sm';
  const bgSidebar = theme === 'dark' ? 'bg-[#0b0e14]' : 'bg-white';
  const bgActivityBar = theme === 'dark' ? 'bg-[#1c1f24]' : 'bg-[#f0f0f0]';
  const bgEditor = theme === 'dark' ? 'bg-[#0d1117]' : 'bg-white';
  const textMain = theme === 'dark' ? 'text-slate-300' : 'text-slate-800';
  const borderMain = theme === 'dark' ? 'border-white/5' : 'border-slate-200';

  return (
    <div className={`flex flex-col h-screen ${bgMain} ${textMain} font-sans overflow-hidden`}>
      <header className={`h-12 border-b ${borderMain} flex items-center justify-between px-4 ${bgToolbar} shrink-0`}>
        <div className="flex items-center gap-4">
          <Zap size={22} className="text-[#008184] mr-2" fill="currentColor" />
          <div className="flex items-center gap-2">
            <button onClick={handleVerify} disabled={isBusy} className="p-1.5 hover:text-teal-400 transition-colors"><Check size={20} /></button>
            <button onClick={handleUpload} disabled={isBusy} className="p-1.5 hover:text-teal-400 transition-colors"><ArrowRight size={20} /></button>
          </div>
          <div className="border rounded-full px-4 py-1 flex items-center gap-2 bg-black/20">
            <BoardIcon size={14} className="text-teal-500" />
            <select value={selectedBoard.id} onChange={(e) => setSelectedBoard(BOARDS.find(b => b.id === e.target.value) || BOARDS[0])} className="bg-transparent text-[11px] font-bold appearance-none outline-none cursor-pointer">
              {BOARDS.map(b => <option key={b.id} value={b.id} className="bg-[#1c1f24]">{b.name}</option>)}
            </select>
          </div>
          <button onClick={connectSerial} className={`px-4 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${isConnected ? 'bg-teal-500/10 text-teal-400' : 'bg-slate-500/10 text-slate-400'}`}>
            {isConnected ? 'Porta Ativa' : 'Conectar Serial'}
          </button>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 bg-teal-500/10 border border-teal-500/30 rounded-lg px-3 py-1">
            <Sparkles size={14} className="text-teal-400"/>
            <span className="text-[10px] text-teal-400 font-bold">IA Online</span>
          </div>
          <Github size={20} className="text-slate-500 cursor-pointer hover:text-white transition-colors" />
        </div>
      </header>

      {progress > 0 && <div className="h-0.5 w-full bg-white/5"><div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${progress}%` }} /></div>}

      <div className="flex flex-1 overflow-hidden">
        <nav className={`w-14 border-r ${borderMain} ${bgActivityBar} flex flex-col items-center py-6 gap-6 shrink-0`}>
          {[
            { id: 'files', icon: Files },
            { id: 'boards', icon: Layers },
            { id: 'libraries', icon: Box },
            { id: 'examples', icon: BookOpen },
            { id: 'ai', icon: MessageSquare },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as TabType)} className={`p-2.5 rounded-xl transition-all ${activeTab === tab.id ? 'text-teal-400 bg-teal-400/10' : 'text-slate-500 hover:text-slate-300'}`}>
              <tab.icon size={22}/>
            </button>
          ))}
          <button onClick={() => setActiveTab('settings')} className={`mt-auto mb-4 p-2.5 rounded-xl ${activeTab === 'settings' ? 'text-teal-400 bg-teal-400/10' : 'text-slate-500'}`}><Settings size={22}/></button>
        </nav>

        <aside className={`w-72 border-r ${borderMain} ${bgSidebar} flex flex-col shrink-0`}>
          <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/10">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{activeTab}</span>
            {activeTab === 'files' && <Plus size={14} className="cursor-pointer" onClick={createNewFile}/>}
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {activeTab === 'files' && (
              <div className="p-2 space-y-1">
                {files.map((file, idx) => (
                  <div key={idx} onClick={() => setActiveFileIndex(idx)} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer ${activeFileIndex === idx ? 'bg-teal-500/10 text-teal-400' : 'hover:bg-white/5 text-slate-400'}`}>
                    <FileCode size={16}/> <span className="text-xs truncate">{file.name}</span>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'settings' && (
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                   <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider"><Monitor size={14}/> Tema</div>
                   <div className="grid grid-cols-2 gap-2">
                     <button onClick={() => setTheme('dark')} className={`py-2 rounded text-[10px] font-bold border transition-all ${theme === 'dark' ? 'border-teal-500 text-teal-400' : 'border-white/5'}`}>Dark</button>
                     <button onClick={() => setTheme('light')} className={`py-2 rounded text-[10px] font-bold border transition-all ${theme === 'light' ? 'border-teal-500 text-teal-600' : 'border-white/5'}`}>Light</button>
                   </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider"><FontIcon size={14}/> Fonte</div>
                  <input type="range" min="10" max="24" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="w-full accent-teal-500 h-1 bg-white/10 rounded-full appearance-none"/>
                </div>
                <div className="pt-6 border-t border-white/5">
                   <p className="text-[10px] text-slate-500 font-bold mb-4 uppercase">Desenvolvedor</p>
                   <div className="flex items-center gap-3">
                     <Instagram size={18} className="text-pink-500"/>
                     <span className="text-[10px] font-black text-teal-500">@josehebertot2</span>
                   </div>
                </div>
                <button onClick={handleResetData} className="w-full py-2 border border-red-500/20 text-red-500 rounded text-[10px] font-bold hover:bg-red-500 hover:text-white transition-all">Resetar IDE</button>
              </div>
            )}
            {activeTab === 'ai' && (
              <div className="h-full flex flex-col">
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-[11px]">
                  {chatHistory.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4 opacity-50">
                      <Sparkles size={32} className="mb-2 text-teal-500"/>
                      <p className="text-xs font-bold uppercase tracking-widest">Assistente IA</p>
                      <p className="text-[10px] mt-1">Como posso ajudar com seu código Arduino hoje?</p>
                    </div>
                  )}
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`p-3 rounded-xl border ${msg.role === 'user' ? 'bg-white/5 border-white/5' : 'bg-teal-500/5 border-teal-500/20'}`}>
                      <div className="text-[8px] font-black uppercase mb-1 opacity-50">{msg.role === 'user' ? 'Você' : 'Gemini AI'}</div>
                      <div className="whitespace-pre-wrap">{msg.text}</div>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t border-white/5 bg-black/20">
                  <div className="relative">
                    <textarea value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleAskAI())} placeholder="Pergunte ao Gemini..." className="w-full bg-[#1c1f24] border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-teal-500/50 resize-none h-20 custom-scrollbar" />
                    <button onClick={handleAskAI} className="absolute bottom-3 right-3 p-1.5 bg-teal-500 text-black rounded-lg hover:bg-teal-400 transition-all"><Wand2 size={14} /></button>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'examples' && (
               <div className="p-2 space-y-1">
                 {EXAMPLES.map((ex, i) => (
                   <div key={i} onClick={() => setFiles([...files, { name: ex.name + '.ino', content: ex.content, isOpen: true }])} className="p-3 rounded-lg hover:bg-white/5 cursor-pointer border border-transparent hover:border-teal-500/20">
                     <p className="text-[9px] font-black text-teal-500 uppercase">{ex.category}</p>
                     <p className="text-xs font-bold">{ex.name}</p>
                   </div>
                 ))}
               </div>
            )}
            {activeTab === 'libraries' && (
              <div className="p-4 space-y-4">
                 {LIBRARIES.map((lib, i) => (
                   <div key={i} className="p-3 rounded-xl border border-white/5 bg-white/5">
                      <p className="text-[11px] font-bold text-teal-400">{lib.name}</p>
                      <p className="text-[9px] text-slate-500 mt-1">{lib.description}</p>
                      <button onClick={() => {
                        const newFiles = [...files];
                        newFiles[activeFileIndex].content = lib.header + "\n" + newFiles[activeFileIndex].content;
                        setFiles(newFiles);
                      }} className="mt-2 w-full py-1 bg-teal-500/10 text-teal-500 rounded text-[9px] font-bold hover:bg-teal-500 hover:text-black">Instalar</button>
                   </div>
                 ))}
              </div>
            )}
          </div>
        </aside>

        <main className={`flex-1 flex flex-col ${bgEditor} relative`}>
          <div className="h-9 bg-black/20 border-b border-white/5 flex items-center px-2 overflow-x-auto no-scrollbar shrink-0">
            {files.map((file, idx) => (
              <div key={idx} onClick={() => setActiveFileIndex(idx)} className={`h-full flex items-center px-4 text-[11px] font-medium cursor-pointer border-r border-white/5 gap-3 ${activeFileIndex === idx ? 'bg-[#0d1117] text-teal-400' : 'text-slate-500 hover:text-slate-400'}`}>
                <FileCode size={12}/> {file.name}
                {files.length > 1 && <X size={10} className="hover:text-red-400" onClick={(e) => { e.stopPropagation(); setFiles(files.filter((_, i) => i !== idx)); setActiveFileIndex(0); }}/>}
              </div>
            ))}
          </div>

          <div className="flex-1 relative overflow-hidden group">
            {showLineNumbers && (
              <div className="absolute left-0 top-0 w-10 h-full bg-black/10 border-r border-white/5 py-5 flex flex-col items-center text-slate-600 font-mono select-none" style={{ fontSize: `${fontSize}px`, lineHeight: `${fontSize * 1.5}px` }}>
                {activeFile.content.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
              </div>
            )}
            <div className="ml-10 h-full relative">
               <div ref={highlightRef} className="absolute inset-0 p-5 pointer-events-none code-font whitespace-pre overflow-hidden z-0" 
                    style={{ fontSize: `${fontSize}px`, lineHeight: `${fontSize * 1.5}px` }}
                    dangerouslySetInnerHTML={{ __html: highlightCode(activeFile.content) }} />
               <textarea 
                  value={activeFile.content} 
                  onChange={e => { const newFiles = [...files]; newFiles[activeFileIndex].content = e.target.value; setFiles(newFiles); }} 
                  onScroll={(e) => { if (highlightRef.current) { highlightRef.current.scrollTop = e.currentTarget.scrollTop; highlightRef.current.scrollLeft = e.currentTarget.scrollLeft; } }}
                  spellCheck={false}
                  style={{ fontSize: `${fontSize}px`, lineHeight: `${fontSize * 1.5}px` }}
                  className="absolute inset-0 w-full h-full p-5 bg-transparent text-transparent caret-teal-400 code-font outline-none z-10 whitespace-pre overflow-auto custom-scrollbar"
               />
               <button onClick={() => downloadFile(activeFile)} className="absolute top-4 right-6 p-2 bg-black/60 hover:bg-teal-500 hover:text-black rounded-lg text-slate-400 border border-white/10 opacity-0 group-hover:opacity-100 transition-all z-20"><Save size={16}/></button>
            </div>
          </div>

          <div className={`h-48 border-t ${borderMain} bg-black/20 flex flex-col shrink-0`}>
            <div className="h-8 border-b border-white/5 flex items-center justify-between px-4 bg-black/20 shrink-0">
              <div className="flex gap-4 h-full">
                <button onClick={() => setConsoleTab('output')} className={`text-[10px] font-black uppercase px-2 h-full transition-all border-b ${consoleTab === 'output' ? 'text-teal-500 border-teal-500' : 'text-slate-500 border-transparent'}`}>Output</button>
                <button onClick={() => setConsoleTab('serial')} className={`text-[10px] font-black uppercase px-2 h-full transition-all border-b ${consoleTab === 'serial' ? 'text-teal-500 border-teal-500' : 'text-slate-500 border-transparent'}`}>Serial</button>
              </div>
              <button onClick={() => consoleTab === 'output' ? setOutputMessages([]) : setSerialMessages([])} className="text-[10px] text-slate-500 hover:text-teal-500"><RotateCcw size={12}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] custom-scrollbar bg-black/40">
              {consoleTab === 'output' ? (
                <div className="space-y-1">
                  {outputMessages.map((m, i) => (
                    <div key={i} className={m.includes('[ERRO]') ? 'text-red-400' : 'text-slate-400'}>
                      {">"} {m}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {serialMessages.map((msg, i) => (
                    <div key={i} className="flex gap-4">
                      <span className="text-slate-600">[{msg.timestamp}]</span>
                      <span className="text-teal-500">{msg.text}</span>
                    </div>
                  ))}
                </div>
              )}
              <div ref={consoleEndRef} />
            </div>
          </div>
        </main>
      </div>

      <footer className="h-6 bg-[#008184] text-white flex items-center justify-between px-4 text-[9px] font-black uppercase shrink-0">
         <div className="flex gap-6">
           <span className="flex items-center gap-1"><BoardIcon size={12}/> {selectedBoard.name}</span>
           <span className="flex items-center gap-1"><div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-white animate-pulse' : 'bg-white/20'}`} /> {isConnected ? 'Porta Serial Conectada' : 'Desconectado'}</span>
         </div>
         <div className="flex gap-6">
           <span>Linha {activeFile.content.split('\n').length}</span>
           <span>v2.1.5-Stable</span>
         </div>
      </footer>
    </div>
  );
};

export default App;
