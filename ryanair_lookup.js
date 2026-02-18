const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

async function fetchFlights(date, origin, destination, pax = 1) {
  const url = `https://www.ryanair.com/api/booking/v4/en-gb/availability?dateOut=${date}&dateIn=&origin=${origin}&destination=${destination}&isConnectedFlight=false&isReturn=false&fareClass=regular&adult=${pax}&teen=0&child=0&infant=0`;
  const response = await axios.get(url);
  const flights = response.data?.trips?.[0]?.dates?.[0]?.flights;
  return Array.isArray(flights) ? flights : [];
}

app.get('/flight', async (req, res) => {
  const { flightNumber, date, origin, destination, pax } = req.query;
  if (!flightNumber || !date || !origin || !destination) {
    return res.status(400).json({ error: 'Missing required parameters: flightNumber, date, origin, destination' });
  }
  try {
    const flights = await fetchFlights(date, origin, destination, pax || 1);
    // Normalize flight numbers by removing spaces and upper-casing
    const target = flightNumber.replace(/\s+/g, '').toUpperCase();
    const found = flights.find(f => {
      const num = (f.numericFlightNumber || '').replace(/\s+/g, '').toUpperCase();
      return num === target;
    });
    if (found) {
      return res.json({
        flightNumber: found.numericFlightNumber,
        departureLocal: found.departureLocal,
        arrivalLocal: found.arrivalLocal,
      });
    }
    return res.status(404).json({ error: 'Flight not found' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch flight information' });
  }
});

app.get('/dump', async (req, res) => {
  const { date, origin, destination, pax } = req.query;
  if (!date || !origin || !destination) {
    return res.status(400).json({ error: 'Missing required parameters: date, origin, destination' });
  }
  try {
    const flights = await fetchFlights(date, origin, destination, pax || 1);
    res.json(flights);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch flights' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
