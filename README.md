# Wituz Webcam

A simple Electron application for webcam recording with the following features:

![Screenshot 2025-06-18 at 12 34 53](https://github.com/user-attachments/assets/8cf0ebfc-f4d6-4398-8d70-436e27d6c3c1)

## Features

- **Video Preview**: Real-time webcam preview
- **Recording**: Start/Stop recording with a single button
- **Device Selection**: Choose from available video devices
- **Resolution & Frame Rate**: Configurable video quality settings
- **Output Path**: Choose where to save recordings
- **Global Shortcuts**: Keyboard shortcuts that work system-wide
- **System Tray**: Always accessible from the system tray
- **Auto-save Settings**: Settings are automatically saved

## How to Use

### Starting the App
```bash
npm start
```

### Main Interface
- The main window shows a live video preview
- Click "Start Recording" to begin recording
- Click "Stop Recording" to end recording
- The app will minimize to the system tray when closed

### Settings
- Click the "Settings" button in the main window
- Or right-click the tray icon and select "Settings"

#### Available Settings:
- **Video Device**: Select which camera to use
- **Resolution**: Choose video resolution (VGA to 4K)
- **Frame Rate**: Set recording frame rate (15-60 fps)
- **Audio Recording**: Enable/disable separate audio recording (enabled by default)
- **Output Folder**: Choose where recordings are saved
- **Global Shortcut**: Set a system-wide keyboard shortcut for recording

### Global Shortcuts
- Default shortcut: `Cmd+Shift+R` (macOS) or `Ctrl+Shift+R` (Windows/Linux)
- **macOS Users**: You may need to grant accessibility permissions for global shortcuts to work:
  1. Go to System Preferences > Security & Privacy > Privacy > Accessibility
  2. Add and enable the Electron app

### File Format
- **Video**: Recordings are saved as WebM files with VP9 codec (falls back to VP8 if needed)
- **Audio**: Audio is saved as separate WebM files with Opus codec (falls back to default if needed)
- **File Names**: 
  - Video: `recording-YYYY-MM-DDTHH-MM-SS.webm`
  - Audio: `recording-YYYY-MM-DDTHH-MM-SS-audio.webm`

## Requirements

- Node.js 16 or higher
- A webcam or video input device
- For global shortcuts on macOS: Accessibility permissions

## Development

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Package for distribution (requires additional setup)
npm run build
```

## Permissions

The app requires the following permissions:
- **Camera**: To access and record video
- **Microphone**: To record audio (when audio recording is enabled)
- **File System**: To save recordings
- **Accessibility** (macOS): For global keyboard shortcuts
