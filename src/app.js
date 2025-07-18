import express from 'express';
import axios from 'axios';
import mysql from 'mysql2/promise';

const app = express();
const GOOGLE_MAPS_API_KEY = 'AIzaSyAkAcY2k8f7AVPUia7gpCDLsJ-jrVrFp8I';

// Configuración de la base de datos
const pool = mysql.createPool({
  host: '148.113.168.53',
  user: 'switchsc_bot_whatsapp',
  password: 'bot_whatsapp',
  database: 'switchsc_bot_whatsapp'
});

app.get('/calcular-tarifa', async (req, res) => {
  const { destino } = req.query;

  if (!destino) {
    return res.status(400).json({ error: 'Debe proporcionar el destino.' });
  }

  try {
    const [companyData] = await pool.query(
      'SELECT latitude, longitude, base_value, additional_value FROM company WHERE status = "ACTIVE" LIMIT 1'
    );

    if (companyData.length === 0) {
      return res.status(400).json({ error: 'No se encontró una compañía activa en la base de datos.' });
    }


    const { latitude, longitude, base_value, additional_value } = companyData[0];

    let tarifaBase = base_value;  
    let tarifaAdicional = additional_value ; 
    let latitudOrigen = parseFloat(latitude);
    let longitudOrigen = parseFloat(longitude);

    if (isNaN(latitudOrigen) || isNaN(longitudOrigen)) {
      return res.status(400).json({ error: 'Las coordenadas de origen son inválidas.' });
    }

    // Obtener las coordenadas del destino usando Google Maps Geocoding
    const responseGeocodingDestino = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(destino)},Tulua&key=${GOOGLE_MAPS_API_KEY}`
    );

    const geocodingDataDestino = responseGeocodingDestino.data;
    if (!geocodingDataDestino.results || geocodingDataDestino.results.length === 0) {
      return res.status(400).json({ error: 'No se pudo obtener la latitud y longitud del destino.' });
    }

    const locationDestino = geocodingDataDestino.results[0].geometry.location;
    const latitudDestino = locationDestino.lat;
    const longitudDestino = locationDestino.lng;

    console.log('Coordenadas del origen:', latitudOrigen, longitudOrigen);
    console.log('Coordenadas del destino:', latitudDestino, longitudDestino);

    // Calcular la distancia entre el origen y destino
    const responseDistance = await axios.get(
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${latitudOrigen},${longitudOrigen}&destinations=${latitudDestino},${longitudDestino}&key=${GOOGLE_MAPS_API_KEY}`
    );

    const data = responseDistance.data;

    if (!data.rows || !data.rows[0] || !data.rows[0].elements || !data.rows[0].elements[0]) {
      return res.status(400).json({ error: 'No se pudo calcular la distancia. Respuesta inválida de Google Maps.' });
    }

    const element = data.rows[0].elements[0];

    if (element.status === 'ZERO_RESULTS') {
      return res.status(400).json({ error: 'No se pudo calcular la distancia. No se encontraron resultados para estas coordenadas o ruta.' });
    }

    if (element.status !== 'OK') {
      return res.status(400).json({ error: 'No se pudo calcular la distancia. Google Maps devolvió un error.' });
    }

    const distanciaEnMetros = element.distance.value;
    const distanciaEnKm = distanciaEnMetros / 1000;

    let tarifaTotal = tarifaBase;
    if (distanciaEnKm > 3) {
      const kmExtra = Math.ceil(distanciaEnKm - 3);
      tarifaTotal += kmExtra * tarifaAdicional; 
    }

    res.json({
      distancia: `${distanciaEnKm.toFixed(2)} km`,
      tarifa: `$${tarifaTotal.toFixed(2)}`,
      latitud_origen: latitudOrigen,
      longitud_origen: longitudOrigen,
      latitud_destino: latitudDestino,
      longitud_destino: longitudDestino
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
