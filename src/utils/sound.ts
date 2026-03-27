import { invoke } from '@tauri-apps/api/core';
import type { SoundChoice } from '../store/timerStore';

export const playSound = async (sound: SoundChoice): Promise<void> => {
  try {
    await invoke('play_sound', { soundName: sound });
  } catch (e) {
    console.error('[Sound] Error:', e);
  }
};