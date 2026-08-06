type AlarmType = "restaurant" | "driver";

let audioContext: AudioContext | null = null;
let alarmInterval: ReturnType<typeof setInterval> | null = null;
let currentAlarm: AlarmType | null = null;

function getAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextClass =
    window.AudioContext ||
    (
      window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  return audioContext;
}

async function ensureAudioReady() {
  const context = getAudioContext();

  if (!context) {
    throw new Error("O navegador não suporta notificações sonoras.");
  }

  if (context.state === "suspended") {
    await context.resume();
  }

  return context;
}

function playTone(
  frequency: number,
  duration: number,
  delay = 0,
  volume = 0.35
) {
  const context = getAudioContext();

  if (!context || context.state !== "running") {
    return;
  }

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const startTime = context.currentTime + delay;
  const endTime = startTime + duration;

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startTime);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(
    volume,
    startTime + 0.02
  );
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    endTime
  );

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start(startTime);
  oscillator.stop(endTime);
}

function playRestaurantPattern() {
  playTone(880, 0.3, 0);
  playTone(1100, 0.3, 0.38);
  playTone(880, 0.3, 0.76);
}

function playDriverPattern() {
  playTone(660, 0.25, 0);
  playTone(880, 0.25, 0.32);
  playTone(1100, 0.35, 0.64);
}

export async function unlockNotificationAudio() {
  const context = await ensureAudioReady();

  playTone(880, 0.18);

  return context.state === "running";
}

export function startNotificationAlarm(type: AlarmType) {
  if (currentAlarm === type && alarmInterval) {
    return;
  }

  stopNotificationAlarm();

  currentAlarm = type;

  const playPattern =
    type === "restaurant"
      ? playRestaurantPattern
      : playDriverPattern;

  playPattern();

  alarmInterval = setInterval(playPattern, 2800);
}

export function stopNotificationAlarm() {
  if (alarmInterval) {
    clearInterval(alarmInterval);
  }

  alarmInterval = null;
  currentAlarm = null;
}
