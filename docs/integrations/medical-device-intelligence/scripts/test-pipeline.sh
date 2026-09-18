#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLE_DIR="$(dirname "$SCRIPT_DIR")"
REPOSITORY_ROOT="$(cd "$EXAMPLE_DIR/../../.." && pwd)"
FIXTURE_DIR="$REPOSITORY_ROOT/examples/integrations/medical-device-intelligence"

for fixture in maintenance-logs.csv error-events.json technician-notes.txt; do
  test -f "$FIXTURE_DIR/$fixture"
done

if python3 -c "import yaml" 2>/dev/null; then
  python3 -c "import yaml; yaml.safe_load(open('$EXAMPLE_DIR/pipeline.yaml'))"
fi

OUTPUT="$(python3 "$SCRIPT_DIR/analyze_reports.py")"
printf '%s' "$OUTPUT" | python3 -c '
import json, sys
data = json.load(sys.stdin)
candidates = data["review_candidates"]
assert len(candidates) > 0
for candidate in candidates:
    assert set(["candidate_id", "device_id", "review_reason", "source_signals", "evidence_refs"]) <= set(candidate)
'

python3 "$SCRIPT_DIR/mock_receiver.py" 8089 &
RECEIVER_PID=$!
trap 'kill "$RECEIVER_PID" 2>/dev/null || true' EXIT
sleep 1
curl --fail --silent --show-error -X POST http://localhost:8089/api/v1/review-candidates \
  -H "Content-Type: application/json" \
  -d "$OUTPUT" | python3 -c 'import json,sys; assert json.load(sys.stdin)["status"] == "received"'

printf 'Medical-device architecture fixtures and custom analyzer: PASS\n'
