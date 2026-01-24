"""Loopback-only demo server; intentionally not an Internet production server."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
from urllib.parse import urlsplit

from .application import Application


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, application, directory, **kwargs):
        self.application = application
        super().__init__(*args, directory=directory, **kwargs)

    def reply(self, status, payload):
        content = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(content)

    def valid_host(self):
        host = self.headers.get("Host", "")
        return host in {f"127.0.0.1:{self.server.server_port}",
                        f"localhost:{self.server.server_port}"}

    def do_GET(self):
        if not self.valid_host():
            self.reply(403, {"error": "loopback host required"})
            return
        path = urlsplit(self.path).path
        if path in {"/api/status", "/api/report"}:
            try:
                self.reply(200, self.application.status())
            except Exception as error:
                self.reply(503, {"error": f"Supervisor unavailable: {error}"})
        elif path.startswith("/api/"):
            self.reply(404, {"error": "unknown API route"})
        else:
            super().do_GET()

    def do_POST(self):
        origin = self.headers.get("Origin")
        if not self.valid_host() or (origin and origin != f"http://{self.headers.get('Host')}"):
            self.reply(403, {"error": "same-origin loopback requests only"})
            return
        if self.headers.get_content_type() != "application/json":
            self.reply(415, {"error": "application/json required"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 8192:
                self.reply(413, {"error": "request body must be 1–8192 bytes"})
                return
            body = json.loads(self.rfile.read(length))
            if not isinstance(body, dict):
                raise ValueError("request body must be an object")
            self.reply(200, self.application.mutate(urlsplit(self.path).path, body))
        except (ValueError, TypeError) as error:
            self.reply(400, {"error": str(error)})
        except Exception as error:
            self.reply(503, {"error": f"Supervisor unavailable: {error}"})

    def log_message(self, format, *args):
        if args and str(args[1]) not in {"200", "304"}:
            super().log_message(format, *args)


def create_server(root, database, port=8080):
    application = Application(root, database)
    handler = partial(Handler, application=application, directory=str(root / "simulator"))
    try:
        server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    except Exception:
        application.close()
        raise
    return server, application


def main():
    root = Path(__file__).resolve().parents[3]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--db", type=Path, default=root / ".data/pawpal.sqlite3")
    args = parser.parse_args()
    server, application = create_server(root, args.db, args.port)
    stopped = threading.Event()

    def advance():
        while not stopped.wait(.2):
            try:
                application.tick()
            except Exception as error:
                application.error = str(error)

    worker = threading.Thread(target=advance, daemon=True)
    worker.start()
    print(f"PawPal Python supervisor: http://127.0.0.1:{server.server_port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        stopped.set()
        worker.join(timeout=5)
        server.server_close()
        application.close()


if __name__ == "__main__":
    main()
