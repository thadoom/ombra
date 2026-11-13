# Everything Ombra does

The [README](../README.md) has the short version and the [website](https://thadoom.github.io/ombra/) has the pictures. This is the whole list.

## Trackers

- HaritoraX 2, 2 Pro and Wireless through GX2 or GX6 dongles, at 50 or 100 Hz per sensor. Pairing, channels and every tracker setting are in the app, status light included.
- SlimeVR-compatible trackers over Wi-Fi or a USB receiver, with a guided Wi-Fi setup for new boards. A new tracker asks to be added first, so a neighbour's never gets in. If the firewall blocks them, one click fixes it.
- Both kinds on one body.
- Vive or other base-station trackers with a Quest: hold one against a controller, wave them, and Ombra lines them up with the headset.
- Other IMU trackers already in SteamVR can be smoothed too, if you turn that on.
- Firmware updates for trackers (Bluetooth) and dongles (USB), with Shiftall's original signed files, checked with SHA-256 before use.
- Ankles that bend, from the HaritoraX 2 distance sensor.

## Calibration

- Two poses, standing and a ski pose, plus a third on your tiptoes if you have foot trackers. Ombra works out how each sensor sits on your limb and names the one to fix.
- Quick calibration reuses the mounting it remembers for each tracker, even after a restart, so on most days standing straight is enough.
- Start it from the app, the SteamVR dashboard, a double press of the triggers or **Ctrl+Alt+Shift+Y / U / I**. A T-pose or taps on a tracker can start it too; you switch those gestures on or off on the Calibration page.
- VRChat's own calibration is confirmed for you as soon as you stand still.

## Body

- Height from the headset, or touch your knees, hips and ankles with a controller and Ombra measures each segment. Body profiles for different avatars.
- Elbows without elbow trackers, estimated from how you hold the controllers.
- A real floor, planted feet that don't slide, knees that never bend backwards.
- Sitting and lying down: Ombra finds the bed, sofa or floor under you.
- A short signal dropout is covered with an estimated pose.

## Without trackers

- Choose *No trackers* in the setup and Ombra never asks for a dongle. The chatbox, the crash reports, the wrist panel and space drag work with a headset and controllers alone.
- Full body from the headset: hips, knees and feet are made up from your headset, and they stand, sit and walk with you. They are sent to SteamVR as trackers, so any SteamVR game sees them. Off unless you turn it on. It also fills in any leg that has no tracker.
- Posture: auto (it follows your head, and low means seated), standing, seated or in bed.
- Five walks: natural, masculine, feminine, confident, shy. Four ways to sit: relaxed, wide, composed, legs crossed.
- Ombra can also step aside: one switch hands the body tracking to another tracking app, and Ombra can still smooth that app's trackers.

## Space drag

- Hold a controller button and pull to move your playspace: climb, cross a big room, reach what your real walls hide. Trackers come along by themselves.
- One hand or both, to climb hand over hand. The button is read by Ombra's driver, so there is no SteamVR binding to set up, and it works while a game has focus.
- *Press twice and hold* leaves single presses to the game.
- Slow moves stay 1:1 and the distance grows as you pull faster. A steady-hand filter calms a shaky hand.
- A fling when you let go, optional gravity (Moon, Mars, Earth, Jupiter), or a glide with no gravity.
- Nothing is saved. **Back to start**, a double or triple tap on the button, or closing Ombra puts SteamVR's playspace back.

## Smoothing and drift

- An adaptive filter that is steady when you stand still and quick when you kick. Presets Smooth, Balanced, Responsive and Off, a 0 to 10 slider, and a separate style per tracker.
- Every pose carries its velocity and is shifted by the radio delay, so SteamVR predicts it to the frame.
- Drift correction while you play, built from many small checks. [How it works, with numbers.](how-it-works.md#drift-correction)

## Outputs

- SteamVR, through Ombra's own driver, with tracker roles already set.
- VRChat OSC trackers, for VRChat on a standalone Quest without SteamVR.
- VMC, for VSeeFace, Warudo, VNyan and other VTuber apps.

## VRChat chatbox

- Eight looks to start from (Ombra, Studio, Neon, Kawaii, Minimal, One row, Elegant, Streamer), each drawn as a real VRChat bubble with your own lines.
- Modules you switch on and off and move up or down: song, heart rate, status, time, full body, live alerts. Free text too.
- Twelve dividers VRChat can draw, or everything on one row. Characters VRChat can't draw never get in.
- When the text doesn't fit, Ombra says the bubble needs more screens and offers one-click fixes.
- It sends only when the text changes, so no spam and no chatbox timeouts. The bubble clears when you turn the chatbox off or close Ombra.
- A theme is shared as a 9-character code like `T7RK-1J85-6`. There is no server: Ombra reads its own codes.
- Your song from Spotify or any player, without logging in.
- Heart rate from Pulsoid or straight from a Bluetooth strap or watch, also sent to your avatar's parameters.
- Optional speech to chatbox with the Whisper model, on your PC.

## Crash reports and VRChat tools

- Ombra reads VRChat's log on your PC: who is in your instance, which avatar they wear and how heavy it is.
- After a crash, a report names the likely crasher and how many seconds before. Hide that avatar in one click, undo any time.
- Optional: hide an avatar by itself after two crashes from the same person, and rejoin after a crash with a countdown you can cancel.
- A warning on your wrist when an avatar drags your frame rate down.
- The best VRChat tracking settings for your set, with one-click apply and undo.
- Ombra never asks for your VRChat password and never touches the game.

## In VR

- A panel on your wrist that fades in when you look at it: clock, live trackers, the emptiest battery, calibration state, four switches (full body, sleep, screens, mirror), your music and your PC's notifications.
- Calibration and Options pages on the wrist: calibrate, quick calibration, reset facing, smoothness, drift fix and elbows.
- Buttons wait until the panel is in view, the trigger acts when you let go, and a greyed-out button says why.
- A tab in the SteamVR dashboard with every tracker and its battery. While you calibrate, the Calibrate button becomes Cancel. A tracker that is off shows in amber.
- Live chat from Twitch, YouTube and TikTok LIVE on your wrist and on a floating panel, each message with its platform's icon. Gifts, subs, raids and follows can show in your VRChat bubble for a few seconds. TikTok needs no login.
- Voice warnings when a tracker drops out or runs low.
- Sleep mode: a calm body, a quiet voice and a headset that dims while you sleep.
- Full body on and off in one tap, back without recalibrating.
- A pocket mirror: your body as a small live figure next to you, to grab and turn. Off by default.

## The app

- A Health page that says whether a stutter comes from the radio or from your PC, with signal, dropouts and frame times for every tracker.
- A sidebar you arrange yourself: folders, your own order, and one button to put the original back.
- 12 colour themes, or your own from three colours, shared as a code. Themes apply to the VR panels too.
- 10 languages: English, Italian, German, French, Spanish, Brazilian Portuguese, Japanese, Korean, Simplified Chinese and Russian.
- Settings → Export diagnostics writes one text file for bug reports.
- `Ombra.exe --demo` runs eight simulated trackers without touching COM ports, Bluetooth, SteamVR or your settings.
