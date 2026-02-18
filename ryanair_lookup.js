const express = require("express");
const axios = require("axios");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

/* ---------------- CONFIG ---------------- */

const API_KEY = process.env.API_KEY || "CHANGE_THIS_TO_LONG_RANDOM_STRING";
const PORT = process.env.PORT || 3000;
const LOG_FILE = path.join(__dirname, "flight_log.json");

/* ---------------- SECURITY ---------------- */

app.use(cors({ origin: "*" }));

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 60
}));

app.use((req, res, next) => {
  if (req.query.key !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

/* ---------------- UTILITIES ---------------- */

function normalizeFlightNumber(fn) {
  return fn.replace(/\s+/g, "").toUpperCase();
}

function readLog() {
  if (!fs.existsSync(LOG_FILE)) return [];
  return JSON.parse(fs.readFileSync(LOG_FILE));
}

function writeLog(data) {
  fs.writeFileSync(LOG_FILE, JSON.stringify(data, null, 2));
}

/* ---------------- RYANAIR FETCH ---------------- */

async function fetchFlights(date, origin, destination, pax = 1) {

  const response = await axios.get(
    "https://www.ryanair.com/api/booking/v4/en-gb/availability",
    {
      params: {
        ADT: pax,
        CHD: 0,
        INF: 0,
        Origin: origin,
        Destination: destination,
        DateOut: date,
        FlexDaysOut: 0,
        RoundTrip: false,
        ToUs: "AGREED"
      },
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
        "Referer": "https://www.ryanair.com/"
      },
      timeout: 15000
    }
  );

  return response.data?.trips?.[0]?.dates?.[0]?.flights || [];
}

/* ---------------- ROUTES ---------------- */

app.get("/flight", async (req, res) => {

  const { flightNumber, date, origin, destination, pax } = req.query;

  if (!flightNumber || !date || !origin || !destination) {
    return res.status(400).json({
      error: "Required: flightNumber, date, origin, destination"
    });
  }

  try {
    const flights = await fetchFlights(
      date,
      origin.toUpperCase(),
      destination.toUpperCase(),
      pax ? parseInt(pax) : 1
    );

    const target = normalizeFlightNumber(flightNumber);

    const found = flights.find(f =>
      normalizeFlightNumber(f.flightNumber) === target
    );

    if (!found) {
      return res.status(404).json({ error: "Flight not found" });
    }

    res.json({
      flightNumber: found.flightNumber,
      departureLocal: found.time?.[0],
      arrivalLocal: found.time?.[1],
      departureUTC: found.timeUTC?.departure,
      arrivalUTC: found.timeUTC?.arrival
    });

  } catch (err) {
    res.status(500).json({ error: "Ryanair fetch failed" });
  }
});

app.get("/dump", async (req, res) => {

  const { date, origin, destination, pax } = req.query;

  if (!date || !origin || !destination) {
    return res.status(400).json({
      error: "Required: date, origin, destination"
    });
  }

  try {
    const flights = await fetchFlights(
      date,
      origin.toUpperCase(),
      destination.toUpperCase(),
      pax ? parseInt(pax) : 1
    );

    res.json(flights);

  } catch (err) {
    res.status(500).json({ error: "Failed to fetch flights" });
  }
});

/* ---------------- LOGGING ---------------- */

app.post("/log", (req, res) => {

  const entry = req.body;

  if (!entry.flightNumber || !entry.date) {
    return res.status(400).json({
      error: "flightNumber and date required"
    });
  }

  const log = readLog();

  log.push({
    timestamp: new Date().toISOString(),
    ...entry
  });

  writeLog(log);

  res.json({ status: "Logged" });
});

app.get("/logs", (req, res) => {
  res.json(readLog());
});

/* ---------------- START ---------------- */

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
