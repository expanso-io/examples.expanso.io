#!/usr/bin/env python3
"""Local receiver for candidate fleet-review JSON."""

import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer


class ReceiverHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        payload = json.loads(body)
        if not isinstance(payload.get("review_candidates"), list):
            self.send_error(400, "review_candidates must be an array")
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"status": "received"}).encode())

    def log_message(self, format, *args):
        pass


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8089
    HTTPServer(("127.0.0.1", port), ReceiverHandler).serve_forever()


if __name__ == "__main__":
    main()
