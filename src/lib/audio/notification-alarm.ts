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
    restaurantAudio = new Audio();
    const supportsOriginalOgg =
      restaurantAudio.canPlayType('audio/ogg; codecs="opus"') !== "";

    // O OGG é o alerta original. O WAV contém o mesmo áudio e é usado apenas
    // quando o navegador não consegue reproduzir Opus (algumas versões do Safari).
    restaurantAudio.src = supportsOriginalOgg
      ? "/sounds/new-order.ogg"
      : "/sounds/new-order.wav";
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

async function playRestaurantAudio() {
  const audio = getRestaurantAudio();

  if (!audio || !restaurantFileReady) {
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
    restaurantAudioUnlocked = false;
    console.warn("O som original do pedido não pôde tocar.", error);
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
  restaurantAudioUnlocked = fileReady;

  // O contexto continua preparado para os alertas dos estafetas, mas o som
  // do restaurante só fica pronto quando o áudio original foi autorizado.
  return fileReady || context?.state === "running";
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
  return isNotificationAudioReady();
}

export function isNotificationAudioReady() {
  return restaurantAudioUnlocked && restaurantFileReady;
}

export function startNotificationAlarm(type: AlarmType) {
  const playWhenReady = async () => {
    try {
      if (type === "restaurant") {
        // The restaurant alert is a real audio file and does not depend on
        // Web Audio. Requiring AudioContext here caused Safari to suppress an
        // otherwise valid, already-authorised HTMLAudioElement.
        await playRestaurantAudio();
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
