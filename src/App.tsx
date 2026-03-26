import { useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import {
  Play,
  Pause,
  RotateCcw,
  Settings as SettingsIcon,
  FileText,
  Brain,
  Save,
  FolderOpen,
} from 'lucide-react';
import {
  useTimerStore,
  getDynamicPath,
  formatTime,
  getInitialTimeFn,
  TimerPhase,
} from './store/timerStore';

const App = () => {
  const {
    phase,
    timeLeft,
    isActive,
    workCount,
    showSettings,
    config,
    currentComment,
    sessionStartTime,
    setIsActive,
    setWorkCount,
    setShowSettings,
    setConfig,
    setCurrentComment,
    tick,
    reset,
    toggleTimer,
    switchPhase,
  } = useTimerStore();

  const currentPath = getDynamicPath(config.baseDirectory);

  const handlePhaseEnd = useCallback(async () => {
    setIsActive(false);

    const duration = getInitialTimeFn(phase, config) / 60;
    const comment = config.logCommentTemplate
      .replace('{time}', duration.toString())
      .replace('{comment}', currentComment || '集中セッション');

    const startTimeStr = sessionStartTime
      ? sessionStartTime.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    try {
      await invoke('save_log', {
        path: currentPath,
        content: comment,
        startTime: startTimeStr,
      });
    } catch (e) {
      console.error('Failed to save log:', e);
    }

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
    setCurrentComment('');
  }, [phase, config, currentComment, currentPath, sessionStartTime, workCount, config.longBreakInterval, setIsActive, setWorkCount, switchPhase, setCurrentComment]);

  useEffect(() => {
    let timer: number | null = null;
    if (isActive && timeLeft > 0) {
      timer = window.setInterval(() => {
        tick();
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      handlePhaseEnd();
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isActive, timeLeft, tick, handlePhaseEnd]);

  useEffect(() => {
    const updateTray = async () => {
      const timeStr = formatTime(timeLeft);
      const phaseStr = phase === 'work' ? 'W' : phase === 'shortBreak' ? 'SB' : 'LB';
      try {
        await invoke('update_tray_title', { title: `[${timeStr}] ${phaseStr}` });
      } catch (e) {
        console.error('Failed to update tray:', e);
      }
    };
    updateTray();
  }, [timeLeft, phase]);

  useEffect(() => {
    const unlisten = listen<string>('tray-action', (event) => {
      switch (event.payload) {
        case 'start':
          if (!isActive) toggleTimer();
          break;
        case 'pause':
          if (isActive) toggleTimer();
          break;
        case 'reset':
          reset();
          break;
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [isActive, toggleTimer, reset]);

  const handleSelectDirectory = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Select Log Directory',
    });
    if (selected && typeof selected === 'string') {
      setConfig({ baseDirectory: selected });
    }
  };

  const handleResetTimer = () => {
    reset();
  };

  const handleSwitchPhase = (p: TimerPhase) => {
    switchPhase(p);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 p-6 font-sans">
      <div className="max-w-md mx-auto flex justify-between items-center mb-8">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
            <Brain size={20} className="text-white" />
          </div>
          <h1 className="text-xl font-black tracking-tight italic">POMO<span className="text-indigo-500">LOG</span></h1>
        </div>
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2 rounded-full transition-all ${showSettings ? 'bg-indigo-600 text-white rotate-90' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
        >
          <SettingsIcon size={20} />
        </button>
      </div>

      <div className="max-w-md mx-auto bg-slate-800/50 backdrop-blur-xl rounded-[2.5rem] p-10 shadow-2xl border border-slate-700/50 relative overflow-hidden">
        {!showSettings ? (
          <div className="flex flex-col items-center relative z-10">
            <div className="flex gap-2 mb-6 bg-slate-900/50 p-1.5 rounded-full border border-slate-700/30">
              {(['work', 'shortBreak', 'longBreak'] as TimerPhase[]).map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => handleSwitchPhase(p)}
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

            <div className="relative mb-10 group">
              <div className="absolute -inset-4 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all"></div>
              <div className="text-[100px] font-black leading-none tabular-nums tracking-tighter text-white relative">
                {formatTime(timeLeft)}
              </div>
            </div>

            <div className="flex items-center gap-6 mb-10">
              <button
                type="button"
                onClick={handleResetTimer}
                className="p-4 bg-slate-700/50 hover:bg-slate-700 rounded-2xl text-slate-300 transition-all hover:scale-105 active:scale-95"
              >
                <RotateCcw size={24} />
              </button>

              <button
                type="button"
                onClick={toggleTimer}
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

            <div className="w-full bg-slate-900/60 rounded-3xl p-5 border border-slate-700/50 group focus-within:border-indigo-500/50 transition-all">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <FileText size={12} className="text-indigo-500" />
                  Next Log Entry
                </span>
                <span className="text-[9px] text-slate-600 font-mono truncate max-w-[150px]">
                  {currentPath.split('/').pop()}
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
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold border-b border-slate-700 pb-4 flex justify-between items-center">
              Configuration
              <span className="text-[10px] font-normal text-slate-500 bg-slate-900 px-2 py-1 rounded">v1.0.0</span>
            </h2>

            <div className="space-y-5 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Work', key: 'workTime' as const },
                  { label: 'Short', key: 'shortBreakTime' as const },
                  { label: 'Long', key: 'longBreakTime' as const },
                ].map((item) => (
                  <div key={item.key} className="bg-slate-900/50 p-3 rounded-2xl border border-slate-700/30 text-center">
                    <label htmlFor={item.key} className="text-[9px] uppercase font-black text-slate-500 block mb-1">{item.label}</label>
                    <input
                      id={item.key}
                      type="number"
                      value={config[item.key]}
                      onChange={(e) => setConfig({ [item.key]: parseInt(e.target.value) || 1 })}
                      className="w-full bg-transparent text-center font-bold text-indigo-400 focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/30">
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="longBreakInterval" className="text-[10px] uppercase font-black text-slate-500">Long Break Interval</label>
                  <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2 rounded">Every {config.longBreakInterval} sessions</span>
                </div>
                <input
                  id="longBreakInterval"
                  type="range"
                  min="1"
                  max="10"
                  value={config.longBreakInterval}
                  onChange={(e) => setConfig({ longBreakInterval: parseInt(e.target.value) })}
                  className="w-full accent-indigo-500 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/30">
                <label htmlFor="baseDirectory" className="text-[10px] uppercase font-black text-slate-500 block mb-2">Base Log Directory</label>
                <div className="flex gap-2">
                  <input
                    id="baseDirectory"
                    type="text"
                    value={config.baseDirectory}
                    onChange={(e) => setConfig({ baseDirectory: e.target.value })}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs font-mono text-slate-300 focus:border-indigo-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSelectDirectory}
                    className="p-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl transition-colors"
                  >
                    <FolderOpen size={16} />
                  </button>
                </div>
                <div className="mt-3 p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl">
                  <p className="text-[9px] text-indigo-400 font-bold mb-1 uppercase tracking-tighter">Preview Path:</p>
                  <p className="text-[10px] font-mono text-slate-400 break-all">{currentPath}</p>
                </div>
              </div>

              <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/30">
                <label htmlFor="logCommentTemplate" className="text-[10px] uppercase font-black text-slate-500 block mb-2">Log Line Template</label>
                <input
                  id="logCommentTemplate"
                  type="text"
                  value={config.logCommentTemplate}
                  onChange={(e) => setConfig({ logCommentTemplate: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-300 focus:border-indigo-500 outline-none"
                />
                <p className="text-[9px] text-slate-500 mt-2 italic">Available: {'{time}'}, {'{comment}'}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowSettings(false);
                reset();
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-indigo-500/20 active:scale-95"
            >
              <Save size={18} />
              Save Configuration
            </button>
          </div>
        )}
      </div>

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
