# Mac Setup Instructions for StageTimer Remote

This guide is for setting up the iOS build and widget on macOS. Follow these steps after pulling the latest changes from the repository.

## Prerequisites

- macOS with Xcode 15+ installed
- Apple Developer account (for App Store submission)
- CocoaPods installed (`sudo gem install cocoapods`)
- Node.js and npm installed

## Step 1: Pull Latest Changes

```bash
cd stagetimer-remote
git pull origin main
```

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: Generate iOS Native Project

```bash
npx expo prebuild --platform ios
```

This will create the `ios/` directory with the native Xcode project.

## Step 4: Install CocoaPods Dependencies

```bash
cd ios
pod install
cd ..
```

## Step 5: Open in Xcode

```bash
open ios/StageTimerRemote.xcworkspace
```

**Important:** Always open the `.xcworkspace` file, not the `.xcodeproj`.

## Step 6: Configure Signing

1. Select the `StageTimerRemote` project in the navigator
2. Select the `StageTimerRemote` target
3. Go to **Signing & Capabilities** tab
4. Select your Team from the dropdown
5. Xcode will automatically manage signing

## Step 7: Add iOS Widget Extension

### 7.1 Create Widget Target

1. In Xcode, go to **File > New > Target**
2. Search for and select **Widget Extension**
3. Configure:
   - Product Name: `StageTimerWidget`
   - Team: (your team)
   - Bundle Identifier: `com.mattm10101.stagetimerremote.widget`
   - Uncheck "Include Live Activity"
   - Uncheck "Include Configuration App Intent"
4. Click **Finish**
5. When prompted to activate the scheme, click **Activate**

### 7.2 Configure App Groups

Both the main app and widget need to share data via App Groups:

1. Select the `StageTimerRemote` target
2. Go to **Signing & Capabilities**
3. Click **+ Capability**
4. Select **App Groups**
5. Click the **+** button and add: `group.com.mattm10101.stagetimerremote`

6. Now select the `StageTimerWidgetExtension` target
7. Go to **Signing & Capabilities**
8. Click **+ Capability** > **App Groups**
9. Check the same group: `group.com.mattm10101.stagetimerremote`

### 7.3 Replace Widget Code

1. In the Project Navigator, expand `StageTimerWidget` folder
2. Open `StageTimerWidget.swift`
3. Replace the entire contents with the code from `ios-widget/StageTimerWidget.swift` in the repository

### 7.4 Add URL Scheme for Deep Links

1. Select the `StageTimerRemote` target
2. Go to **Info** tab
3. Expand **URL Types**
4. Click **+** to add a new URL type:
   - Identifier: `com.mattm10101.stagetimerremote`
   - URL Schemes: `stagetimerremote`
   - Role: Editor

## Step 8: Build and Test

### Test on Simulator

1. Select an iPhone simulator from the device dropdown
2. Press **Cmd+R** to build and run
3. The app should launch in the simulator

### Test Widget

1. After the app runs, go to the home screen
2. Long-press on an empty area
3. Tap the **+** button in the top-left
4. Search for "StageTimer"
5. Add the widget to your home screen

### Test on Physical Device

1. Connect your iPhone via USB
2. Select your device from the dropdown
3. Press **Cmd+R** to build and run
4. Trust the developer certificate on your phone if prompted

## Step 9: Prepare for App Store

### Update Version Numbers

In `app.json`:
- `version`: Increment for each release (e.g., "1.0.0" → "1.1.0")
- `ios.buildNumber`: Increment for each build (e.g., "1" → "2")

### Create App Store Screenshots

Required sizes:
- 6.7" Display (iPhone 15 Pro Max): 1290 x 2796 px
- 6.5" Display (iPhone 14 Plus): 1284 x 2778 px
- 5.5" Display (iPhone 8 Plus): 1242 x 2208 px
- 12.9" iPad Pro: 2048 x 2732 px (if supporting iPad)

### Archive and Upload

1. Select **Any iOS Device (arm64)** as the build target
2. Go to **Product > Archive**
3. Once complete, the Organizer window opens
4. Click **Distribute App**
5. Select **App Store Connect** > **Upload**
6. Follow the prompts to upload

## Step 10: App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Create a new app if not already created:
   - Bundle ID: `com.mattm10101.stagetimerremote`
   - Name: StageTimer Remote
   - Primary Language: English
   - SKU: `stagetimerremote`
3. Fill in app information:
   - Description
   - Keywords
   - Support URL
   - Screenshots
   - App Preview (optional)
4. Set pricing ($9.99)
5. Submit for review

## Troubleshooting

### "No signing certificate" error
- Go to Xcode > Settings > Accounts
- Select your Apple ID and click "Download Manual Profiles"

### Pod install fails
```bash
cd ios
pod deintegrate
pod cache clean --all
pod install
```

### Widget not appearing
- Make sure App Groups are configured for both targets
- Clean build folder: **Product > Clean Build Folder** (Cmd+Shift+K)
- Delete app from device/simulator and reinstall

### Build fails after prebuild
```bash
rm -rf ios
npx expo prebuild --platform ios --clean
cd ios && pod install
```

## Files Reference

- `ios-widget/StageTimerWidget.swift` - Widget source code to copy
- `ios-widget/SETUP.md` - Detailed widget setup instructions
- `app.json` - App configuration with bundle IDs
- `assets/icon.png` - App icon (1024x1024)
