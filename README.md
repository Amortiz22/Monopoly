# Magnate CDMX

Juego de compraventa de propiedades para Android, ambientado en la Ciudad de México. Usa las reglas clásicas: compras colonias, cobras renta, construyes casas y hoteles, hipotecas, haces intercambios y gana quien no quiebre.

## Modos de juego

- **Un jugador:** tú contra 1 a 5 rivales de la computadora. También puedes agregar hasta 3 personas más en el mismo teléfono, que se lo van pasando en su turno. La partida se guarda sola.
- **Multijugador:** una persona toca **Crear sala** y comparte el código de 5 letras. Los demás tocan **Unirme** y escriben el código. Solo pueden entrar quienes tengan la app. El anfitrión puede rellenar lugares con jugadores de la computadora (de 2 a 6 jugadores en total).

### Modos de juego (en un jugador y en las salas)
- **Clásico:** las reglas de siempre. Gana el último que no quiebre.
- **Rápido:** cada quien empieza con 3 propiedades al azar. Al terminar la ronda 20 gana quien tenga más patrimonio.
- **Fiesta:** empiezas con $2,000. Impuestos, multas y fianzas van a un bote que se lleva quien caiga en el Estacionamiento. Caer justo en la Salida paga $400.
- **Actuarial:** tu efectivo gana 2% de interés por ronda (máx. $100). Puedes contratar un seguro que cubre 80% de las rentas por 5 rondas, con suma asegurada de $1,000 y prima = valor esperado + 20% de recargo. Las cartas son de Siniestros y Reservas.
- **Millonario:** gana el primero en juntar $4,000 de patrimonio (dinero + propiedades + casas).

En las salas, el modo lo elige el anfitrión y los invitados lo ven antes de empezar.

### Cómo funciona el multijugador
Los teléfonos se conectan directamente entre sí (WebRTC, con la librería PeerJS). No hay que montar ni pagar ningún servidor: el servidor público gratuito de PeerJS solo sirve para que los teléfonos se encuentren por el código.

- El **anfitrión** lleva la partida: tiene que tener la app abierta y en pantalla. Si la cierra, la partida se termina para todos.
- Si un invitado pierde la conexión, la app reintenta sola. Si en 20 segundos no ha vuelto, la computadora juega por él hasta que regrese. Para volver, abre la app, toca **Unirme** y escribe el mismo código.
- Funciona con Wi-Fi o con datos y entre redes distintas. En algunas redes muy cerradas (de empresa o escuela) la conexión directa puede fallar.

## Cómo obtener el APK

### Opción A: GitHub (no instalas nada)
1. Crea un repositorio en GitHub y sube todo el contenido de esta carpeta.
2. Ve a la pestaña **Actions**. El flujo **Compilar APK** corre solo con cada push (o lo lanzas a mano con *Run workflow*).
3. Cuando termine (unos 5 minutos), abre la ejecución y descarga **MagnateCDMX-apk**. Adentro está `MagnateCDMX.apk`.
4. Pásalo a tu teléfono y a los de tus amigos, ábrelo y permite "instalar apps de origen desconocido".

### Opción B: en tu computadora
Necesitas Node 22+ y Android Studio (con JDK 21).
```bash
npm install
npx cap sync android
npx cap open android     # abre Android Studio → Run, o Build > Build APK(s)
```

### Versión web (iPhone y cualquier navegador)
El flujo **Publicar versión web** sube la carpeta `www` a GitHub Pages con cada push. Antes, activa una vez *Settings → Pages → Source: GitHub Actions*. El enlace queda como `https://TU_USUARIO.github.io/NOMBRE_DEL_REPO/`. En iPhone: ábrelo en Safari → Compartir → **Agregar a inicio**. Se juega en las mismas salas que la app de Android.

### Probar en el navegador
```bash
npm run serve            # luego abre http://localhost:8080
```

## Estructura
- `www/js/engine.js`: reglas, tablero, cartas e inteligencia de los rivales
- `www/js/net.js`: salas y conexión entre teléfonos
- `www/js/app.js`: interfaz
- `www/css/style.css`: estilos
- `android/`: proyecto nativo (Capacitor)

## Notas
- El APK se firma con `android/app/magnate.keystore`, así que las versiones nuevas se instalan encima de las anteriores. Esa llave sirve para compartir con amigos. Si algún día lo subes a Google Play, crea una llave propia y no la subas a un repositorio público.
- Para publicar una versión nueva, sube `versionCode` en `android/app/build.gradle`.
- Reglas simplificadas: si nadie compra una propiedad, no se subasta; el estacionamiento libre no da premio; no hay límite de casas en el banco.
