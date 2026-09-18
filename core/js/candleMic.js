// Web Audio mic volume metering for the finale "blow out the candles"
// interaction. This module only wraps the getUserMedia/AnalyserNode
// plumbing and the volume math — it has no idea about candles, progress
// bars, or Phaser. PostcardScene owns the blow-detection thresholds and
// what happens with the numbers this returns.
//
// Browser permission rules: getUserMedia() must be called from directly
// inside a user gesture's event handler (a tap/click), never on page or
// scene load — the caller is responsible for that; this function does no
// deferring or queuing of its own.

export async function startMicVolumeMeter() {
  // Plain `{ audio: true }` lets the browser apply its default voice-call
  // processing — autoGainControl, noiseSuppression, and echoCancellation
  // — and noise suppression in particular actively fights this feature:
  // it's designed to suppress exactly the kind of sustained, non-voice
  // broadband noise a blow produces, so within a second or two of
  // steady blowing the reported volume decays toward zero even though
  // the real input hasn't let up. Explicitly disabling all three keeps
  // the raw signal level intact for the threshold check below.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioContextClass();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.4;
  source.connect(analyser);

  const timeDomainData = new Uint8Array(analyser.frequencyBinCount);

  return {
    // Normalized RMS volume of the current time-domain signal — 0 for
    // silence, climbing well past 1 for loud/close input. A sustained
    // blow into the mic reads as sustained mid-to-loud broadband noise;
    // telling that apart from a brief spike (a tap, a cough) is the
    // caller's job via a fill/decay curve, not this function's.
    getVolume() {
      analyser.getByteTimeDomainData(timeDomainData);
      let sumSquares = 0;
      for (let i = 0; i < timeDomainData.length; i++) {
        const normalized = (timeDomainData[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      return Math.sqrt(sumSquares / timeDomainData.length);
    },

    // Releases the mic entirely — stops the media stream tracks (so the
    // browser's mic-in-use indicator goes away) and tears down the audio
    // graph. Safe to call once; the caller shouldn't call it twice.
    stop() {
      stream.getTracks().forEach((track) => track.stop());
      source.disconnect();
      analyser.disconnect();
      audioContext.close();
    },
  };
}
