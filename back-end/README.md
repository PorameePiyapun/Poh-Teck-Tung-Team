# Case Log Service (simple)

This README explains how to run the small standalone Case Log Service and how to test its API.

Run:

```powershell
cd "back-end/case-log-service"
node service.js
```

The service listens on `http://localhost:4001`.

API endpoints:

- `POST /start-case` — store a new log entry (auto time/GPS). Send JSON body.
  - Example request bodies (JSON):
    - Minimal (auto-generated GPS, id):
      ```json
      {}
      ```
    - Provide case id and GPS:
      ```json
      { "caseId": "CASE123", "gps": { "lat": 13.7, "lng": 100.5 } }
      ```
    - Provide an image (base64 data URI) along with case:
      ```json
      { "caseId": "CASE123", "imageBase64": "data:image/jpeg;base64,/9j/4AAQ..." }
      ```

  - Response: JSON with saved `entry` including `timestamp`, `gps`, and `imagePath` (if image provided).

- `GET /logs` — returns all saved log entries as JSON array.

Where files are stored:

- Logs: `back-end/case-log-service/db.json`
- Saved images: `back-end/data/photos/logs/`

Notes:

- This service is intentionally standalone and does not modify existing project code. It runs on port 4001 so it won't conflict with other servers.
- GPS is simulated if not provided by the caller.

Testing with curl (PowerShell examples):

Start a log with simulated GPS:

```powershell
curl -X POST http://localhost:4001/start-case -H "Content-Type: application/json" -d "{}"
```

Start a log with provided GPS:

```powershell
curl -X POST http://localhost:4001/start-case -H "Content-Type: application/json" -d "{\"caseId\":\"C1\",\"gps\":{\"lat\":13.72,\"lng\":100.52}}"
```

Get logs:

```powershell
curl http://localhost:4001/logs
```
