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
        
    def check_overlap(self, bbox, spot_coords):
        """Check if vehicle bounding box overlaps with parking spot"""
        x1, y1, x2, y2 = bbox
        sx1, sy1, sx2, sy2 = spot_coords
        
        # Calculate intersection area
        ix1 = max(x1, sx1)
        iy1 = max(y1, sy1)
        ix2 = min(x2, sx2)
        iy2 = min(y2, sy2)
        
        if ix1 < ix2 and iy1 < iy2:
            intersection = (ix2 - ix1) * (iy2 - iy1)
            bbox_area = (x2 - x1) * (y2 - y1)
            overlap_ratio = intersection / bbox_area if bbox_area > 0 else 0
            return overlap_ratio > 0.3  # 30% overlap threshold
        
        return False
    
    def log_detection(self, detection_data):
        """Log detection to JSONL file"""
        try:
            with open(self.output_log, "a") as f:
                f.write(json.dumps(detection_data) + "\n")
        except Exception as e:
            logger.error(f"Failed to log detection: {e}")
    
    def process_frame(self, frame, frame_count):
        """Process a single frame for vehicle detection"""
        results = self.model(frame, verbose=False)
        
        detections = []
        timestamp = datetime.utcnow().isoformat()
        
        for result in results:
            boxes = result.boxes
            if boxes is not None:
                for box in boxes:
                    # Get class and confidence
                    cls = int(box.cls[0])
                    confidence = float(box.conf[0])
                    
                    # Only process vehicles with good confidence
                    if cls in self.vehicle_classes and confidence > 0.5:
                        # Get bounding box coordinates
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
                        
                        vehicle_type = self.class_names[cls]
                        
                        # Check which parking spot this vehicle occupies
                        parking_spot_id = None
                        for spot_id, spot_coords in self.parking_spots.items():
                            if self.check_overlap((x1, y1, x2, y2), spot_coords):
                                parking_spot_id = spot_id
                                break
                        
                        detection = {
                            "timestamp": timestamp,
                            "camera_id": "main_camera",
                            "frame_number": frame_count,
                            "vehicle_type": vehicle_type,
                            "confidence": round(confidence, 3),
                            "bbox_x": x1,
                            "bbox_y": y1,
                            "bbox_width": x2 - x1,
                            "bbox_height": y2 - y1,
                            "parking_spot_id": parking_spot_id,
                            "occupied": parking_spot_id is not None
                        }
                        
                        detections.append(detection)
                        self.log_detection(detection)
        
        return detections
    
    def run(self):
        """Main detection loop"""
        logger.info(f"Starting parking lot detector")
        logger.info(f"Video source: {self.video_source}")
        logger.info(f"Output log: {self.output_log}")
        logger.info(f"Processing at {self.fps} FPS")
        
        # Open video source
        cap = cv2.VideoCapture(self.video_source)
        if not cap.isOpened():
            logger.error(f"Failed to open video source: {self.video_source}")
            # Create a dummy frame for testing
            logger.info("Creating synthetic detection data for demo")
            self.create_demo_data()
            return
        
        frame_interval = int(cap.get(cv2.CAP_PROP_FPS) / self.fps) if self.fps > 0 else 30
        frame_count = 0
        processed_count = 0
        
        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    logger.info("End of video reached, restarting...")
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue
                
                # Process every Nth frame based on desired FPS
                if frame_count % frame_interval == 0:
                    detections = self.process_frame(frame, processed_count)
                    logger.info(f"Processed frame {processed_count}, found {len(detections)} vehicles")
                    processed_count += 1
                
                frame_count += 1
                time.sleep(1 / self.fps)
                
        except KeyboardInterrupt:
            logger.info("Detection stopped by user")
        finally:
            cap.release()
    
    def create_demo_data(self):
        """Create synthetic detection data for demo purposes"""
        import random
        
        spot_ids = list(self.parking_spots.keys())
        vehicle_types = ["car", "motorcycle", "bus", "truck"]
        
        while True:
            timestamp = datetime.utcnow().isoformat()
            
            # Randomly detect 3-8 vehicles
            num_vehicles = random.randint(3, 8)
            occupied_spots = random.sample(spot_ids, num_vehicles)
            
            for spot_id in occupied_spots:
                spot_coords = self.parking_spots[spot_id]
                sx1, sy1, sx2, sy2 = spot_coords
                
                # Generate realistic detection data
                detection = {
                    "timestamp": timestamp,
                    "camera_id": "main_camera",
                    "frame_number": int(time.time()),
                    "vehicle_type": random.choice(vehicle_types),
                    "confidence": round(random.uniform(0.6, 0.95), 3),
                    "bbox_x": sx1 + random.randint(-10, 10),
                    "bbox_y": sy1 + random.randint(-10, 10),
                    "bbox_width": (sx2 - sx1) + random.randint(-20, 20),
                    "bbox_height": (sy2 - sy1) + random.randint(-20, 20),
                    "parking_spot_id": spot_id,
                    "occupied": True
                }
                
                self.log_detection(detection)
            
            logger.info(f"Generated {num_vehicles} synthetic detections")
            time.sleep(1 / self.fps)

if __name__ == "__main__":
    detector = ParkingLotDetector()
    detector.run()