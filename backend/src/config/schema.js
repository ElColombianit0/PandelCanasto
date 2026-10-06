import { pool } from "./db.js";

export async function asegurarEsquemaDB() {
  await pool.query(`
    ALTER TABLE receta_ingredientes
    ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_receta_ingredientes_receta_activo
    ON receta_ingredientes (receta_id, activo)
  `);

  await pool.query(`
    ALTER TABLE sucursales
    ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true
  `);

  await pool.query(`
    ALTER TABLE ventas
    ADD COLUMN IF NOT EXISTS sucursal_id integer REFERENCES sucursales(id)
  `);

  await pool.query(`
    UPDATE ventas v
    SET sucursal_id = u.sucursal_id
    FROM usuarios u
    WHERE v.usuario_id = u.id
    AND v.sucursal_id IS NULL
    AND u.sucursal_id IS NOT NULL
  `);

  await pool.query(`
    ALTER TABLE gastos_operativos
    ADD COLUMN IF NOT EXISTS tipo character varying(30) NOT NULL DEFAULT 'VARIABLE',
    ADD COLUMN IF NOT EXISTS categoria character varying(80),
    ADD COLUMN IF NOT EXISTS fecha date DEFAULT (timezone('America/Bogota', now()))::date,
    ADD COLUMN IF NOT EXISTS periodo_mes date,
    ADD COLUMN IF NOT EXISTS cantidad numeric(12,2) NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS valor_unitario numeric(12,2),
    ADD COLUMN IF NOT EXISTS recurrente boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS sucursal_id integer REFERENCES sucursales(id)
  `);

  await pool.query(`
    UPDATE gastos_operativos
    SET
      valor_unitario = COALESCE(valor_unitario, monto),
      periodo_mes = COALESCE(periodo_mes, date_trunc('month', COALESCE(fecha, creado_en)::timestamp)::date),
      categoria = COALESCE(categoria, concepto)
    WHERE valor_unitario IS NULL
    OR periodo_mes IS NULL
    OR categoria IS NULL
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS horas_extra_empleados (
      id serial PRIMARY KEY,
      usuario_id integer NOT NULL REFERENCES usuarios(id),
      sucursal_id integer REFERENCES sucursales(id),
      tipo character varying(30) NOT NULL DEFAULT 'EXTRA_DIURNA',
      fecha date NOT NULL DEFAULT (timezone('America/Bogota', now()))::date,
      hora_inicio time,
      horas numeric(8,2) NOT NULL DEFAULT 0,
      valor_hora numeric(12,2) NOT NULL DEFAULT 0,
      multiplicador numeric(8,2) NOT NULL DEFAULT 1,
      total numeric(12,2) NOT NULL DEFAULT 0,
      observacion text,
      creado_en timestamp without time zone DEFAULT timezone('America/Bogota', now())
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_horas_extra_periodo
    ON horas_extra_empleados (fecha, usuario_id)
  `);

  await pool.query(`
    UPDATE costos_variables
    SET nombre = 'kwh_luz',
        unidad = COALESCE(unidad, 'kWh'),
        activo = true
    WHERE tipo = 'LUZ'
  `);

  await pool.query(`
    INSERT INTO costos_variables (nombre, tipo, valor, unidad, activo)
    SELECT 'kwh_luz', 'LUZ', 0, 'kWh', true
    WHERE NOT EXISTS (SELECT 1 FROM costos_variables WHERE tipo = 'LUZ')
  `);

  await pool.query(`
    UPDATE costos_variables
    SET nombre = 'gas',
        unidad = COALESCE(unidad, 'unidad'),
        activo = true
    WHERE tipo = 'GAS'
  `);

  await pool.query(`
    INSERT INTO costos_variables (nombre, tipo, valor, unidad, activo)
    SELECT 'gas', 'GAS', 0, 'unidad', true
    WHERE NOT EXISTS (SELECT 1 FROM costos_variables WHERE tipo = 'GAS')
  `);

  await pool.query(`
    UPDATE costos_variables
    SET nombre = 'mano_obra_hora',
        unidad = COALESCE(unidad, 'hora'),
        activo = true
    WHERE tipo = 'MANO_OBRA'
  `);

  await pool.query(`
    INSERT INTO costos_variables (nombre, tipo, valor, unidad, activo)
    SELECT 'mano_obra_hora', 'MANO_OBRA', 0, 'hora', true
    WHERE NOT EXISTS (SELECT 1 FROM costos_variables WHERE tipo = 'MANO_OBRA')
  `);
}
