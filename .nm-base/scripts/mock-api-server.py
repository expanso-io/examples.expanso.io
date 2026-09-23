#!/usr/bin/env python3
import json
import time
import random
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

class MockAPIHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlparse(self.path).path
        query = parse_qs(urlparse(self.path).query)
        
        # Simulate different failure modes based on query parameters
        failure_mode = query.get('failure_mode', ['none'])[0]
        
        if failure_mode == 'timeout':
            # Simulate timeout by sleeping longer than circuit breaker timeout
            time.sleep(10)
        elif failure_mode == 'slow':
            # Simulate slow response
            time.sleep(3)
        elif failure_mode == 'error':
            # Simulate HTTP error
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Internal server error"}).encode())
            return
        elif failure_mode == 'intermittent':
            # Randomly fail 50% of requests
            if random.random() < 0.5:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Random failure"}).encode())
                return
        
        # Successful response
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        
        # Extract sensor_id from path if present
        sensor_id = path.split('/')[-1] if path != '/' else 'unknown'
        
        response = {
            "sensor_id": sensor_id,
            "metadata": {
                "location": "Building A, Floor 2",
                "device_type": "temperature_sensor",
                "last_calibration": "2024-01-15T10:00:00Z"
            },
            "status": "healthy",
            "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ')
        }
        
        self.wfile.write(json.dumps(response).encode())
    
    def do_POST(self):
        # Handle POST requests for processing
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        
        # Parse failure mode from headers or body
        failure_mode = self.headers.get('X-Failure-Mode', 'none')
        
        if failure_mode == 'timeout':
            time.sleep(10)
        elif failure_mode == 'error':
            self.send_response(503)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Service unavailable"}).encode())
            return
        
        # Successful response
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        
        response = {
            "processed": True,
            "received_data": post_data.decode() if post_data else None,
            "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ')
        }
        
        self.wfile.write(json.dumps(response).encode())
    
    def log_message(self, format, *args):
        print(f"[MOCK API] {format % args}")

if __name__ == '__main__':
    server = HTTPServer(('localhost', 8081), MockAPIHandler)
    print("Mock API server started on http://localhost:8081")
    print("Failure modes:")
    print("  - ?failure_mode=timeout (10s delay)")
    print("  - ?failure_mode=slow (3s delay)")
    print("  - ?failure_mode=error (500 error)")
    print("  - ?failure_mode=intermittent (random failures)")
    server.serve_forever()
