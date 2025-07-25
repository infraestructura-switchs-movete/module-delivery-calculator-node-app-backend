import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const ARQBS_API_URL = process.env.ARQBS_API_URL;

async function obtenerDatosDeServicio() {
  try {
    const response = await axios.get(`${ARQBS_API_URL}/company/get-company`);
    if (response.data && response.data.length > 0) {
      const company = response.data[0]; 
      return {
        latitude: parseFloat(company.latitude),
        longitude: parseFloat(company.longitude),
        base_value: company.baseValue,
        additional_value: company.additionalValue
      };
    } else {
      throw new Error('No se encontraron empresas activas en el servicio');
    }
  } catch (error) {
    throw new Error('Error al obtener los datos del servicio: ' + error.message);
  }
}

app.get('/calcular-tarifa', async (req, res) => {
  const { destino } = req.query;

  if (!destino) {
    return res.status(400).json({ error: 'Debe proporcionar el destino.' });
  }

  try {
    const { latitude, longitude, base_value, additional_value } = await obtenerDatosDeServicio();

    if (isNaN(latitude) || latitude < -90 || latitude > 90 || isNaN(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Las coordenadas de origen son inválidas.' });
    }

    let tarifaBase = base_value;
    let tarifaAdicional = additional_value;
    let latitudOrigen = latitude;
    let longitudOrigen = longitude;

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

    // Calcular la distancia entre el origen y destino usando la API de Google Maps Distance Matrix
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
    console.error('Error en la ejecución del cálculo de tarifa:', error);
    res.status(500).json({ error: 'Error en el servidor', details: error.message });
  }
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
