#!/usr/bin/env bash
# Reset Hub clinical data for a clean restart.
# Usage: sudo CIS-Deployment/scripts/reset-hub-clinical-data.sh [--all-units] [--full-mongo]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

REMOVE_R2=false
FULL_MONGO=false
for arg in "$@"; do
  case "$arg" in
    --all-units) REMOVE_R2=true ;;
    --full-mongo) FULL_MONGO=true ;;
  esac
done

echo "=== Reset Hub clinical data ==="
echo "Before:"
docker exec CIS-postgres psql -U icu_hub -d icu_hub -c \
  "SELECT 'patients' AS entity, COUNT(*) FROM hub_patients
   UNION ALL SELECT 'units', COUNT(*) FROM hub_units
   UNION ALL SELECT 'beds', COUNT(*) FROM hub_beds;"

echo "Clearing patients and clinical charts..."
docker exec CIS-postgres psql -U icu_hub -d icu_hub -v ON_ERROR_STOP=1 \
  -c "DELETE FROM hub_fluid_entries;" \
  -c "DELETE FROM hub_score_snapshots;" \
  -c "DELETE FROM hub_clinical_notes;" \
  -c "DELETE FROM hub_orders;" \
  -c "DELETE FROM hub_lab_results;" \
  -c "DELETE FROM hub_imaging_studies;" \
  -c "DELETE FROM hub_bed_assignments;" \
  -c "DELETE FROM hub_admission_drafts;" \
  -c "DELETE FROM hub_patient_visits;" \
  -c "DELETE FROM hub_patients;" \
  -c "DELETE FROM hub_mongo_sync_log;"

if [[ "$REMOVE_R2" == true ]]; then
  echo "Removing ALL units and beds..."
  docker exec CIS-postgres psql -U icu_hub -d icu_hub -v ON_ERROR_STOP=1 \
    -c "DELETE FROM hub_beds;" \
    -c "DELETE FROM hub_units;"
else
  echo "Removing Cardiac ICU and other non-R2 units..."
  docker exec CIS-postgres psql -U icu_hub -d icu_hub -v ON_ERROR_STOP=1 \
    -c "DELETE FROM hub_beds WHERE unit_id IN (SELECT id FROM hub_units WHERE center_id = 'RTWO' AND UPPER(code) <> 'R2');" \
    -c "DELETE FROM hub_units WHERE center_id = 'RTWO' AND UPPER(code) <> 'R2';"
fi

echo "After:"
docker exec CIS-postgres psql -U icu_hub -d icu_hub -c \
  "SELECT code, name FROM hub_units ORDER BY name;
   SELECT COUNT(*) AS patients FROM hub_patients;
   SELECT COUNT(*) AS beds FROM hub_beds;"

if [[ "$FULL_MONGO" == true ]]; then
  docker exec CIS-mongodb mongosh -u monish -p "admin@123" --authenticationDatabase admin --quiet --eval \
    'const h=db.getSiblingDB("v2-ICU-Connect"); print("patients:"+h.patientInfoEntity.deleteMany({}).deletedCount); print("beds cleared:"+h.centerEntity.updateOne({_id:"RTWO"},{$set:{beds:[]}}).modifiedCount);'
else
  docker exec CIS-mongodb mongosh -u monish -p "admin@123" --authenticationDatabase admin --quiet --eval \
    'const h=db.getSiblingDB("v2-ICU-Connect"); print("patients:"+h.patientInfoEntity.deleteMany({}).deletedCount); const d=h.centerEntity.findOne({_id:"RTWO"}); let b=d&&d.beds?d.beds:[]; b=b.map(x=>{const c=Object.assign({},x); delete c.patient; delete c.devices; return c;}); h.centerEntity.updateOne({_id:"RTWO"},{$set:{beds:b}}); print("mongo beds kept:"+b.length);'
fi

curl -sf -X POST http://127.0.0.1:7020/api/center/reload >/dev/null 2>&1 || true
echo "Done. Hard-refresh browser: Ctrl+Shift+R"
