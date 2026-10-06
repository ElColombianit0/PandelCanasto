BEGIN;

CREATE TABLE IF NOT EXISTS pagos_desglose (
  pago_id integer NOT NULL REFERENCES pagos(id) ON DELETE CASCADE,
  metodo_pago_id integer NOT NULL REFERENCES metodos_pago(id),
  monto numeric(12,2) NOT NULL CHECK (monto > 0),
  PRIMARY KEY (pago_id, metodo_pago_id)
);

INSERT INTO metodos_pago (nombre)
SELECT 'Mixto'
WHERE NOT EXISTS (SELECT 1 FROM metodos_pago WHERE lower(trim(nombre)) = 'mixto');

-- Las ventas anteriores conservan su medio y monto originales.
CREATE OR REPLACE VIEW ventas_pagos_desglose AS
SELECT v.id AS venta_id, p.id AS pago_id, mp.id AS metodo_pago_id,
       mp.nombre AS metodo_pago, COALESCE(d.monto, v.total) AS monto
FROM ventas v
JOIN pagos p ON p.id = v.pago_id
LEFT JOIN pagos_desglose d ON d.pago_id = p.id
JOIN metodos_pago mp ON mp.id = COALESCE(d.metodo_pago_id, p.metodo_pago_id);

COMMIT;
