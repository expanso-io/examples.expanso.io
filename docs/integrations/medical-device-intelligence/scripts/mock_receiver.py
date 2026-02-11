#!/usr/bin/env python3
"""
Mock External Endpoint Receiver

Simple HTTP server that accepts POST requests and logs them.
Simulates a central fleet management dashboard receiving
structured incident reports from edge sites.
"""

import json
import sys
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler


class ReceiverHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            data = json.loads(body)
            formatted = json.dumps(data, indent=2)
        except json.JSONDecodeError:
            formatted = body.decode("utf-8", errors="replace")

        timestamp = datetime.utcnow().isoformat() + "Z"
        print(f"\n{'='*60}")
        print(f"📥 Received POST at {timestamp}")
        print(f"   Path: {self.path}")
        print(f"   Content-Type: {self.headers.get('Content-Type', 'unknown')}")
        print(f"   Size: {content_length} bytes")
        print(f"{'='*60}")

        if isinstance(data, dict):
            if "incidents" in data:
                print(f"\n🏥 Site: {data.get('site', 'unknown')}")
                print(f"📋 Batch: {data.get('batch_id', 'unknown')}")
                print(f"🔍 Incidents: {len(data['incidents'])}")
                for inc in data["incidents"]:
                    severity_icon = {
                        "critical": "🔴",
                        "warning": "🟡",
                        "info": "🟢",
                    }.get(inc.get("severity", ""), "⚪")
                    print(
                        f"   {severity_icon} {inc.get('incident_id', '?')}: "
                        f"{inc.get('device_id', '?')} — {inc.get('failure_mode', '?')}"
                    )
                if data.get("fleet_alerts"):
                    print(f"\n⚠️  Fleet Alerts: {len(data['fleet_alerts'])}")
                    for alert in data["fleet_alerts"]:
                        print(f"   • {alert.get('alert', '?')}")
                if data.get("supply_alerts"):
                    print(f"\n📦 Supply Alerts: {len(data['supply_alerts'])}")
                    for alert in data["supply_alerts"]:
                        print(
                            f"   • {alert.get('item', '?')} — "
                            f"stock: {alert.get('current_stock', '?')}, "
                            f"order: {alert.get('recommended_order', '?')}"
                        )
            else:
                print(f"\n{formatted[:2000]}")
        else:
            print(f"\n{formatted[:2000]}")

        print(f"\n{'='*60}\n")

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(
            json.dumps({"status": "received", "timestamp": timestamp}).encode()
        )

    def log_message(self, format, *args):
        # Suppress default request logging
        pass


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8089
    server = HTTPServer(("0.0.0.0", port), ReceiverHandler)
    print(f"🏥 Mock Fleet Management Dashboard")
    print(f"   Listening on http://0.0.0.0:{port}")
    print(f"   Waiting for incident reports from edge sites...\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()


if __name__ == "__main__":
    main()
