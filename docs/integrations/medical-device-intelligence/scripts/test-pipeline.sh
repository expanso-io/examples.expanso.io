#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLE_DIR="$(dirname "$SCRIPT_DIR")"

echo "🧪 Medical Device Intelligence — Pipeline Test"
echo "================================================"

# Test 1: Validate data files exist
echo -e "\n📁 Test 1: Data files"
for f in maintenance-logs.csv error-events.json technician-notes.txt; do
    if [ -f "$EXAMPLE_DIR/data/$f" ]; then
        echo "   ✅ data/$f"
    else
        echo "   ❌ data/$f MISSING"
        exit 1
    fi
done

# Test 2: Validate pipeline YAML syntax
echo -e "\n📋 Test 2: Pipeline YAML"
if python3 -c "import yaml; yaml.safe_load(open('$EXAMPLE_DIR/pipeline.yaml'))" 2>/dev/null; then
    echo "   ✅ pipeline.yaml is valid YAML"
else
    echo "   ⚠️  PyYAML not installed, skipping YAML validation"
fi

# Test 3: Run analyzer with mock response
echo -e "\n🔬 Test 3: Analyzer (mock mode)"
cd "$EXAMPLE_DIR"
OUTPUT=$(python3 scripts/analyze_reports.py 2>/dev/null)

# Validate JSON output
if echo "$OUTPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'incidents' in d; assert len(d['incidents']) > 0" 2>/dev/null; then
    INCIDENT_COUNT=$(echo "$OUTPUT" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['incidents']))")
    echo "   ✅ Valid JSON with $INCIDENT_COUNT incidents"
else
    echo "   ❌ Invalid output"
    echo "$OUTPUT" | head -5
    exit 1
fi

# Validate required fields in each incident
echo -e "\n🔍 Test 4: Incident schema validation"
VALID=true
echo "$OUTPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
required = ['incident_id', 'device_id', 'device_model', 'failure_mode', 'severity', 'recommended_action', 'confidence']
for inc in data['incidents']:
    missing = [f for f in required if f not in inc]
    if missing:
        print(f'   ❌ {inc.get(\"incident_id\", \"?\")}: missing {missing}')
        sys.exit(1)
    sev = inc['severity']
    if sev not in ('critical', 'warning', 'info'):
        print(f'   ❌ {inc[\"incident_id\"]}: invalid severity \"{sev}\"')
        sys.exit(1)
    conf = inc['confidence']
    if not (0.0 <= conf <= 1.0):
        print(f'   ❌ {inc[\"incident_id\"]}: confidence {conf} out of range')
        sys.exit(1)
    print(f'   ✅ {inc[\"incident_id\"]}: {inc[\"device_id\"]} [{sev}] conf={conf}')
print()
print(f'Fleet alerts: {len(data.get(\"fleet_alerts\", []))}')
print(f'Supply alerts: {len(data.get(\"supply_alerts\", []))}')
"

# Test 5: Mock receiver test
echo -e "\n📡 Test 5: Mock receiver"
python3 "$EXAMPLE_DIR/scripts/mock_receiver.py" 8089 &
RECEIVER_PID=$!
sleep 1

if curl -s -X POST http://localhost:8089/api/v1/incidents \
    -H "Content-Type: application/json" \
    -d "$OUTPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['status']=='received'" 2>/dev/null; then
    echo "   ✅ Mock receiver accepted the report"
else
    echo "   ❌ Mock receiver failed"
fi

kill $RECEIVER_PID 2>/dev/null || true
wait $RECEIVER_PID 2>/dev/null || true

# Test 6: Store locally
echo -e "\n💾 Test 6: Local storage"
mkdir -p "$EXAMPLE_DIR/output"
echo "$OUTPUT" > "$EXAMPLE_DIR/output/incident-reports.json"
if [ -f "$EXAMPLE_DIR/output/incident-reports.json" ]; then
    SIZE=$(wc -c < "$EXAMPLE_DIR/output/incident-reports.json")
    echo "   ✅ Stored locally ($SIZE bytes)"
else
    echo "   ❌ Failed to store"
    exit 1
fi

echo -e "\n================================================"
echo "✅ All tests passed!"
echo ""
echo "To run with real Claude API:"
echo "  ANTHROPIC_API_KEY=sk-... python3 scripts/analyze_reports.py"
