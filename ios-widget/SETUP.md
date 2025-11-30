# iOS Widget Setup Guide

This guide explains how to add the iOS widget after pulling the project to your Mac.

## Prerequisites

- macOS with Xcode 15+
- Apple Developer account
- CocoaPods installed (`gem install cocoapods`)

## Setup Steps

### 1. Generate iOS Native Project

```bash
cd stagetimer-remote
npx expo prebuild --platform ios
cd ios
pod install
```

### 2. Open in Xcode

```bash
open StageTimerRemote.xcworkspace
```

### 3. Add Widget Extension

1. In Xcode, go to **File > New > Target**
2. Select **Widget Extension**
3. Name it `StageTimerWidget`
4. Uncheck "Include Configuration Intent"
5. Click **Finish**

### 4. Configure App Groups

1. Select your main app target
2. Go to **Signing & Capabilities**
3. Click **+ Capability** and add **App Groups**
4. Create a group: `group.com.mattm10101.stagetimerremote`
5. Repeat for the widget extension target

### 5. Replace Widget Code

Copy the contents of `StageTimerWidget.swift` to replace the generated widget code.

### 6. Add URL Scheme

In your app's **Info.plist**, add a URL scheme:

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>stagetimerremote</string>
        </array>
    </dict>
</array>
```

### 7. Handle Deep Links in App.js

The app will need to handle the URL scheme for widget button presses.
Add this to your App.js (already included in the project for iOS):

```javascript
import { Linking } from 'react-native';

useEffect(() => {
  const handleUrl = (event) => {
    const action = event.url.replace('stagetimerremote://', '');
    if (action === 'play') handleStartPause();
    else if (action === 'stop') sendApiRequest('/stop');
    else if (action === 'next') handleNext();
  };

  Linking.addEventListener('url', handleUrl);
  return () => Linking.removeEventListener('url', handleUrl);
}, []);
```

### 8. Build and Test

1. Select your iPhone or simulator
2. Build and run (Cmd+R)
3. Long-press on home screen > tap **+** > search "StageTimer"
4. Add the widget

## Sharing Data with Widget

For the widget to access the room ID and API key, you need to save them to the shared App Group:

```javascript
import { NativeModules, Platform } from 'react-native';

// In saveSettings function:
if (Platform.OS === 'ios') {
  // Use react-native-user-defaults or similar to write to App Group
  // UserDefaults(suiteName: "group.com.mattm10101.stagetimerremote")
}
```

## Notes

- Widgets update periodically (minimum every 15 minutes)
- For real-time updates, consider using Background App Refresh
- The widget uses deep links to trigger actions in the main app
