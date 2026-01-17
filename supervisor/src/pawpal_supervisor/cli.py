from __future__ import annotations

import argparse
import json

from .controller import RobotController
from .protocol import event_command, set_mode_command
from .transport import SerialTransport


def main() -> None:
    parser = argparse.ArgumentParser(description="Send one command to PawPal")
    parser.add_argument("--port", required=True)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--mode")
    group.add_argument("--event")
    parser.add_argument("--intensity", type=float, default=0.0)
    args = parser.parse_args()

    controller = RobotController(SerialTransport(args.port))
    try:
        command = (
            set_mode_command(args.mode)
            if args.mode
            else event_command(args.event, args.intensity)
        )
        print(json.dumps(controller.execute(command), ensure_ascii=False))
    finally:
        controller.close()


if __name__ == "__main__":
    main()
