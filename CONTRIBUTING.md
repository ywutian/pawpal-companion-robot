# Contributing to PawPal

Thanks for improving PawPal. Small, focused changes with tests and clear hardware
claims are easiest to review.

## Development setup

Requirements:

- Node.js 20.19 or newer
- Python 3.10 or newer
- PlatformIO

From the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e supervisor
npm ci
npx playwright install chromium
make verify
```

Install `supervisor[hardware]` instead of `supervisor` only when working with a
physical serial device.

## Change guidelines

1. Keep product rules out of DOM rendering and hardware drivers.
2. Preserve the protocol boundary between supervisor and device.
3. Add or update tests for behavior changes and failure recovery.
4. Do not commit local databases, generated firmware, screenshots, credentials,
   device identifiers, or private recordings.
5. Describe simulated, built, and physically validated behavior separately.
6. Update documentation when commands, wiring, protocol, or validation status change.

## Before opening a pull request

Run the narrowest relevant checks, then run the full suite when practical:

```bash
make test
make build
make qa
```

Include a concise problem statement, the design choice, verification performed,
and any physical hardware used. For UI changes, include a screenshot or short
recording. For protocol changes, document backward-compatibility implications.

By contributing, you agree that your contribution is licensed under the MIT License.
