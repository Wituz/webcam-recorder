const { ipcRenderer } = require('electron');

let currentSettings = {};
let availableDevices = [];
let isListeningForShortcut = false;
let currentShortcut = '';

document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    await loadDevices();
    populateSettingsForm();
});

async function loadSettings() {
    try {
        currentSettings = await ipcRenderer.invoke('get-settings');
    } catch (error) {
        console.error('Error loading settings:', error);
        currentSettings = {
            outputPath: '',
            selectedDevice: '',
            resolution: '1280x720',
            frameRate: 30,
            globalShortcut: 'CommandOrControl+Shift+R'
        };
    }
}

async function loadDevices() {
    try {
        // Request media permissions first
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        
        // Now enumerate devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        availableDevices = devices.filter(device => device.kind === 'videoinput');
        
        populateDeviceSelect();
    } catch (error) {
        console.error('Error loading devices:', error);
        const deviceSelect = document.getElementById('deviceSelect');
        deviceSelect.innerHTML = '<option value="">No devices available</option>';
    }
}

function populateDeviceSelect() {
    const deviceSelect = document.getElementById('deviceSelect');
    deviceSelect.innerHTML = '';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Default Device';
    deviceSelect.appendChild(defaultOption);
    
    // Add available devices
    availableDevices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Camera ${device.deviceId.substring(0, 8)}...`;
        deviceSelect.appendChild(option);
    });
}

function populateSettingsForm() {
    // Set device selection
    document.getElementById('deviceSelect').value = currentSettings.selectedDevice || '';
    
    // Set resolution
    document.getElementById('resolutionSelect').value = currentSettings.resolution;
    
    // Set frame rate
    document.getElementById('frameRateSelect').value = currentSettings.frameRate;
    
    // Set audio recording
    document.getElementById('recordAudio').checked = currentSettings.recordAudio;
    
    // Set output path
    document.getElementById('outputPath').value = currentSettings.outputPath;
    
    // Set shortcut display
    currentShortcut = currentSettings.globalShortcut;
    updateShortcutDisplay();
}

function updateShortcutDisplay() {
    const shortcutDisplay = document.getElementById('shortcutDisplay');
    if (currentShortcut) {
        shortcutDisplay.textContent = formatShortcut(currentShortcut);
    } else {
        shortcutDisplay.textContent = 'No shortcut set';
    }
}

function formatShortcut(shortcut) {
    return shortcut
        .replace('CommandOrControl', navigator.platform.includes('Mac') ? '⌘' : 'Ctrl')
        .replace('Shift', '⇧')
        .replace('Alt', navigator.platform.includes('Mac') ? '⌥' : 'Alt')
        .replace('+', ' + ');
}

async function browseOutputFolder() {
    try {
        const selectedPath = await ipcRenderer.invoke('select-output-folder');
        if (selectedPath) {
            document.getElementById('outputPath').value = selectedPath;
        }
    } catch (error) {
        console.error('Error selecting output folder:', error);
    }
}

function startListeningForShortcut() {
    if (isListeningForShortcut) return;
    
    isListeningForShortcut = true;
    const shortcutInput = document.getElementById('shortcutInput');
    const shortcutDisplay = document.getElementById('shortcutDisplay');
    
    shortcutInput.classList.add('listening');
    shortcutDisplay.textContent = 'Press key combination...';
    
    document.addEventListener('keydown', handleShortcutKeyDown);
    document.addEventListener('keyup', handleShortcutKeyUp);
    
    // Auto-cancel after 10 seconds
    setTimeout(() => {
        if (isListeningForShortcut) {
            stopListeningForShortcut();
        }
    }, 10000);
}

function handleShortcutKeyDown(event) {
    if (!isListeningForShortcut) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const keys = [];
    
    // Add modifiers
    if (event.metaKey || event.ctrlKey) {
        keys.push('CommandOrControl');
    }
    if (event.altKey) {
        keys.push('Alt');
    }
    if (event.shiftKey) {
        keys.push('Shift');
    }
    
    // Add main key (only if it's not a modifier)
    if (!['Control', 'Alt', 'Shift', 'Meta', 'Cmd', 'Command'].includes(event.key)) {
        keys.push(event.key.toUpperCase());
    }
    
    // Need at least a modifier and a main key
    if (keys.length >= 2 && !['Control', 'Alt', 'Shift', 'Meta', 'Cmd', 'Command'].includes(keys[keys.length - 1])) {
        currentShortcut = keys.join('+');
        stopListeningForShortcut();
    }
}

function handleShortcutKeyUp(event) {
    // Keep listening until we get a valid combination
}

function stopListeningForShortcut() {
    isListeningForShortcut = false;
    const shortcutInput = document.getElementById('shortcutInput');
    
    shortcutInput.classList.remove('listening');
    document.removeEventListener('keydown', handleShortcutKeyDown);
    document.removeEventListener('keyup', handleShortcutKeyUp);
    
    updateShortcutDisplay();
}

async function saveSettings() {
    const newSettings = {
        selectedDevice: document.getElementById('deviceSelect').value,
        resolution: document.getElementById('resolutionSelect').value,
        frameRate: parseInt(document.getElementById('frameRateSelect').value),
        recordAudio: document.getElementById('recordAudio').checked,
        outputPath: document.getElementById('outputPath').value,
        globalShortcut: currentShortcut
    };
    
    try {
        await ipcRenderer.invoke('save-settings', newSettings);
        
        // Notify main window of settings change
        ipcRenderer.send('settings-changed');
        
        closeSettings();
    } catch (error) {
        console.error('Error saving settings:', error);
        alert('Failed to save settings: ' + error.message);
    }
}

function closeSettings() {
    window.close();
}

// Handle clicks outside shortcut input to cancel listening
document.addEventListener('click', (event) => {
    if (isListeningForShortcut && !event.target.closest('#shortcutInput')) {
        stopListeningForShortcut();
    }
});

// Show permission warning on macOS
if (navigator.platform.includes('Mac')) {
    const permissionWarning = document.getElementById('permissionWarning');
    permissionWarning.style.display = 'block';
}