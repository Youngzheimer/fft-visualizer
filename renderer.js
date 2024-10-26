let audioContext;
let analyser;
let gainNode;
let mediaStream;
const canvas = document.getElementById("spectrum");
const ctx = canvas.getContext("2d");
const frequencyLabels = document.getElementById("frequencyLabels");
let animationId;
let colorScheme = "rainbow";
const FFT_SIZE = 2048;

// Canvas 크기 설정
function resizeCanvas() {
  canvas.width = window.innerWidth - 40;
  canvas.height =
    window.innerHeight - document.getElementById("controls").offsetHeight - 80;
  createFrequencyLabels();
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// 주파수 라벨 생성
function createFrequencyLabels() {
  frequencyLabels.innerHTML = "";
  const minFreq = 20;
  const maxFreq = 20000;
  const labelPoints = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];

  labelPoints.forEach((freq) => {
    const x = freqToX(freq, minFreq, maxFreq, canvas.width);
    const label = document.createElement("div");
    label.style.position = "absolute";
    label.style.left = `${x}px`;
    label.style.transform = "translateX(-50%)";
    label.style.bottom = "0";
    label.textContent = freq >= 1000 ? `${freq / 1000}kHz` : `${freq}Hz`;
    frequencyLabels.appendChild(label);
  });
}

function freqToX(freq, minFreq, maxFreq, width) {
  const logFreq = Math.log10(freq);
  const logMin = Math.log10(minFreq);
  const logMax = Math.log10(maxFreq);
  return (width * (logFreq - logMin)) / (logMax - logMin);
}

function getBinForFrequency(freq, sampleRate, fftSize) {
  return Math.round((freq * fftSize) / sampleRate);
}

function getColor(value, scheme, freq) {
  if (scheme === "rainbow") {
    const minFreq = 20;
    const maxFreq = 20000;
    const logFreq = Math.log10(freq);
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const hue = ((logFreq - logMin) / (logMax - logMin)) * 300;
    return `hsl(${hue}, 100%, ${50 + value * 50}%)`;
  }

  const intensity = Math.floor(value * 255);
  switch (scheme) {
    case "blue":
      return `rgb(0, 0, ${intensity})`;
    case "green":
      return `rgb(0, ${intensity}, 0)`;
    case "red":
      return `rgb(${intensity}, 0, 0)`;
  }
}

async function initAudio() {
  try {
    audioContext = new AudioContext();
    analyser = audioContext.createAnalyser();
    gainNode = audioContext.createGain();

    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = audioContext.createMediaStreamSource(mediaStream);

    source.connect(gainNode);
    gainNode.connect(analyser);

    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.85;

    startVisualization();
  } catch (error) {
    console.error("Error accessing microphone:", error);
    alert("마이크 접근 권한이 필요합니다.");
  }
}

function startVisualization() {
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  const binFrequencies = new Float32Array(bufferLength);
  const sampleRate = audioContext.sampleRate;

  // 각 bin의 중심 주파수 미리 계산
  for (let i = 0; i < bufferLength; i++) {
    binFrequencies[i] = (i * sampleRate) / FFT_SIZE;
  }

  function draw() {
    animationId = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const minFreq = 20;
    const maxFreq = 20000;
    const minBin = getBinForFrequency(minFreq, sampleRate, FFT_SIZE);
    const maxBin = getBinForFrequency(maxFreq, sampleRate, FFT_SIZE);

    for (let i = minBin; i <= maxBin; i++) {
      const freq = binFrequencies[i];
      const nextFreq = binFrequencies[i + 1] || freq * 1.1; // 마지막 빈을 위한 예외 처리

      // 현재 주파수와 다음 주파수의 x 좌표 계산
      const x = Math.floor(freqToX(freq, minFreq, maxFreq, canvas.width));
      const nextX = Math.floor(
        freqToX(nextFreq, minFreq, maxFreq, canvas.width)
      );

      // 막대의 너비를 두 x 좌표의 차이로 계산
      const barWidth = Math.max(nextX - x, 1);

      const value = dataArray[i] / 255.0;
      const height = value * canvas.height;
      const y = canvas.height - height;

      ctx.fillStyle = getColor(value, colorScheme, freq);
      ctx.fillRect(x, y, barWidth, height);
    }
  }

  draw();
}

// freqToX 함수도 약간 수정하여 더 부드러운 전환을 구현
function freqToX(freq, minFreq, maxFreq, width) {
  const logFreq = Math.log10(freq);
  const logMin = Math.log10(minFreq);
  const logMax = Math.log10(maxFreq);
  return (width * (logFreq - logMin)) / (logMax - logMin);
}

async function updateInputSources() {
  const select = document.getElementById("inputSource");
  select.innerHTML = "";

  const devices = await navigator.mediaDevices.enumerateDevices();
  const audioInputs = devices.filter((device) => device.kind === "audioinput");

  audioInputs.forEach((device) => {
    const option = document.createElement("option");
    option.value = device.deviceId;
    option.text = device.label || `Microphone ${select.length + 1}`;
    select.appendChild(option);
  });
}

document.getElementById("inputSource").addEventListener("change", async (e) => {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
  }

  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: e.target.value },
  });
  const source = audioContext.createMediaStreamSource(mediaStream);
  source.connect(gainNode);
});

document.getElementById("colorScheme").addEventListener("change", (e) => {
  colorScheme = e.target.value;
});

document.getElementById("gain").addEventListener("input", (e) => {
  if (gainNode) {
    gainNode.gain.value = parseFloat(e.target.value);
    document.getElementById("gainValue").textContent = e.target.value;
  }
});

updateInputSources().then(() => initAudio());
