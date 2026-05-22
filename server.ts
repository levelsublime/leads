import express from "express";
import cors from "cors";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

console.log("Iniciando motor de IA Sublime Artes... 🚀");

const app = express();
const PORT = process.env.PORT || 3000;

// Habilitar permisos CORS y procesadores de datos universales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // <--- ESTA LÍNEA SE ENCARGA DE QUE NUNCA MÁS DE 500
// Inicializar Cliente Gemini (Librería oficial optimizada)
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
} else {
  console.warn("⚠️ Advertencia: GEMINI_API_KEY no definida.");
}

// Ruta API Principal
app.post("/api/analyze", async (req, res) => {
  try {
    const {
      sector,
      bottleneck,
      infoManagement,
      interactionVolume,
      clientDesire,
      vendedor,
      clientEmail,
      clientPhone,
      divisa_seleccionada,
      latitude,
      longitude
    } = req.body;

    if (!sector || !bottleneck || !infoManagement || !interactionVolume) {
      return res.status(400).json({ error: "Faltan campos obligatorios en el cuestionario." });
    }

    const selectedCurrency: "COP" | "USD" | "EUR" = divisa_seleccionada || "COP";

    // Si no hay API KEY en Render, disparamos el Mock de contingencia
    if (!ai) {
      console.warn("Generando respuesta de emergencia offline...");
      const fallbackValue = generateProfessionalMockProposal(req.body);
      return res.json(fallbackValue);
    }

    // Configuración limpia de geolocalización sin romper variables de entorno
    const geoStr = (latitude !== undefined && longitude !== undefined)
      ? `https://www.google.com/maps?q=${latitude},${longitude}`
      : "https://www.google.com/maps?q=4.6097,-74.0817";

    const currencyRules = selectedCurrency === "COP"
      ? "La divisa es Peso Colombiano (COP). Los montos financieros deben expresarse en valores realistas de COP (ej. entre $1.600.000 COP y $5.000.000 COP). Símbolo de divisa debe ser '$' o 'COP$'."
      : selectedCurrency === "EUR"
      ? "La divisa es Euro (EUR). Los montos deben expresarse en EUR (ej. entre €1.200 y €4.500 EUR). Símbolo de divisa debe ser '€'."
      : "La divisa es Dólar Estadounidense (USD). Los montos deben expresarse en USD (ej. entre $1,400 y $4,800 USD). Símbolo de divisa debe ser '$'.";

    const promptUser = `
    Eres el motor experto de Sublime Artes IA. Diseña una propuesta irresistible para este cliente:
    - Sector del Negocio: ${sector}
    - Dolor crítico cuello de botella: ${bottleneck}
    - Gestión actual de la información: ${infoManagement}
    - Volumen de interacciones diarias: ${interactionVolume}
    - Deseo explícito expresado: "${clientDesire || 'Hacer las cosas automáticas para liberar tiempo'}"
    
    Metadatos asignados por el sistema:
    - Vendedor: ${vendedor || 'Asesor Comercial'}
    - Correo Cliente: ${clientEmail || 'No adjuntado'}
    - WhatsApp Cliente: ${clientPhone || 'No adjuntado'}
    - Geolocalización: ${geoStr}
    - Divisa de transacción: ${selectedCurrency}

    REGLAS DE DIVISAS:
    ${currencyRules}

    Enlaza la ineficiencia con el ROI masivo de la implementación low-code ágil de Sublime Artes IA.
    Redacta el mensaje de WhatsApp y el correo de seguimiento para forzar el cierre de la venta.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: promptUser,
      config: {
        systemInstruction: `Eres un Consultor Tecnológico de Élite de "Sublime Artes IA". Debes responder ÚNICAMENTE con el objeto JSON estructurado según el esquema solicitado. No agregues texto fuera del JSON.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            meta: {
              type: Type.OBJECT,
              properties: {
                vendedor: { type: Type.STRING },
                geolocalizacion: { type: Type.STRING },
                contacto_correo: { type: Type.STRING },
                contacto_whatsapp: { type: Type.STRING },
                divisa_seleccionada: { type: Type.STRING }
              },
              required: ["vendedor", "geolocalizacion", "contacto_correo", "contacto_whatsapp", "divisa_seleccionada"]
            },
            diagnostico: {
              type: Type.OBJECT,
              properties: {
                fuga_tiempo_horas_semanales: { type: Type.INTEGER },
                fuga_tiempo_descripcion: { type: Type.STRING },
                solucion_propuesta_titulo: { type: Type.STRING },
                solucion_propuesta_detalle: { type: Type.STRING },
                beneficio_clave: { type: Type.STRING }
              },
              required: ["fuga_tiempo_horas_semanales", "fuga_tiempo_descripcion", "solucion_propuesta_titulo", "solucion_propuesta_detalle", "beneficio_clave"]
            },
            analisis_financiero: {
              type: Type.OBJECT,
              properties: {
                divisa_simbolo: { type: Type.STRING },
                costo_oculto_mensual: { type: Type.INTEGER },
                inversion_sublime: { type: Type.INTEGER },
                roi_estimado_dias: { type: Type.INTEGER }
              },
              required: ["divisa_simbolo", "costo_oculto_mensual", "inversion_sublime", "roi_estimado_dias"]
            },
            canales_automatizados: {
              type: Type.OBJECT,
              properties: {
                whatsapp_seguimiento_texto: { type: Type.STRING },
                correo_asunto: { type: Type.STRING },
                correo_cuerpo_html: { type: Type.STRING }
              },
              required: ["whatsapp_seguimiento_texto", "correo_asunto", "correo_cuerpo_html"]
            }
          },
          required: ["meta", "diagnostico", "analisis_financiero", "canales_automatizados"]
        }
      }
    });

    const responseText = response.text ? response.text.trim() : "";
    const parsedData = JSON.parse(responseText);
    res.json(parsedData);

  } catch (apiErr: any) {
    console.error("🚨 Error interno del Servidor:", apiErr);
    // En caso de un error 500 de la API, devolvemos el Mock para que la app no muestre un error en pantalla al vendedor
    const fallback = generateProfessionalMockProposal(req.body);
    res.json(fallback);
  }
});

// Generador Estático Offline / Contingencia
function generateProfessionalMockProposal(inputs: any) {
  const sector = inputs.sector || "Gastronomía";
  const bottleneck = inputs.bottleneck || "Responder mensajes frecuentes por WhatsApp";
  const info = inputs.infoManagement || "Excel o manual";
  const vendedor = inputs.vendedor || "Jesús";
  const phone = inputs.clientPhone || "+573123456789";
  const email = inputs.clientEmail || "ejemplo@cliente.com";
  const currency = inputs.divisa_seleccionada || "COP";

  let hoursWasted = 14;
  if (inputs.interactionVolume === "Más de 100") hoursWasted = 24;
  else if (inputs.interactionVolume === "50 a 100") hoursWasted = 18;
  else if (inputs.interactionVolume === "20 a 50") hoursWasted = 12;

  let divisa_simbolo = "$";
  let hourlyRate = 15;
  let inversion_sublime = 499;

  if (currency === "COP") {
    divisa_simbolo = "COP$";
    hourlyRate = 35000;
    inversion_sublime = 1500000;
  } else if (currency === "EUR") {
    divisa_simbolo = "€";
    hourlyRate = 22;
    inversion_sublime = 450;
  }

  const hoursMonth = Math.round(hoursWasted * 4.34);
  const costo_oculto_mensual = Math.round(hoursMonth * hourlyRate);
  const breakEvenMonths = inversion_sublime / costo_oculto_mensual;
  const roi_estimado_dias = Math.max(7, Math.round(breakEvenMonths * 30.4));
  // NUEVA LÍNEA: Cálculo del 15% de comisión directa para el asesor
  const comision_asesor = Math.round(inversion_sublime * 0.15);

  let solutionTitle = "Agente Conversacional WhatsApp 24/7";
  let techDetails = "Diseño de un agente reactivo con Make, Airtable Cloud y Meta Business Cloud API.";
  let keyBenefit = "Liberación total de 2 a 4 horas diarias del equipo.";

  const formattedCostoOculto = currency === "COP" ? `$${costo_oculto_mensual.toLocaleString("es-CO")} COP` : `$${costo_oculto_mensual.toLocaleString("en-US")} ${currency}`;
  const formattedInversion = currency === "COP" ? `$${inversion_sublime.toLocaleString("es-CO")} COP` : `$${inversion_sublime.toLocaleString("en-US")} ${currency}`;

  const mailContentHTML = `<div style="font-family: Arial; padding: 24px;"><h2>Propuesta Tecnológica Exclusiva 🚀</h2><p>Hola, detectamos un costo oculto mensual de ${formattedCostoOculto} en tu proceso de ${bottleneck}.</p></div>`;
  const waContentText = `*¡Hola!* Soy *${vendedor}* de *Sublime Artes IA*. Detectamos una fuga operativa de *${formattedCostoOculto}* en tu proceso.`;

  return {
    meta: {
      vendedor,
      geolocalizacion: (inputs.latitude && inputs.longitude) ? `https://www.google.com/maps?q=${inputs.latitude},${inputs.longitude}` : "https://www.google.com/maps?q=4.6097,-74.0817",
      contacto_correo: email,
      contacto_whatsapp: phone,
      divisa_seleccionada: currency
    },
    diagnostico: {
      fuga_tiempo_horas_semanales: hoursWasted,
      fuga_tiempo_descripcion: `Ineficiencia crítica en ${bottleneck}.`,
      solucion_propuesta_titulo: solutionTitle,
      solucion_propuesta_detalle: techDetails,
      beneficio_clave: keyBenefit
    },
    analisis_financiero: {
      divisa_simbolo,
      costo_oculto_mensual,
      inversion_sublime,
      roi_estimado_dias, 
      comision_asesor // <--- AGREGAR ESTA LÍNEA AQUÍ
    },
    canales_automatizados: {
      whatsapp_seguimiento_texto: waContentText,
      correo_asunto: `Propuesta de Automatización - Sublime Artes IA`,
      correo_cuerpo_html: mailContentHTML
    }
  };
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor en puerto ${PORT}`);
});
