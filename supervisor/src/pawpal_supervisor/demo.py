from __future__ import annotations

import argparse
import json
import time

from .controller import RobotController
from .protocol import event_command, set_mode_command
from .transport import RecordingTransport, SerialTransport


DEMO_STEPS = (
    ("mode", "companion", 1.0),
    ("mode", "training", 1.0),
    ("event", "training_success", 2.0),
    ("mode", "monitoring", 1.0),
    ("event", "alert_raised", 2.0),
    ("event", "alert_cleared", 1.0),
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run the PawPal product-mode demo")
    parser.add_argument("--port", help="ESP32 serial port, for example /dev/ttyACM0")
    parser.add_argument("--speed", type=float, default=1.0, help="delay multiplier")
    parser.add_argument(
        "--dry-run", action="store_true", help="print commands without requiring hardware"
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    if not args.dry_run and not args.port:
        raise SystemExit("provide --port or use --dry-run")

    transport = RecordingTransport() if args.dry_run else SerialTransport(args.port)
    controller = RobotController(transport)
    try:
        for kind, value, delay_seconds in DEMO_STEPS:
            command = (
                set_mode_command(value) if kind == "mode" else event_command(value)
            )
            print(json.dumps(command, ensure_ascii=False))
            if not args.dry_run:
                ack = controller.execute(command)
                print(json.dumps(ack, ensure_ascii=False))
            else:
                controller.send(command)
            time.sleep(max(0.0, delay_seconds * args.speed))
    finally:
        controller.close()


if __name__ == "__main__":
    main()
