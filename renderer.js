const { ipcRenderer } = require('electron');

let currentStream = null;
let audioStream = null;
let mediaRecorder = null;
let audioRecorder = null;
let recordedChunks = [];
let audioChunks = [];
let isRecording = false;
let recordingStartTime = null;
let timerInterval = null;
let availableDevices = [];
let currentSettings = {};

// Initialize the app
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    await initializeCamera();
    setupEventListeners();
});

async function loadSettings() {
    try {
        currentSettings = await ipcRenderer.invoke('get-settings');
        updateSettingsDisplay();
    } catch (error) {
        console.error('Error loading settings:', error);
        // Use defaults if settings fail to load
        currentSettings = {
            outputPath: '',
            selectedDevice: '',
            resolution: '1280x720',
            frameRate: 30,
            globalShortcut: 'CommandOrControl+Shift+R',
            recordAudio: true
        };
    }
}

function updateSettingsDisplay() {
    document.getElementById('currentDevice').textContent = currentSettings.selectedDevice || 'Default';
    document.getElementById('currentResolution').textContent = currentSettings.resolution;
    document.getElementById('currentFrameRate').textContent = currentSettings.frameRate;
    document.getElementById('currentAudio').textContent = currentSettings.recordAudio ? 'Enabled' : 'Disabled';
    document.getElementById('currentPath').textContent = currentSettings.outputPath || 'Default';
    document.getElementById('currentShortcut').textContent = currentSettings.globalShortcut;
}

async function getVideoDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        availableDevices = devices.filter(device => device.kind === 'videoinput');
        return availableDevices;
    } catch (error) {
        console.error('Error enumerating devices:', error);
        return [];
    }
}

async function initializeCamera() {
    try {
        setStatus('Requesting camera access...');
        
        // Get available devices
        await getVideoDevices();
        
        if (availableDevices.length === 0) {
            setStatus('No video devices found');
            return;
        }

        // Parse resolution
        const [width, height] = currentSettings.resolution.split('x').map(Number);
        
        // Set up constraints
        const constraints = {
            video: {
                width: { ideal: width },
                height: { ideal: height },
                frameRate: { ideal: currentSettings.frameRate }
            }
        };

        // Use specific device if selected
        if (currentSettings.selectedDevice) {
            const device = availableDevices.find(d => d.deviceId === currentSettings.selectedDevice);
            if (device) {
                constraints.video.deviceId = { exact: currentSettings.selectedDevice };
            }
        }

        // Get user media
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Set up video preview
        const videoPreview = document.getElementById('videoPreview');
        videoPreview.srcObject = currentStream;
        
        // Set video wrapper aspect ratio based on resolution
        const videoWrapper = document.querySelector('.video-wrapper');
        const aspectRatio = width / height;
        
        // Apply aspect ratio to maintain proper video proportions
        videoWrapper.style.aspectRatio = aspectRatio.toString();
        
        // Update device name display
        const track = currentStream.getVideoTracks()[0];
        const deviceName = track.label || 'Unknown Device';
        document.getElementById('deviceName').textContent = deviceName;
        
        // Enable record button
        document.getElementById('recordBtn').disabled = false;
        setStatus(`Press ${currentSettings.globalShortcut} to record`);
        
    } catch (error) {
        console.error('Error accessing camera:', error);
        setStatus('Camera access denied or failed');
        
        if (error.name === 'NotAllowedError') {
            setStatus('Camera permission denied. Please allow camera access and restart the app.');
        } else if (error.name === 'NotFoundError') {
            setStatus('No camera found. Please connect a camera and restart the app.');
        } else {
            setStatus('Camera initialization failed: ' + error.message);
        }
    }
}

function setupEventListeners() {
    // Listen for global shortcut toggle
    ipcRenderer.on('toggle-recording', () => {
        toggleRecording();
    });
    
    // Listen for settings changes
    ipcRenderer.on('settings-changed', async () => {
        await loadSettings();
        await restartCamera();
    });
}

async function restartCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
    await initializeCamera();
}

function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

async function startRecording() {
    if (!currentStream) {
        setStatus('No camera stream available');
        return;
    }

    try {
        recordedChunks = [];
        audioChunks = [];
        
        // Set up video MediaRecorder
        const videoOptions = {
            mimeType: 'video/webm;codecs=vp9',
            videoBitsPerSecond: 2500000 // 2.5 Mbps
        };
        
        // Fallback to VP8 if VP9 is not supported
        if (!MediaRecorder.isTypeSupported(videoOptions.mimeType)) {
            videoOptions.mimeType = 'video/webm;codecs=vp8';
        }
        
        // Fallback to default if WebM is not supported
        if (!MediaRecorder.isTypeSupported(videoOptions.mimeType)) {
            delete videoOptions.mimeType;
        }

        mediaRecorder = new MediaRecorder(currentStream, videoOptions);
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = async () => {
            await saveRecording();
        };
        
        // Set up audio recording if enabled
        if (currentSettings.recordAudio) {
            try {
                audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                
                const audioOptions = {
                    mimeType: 'audio/webm;codecs=opus'
                };
                
                // Fallback if opus is not supported
                if (!MediaRecorder.isTypeSupported(audioOptions.mimeType)) {
                    audioOptions.mimeType = 'audio/webm';
                }
                
                audioRecorder = new MediaRecorder(audioStream, audioOptions);
                
                audioRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunks.push(event.data);
                    }
                };
                
                audioRecorder.onstop = async () => {
                    await saveAudioRecording();
                };
                
                audioRecorder.start();
            } catch (audioError) {
                console.error('Audio recording failed:', audioError);
                setStatus('Audio recording failed, continuing with video only');
            }
        }
        
        mediaRecorder.start();
        
        // Update UI
        isRecording = true;
        recordingStartTime = Date.now();
        updateRecordButton();
        startTimer();
        setStatus('Recording started');
        
    } catch (error) {
        console.error('Error starting recording:', error);
        setStatus('Recording failed to start: ' + error.message);
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        
        // Stop audio recording if it exists
        if (audioRecorder && audioRecorder.state !== 'inactive') {
            audioRecorder.stop();
        }
        
        // Stop audio stream
        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
            audioStream = null;
        }
        
        isRecording = false;
        stopTimer();
        updateRecordButton();
        setStatus('Stopping recording...');
    }
}

async function saveRecording() {
    try {
        if (recordedChunks.length === 0) {
            setStatus('No recording data to save');
            return;
        }
        
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const buffer = Buffer.from(await blob.arrayBuffer());
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `recording-${timestamp}.webm`;
        
        // Save the file
        const filePath = await ipcRenderer.invoke('save-recording', buffer, filename);
        
        let statusMessage = `Video saved: ${filePath}`;
        if (currentSettings.recordAudio && audioChunks.length > 0) {
            statusMessage += ' (Audio saving...)';
        }
        setStatus(statusMessage);
        
    } catch (error) {
        console.error('Error saving recording:', error);
        setStatus('Failed to save recording: ' + error.message);
    }
}

async function saveAudioRecording() {
    try {
        if (audioChunks.length === 0) {
            console.log('No audio data to save');
            return;
        }
        
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const buffer = Buffer.from(await blob.arrayBuffer());
        
        // Generate filename with timestamp (same as video but with audio suffix)
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `recording-${timestamp}-audio.webm`;
        
        // Save the audio file
        const filePath = await ipcRenderer.invoke('save-recording', buffer, filename);
        setStatus(`Video and audio saved successfully`);
        
    } catch (error) {
        console.error('Error saving audio recording:', error);
        setStatus('Video saved, but audio save failed: ' + error.message);
    }
}

function updateRecordButton() {
    const recordBtn = document.getElementById('recordBtn');
    
    if (isRecording) {
        recordBtn.textContent = 'Stop Recording';
        recordBtn.classList.add('recording');
    } else {
        recordBtn.textContent = 'Start Recording';
        recordBtn.classList.remove('recording');
    }
}

function startTimer() {
    timerInterval = setInterval(() => {
        const elapsed = Date.now() - recordingStartTime;
        const seconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        
        const statusElement = document.getElementById('status');
        statusElement.innerHTML = `<span class="recording-timer">Recording: ${timeString}</span>`;
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function setStatus(message) {
    document.getElementById('status').textContent = message;
}

async function openSettings() {
    await ipcRenderer.invoke('open-settings');
}


// Clean up on window close
window.addEventListener('beforeunload', () => {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
    }
    if (timerInterval) {
        clearInterval(timerInterval);
    }
});