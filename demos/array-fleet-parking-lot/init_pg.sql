-- Create vehicle detections table
CREATE TABLE vehicle_detections (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    camera_id VARCHAR(50) NOT NULL,
    vehicle_type VARCHAR(50),
    confidence FLOAT,
    bbox_x INTEGER,
    bbox_y INTEGER, 
    bbox_width INTEGER,
    bbox_height INTEGER,
    parking_spot_id VARCHAR(20),
    occupied BOOLEAN DEFAULT FALSE
);

-- Create index on timestamp for better query performance
CREATE INDEX idx_vehicle_detections_timestamp ON vehicle_detections(timestamp);
CREATE INDEX idx_vehicle_detections_spot ON vehicle_detections(parking_spot_id);

-- Create parking spots table
CREATE TABLE parking_spots (
    id VARCHAR(20) PRIMARY KEY,
    x1 INTEGER NOT NULL,
    y1 INTEGER NOT NULL,
    x2 INTEGER NOT NULL,
    y2 INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'available',
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Create aggregated stats table
CREATE TABLE parking_stats (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    total_spots INTEGER,
    occupied_spots INTEGER,
    available_spots INTEGER,
    occupancy_rate FLOAT
);

-- Create index for stats queries
CREATE INDEX idx_parking_stats_timestamp ON parking_stats(timestamp);

-- Insert some sample parking spots (grid layout for demo)
INSERT INTO parking_spots (id, x1, y1, x2, y2) VALUES
('A01', 50, 100, 150, 200),
('A02', 170, 100, 270, 200),
('A03', 290, 100, 390, 200),
('A04', 410, 100, 510, 200),
('B01', 50, 220, 150, 320),
('B02', 170, 220, 270, 320),
('B03', 290, 220, 390, 320),
('B04', 410, 220, 510, 320),
('C01', 50, 340, 150, 440),
('C02', 170, 340, 270, 440),
('C03', 290, 340, 390, 440),
('C04', 410, 340, 510, 440);

-- Create view for current occupancy
CREATE VIEW current_occupancy AS
SELECT 
    ps.id,
    ps.x1, ps.y1, ps.x2, ps.y2,
    ps.status,
    ps.last_updated,
    CASE WHEN vd.id IS NOT NULL THEN true ELSE false END as currently_occupied
FROM parking_spots ps
LEFT JOIN LATERAL (
    SELECT id, parking_spot_id 
    FROM vehicle_detections 
    WHERE parking_spot_id = ps.id 
      AND timestamp > NOW() - INTERVAL '30 seconds'
    ORDER BY timestamp DESC 
    LIMIT 1
) vd ON true;