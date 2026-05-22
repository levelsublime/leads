import cors from "cors"; // <--- AGREGAR ESTA LÍNEA ARRIBA
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

console.log("Iniciando proceso de servidor híbrido (Vite + Express)...");

async function startServer() {
  const app = express();
  app.use(cors()); // <--- AGREGAR ESTA LÍNEA PARA DAR PERMISO
const PORT = process.env.PORT || 3000;
  app.use(express.json());

  // Inicializar Cliente Gemini
  let ai: GoogleGenAI | null = null;
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  } else {
    console.warn("⚠️ Advertencia: GEMINI_API_KEY no está definida en tu archivo .env.");
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

      // Si no hay API KEY, devolvemos el Mock de demostración offline
      if (!ai) {
        console.warn("Generando respuesta offline porque falta GEMINI_API_KEY...");
        const fallbackValue = generateProfessionalMockProposal({
          sector,
          bottleneck,
          infoManagement,
          interactionVolume,
          clientDesire,
          vendedor,
          clientEmail,
          clientPhone,
          divisa_seleccionada: selectedCurrency,
          latitude,
          longitude
        });
        return res.json(fallbackValue);
      }

      // Enlace de Google Maps corregido con el símbolo $ en latitud
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
          systemInstruction: `Eres un Consultor Tecnológico de Élite de "Sublime Artes IA". Debes responder ÚNICAMENTE con el objeto JSON estructurado según el esquema solicitado.`,
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
      try {
        const parsedData = JSON.parse(responseText);
        res.json(parsedData);
      } catch (jsonErr) {
        console.error("Fallo al parsear el JSON de Gemini:", responseText);
        res.status(500).json({ error: "No se pudo formatear el diagnóstico de IA adecuadamente." });
      }
    } catch (apiErr: any) {
      console.error("Error de API:", apiErr);
      res.status(500).json({ error: apiErr.message || "Error procesando el diagnóstico." });
    }
  });

  // Middleware Vite
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Sublime Artes IA Server corriendo en http://localhost:${PORT}`);
  });
}

// Generador Estático Offline (A prueba de errores de sintaxis)
function generateProfessionalMockProposal(inputs: any) {
  const sector = inputs.sector || "Gastronomía";
  const bottleneck = inputs.bottleneck || "Responder mensajes frecuentes por WhatsApp";
  const info = inputs.infoManagement || "Excel o manual";
  const vendedor = inputs.vendedor || "Jesús";
  const phone = inputs.clientPhone || "+573123456789";
  const email = inputs.clientEmail || "ejemplo@cliente.com";
  const currency: "COP" | "USD" | "EUR" = inputs.divisa_seleccionada || "COP";

  let hoursWasted = 14;
  if (inputs.interactionVolume === "Más de 100") hoursWasted = 24;
  else if (inputs.interactionVolume === "50 a 100") hoursWasted = 18;
  else if (inputs.interactionVolume === "20 a 50") hoursWasted = 12;
  else hoursWasted = 6;

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
  } else {
    divisa_simbolo = "$";
    hourlyRate = 24;
    inversion_sublime = 499;
  }

  const hoursMonth = Math.round(hoursWasted * 4.34);
  const costo_oculto_mensual = Math.round(hoursMonth * hourlyRate);
  const breakEvenMonths = inversion_sublime / costo_oculto_mensual;
  const roi_estimado_dias = Math.max(7, Math.round(breakEvenMonths * 30.4));

  let solutionTitle = "Agente Conversacional WhatsApp 24/7";
  let techDetails = "Diseño de un agente reactivo con Make, Airtable Cloud y Meta Business Cloud API.";
  let keyBenefit = "Liberación total de 2 a 4 horas diarias del equipo.";

  if (bottleneck.includes("Agendar citas") || bottleneck.includes("citas")) {
    solutionTitle = "Sistema de Agendamiento Inteligente con Notificaciones";
    techDetails = "Arquitectura que conecta formularios con Make y Google Calendar para bloquear horarios verificados al instante.";
    keyBenefit = "Reducción a cero de ausencias involuntarias mediante avisos automáticos sincronizados por WhatsApp/SMS.";
  } else if (bottleneck.includes("inventario") || bottleneck.includes("facturación")) {
    solutionTitle = "Sincronizador Automático de Stock e Inventarios";
    techDetails = "Automatización mediante flujos Make que asocia las ventas físicas reportadas con el catálogo en la nube.";
    keyBenefit = "Prevención total de quiebre de stock y automatización del reporte administrativo de inventarios.";
  } else if (bottleneck.includes("prospectos") || bottleneck.includes("Leads")) {
    solutionTitle = "CRM Automatizado de Embudo de Ventas (Pipeline)";
    techDetails = "Implementación ágil que unifica tus canales de redes sociales con un CRM centralizado en Airtable.";
    keyBenefit = "Atención al prospecto en tiempo récord multiplicando la retención de leads calificados.";
  }

  function currentFormat(val: number, cur: string) {
    if (cur === "COP") return `$${val.toLocaleString("es-CO")} COP`;
    if (cur === "EUR") return `€${val.toLocaleString("de-DE")}`;
    return `$${val.toLocaleString("en-US")} USD`;
  }

  const formattedCostoOculto = currentFormat(costo_oculto_mensual, currency);
  const formattedInversion = currentFormat(inversion_sublime, currency);

  const mailContentHTML = `
<div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; background-color: #ffffff;">
  <h2 style="color: #0f172a; border-bottom: 2px solid #f59e0b; padding-bottom: 12px; margin-top: 0;">Propuesta de Solución Tecnológica Exclusiva 🚀</h2>
  <p>Hola,</p>
  <p>Fue un gran gusto hablar contigo sobre el crecimiento de tu negocio en el sector <strong>${sector}</strong>. Basándonos en nuestra sesión de consultoría express, detectamos que la gestión manual de ineficiencias para el proceso de <em>${bottleneck.toLowerCase()}</em> representa un costo oculto mensual de <strong>${formattedCostoOculto}</strong>.</p>
  
  <div style="background-color: #f8fafc; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; border-radius: 4px;">
    <h3 style="margin: 0 0 8px 0; color: #1e293b; font-size: 16px;">PROYECTO: ${solutionTitle}</h3>
    <p style="margin: 0; font-size: 14px; color: #475569;">${techDetails}</p>
    <p style="margin: 8px 0 0 0; font-size: 13px; font-weight: bold; color: #15803d;">⚡ Beneficio Clave: ${keyBenefit}</p>
  </div>

  <p>Nos entusiasma acompañarte en esta transformación con soluciones Low-Code ágiles y robustas. ¿Te parece bien si agendamos una videollamada de 10 minutos para revisar el flujo piloto en vivo?</p>
  <br />
  <p style="margin-bottom: 4px;">Atentamente,</p>
  <strong style="color: #0f172a; font-size: 16px;">${vendedor}</strong><br />
  <span style="color: #64748b; font-size: 12px; font-family: monospace;">Consultor Tecnológico de Élite • Sublime Artes IA</span>
</div>
`;

  const waContentText = `*¡Hola! Un gusto saludarte.* 👋🏼 Soy *${vendedor}* de *Sublime Artes IA*.

Estuve estructurando el análisis financiero de tu negocio en el sector de *${sector}* y detectamos que automatizar el proceso de *${bottleneck.toLowerCase()}* te devolverá unas *${hoursWasted} horas clave a la semana*.

Te armé una propuesta comercial de implementación ágil que se amortiza en tan solo *${roi_estimado_dias} días*:

🚀 *Solución Propuesta:* ${solutionTitle}
📈 *Fuga Operativa Mensual:* ${formattedCostoOculto}
⚡ *Única Inversión:* ${formattedInversion}
💼 *Beneficio:* ${keyBenefit}

¿Te parece si agendamos un Zoom cortito mañana para ver el piloto en vivo? Cuéntame qué tal te queda tu agenda. 😊`;

  return {
    meta: {
      vendedor,
      geolocalizacion: (inputs.latitude !== undefined && inputs.longitude !== undefined) 
        ? `https://www.google.com/maps?q=${inputs.latitude},${inputs.longitude}` 
        : "https://www.google.com/maps?q=4.6097,-74.0817",
      contacto_correo: email,
      contacto_whatsapp: phone,
      divisa_seleccionada: currency
    },
    diagnostico: {
      fuga_tiempo_horas_semanales: hoursWasted,
      fuga_tiempo_descripcion: `La ineficiencia en el proceso de ${bottleneck.toLowerCase()} combinada con el uso de "${info}" provoca una fuga silenciosa.`,
      solucion_propuesta_titulo: solutionTitle,
      solucion_propuesta_detalle: techDetails,
      beneficio_clave: keyBenefit
    },
    analisis_financiero: {
      divisa_simbolo,
      costo_oculto_mensual,
      inversion_sublime,
      roi_estimado_dias
    },
    canales_automatizados: {
      whatsapp_seguimiento_texto: waContentText,
      correo_asunto: `Propuesta de Automatización - Sublime Artes IA 🚀`,
      correo_cuerpo_html: mailContentHTML
    }
  };
}

startServer()
  .then(() => console.log("✅ Secuencia de arranque finalizada."))
  .catch((err) => {
    console.error("🚨 Error crítico al arrancar el servidor:", err);
    process.exit(1);
  });
