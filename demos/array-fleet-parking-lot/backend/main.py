from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text
import os
import json
import logging
import threading
import time
from datetime import datetime, timedelta
from typing import List, Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Fleet Parking Lot API", version="1.0.0")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres123@timescaledb:5432/parking_lot")
engine = create_engine(DATABASE_URL)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Test database connection
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail="Database connection failed")

@app.get("/stats")
async def get_stats():
    """Get current parking lot statistics"""
    try:
        with engine.connect() as conn:
            # Get total spots
            total_result = conn.execute(text("SELECT COUNT(*) as total FROM parking_spots"))
            total_spots = total_result.fetchone()[0]
            
            # Get currently occupied spots (detections in last 30 seconds)
            occupied_result = conn.execute(text("""
                SELECT COUNT(DISTINCT parking_spot_id) as occupied 
                FROM vehicle_detections 
                WHERE timestamp > NOW() - INTERVAL '30 seconds'
                AND parking_spot_id IS NOT NULL
            """))
            occupied_spots = occupied_result.fetchone()[0]
            
            # Get recent detection count
            recent_result = conn.execute(text("""
                SELECT COUNT(*) as recent_detections 
                FROM vehicle_detections 
                WHERE timestamp > NOW() - INTERVAL '1 minute'
            """))
            recent_detections = recent_result.fetchone()[0]
            
            available_spots = total_spots - occupied_spots
            occupancy_rate = (occupied_spots / total_spots * 100) if total_spots > 0 else 0
            
            return {
                "timestamp": datetime.utcnow().isoformat(),
                "total_spots": total_spots,
                "occupied_spots": occupied_spots,
                "available_spots": available_spots,
                "occupancy_rate": round(occupancy_rate, 1),
                "recent_detections": recent_detections
            }
    except Exception as e:
        logger.error(f"Stats query failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to get statistics")

@app.get("/spots")
async def get_spots():
    """Get all parking spots with their current status"""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT 
                    ps.id,
                    ps.x1, ps.y1, ps.x2, ps.y2,
                    ps.status,
                    ps.last_updated,
                    CASE WHEN vd.parking_spot_id IS NOT NULL THEN true ELSE false END as currently_occupied,
                    vd.vehicle_type,
                    vd.confidence
                FROM parking_spots ps
                LEFT JOIN LATERAL (
                    SELECT parking_spot_id, vehicle_type, confidence
                    FROM vehicle_detections 
                    WHERE parking_spot_id = ps.id 
                      AND timestamp > NOW() - INTERVAL '30 seconds'
                    ORDER BY timestamp DESC 
                    LIMIT 1
                ) vd ON true
                ORDER BY ps.id
            """))
            
            spots = []
            for row in result:
                spots.append({
                    "id": row[0],
                    "x1": row[1], "y1": row[2], "x2": row[3], "y2": row[4],
                    "status": row[5],
                    "last_updated": row[6].isoformat() if row[6] else None,
                    "currently_occupied": row[7],
                    "vehicle_type": row[8],
                    "confidence": row[9]
                })
            
            return spots
    except Exception as e:
        logger.error(f"Spots query failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to get parking spots")

@app.get("/detections/recent")
async def get_recent_detections(limit: int = 50):
    """Get recent vehicle detections"""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT id, timestamp, camera_id, vehicle_type, confidence, 
                       bbox_x, bbox_y, bbox_width, bbox_height, parking_spot_id, occupied
                FROM vehicle_detections 
                ORDER BY timestamp DESC 
                LIMIT :limit
            """), {"limit": limit})
            
            detections = []
            for row in result:
                detections.append({
                    "id": row[0],
                    "timestamp": row[1].isoformat(),
                    "camera_id": row[2],
                    "vehicle_type": row[3],
                    "confidence": row[4],
                    "bbox": {"x": row[5], "y": row[6], "width": row[7], "height": row[8]},
                    "parking_spot_id": row[9],
                    "occupied": row[10]
                })
            
            return detections
    except Exception as e:
        logger.error(f"Detections query failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to get detections")

@app.get("/history/{hours}")
async def get_occupancy_history(hours: int = 24):
    """Get occupancy history for the specified number of hours"""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("""
                WITH hourly_stats AS (
                    SELECT 
                        DATE_TRUNC('hour', timestamp) as hour,
                        COUNT(DISTINCT parking_spot_id) as occupied_count
                    FROM vehicle_detections 
                    WHERE timestamp > NOW() - INTERVAL '%s hours'
                    AND parking_spot_id IS NOT NULL
                    GROUP BY DATE_TRUNC('hour', timestamp)
                    ORDER BY hour
                )
                SELECT 
                    hour,
                    occupied_count,
                    (SELECT COUNT(*) FROM parking_spots) as total_spots,
                    (occupied_count::float / (SELECT COUNT(*) FROM parking_spots)::float * 100) as occupancy_rate
                FROM hourly_stats
            """) % hours)
            
            history = []
            for row in result:
                history.append({
                    "timestamp": row[0].isoformat(),
                    "occupied_spots": row[1],
                    "total_spots": row[2],
                    "occupancy_rate": round(row[3], 1) if row[3] else 0
                })
            
            return history
    except Exception as e:
        logger.error(f"History query failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to get occupancy history")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8010)