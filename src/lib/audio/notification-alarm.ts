type AlarmType = "restaurant" | "driver";

const RESTAURANT_ALARM_INTERVAL_MS = 4500;
const RESTAURANT_ALARM_VOLUME = 0.55;

let audioContext: AudioContext | null = null;
let restaurantAudio: HTMLAudioElement | null = null;
let restaurantAudioUnlocked = false;
let restaurantFileReady = false;
let alarmInterval: ReturnType<typeof setInterval> | null = null;
let currentAlarm: AlarmType | null = null;
let unlockInFlight: Promise<boolean> | null = null;
const activeAlarmOscillators = new Set<OscillatorNode>();

function getRestaurantAudio() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!restaurantAudio) {
    // WAV is a lossless copy of the original OGG alert. It keeps the exact
    // sound while avoiding the Opus/OGG rejection seen in some Safari builds.
    restaurantAudio = new Audio("/sounds/new-order.wav");
    restaurantAudio.preload = "auto";
    restaurantAudio.volume = RESTAURANT_ALARM_VOLUME;
    restaurantAudio.setAttribute("playsinline", "");
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

function playRestaurantFallback(trackForAlarm = false) {
  playTone(440, 0.22, 0, 0.2, "sine", trackForAlarm);
  playTone(554.37, 0.26, 0.25, 0.18, "sine", trackForAlarm);
  playTone(659.25, 0.36, 0.54, 0.16, "sine", trackForAlarm);
}

function playDriverPattern(trackForAlarm = false) {
  playTone(660, 0.25, 0, 0.35, "sine", trackForAlarm);
  playTone(880, 0.25, 0.32, 0.35, "sine", trackForAlarm);
  playTone(1100, 0.35, 0.64, 0.35, "sine", trackForAlarm);
}

async function primeRestaurantAudio() {
  const audio = getRestaurantAudio();

  if (!audio) {
    return false;
  }

  const previousVolume = audio.volume;
  audio.pause();
  audio.currentTime = 0;
  audio.volume = 0;

  try {
    const playPromise = audio.play();
    if (playPromise) {
      await playPromise;
    }
    audio.pause();
    audio.currentTime = 0;
    audio.volume = previousVolume || RESTAURANT_ALARM_VOLUME;
    return true;
  } catch {
    audio.volume = previousVolume || RESTAURANT_ALARM_VOLUME;
    return false;
  }
}

async function playRestaurantAudio(trackForAlarm = false) {
  const audio = getRestaurantAudio();

  if (!audio || !restaurantFileReady) {
    playRestaurantFallback(trackForAlarm);
    return;
  }

  try {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = RESTAURANT_ALARM_VOLUME;
    await audio.play();
    restaurantAudioUnlocked = true;
  } catch (error) {
    restaurantFileReady = false;
    playRestaurantFallback(trackForAlarm);
    console.warn(
      "O som original não pôde tocar; foi usado o alerta compatível.",
      error,
    );
  }
}

async function performAudioUnlock() {
  // Estas duas chamadas precisam começar antes do primeiro await. Safari e
  // iOS só autorizam áudio quando play/resume nascem diretamente do gesto.
  const audioPrimePromise = primeRestaurantAudio();
  const contextReadyPromise = ensureAudioReady().catch(() => null);
  const [fileReady, context] = await Promise.all([
    audioPrimePromise,
    contextReadyPromise,
  ]);

  restaurantFileReady = fileReady;
  restaurantAudioUnlocked = fileReady || context?.state === "running";
  return restaurantAudioUnlocked;
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
  if (
    restaurantAudioUnlocked &&
    (restaurantFileReady || audioContext?.state === "running")
  ) {
    return true;
  }

  try {
    const context = await ensureAudioReady();
    return (
      restaurantAudioUnlocked &&
      (restaurantFileReady || context.state === "running")
    );
  } catch {
    return false;
  }
}

export function isNotificationAudioReady() {
  return (
    restaurantAudioUnlocked &&
    (restaurantFileReady || audioContext?.state === "running")
  );
}

export function startNotificationAlarm(type: AlarmType) {
  const playWhenReady = async () => {
    try {
      if (type === "restaurant") {
        // The restaurant alert is a real audio file and does not depend on
        // Web Audio. Requiring AudioContext here caused Safari to suppress an
        // otherwise valid, already-authorised HTMLAudioElement.
        await playRestaurantAudio(true);
      } else {
        await ensureAudioReady();
        playDriverPattern(true);
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

  alarmInterval = setInterval(
    () => {
      void playWhenReady();
    },
    type === "restaurant" ? RESTAURANT_ALARM_INTERVAL_MS : 2800,
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
