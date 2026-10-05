// soundService.ts — Custom Device Tones & High-Fidelity Synthesized Alarm Audio
// Supports:
// 1. Uploading & storing custom audio from the user's device (IndexedDB/localStorage)
// 2. Multiple synthesized alarm tones (Digital Alarm, Gentle Chime, Radar Pulse, Marimba)
// 3. Looping alarm player that rings until user stops or snoozes

import { db } from '../db/db';

export type AlarmToneType = 'chime' | 'digital' | 'radar' | 'marimba' | 'custom';

const activeAudioElements = new Set<HTMLAudioElement>();
const activeAudioContexts = new Set<AudioContext>();
let currentAudioElement: HTMLAudioElement | null = null;
let currentLoopInterval: ReturnType<typeof setInterval> | null = null;

// Get the user's configured alarm tone
export async function getConfiguredAlarmTone(): Promise<{ tone: AlarmToneType; customDataUrl?: string; customName?: string }> {
  try {
    const settings = await db.settings.get('current_settings');
    const customDataUrl = localStorage.getItem('custom_reminder_tone_data');
    const customName = localStorage.getItem('custom_reminder_tone_name');
    return {
      tone: ((settings as any)?.reminderTone || (customDataUrl ? 'custom' : 'digital')) as AlarmToneType,
      customDataUrl: customDataUrl || undefined,
      customName: customName || undefined
    };
  } catch {
    return { tone: 'digital' };
  }
}

// Save custom device audio file (base64 Data URL)
export async function saveCustomDeviceTone(file: File): Promise<{ dataUrl: string; name: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string;
        localStorage.setItem('custom_reminder_tone_data', dataUrl);
        localStorage.setItem('custom_reminder_tone_name', file.name);
        await db.settings.update('current_settings', { reminderTone: 'custom' as any });
        resolve({ dataUrl, name: file.name });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Web Audio synthesizer for built-in alarm tones
function playSynthesizedTone(tone: AlarmToneType): AudioContext | null {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    const ctx = new AudioCtx();
    activeAudioContexts.add(ctx);
    const now = ctx.currentTime;

    let maxDuration = 1.0;

    if (tone === 'digital') {
      maxDuration = 0.5;
      // Classic loud digital alarm: 3 quick high-pitch beeps
      [0, 0.15, 0.3].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now + offset); // A5
        gain.gain.setValueAtTime(0.2, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.1);
      });
    } else if (tone === 'radar') {
      maxDuration = 0.45;
      // Modern radar pulse
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.35);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (tone === 'marimba') {
      maxDuration = 0.65;
      // Marimba arpeggio (C5 - E5 - G5 - C6)
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.2, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.25);
      });
    } else {
      maxDuration = 0.9;
      // Gentle chime default (D5 -> A5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.5);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.12);
      gain2.gain.setValueAtTime(0.18, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.8);
    }

    // Auto-cleanup context after sound completes if not already stopped
    setTimeout(() => {
      if (activeAudioContexts.has(ctx)) {
        activeAudioContexts.delete(ctx);
        try {
          if (ctx.state !== 'closed') ctx.close();
        } catch {}
      }
    }, (maxDuration + 0.2) * 1000);

    return ctx;
  } catch (err) {
    console.warn('Synthesizer audio playback note:', err);
    return null;
  }
}

// Play single tone once (for testing / previewing)
export async function testAlarmSound(requestedTone?: AlarmToneType): Promise<void> {
  const config = await getConfiguredAlarmTone();
  const tone = requestedTone || config.tone;

  if (tone === 'custom' && config.customDataUrl) {
    try {
      const audio = new Audio(config.customDataUrl);
      audio.volume = 0.9;
      activeAudioElements.add(audio);
      audio.onended = () => activeAudioElements.delete(audio);
      audio.onerror = () => activeAudioElements.delete(audio);
      await audio.play();
    } catch {
      playSynthesizedTone('digital');
    }
  } else {
    playSynthesizedTone(tone);
  }
}

// Start repeating alarm sound until stopped
export async function startAlarmRinging(requestedTone?: AlarmToneType): Promise<void> {
  stopAlarmRinging(); // Stop any previous sound immediately

  const config = await getConfiguredAlarmTone();
  const tone = requestedTone || config.tone;

  if (tone === 'custom' && config.customDataUrl) {
    try {
      currentAudioElement = new Audio(config.customDataUrl);
      currentAudioElement.loop = true;
      currentAudioElement.volume = 1.0;
      activeAudioElements.add(currentAudioElement);
      currentAudioElement.onended = () => {
        if (currentAudioElement) activeAudioElements.delete(currentAudioElement);
      };
      await currentAudioElement.play();
      return;
    } catch {
      // Fallback to synthesized digital alarm if autoplay blocks audio file
    }
  }

  // Play immediately once
  playSynthesizedTone(tone);

  // Repeat every 1.6 seconds like a real alarm clock
  currentLoopInterval = setInterval(() => {
    playSynthesizedTone(tone);
  }, 1600);
}

// Stop the currently ringing alarm immediately and completely
export function stopAlarmRinging(): void {
  // 1. Clear repeating loop timer
  if (currentLoopInterval) {
    clearInterval(currentLoopInterval);
    currentLoopInterval = null;
  }

  // 2. Pause and reset all active audio elements
  activeAudioElements.forEach((audio) => {
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.src = '';
    } catch {}
  });
  activeAudioElements.clear();
  currentAudioElement = null;

  // 3. Immediately close and destroy all running Web Audio contexts
  activeAudioContexts.forEach((ctx) => {
    try {
      if (ctx.state !== 'closed') {
        ctx.close();
      }
    } catch {}
  });
  activeAudioContexts.clear();
}
