import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8010';

function App() {
  const [stats, setStats] = useState({});
  const [spots, setSpots] = useState([]);
  const [history, setHistory] = useState([]);
  const [recentDetections, setRecentDetections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setError(null);
      
      // Fetch all data in parallel
      const [statsRes, spotsRes, historyRes, detectionsRes] = await Promise.all([
        fetch(`${API_URL}/stats`),
        fetch(`${API_URL}/spots`),
        fetch(`${API_URL}/history/24`),
        fetch(`${API_URL}/detections/recent?limit=20`)
      ]);

      if (!statsRes.ok) throw new Error('Failed to fetch stats');
      if (!spotsRes.ok) throw new Error('Failed to fetch spots');
      if (!historyRes.ok) throw new Error('Failed to fetch history');
      if (!detectionsRes.ok) throw new Error('Failed to fetch detections');

      const [statsData, spotsData, historyData, detectionsData] = await Promise.all([
        statsRes.json(),
        spotsRes.json(),
        historyRes.json(),
        detectionsRes.json()
      ]);

      setStats(statsData);
      setSpots(spotsData);
      setHistory(historyData);
      setRecentDetections(detectionsData);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  if (loading) {
    return <div className="loading">Loading parking lot data...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="App">
      <header className="header">
        <h1>🅿️ Fleet Parking Lot Monitor</h1>
        <div className="timestamp">
          Last updated: {new Date(stats.timestamp).toLocaleString()}
        </div>
      </header>

      <div className="dashboard">
        {/* Stats Overview */}
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Spots</h3>
            <div className="stat-value">{stats.total_spots}</div>
          </div>
          <div className="stat-card">
            <h3>Occupied</h3>
            <div className="stat-value occupied">{stats.occupied_spots}</div>
          </div>
          <div className="stat-card">
            <h3>Available</h3>
            <div className="stat-value available">{stats.available_spots}</div>
          </div>
          <div className="stat-card">
            <h3>Occupancy Rate</h3>
            <div className="stat-value">{stats.occupancy_rate}%</div>
          </div>
        </div>

        {/* Parking Lot Visualization */}
        <div className="section">
          <h2>Parking Lot Layout</h2>
          <div className="parking-lot">
            <svg viewBox="0 0 600 500" className="parking-svg">
              {/* Draw parking spots */}
              {spots.map(spot => (
                <g key={spot.id}>
                  <rect
                    x={spot.x1}
                    y={spot.y1}
                    width={spot.x2 - spot.x1}
                    height={spot.y2 - spot.y1}
                    className={`parking-spot ${spot.currently_occupied ? 'occupied' : 'available'}`}
                    stroke="#333"
                    strokeWidth="2"
                  />
                  <text
                    x={spot.x1 + (spot.x2 - spot.x1) / 2}
                    y={spot.y1 + (spot.y2 - spot.y1) / 2}
                    className="spot-label"
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {spot.id}
                  </text>
                  {spot.currently_occupied && (
                    <text
                      x={spot.x1 + (spot.x2 - spot.x1) / 2}
                      y={spot.y1 + (spot.y2 - spot.y1) / 2 + 15}
                      className="vehicle-type"
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      {spot.vehicle_type}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* Occupancy History Chart */}
        <div className="section">
          <h2>24-Hour Occupancy History</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(value) => new Date(value).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                  formatter={(value, name) => [value, name === 'occupancy_rate' ? 'Occupancy %' : name]}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="occupancy_rate" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                  name="Occupancy Rate (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Detections */}
        <div className="section">
          <h2>Recent Vehicle Detections</h2>
          <div className="detections-list">
            {recentDetections.slice(0, 10).map((detection, index) => (
              <div key={detection.id || index} className="detection-item">
                <div className="detection-time">
                  {formatTime(detection.timestamp)}
                </div>
                <div className="detection-info">
                  <span className="vehicle-type">{detection.vehicle_type}</span>
                  {detection.parking_spot_id && (
                    <span className="spot-id">in spot {detection.parking_spot_id}</span>
                  )}
                  <span className="confidence">
                    {Math.round(detection.confidence * 100)}% confidence
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;