# ⚽ World Cup Goal Notifier (PWA + Web Push)

App web instalable (iOS y Android) que avisa con **animación de bandera, marcador y sonido**
cuando hay un gol. Un pequeño servidor vigila la API y manda **notificaciones push**
que llegan aunque la app esté cerrada.

## Arrancar

```bash
npm install
npm start
```

Abre http://localhost:3000 → pulsa **Activar avisos 🔔** y **Probar gol de prueba ⚽**.

### Modo simulado (por defecto)
No necesita nada. El servidor inventa partidos y mete goles solos.

```bash
npm start                      # demo, sondeo cada 15s
POLL_SECONDS=3 npm start       # goles más seguido (para probar)
```

### Modo en vivo (datos reales)
Consigue un token gratis en https://www.football-data.org/ y:

```bash
MODE=live FD_TOKEN=tu_token COMPETITION=WC npm start
```

`COMPETITION`: `WC` (Mundial), `CL` (Champions), `PD` (LaLiga), `PL` (Premier)...

## Compartir con amigos (iOS y Android), sin publicar en tiendas

El servidor debe ser accesible desde internet. Lo más rápido:

```bash
npx ngrok http 3000        # te da una URL pública https://xxxx.ngrok-free.app
```

Manda esa URL. Cada persona:
1. La abre en el navegador del móvil.
2. Pulsa **Activar avisos 🔔**.
3. **iPhone**: primero *Compartir → Añadir a pantalla de inicio*, abrir desde el icono,
   y ahí activar los avisos (requisito de iOS 16.4+).

A partir de ahí reciben el aviso de gol con sonido aunque tengan la app cerrada.

## Notas

- **Ventana flotante sobre otras apps**: no es posible en iOS y no se puede desde web.
  El mecanismo cross-platform es la **notificación push** (banner + sonido) + la animación
  a pantalla completa al tocarla.
- Banderas vía flagcdn.com (demo) o los escudos de football-data.org (live).
