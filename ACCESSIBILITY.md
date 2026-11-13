# Accessibility

VR is already physical and demanding. Ombra tries not to add barriers of its own: it should be usable with different eyesight, different bodies and different ways of playing, standing, seated or lying down. This page says what works today, what doesn't yet, and how to tell us about a barrier.

## Where Ombra runs

- Windows 10 and 11, 64-bit, with SteamVR.
- The Ombra window on your PC, a tab in the SteamVR dashboard, and a wrist panel in VR.
- In 10 languages: English, Italiano, Deutsch, Français, Español, Português (Brasil), 日本語, 한국어, 简体中文, Русский.

## What works today

**Seeing the window**
- **Display scaling.** The window follows the Windows display scale of each monitor (Settings → System → Display → Scale), so text and controls grow with it.
- **Less motion.** When Windows animation effects are off (Settings → Accessibility → Visual effects), Ombra turns its page transitions off too.
- **Not only colour.** Tracker state is written in words and numbers (battery %, signal, update rate), not shown by colour alone.
- **12 colour themes** for the window and the panels in VR.

**Calibrating and playing**
- **Many ways to start a calibration:** a button in the window, a big button in the SteamVR dashboard or on the wrist, a double press of the triggers, the keyboard shortcuts Ctrl+Alt+Shift+Y / U / I, a T-pose, or taps on a tracker. Gestures can be switched off.
- **Time to get ready:** a countdown of 3, 5 or 8 seconds before each pose.
- **Sound your way:** calibration steps can be spoken, played as short tones, or silent; the panel in VR always shows each step in text.
- **Physical steps are shown, not only described:** when Ombra asks you to move, the window shows the movement as an animation.
- **Voice warnings** in VR when a tracker drops out or its battery runs low, with the voices built into Windows.
- **Your body, not an average one:** body proportions can be measured by touching your joints with a controller, or typed in. Missing trackers are estimated from the ones you wear.
- **Lying down:** a bed mode and a sleep mode for playing or resting in bed.

## Known limitations

- **No screen reader support.** The window and the VR panels are drawn by Ombra itself and don't expose their controls to Windows UI Automation, so Narrator, NVDA and JAWS can't read them.
- **Mouse first.** Apart from the calibration shortcuts and text fields, the window can't be used with the keyboard alone yet: there is no Tab navigation between controls.
- **No text size setting inside Ombra.** Text grows only with the Windows display scale.
- **No high-contrast theme** that follows Windows contrast themes.
- **Translations** were made with AI help and may read unnaturally in places.

## Report a barrier

If something in Ombra stops you or makes it harder than it should be, please tell us. Barriers are treated as bugs.

- [Open a bug report](https://github.com/thadoom/ombra/issues/new?template=bug_report.yml) and start the title with **Accessibility:**. Say what you were trying to do, what got in the way, and what you use (for example screen magnifier, display scale, one-handed controller, seated play).
- Prefer to talk first? Write in [Discussions](https://github.com/thadoom/ombra/discussions).
- A wrong or unclear translation: [open a translation request](https://github.com/thadoom/ombra/issues/new?template=translation.yml).

Ombra is made by one developer, so fixes take time, but every report is read.
