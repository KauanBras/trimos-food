type AlarmType = "restaurant" | "driver";

const RESTAURANT_ALARM_INTERVAL_MS = 3000;
const RESTAURANT_ALARM_VOLUME = 0.65;
const RESTAURANT_OGG_URL = "/sounds/new-order.ogg";
const RESTAURANT_WAV_URL = "/sounds/new-order.wav";

let audioContext: AudioContext | null = null;
let restaurantAudio: HTMLAudioElement | null = null;
let restaurantAudioUnlocked = false;
let alarmInterval: ReturnType<typeof setInterval> | null = null;
let currentAlarm: AlarmType | null = null;
let unlockInFlight: Promise<boolean> | null = null;
const activeAlarmOscillators = new Set<OscillatorNode>();

function getRestaurantAudio() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!restaurantAudio) {
    const audio = new Audio();

    audio.src = RESTAURANT_WAV_URL;
    audio.preload = "auto";
    audio.volume = RESTAURANT_ALARM_VOLUME;
    audio.loop = true;
    audio.setAttribute("playsinline", "");
    audio.load();
    restaurantAudio = audio;
  }

  return restaurantAudio;
}

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

  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioContextClass();
  }

  return audioContext;
}

async function ensureAudioReady() {
  const context = getAudioContext();

  if (!context) {
    throw new Error("O navegador não suporta notificações sonoras.");
  }

  if (context.state !== "running") {
    await context.resume();
  }

  if (context.state !== "running") {
    throw new Error("O navegador manteve o áudio suspenso.");
  }

  return context;
}

function playTone(
  frequency: number,
  duration: number,
  delay = 0,
  volume = 0.35,
  type: OscillatorType = "sine",
  trackForAlarm = false,
) {
  const context = getAudioContext();

  if (!context || context.state !== "running") {
    return;
  }

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const startTime = context.currentTime + delay;
  const endTime = startTime + duration;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, endTime);
  oscillator.connect(gain);
  gain.connect(context.destination);

  if (trackForAlarm) {
    activeAlarmOscillators.add(oscillator);
  }

  oscillator.addEventListener(
    "ended",
    () => {
      activeAlarmOscillators.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    },
    { once: true },
  );

  oscillator.start(startTime);
  oscillator.stop(endTime);
}

function playDriverPattern(trackForAlarm = false) {
  playTone(660, 0.25, 0, 0.35, "sine", trackForAlarm);
  playTone(880, 0.25, 0.32, 0.35, "sine", trackForAlarm);
  playTone(1100, 0.35, 0.64, 0.35, "sine", trackForAlarm);
}

function playRestaurantSound() {
  const audio = getRestaurantAudio();

  if (!audio || !restaurantAudioUnlocked || currentAlarm !== "restaurant") {
    return;
  }

  if (!audio.paused) {
    return;
  }

  audio.currentTime = 0;
  audio.muted = false;
  audio.volume = RESTAURANT_ALARM_VOLUME;
  audio.loop = true;

  void audio.play().catch((error) => {
    restaurantAudioUnlocked = false;
    console.warn("Não foi possível tocar o alarme:", error);
  });
}

export function primeRestaurantAudio() {
  const audio = getRestaurantAudio();

  if (!audio) {
    return Promise.resolve(false);
  }

  const shouldRingNow = currentAlarm === "restaurant";
  audio.pause();
  audio.currentTime = 0;
  audio.muted = !shouldRingNow;
  audio.volume = RESTAURANT_ALARM_VOLUME;

  // A chamada a play precisa acontecer sincronamente dentro do gesto do
  // utilizador para o Safari/iOS autorizar reproduções futuras.
  const playPromise = audio.play();

  return playPromise
    .then(() => {
      restaurantAudioUnlocked = true;

      if (!shouldRingNow || currentAlarm !== "restaurant") {
        audio.pause();
        audio.currentTime = 0;
      }

      audio.muted = false;
      return true;
    })
    .catch((error) => {
      restaurantAudioUnlocked = false;
      audio.muted = false;
      console.warn("Não foi possível desbloquear o áudio:", error);
      return false;
    });
}

async function performAudioUnlock() {
  const restaurantReadyPromise = primeRestaurantAudio();

  try {
    await ensureAudioReady();
  } catch {
    // O ficheiro de áudio continua a funcionar em navegadores sem Web Audio.
  }

  return restaurantReadyPromise;
}

export function unlockNotificationAudio() {
  if (!unlockInFlight) {
    unlockInFlight = performAudioUnlock().finally(() => {
      unlockInFlight = null;
    });
  }

  return unlockInFlight;
}

export async function restoreNotificationAudio() {
  getRestaurantAudio();
  return restaurantAudioUnlocked;
}

export function isNotificationAudioReady() {
  return restaurantAudioUnlocked;
}

export function startNotificationAlarm(type: AlarmType) {
  const playWhenReady = async () => {
    try {
      if (type === "restaurant") {
        playRestaurantSound();
      } else {
        await ensureAudioReady();
        if (currentAlarm === "driver") {
          playDriverPattern(true);
        }
      }
    } catch (error) {
      console.warn("Não foi possível tocar o alarme:", error);
    }
  };

  if (currentAlarm === type && alarmInterval) {
    return;
  }

  stopNotificationAlarm();
  currentAlarm = type;
  void playWhenReady();

  if (type === "restaurant") {
    return;
  }

  alarmInterval = setInterval(
    () => {
      void playWhenReady();
    },
    2800,
  );
}

export function stopNotificationAlarm() {
  if (alarmInterval) {
    clearInterval(alarmInterval);
  }

  alarmInterval = null;
  currentAlarm = null;

  if (restaurantAudio) {
    restaurantAudio.pause();
    restaurantAudio.currentTime = 0;
    restaurantAudio.loop = false;
    restaurantAudio.muted = false;
  }

  for (const oscillator of activeAlarmOscillators) {
    try {
      oscillator.stop();
    } catch {
      // O oscilador pode já ter terminado entre a verificação e a paragem.
    }
  }
  activeAlarmOscillators.clear();
}
