/**
 * MediCare - Audio Synthesizer & Alarm Alerts
 * Generates custom pleasant acoustic chime sequences without external audio files.
 */

window.MediCareAudio = (function () {
    let audioCtx = null;
    let alarmIntervalId = null;
    let soundEnabled = true;

    function getAudioContext() {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContextClass();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    /**
     * Plays a hospital-grade melodic chime chord sequence (E5, G#5, B5, E6)
     */
    function playChimeAlert() {
        if (!soundEnabled) return;

        try {
            const ctx = getAudioContext();
            const now = ctx.currentTime;
            const notes = [659.25, 830.61, 987.77, 1318.51];

            notes.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + (idx * 0.15));

                gain.gain.setValueAtTime(0, now + (idx * 0.15));
                gain.gain.linearRampToValueAtTime(0.2, now + (idx * 0.15) + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, now + (idx * 0.15) + 0.8);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now + (idx * 0.15));
                osc.stop(now + (idx * 0.15) + 0.85);
            });
        } catch (err) {
            console.warn('Audio playback restricted or blocked by browser policy:', err);
        }
    }

    /**
     * Loops the audio chime every 3 seconds until dismissed
     */
    function startContinuousAlarm() {
        playChimeAlert();
        if (alarmIntervalId) clearInterval(alarmIntervalId);
        alarmIntervalId = setInterval(() => {
            playChimeAlert();
        }, 3000);
    }

    /**
     * Halts recurring alarm sound
     */
    function stopContinuousAlarm() {
        if (alarmIntervalId) {
            clearInterval(alarmIntervalId);
            alarmIntervalId = null;
        }
    }

    function toggleSound() {
        soundEnabled = !soundEnabled;
        return soundEnabled;
    }

    function isSoundEnabled() {
        return soundEnabled;
    }

    return {
        getAudioContext,
        playChimeAlert,
        startContinuousAlarm,
        stopContinuousAlarm,
        toggleSound,
        isSoundEnabled
    };
})();

// Backward compatibility bindings for any inline scripts
window.playChimeAlert = window.MediCareAudio.playChimeAlert;
window.startContinuousAlarm = window.MediCareAudio.startContinuousAlarm;
window.stopContinuousAlarm = window.MediCareAudio.stopContinuousAlarm;
