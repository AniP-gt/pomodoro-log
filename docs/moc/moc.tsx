import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Settings as SettingsIcon, 
  FileText, 
  CheckCircle2,
  Brain,
  Save,
  FolderOpen
} from 'lucide-react';

const App = () => {
  // --- States ---
  const [phase, setPhase] = useState('work'); // 'work', 'shortBreak', 'longBreak'
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [workCount, setWorkCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  // --- Configuration ---
  const [config, setConfig] = useState({
    workTime: 25,
    shortBreakTime: 5,
    longBreakTime: 15,
    longBreakInterval: 4,
    baseDirectory: '/Users/user/Documents/PomodoroLogs', // 基点となるディレクトリ
    logCommentTemplate: '- {time}min | {comment}',
    autoStartNext: false
  });

  const [currentComment, setCurrentComment] = useState("");

  // --- Helper: Generate Dynamic Path ---
  const getDynamicPath = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    
    // パス区切り文字はOSに合わせてRust側で処理するのが理想的ですが、
    // ここでは表示用に macOS/Linux 形式で構築します
    const base = config.baseDirectory.endsWith('/') ? config.baseDirectory : config.baseDirectory + '/';
    return `${base}${yyyy}/${mm}/${yyyy}-${mm}-${dd}.md`;
  };

  // --- Timer Logic ---
  useEffect(() => {
    let timer = null;
    if (isActive && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      handlePhaseEnd();
    }
    return () => clearInterval(timer);
  }, [isActive, timeLeft]);

  const handlePhaseEnd = () => {
    setIsActive(false);
    
    const finalPath = getDynamicPath();
    const finalComment = config.logCommentTemplate
      .replace('{time}', (getInitialTime(phase) / 60).toString())
      .replace('{comment}', currentComment || "集中セッション");
    
    // TauriのAPIを呼び出す想定 (実際は invoke("save_log", { path: finalPath, content: finalComment }))
    console.log(`Saving to: ${finalPath}`);
    console.log(`Content: ${finalComment}`);
    
    alert(`セッション終了!\n保存先: ${finalPath}\n内容: ${finalComment}`);

    if (phase === 'work') {
      const nextCount = workCount + 1;
      setWorkCount(nextCount);
      if (nextCount % config.longBreakInterval === 0) {
        switchPhase('longBreak');
      } else {
        switchPhase('shortBreak');
      }
    } else {
      switchPhase('work');
    }
    setCurrentComment("");
  };

  const switchPhase = (newPhase) => {
    setPhase(newPhase);
    setTimeLeft(getInitialTime(newPhase));
  };

  const getInitialTime = (p) => {
    if (p === 'work') return config.workTime * 60;
    if (p === 'shortBreak') return config.shortBreakTime * 60;
    if (p === 'longBreak') return config.longBreakTime * 60;
    return 25 * 60;
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(getInitialTime(phase));
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 p-6 font-sans">
      {/* Header */}
      <div className="max-w-md mx-auto flex justify-between items-center mb-8">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
            <Brain size={20} className="text-white" />
          </div>
          <h1 className="text-xl font-black tracking-tight italic">POMO<span className="text-indigo-500">LOG</span></h1>
        </div>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2 rounded-full transition-all ${showSettings ? 'bg-indigo-600 text-white rotate-90' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
        >
          <SettingsIcon size={20} />
        </button>
      </div>

      <div className="max-w-md mx-auto bg-slate-800/50 backdrop-blur-xl rounded-[2.5rem] p-10 shadow-2xl border border-slate-700/50 relative overflow-hidden">
        {!showSettings ? (
          <div className="flex flex-col items-center relative z-10">
            {/* Phase Indicator */}
            <div className="flex gap-2 mb-6 bg-slate-900/50 p-1.5 rounded-full border border-slate-700/30">
              {['work', 'shortBreak', 'longBreak'].map((p) => (
                <button
                  key={p}
                  onClick={() => switchPhase(p)}
                  className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                    phase === p 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' 
                    : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {p === 'work' ? 'Work' : p === 'shortBreak' ? 'Short' : 'Long'}
                </button>
              ))}
            </div>

            {/* Timer Display */}
            <div className="relative mb-10 group">
                <div className="absolute -inset-4 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all"></div>
                <div className="text-[100px] font-black leading-none tabular-nums tracking-tighter text-white relative">
                  {formatTime(timeLeft)}
                </div>
            </div>

            {/* Main Controls */}
            <div className="flex items-center gap-6 mb-10">
              <button 
                onClick={resetTimer}
                className="p-4 bg-slate-700/50 hover:bg-slate-700 rounded-2xl text-slate-300 transition-all hover:scale-105 active:scale-95"
              >
                <RotateCcw size={24} />
              </button>
              
              <button 
                onClick={() => setIsActive(!isActive)}
                className={`w-24 h-24 rounded-[2rem] flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-2xl ${
                  isActive 
                  ? 'bg-slate-100 text-slate-900' 
                  : 'bg-indigo-600 text-white shadow-indigo-500/40'
                }`}
              >
                {isActive ? <Pause size={40} fill="currentColor" /> : <Play size={40} fill="currentColor" className="ml-2" />}
              </button>

              <div className="p-4 bg-slate-700/50 rounded-2xl text-indigo-400 font-mono font-bold">
                #{workCount + 1}
              </div>
            </div>

            {/* Log Input */}
            <div className="w-full bg-slate-900/60 rounded-3xl p-5 border border-slate-700/50 group focus-within:border-indigo-500/50 transition-all">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <FileText size={12} className="text-indigo-500" />
                  Next Log Entry
                </span>
                <span className="text-[9px] text-slate-600 font-mono truncate max-w-[150px]">
                  {getDynamicPath().split('/').pop()}
                </span>
              </div>
              <textarea 
                value={currentComment}
                onChange={(e) => setCurrentComment(e.target.value)}
                placeholder="現在の作業内容をメモ..."
                className="w-full bg-transparent text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none h-20 resize-none"
              />
            </div>
          </div>
        ) : (
          /* Settings View */
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold border-b border-slate-700 pb-4 flex justify-between items-center">
              Configuration
              <span className="text-[10px] font-normal text-slate-500 bg-slate-900 px-2 py-1 rounded">v1.0.0</span>
            </h2>
            
            <div className="space-y-5 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {/* Intervals */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Work', key: 'workTime' },
                  { label: 'Short', key: 'shortBreakTime' },
                  { label: 'Long', key: 'longBreakTime' }
                ].map(item => (
                  <div key={item.key} className="bg-slate-900/50 p-3 rounded-2xl border border-slate-700/30 text-center">
                    <label className="text-[9px] uppercase font-black text-slate-500 block mb-1">{item.label}</label>
                    <input 
                      type="number" 
                      value={config[item.key]} 
                      onChange={(e) => setConfig({...config, [item.key]: parseInt(e.target.value)})}
                      className="w-full bg-transparent text-center font-bold text-indigo-400 focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              {/* Long Break Interval */}
              <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/30">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] uppercase font-black text-slate-500">Long Break Interval</label>
                  <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2 rounded">Every {config.longBreakInterval} sessions</span>
                </div>
                <input 
                  type="range" min="1" max="10" 
                  value={config.longBreakInterval} 
                  onChange={(e) => setConfig({...config, longBreakInterval: parseInt(e.target.value)})}
                  className="w-full accent-indigo-500 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Base Directory */}
              <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/30">
                <label className="text-[10px] uppercase font-black text-slate-500 block mb-2">Base Log Directory</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={config.baseDirectory} 
                    onChange={(e) => setConfig({...config, baseDirectory: e.target.value})}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs font-mono text-slate-300 focus:border-indigo-500 outline-none"
                  />
                  <button className="p-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl transition-colors">
                    <FolderOpen size={16} />
                  </button>
                </div>
                <div className="mt-3 p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl">
                  <p className="text-[9px] text-indigo-400 font-bold mb-1 uppercase tracking-tighter">Preview Path:</p>
                  <p className="text-[10px] font-mono text-slate-400 break-all">{getDynamicPath()}</p>
                </div>
              </div>

              {/* Log Template */}
              <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/30">
                <label className="text-[10px] uppercase font-black text-slate-500 block mb-2">Log Line Template</label>
                <input 
                  type="text" 
                  value={config.logCommentTemplate} 
                  onChange={(e) => setConfig({...config, logCommentTemplate: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-300 focus:border-indigo-500 outline-none"
                />
                <p className="text-[9px] text-slate-500 mt-2 italic">Available: {'{time}'}, {'{comment}'}</p>
              </div>
            </div>

            <button 
              onClick={() => {
                setShowSettings(false);
                resetTimer();
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-indigo-500/20 active:scale-95"
            >
              <Save size={18} />
              Save Configuration
            </button>
          </div>
        )}
      </div>

      {/* Footer Status */}
      <div className="max-w-md mx-auto mt-8 flex justify-between items-center px-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">System Tray Active</span>
        </div>
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700/50">
          Target: macOS Sonoma+
        </div>
      </div>
    </div>
  );
};

export default App;
