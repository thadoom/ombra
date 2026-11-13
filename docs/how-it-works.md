# How Ombra works

IMU trackers only measure rotation. Everything about *where* your body is comes from a model. This page is how Ombra builds that model and gets it into SteamVR. For what Ombra does and how to install it, go back to the [README](../README.md).

## From the trackers to the game

1. **Trackers.** Ombra opens each GX dongle over USB, or receives SlimeVR-compatible trackers over Wi-Fi or a USB receiver, and decodes every sensor's orientation, battery, signal and real update rate. The tracker settings you choose (rate, mode, light, ankle sensor) are written back each time a tracker connects.
2. **Body.** A core loop at 250 Hz turns the sensor rotations into a body ([below](#the-skeleton)) and writes the virtual trackers into shared memory.
3. **Driver.** Ombra's SteamVR driver creates the trackers with their roles already set (waist, chest, knees, feet). For every pose it:
   - filters it with an adaptive One Euro filter: presets Smooth, Balanced, Responsive and Off, a 0 to 10 slider, and a separate style per tracker;
   - adds linear and angular velocity, faded to zero when you stand still, so SteamVR predicts the pose to the frame;
   - shifts the pose time by the radio latency, 12 ms by default and adjustable.
4. **Nothing else is touched.** Headsets, controllers and base stations are never modified. Filtering other IMU trackers already in SteamVR is optional and off by default.

The filter was tuned on a benchmark that models VRChat at 90 Hz with its own motion prediction, so the defaults are chosen for how trackers look in the game, not on a graph.

## The skeleton

Your height comes from your headset: standing eye height ÷ 0.936. You can also type it, or measure your body with the controllers: touch your knees, hip bones and ankles with the bottom of a controller and Ombra measures each segment. Left and right touches that disagree by more than 6 cm are rejected.

Segment lengths are anatomical proportions of your height, for example thigh 24.5 %, shin 24.6 %, chest to hip 19 %.

The body is built by forward kinematics from the headset down: eyes, neck, chest, spine, hip, knees, ankles, feet. Each bone takes its rotation from its sensor, so the headset's real position anchors the whole body.

## Calibration: how each sensor is worn

A sensor is never perfectly straight on your leg. Calibration measures that offset.

While you stand, gravity gives each sensor's "up" and the headset gives "forward".

In the ski pose, knees bent forward, each segment bends around a known axis, and the axis the sensor sees shows how it is turned on the limb. Sensors that bend too little borrow the average of the same kind; one that is twisted, moving or missing is named on screen.

Quick calibration reuses the mounting stored for each tracker, so standing straight is enough until you move a strap.

You can start a calibration from the app, from the SteamVR dashboard, with a double press of the triggers (controllers down) or with **Ctrl+Alt+Shift+Y / U / I**. A T-pose, or taps on a tracker (2 taps reset facing, 3 taps run a quick calibration), can start it too; you can switch these gestures on or off on the Calibration page.

## When a sensor is missing

| Missing | Estimate |
|---|---|
| Hip sensor | Follows the chest |
| Chest sensor | Halfway between the hip and where your head faces |
| Thigh or shin | Each copies the other |
| Foot sensor | Follows the shin's heading |
| A sensor drops out | Its last pose is held relative to its parent for a moment, then blended into the estimate (1 s hysteresis, so a flickering signal doesn't jump) |

## Elbows from the controllers

The elbow lies on a circle: one upper-arm length from the shoulder and one forearm length from the hand. Arm lengths come from your height.

Without arm trackers, the point on that circle comes from how you hold the controller (thumb up: elbow down; palm down: elbow out), blended with a natural rest pose and smoothed over about 60 ms. The shoulder rises a little when the hand goes overhead and comes forward when you reach.

With a sensor on the upper arm, Ombra uses only its tilt, which gravity keeps exact. Drift in the sensor's heading doesn't move the elbow: in tests, 25° of drift gives under 3 cm of elbow error.

## Drift correction

IMU sensors slowly lose their heading (yaw). Ombra never touches tilt, which gravity keeps correct. It corrects heading only, with many small checks that each move a sensor by at most a few degrees per second.

| Check | What it does |
|---|---|
| Head anchor | Over a minute, your chest and hips face where your head faces, on average. |
| Turn matching | Every 120° you turn, the headset's turn is compared with each sensor's turn. This measures the gyro's scale error and drift rate, and corrects both. |
| Learned drift rates | How fast each sensor drifts at rest, and how far it had drifted each time you reset facing. Saved per tracker, so it starts corrected next time. |
| Rest alignment | When you stand still, each segment is pulled toward its neighbours. |
| Walking | While you walk, the legs are lined up with the direction you walk in. |
| Anatomy | A foot can't point 20° away from its shin, a thigh can't point 35° away from the hips while standing, and the knee is a hinge. |
| Lying down | On your back, the chest and hip mounting are corrected from gravity, and drift while lying is cancelled from its trend. |
| Fast catch-up | A large error is fixed while that limb turns quickly, when you can't see it happen. |
| Magnetometer mode (Mode 1) | A magnetic map of your room, so metal and speakers don't pull the compass. |

Every correction freezes while you turn fast, and the total is capped.

Measured on simulated 30-minute sessions with HaritoraX 2 noise, as median leg heading error and 95th percentile:

| Session | Without correction | With Ombra |
|---|---|---|
| Social: standing, walking, talking | 36.5° | 7.1° / 14.5° |
| Dance | 76.2° | 15.3° / 39.4° |
| Seated | 6.5° | 6.0° / 12.7° |

In the social session, the time spent more than 10° off drops from 31.9 % to 13.6 %. The hardest cases today are long dances on cheap IMUs and lying in bed.
