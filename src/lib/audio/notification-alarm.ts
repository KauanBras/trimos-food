type AlarmType = "restaurant" | "driver";

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
    restaurantAudio = new Audio("/sounds/new-order.ogg");
    restaurantAudio.preload = "auto";
    restaurantAudio.volume = 0.55;
  }

  return restaurantAudio;
}

async function playRestaurantAudio(requiresUnlock = true) {
  const audio = getRestaurantAudio();

  if (!audio || (requiresUnlock && !restaurantAudioUnlocked)) {
    return false;
  }

  if (!audio.paused) {
    return true;
  }

  try {
    audio.currentTime = 0;
    await audio.play();
    restaurantAudioUnlocked = true;
    return true;
  } catch (error) {
    console.warn("O ficheiro do alerta não pôde ser reproduzido:", error);
    return false;
  }
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

  if (context.state === "closed") {
    throw new Error("O áudio do navegador foi encerrado.");
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

function playRestaurantPattern(trackForAlarm = false) {
  playTone(440, 0.5, 0, 0.22, "sine", trackForAlarm);
  playTone(554.37, 0.56, 0.62, 0.2, "sine", trackForAlarm);
  playTone(659.25, 0.68, 1.28, 0.18, "sine", trackForAlarm);
}

function playDriverPattern(trackForAlarm = false) {
  playTone(660, 0.25, 0, 0.35, "sine", trackForAlarm);
  playTone(880, 0.25, 0.32, 0.35, "sine", trackForAlarm);
  playTone(1100, 0.35, 0.64, 0.35, "sine", trackForAlarm);
}

async function performAudioUnlock() {
  // Inicie ambas as tentativas ainda dentro do gesto do utilizador. O Safari
  // pode perder a autorização se audio.play() for chamado apenas após um await.
  const mediaAttempt = playRestaurantAudio(false);
  const contextAttempt = ensureAudioReady()
    .then((context) => context.state === "running")
    .catch(() => false);

  const [mediaReady, contextReady] = await Promise.all([
    mediaAttempt,
    contextAttempt,
  ]);

  if (!mediaReady && contextReady) {
    playRestaurantPattern();
  }

  if (!mediaReady && !contextReady) {
    throw new Error("O navegador manteve o áudio suspenso.");
  }

  return true;
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
  if (restaurantAudioUnlocked) {
    return true;
  }

  try {
    const context = await ensureAudioReady();
    return context.state === "running";
  } catch {
    return false;
  }
}

export function isNotificationAudioReady() {
  return (
    restaurantAudioUnlocked || getAudioContext()?.state === "running"
  );
}

export function startNotificationAlarm(type: AlarmType) {
  const playPattern =
    type === "restaurant" ? playRestaurantPattern : playDriverPattern;

  const playWhenReady = async () => {
    if (type === "restaurant" && (await playRestaurantAudio())) {
      return;
    }

    try {
      await ensureAudioReady();
      if (type === "restaurant") {
        playRestaurantPattern(true);
      } else {
        playPattern(true);
      }
    } catch (error) {
      console.warn("Não foi possível tocar o alarme:", error);
    }
  };

  if (currentAlarm === type && alarmInterval) {
    void playWhenReady();
    return;
  }

  stopNotificationAlarm();

  currentAlarm = type;

  void playWhenReady();

  alarmInterval = setInterval(
    () => {
      void playWhenReady();
    },
    type === "restaurant" ? 6500 : 2800,
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
