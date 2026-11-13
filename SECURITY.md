# Security

## Report a security problem

If you find a security problem in Ombra (the app, its SteamVR driver, the installer, the updater or the firmware updater), report it privately here: **[Report a vulnerability](https://github.com/thadoom/ombra/security/advisories/new)**. Only you and the maintainer can see the report.

Please don't open a public issue for it. Say which Ombra version you use, what someone could do with the problem, and the steps to reproduce it.

## Supported versions

Only the latest release gets security fixes. Ombra tells you when a new version is out and updates in one click.

## Official downloads

Ombra is free. It only comes from:

- the [Releases page](https://github.com/thadoom/ombra/releases) of this repository,
- the website [thadoom.github.io/ombra](https://thadoom.github.io/ombra/), whose Download button points at the same file,
- the updater built into Ombra, which downloads from the same Releases page.

The installer is always called `Ombra-Setup.exe`, and GitHub shows its SHA-256 next to the file on each release. To compare it with the file you have, run `Get-FileHash .\Ombra-Setup.exe` in PowerShell.

Every release is scanned with Microsoft Defender on a GitHub runner and uploaded to VirusTotal by [this workflow](.github/workflows/release-checks.yml). The [VirusTotal report for the latest installer](https://thadoom.github.io/ombra/vt/) is public. The installer isn't code-signed yet, so a couple of engines there can flag it with a generic machine-learning verdict.

A copy that is sold, bundled with something else or hosted anywhere else is not from here: please [let us know](https://github.com/thadoom/ombra/issues/new?template=bug_report.yml) where you found it.
