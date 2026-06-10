let audioContext = null;
let alarmInterval = null;

export function unlockAlarmAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    return audioContext.resume();
  }
  return Promise.resolve();
}

function beep() {
  if (!audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = 'square';
  oscillator.frequency.value = 880;
  gain.gain.value = 0.35;
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.25);
}

export function startAlarmSound() {
  unlockAlarmAudio().then(() => {
    if (alarmInterval) return;
    beep();
    alarmInterval = setInterval(beep, 600);
  });
}

export function stopAlarmSound() {
  if (alarmInterval) {
    clearInterval(alarmInterval);
    alarmInterval = null;
  }
}

export function vibrateAlarm() {
  if (navigator.vibrate) {
    navigator.vibrate([400, 200, 400, 200, 400]);
  }
}
