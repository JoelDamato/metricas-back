const mongoose = require("mongoose");

// Conexión segura sin parámetros obsoletos
const MONGO_URI =  "mongodb+srv://Scalo:4NAcuxyWdpCk3c1D@scalo.fgada.mongodb.net/nombreBaseDeDatos?retryWrites=true&w=majority" // Cambialo si usás otro nombre o Atlas
mongoose.connect(MONGO_URI);

mongoose.connection.on("connected", () => {
  console.log("✅ Conectado a MongoDB");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ Error de conexión a MongoDB:", err);
});

// Importá tus modelos reales
const Metricas = require("./models/metricasdata");
const Cliente = require("./models/metricascliente");

function crearEstructuraMes() {
  return {
    Agenda: 0,
    "Aplica?": 0,
    "Llamadas efectuadas": 0,
    "Venta Meg": 0,
    Monto: 0,
    "Cash collected": 0,
    "Call Confirm Exitoso": 0,
  };
}

const cashAbrilEsperado = new Set([
  "1e3482517a9580a0bf08d8f00090230c",
  "1e3482517a9580b5ac19d5e3a033aaf6",
  "1e0482517a9580968b38e93423367087",
  "1df482517a958086a3f6c97cc5fe52c3",
  "1de482517a958086ae56c6b101abc3ee",
  "1de482517a958088a876d97f30fb4f89",
  "1dd482517a9580abaf62c3d50a9f12a6",
  "1dd482517a958093b77fdfb530600866",
  "1d9482517a958063a4fdcddab21c492f",
  "1d9482517a9580a6aa7dfc203e0610b8",
  "1d8482517a958006ad9ffd19483a2ca3",
  "1d6482517a95800099b5c0876923e949",
  "1d0482517a9580168cbfde6d7c541997",
  "1ce482517a9580cba337fde53d024e26",
]);

async function main() {
  try {
    const [ventas, llamadas] = await Promise.all([
      Metricas.find({}),
      Cliente.find({})
    ]);

    const acc = {};
    const idsYaSumados = new Set();
    let totalCashAbril = 0;
    let totalPrecioAbril = 0;

    llamadas.forEach(item => {
      const fecha = new Date(item["Fecha de agendamiento"]);
      if (!isNaN(fecha) && item.Agendo === 1) {
        const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
        if (!acc[key]) acc[key] = crearEstructuraMes();

        acc[key].Agenda += 1;

        if (item["Aplica N"] === "1") {
          acc[key]["Aplica?"] += 1;
          acc[key]["Call Confirm Exitoso"] += Number(item["Call confirm exitoso"] || 0);
        }

        acc[key]["Llamadas efectuadas"] += Number(item["Llamadas efectuadas"] || 0);
      }
    });

    ventas.forEach(item => {
      const fecha = new Date(item["Fecha de agendamiento"]);
      const esClub = Number(item["Venta Club"] || 0) === 1;
      if (!isNaN(fecha) && !esClub) {
        const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
        if (!acc[key]) acc[key] = crearEstructuraMes();

        const rawId = item.id || item.ID || item.Id || "";
        const id = rawId.replace(/-/g, "");
        const cash = Number(item["Cash collected total"] || 0);
        const precio = Number(item["Precio"] || 0);

        acc[key]["Venta Meg"] += Number(item["Venta Meg"] || 0);
        acc[key]["Monto"] += precio;
        acc[key]["Cash collected"] += cash;

        if (key === "2025-04" && cash > 0) {
          const incluido = cashAbrilEsperado.has(id);
          if (incluido) {
            totalCashAbril += cash;
            totalPrecioAbril += precio;
            idsYaSumados.add(id);
          }

          console.log("[CASH ABRIL]", {
            idOriginal: rawId,
            idSinGuiones: id,
            cash,
            precio,
            incluido
          });
        }
      }
    });

    console.log("\n💰 TOTAL CASH ABRIL:", totalCashAbril.toFixed(2));
    console.log("💵 TOTAL PRECIO ABRIL:", totalPrecioAbril.toFixed(2));
    console.log("📈 % REAL COBRADO:", totalPrecioAbril > 0 ? ((totalCashAbril / totalPrecioAbril) * 100).toFixed(2) + "%" : "N/A");

    const idsFaltantes = [...cashAbrilEsperado].filter(id => !idsYaSumados.has(id));
    if (idsFaltantes.length > 0) {
      console.warn("\n⚠️ IDs NO ENCONTRADOS:");
      console.table(idsFaltantes);
    } else {
      console.log("\n✅ Todos los IDs esperados fueron incluidos.");
    }

    console.log("\n📦 Resultado agrupado por mes:");
    console.dir(acc, { depth: null });

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    mongoose.disconnect();
  }
}

main();
