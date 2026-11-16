# Mapa de statements

Convierte el log de sesión (`vognis-sesion-*.json`) en un DAG de statements y lo muestra en el navegador.

## Pasos

```bash
python3 -m venv .venv
.venv/bin/pip install "anthropic<1"      # el SDK 0.x acepta temperature=0
export ANTHROPIC_API_KEY=sk-ant-...
.venv/bin/python build_graph.py           # lee vognis-sesion-*.json, escribe graph.json
python3 -m http.server 8000               # abre http://localhost:8000/
```

- Sin `ANTHROPIC_API_KEY`, usa AWS Bedrock con `AWS_BEDROCK_TOKEN` y `AWS_REGION` (del entorno o de `.env`),
  modelo `global.anthropic.claude-sonnet-4-5-20250929-v1:0` (cambiable con `BEDROCK_MODEL`).
- Las respuestas del LLM se guardan en `cache/`; re-ejecutar no vuelve a llamar a la API
  (la clave de caché incluye el texto del evento y los statements previos).
- Se puede pasar otro archivo: `build_graph.py otra-sesion.json -o graph.json`.

## Qué hace

1. **Filtra** eventos (`problem`, `description`, `gamechanger`, `bridge`, `message`, `choice` del usuario;
   `keywords`, `summary`, `cards`, `question`, `reply` del modelo). Cada tarjeta de `cards` y cada
   `intro`/tarjeta de `reply` es un evento aparte.
2. **Extrae** con `claude-sonnet-4-5` (temperatura 0, salida JSON con esquema) statements nuevos,
   repeticiones y aristas `pro`/`con`, sin decirle al LLM quién escribió nada.
3. **Arma** el grafo en código: autor (`User`/`AI`) y timestamp vienen del evento; se descartan aristas a
   ids inexistentes o que no vayan de un statement anterior a uno nuevo, y se verifica que no haya ciclos.

Visualización: relleno según links de salida (azul 0, verde 1 pro, rojo 1 con, gris ≥2), borde naranja = User,
morado = AI.

## Métricas de procedencia humana

```bash
python3 -m unittest test_metrics     # pruebas con grafos de juguete
python3 compute_metrics.py           # graph.json -> metrics.json
```

Luego abre http://localhost:8000/metrics.html: 4 paneles con las mismas posiciones (tiempo
de aparición, m2 50% asegurado, m3 promedio directo, y discordancia m2 vs m3; las semillas sin m3 quedan como "sin entradas").
Snapshot de la versión anterior (discordancia m1 vs m2): `*-m1-m2.*`, en http://localhost:8000/metrics-m1-m2.html.
