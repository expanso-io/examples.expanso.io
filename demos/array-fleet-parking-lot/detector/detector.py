import json
import time
import os
import random
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ParkingLotDetector:
    def __init__(self):
        self.output_log = os.getenv("OUTPUT_LOG", "/app/logs/detections.jsonl")
        self.fps = float(os.getenv("FPS", "1"))  # Lower FPS for demo
        
        # Vehicle types for synthetic data
        self.vehicle_types = ["car", "motorcycle", "bus", "truck"]
        
        # Parking spot definitions (x1, y1, x2, y2) - these would normally come from config
        self.parking_spots = {
            "A01": (50, 100, 150, 200),
            "A02": (170, 100, 270, 200),
            "A03": (290, 100, 390, 200),
            "A04": (410, 100, 510, 200),
            "B01": (50, 220, 150, 320),
            "B02": (170, 220, 270, 320),
            "B03": (290, 220, 390, 320),
            "B04": (410, 220, 510, 320),
            "C01": (50, 340, 150, 440),
            "C02": (170, 340, 270, 440),
            "C03": (290, 340, 390, 440),
            "C04": (410, 340, 510, 440),
        }
        
        # Ensure output directory exists
        os.makedirs(os.path.dirname(self.output_log), exist_ok=True)
    
    def log_detection(self, detection_data):
        """Log detection to JSONL file"""
        try:
            with open(self.output_log, "a") as f:
                f.write(json.dumps(detection_data) + "\n")
        except Exception as e:
            logger.error(f"Failed to log detection: {e}")
    
    def run(self):
        """Main detection loop with synthetic data"""
        logger.info(f"Starting parking lot detector (synthetic mode)")
        logger.info(f"Output log: {self.output_log}")
        logger.info(f"Processing at {self.fps} FPS")
        
        frame_count = 0
        
        try:
            while True:
                timestamp = datetime.utcnow().isoformat()
                
                # Randomly detect 2-8 vehicles
                num_vehicles = random.randint(2, 8)
                spot_ids = list(self.parking_spots.keys())
                occupied_spots = random.sample(spot_ids, num_vehicles)
                
                for spot_id in occupied_spots:
                    spot_coords = self.parking_spots[spot_id]
                    sx1, sy1, sx2, sy2 = spot_coords
                    
                    # Generate realistic detection data
                    detection = {
                        "timestamp": timestamp,
                        "camera_id": "main_camera",
                        "frame_number": frame_count,
                        "vehicle_type": random.choice(self.vehicle_types),
                        "confidence": round(random.uniform(0.6, 0.95), 3),
                        "bbox_x": sx1 + random.randint(-10, 10),
                        "bbox_y": sy1 + random.randint(-10, 10),
                        "bbox_width": (sx2 - sx1) + random.randint(-20, 20),
                        "bbox_height": (sy2 - sy1) + random.randint(-20, 20),
                        "parking_spot_id": spot_id,
                        "occupied": True
                    }
                    
                    self.log_detection(detection)
                
                logger.info(f"Generated {num_vehicles} synthetic detections at frame {frame_count}")
                frame_count += 1
                time.sleep(1 / self.fps)
                
        except KeyboardInterrupt:
            logger.info("Detection stopped by user")

if __name__ == "__main__":
    detector = ParkingLotDetector()
    detector.run()