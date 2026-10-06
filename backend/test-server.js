import express from "express";

const app = express();

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Servidor mínimo funcionando"
  });
});

app.listen(4000, "0.0.0.0", () => {
  console.log("Test server corriendo en puerto 4000");
});
