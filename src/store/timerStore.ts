import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TimerPhase = 'work' | 'shortBreak' | 'longBreak';

interface TimerConfig {
  workTime: number;
  shortBreakTime: number;
  longBreakTime: number;
  longBreakInterval: number;
  baseDirectory: string;
  logCommentTemplate: string;
  autoStartNext: boolean;
}

interface TimerState {
  phase: TimerPhase;
  timeLeft: number;
  isActive: boolean;
  workCount: number;
  showSettings: boolean;
  config: TimerConfig;
  currentComment: string;
  sessionStartTime: Date | null;
}

interface TimerActions {
  setPhase: (phase: TimerPhase) => void;
  setTimeLeft: (time: number) => void;
  setIsActive: (active: boolean) => void;
  setWorkCount: (count: number) => void;
  setShowSettings: (show: boolean) => void;
  setConfig: (config: Partial<TimerConfig>) => void;
  setCurrentComment: (comment: string) => void;
  setSessionStartTime: (time: Date | null) => void;
  tick: () => void;
  reset: () => void;
  toggleTimer: () => void;
  switchPhase: (phase: TimerPhase) => void;
}

const getInitialTime = (phase: TimerPhase, config: TimerConfig): number => {
  switch (phase) {
    case 'work':
      return config.workTime * 60;
    case 'shortBreak':
      return config.shortBreakTime * 60;
    case 'longBreak':
      return config.longBreakTime * 60;
    default:
      return 25 * 60;
  }
};

export const useTimerStore = create<TimerState & TimerActions>()(
  persist(
    (set, get) => ({
      phase: 'work',
      timeLeft: 25 * 60,
      isActive: false,
      workCount: 0,
      showSettings: false,
      currentComment: '',
      sessionStartTime: null,

      config: {
        workTime: 25,
        shortBreakTime: 5,
        longBreakTime: 15,
        longBreakInterval: 4,
        baseDirectory: '/Users/user/Documents/PomodoroLogs',
        logCommentTemplate: '- {time}min | {comment}',
        autoStartNext: false,
      },

      setPhase: (phase) => set({ phase }),
      setTimeLeft: (timeLeft) => set({ timeLeft }),
      setIsActive: (isActive) => set({ isActive }),
      setWorkCount: (workCount) => set({ workCount }),
      setShowSettings: (showSettings) => set({ showSettings }),
      setConfig: (newConfig) =>
        set((state) => ({
          config: { ...state.config, ...newConfig },
        })),
      setCurrentComment: (currentComment) => set({ currentComment }),
      setSessionStartTime: (sessionStartTime) => set({ sessionStartTime }),

      tick: () => {
        const { timeLeft, isActive } = get();
        if (isActive && timeLeft > 0) {
          set({ timeLeft: timeLeft - 1 });
        }
      },

      reset: () => {
        const { phase, config } = get();
        set({
          isActive: false,
          timeLeft: getInitialTime(phase, config),
          sessionStartTime: null,
        });
      },

      toggleTimer: () => {
        const { isActive, sessionStartTime } = get();
        if (!isActive && !sessionStartTime) {
          set({ sessionStartTime: new Date() });
        }
        set({ isActive: !isActive });
      },

      switchPhase: (newPhase) => {
        const { config } = get();
        set({
          phase: newPhase,
          timeLeft: getInitialTime(newPhase, config),
          isActive: false,
          sessionStartTime: null,
        });
      },
    }),
    {
      name: 'pomodoro-log-storage',
      partialize: (state) => ({ config: state.config }),
    }
  )
);

export const getDynamicPath = (baseDirectory: string): string => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  const base = baseDirectory.endsWith('/') ? baseDirectory : baseDirectory + '/';
  return `${base}${yyyy}/${mm}/${yyyy}-${mm}-${dd}.md`;
};

export const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const getInitialTimeFn = (phase: TimerPhase, config: TimerConfig): number => {
  switch (phase) {
    case 'work':
      return config.workTime * 60;
    case 'shortBreak':
      return config.shortBreakTime * 60;
    case 'longBreak':
      return config.longBreakTime * 60;
    default:
      return 25 * 60;
  }
};
