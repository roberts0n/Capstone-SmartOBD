# Prueba completa DTC: guia para el taller

Esta herramienta temporal permite aprovechar una visita al taller y reanalizar
las respuestas despues, sin el vehiculo. No sustituye la validacion con hardware.

## Antes de salir

1. Instalar una APK nueva. Este cambio incluye un modulo Android: recargar Metro
   no basta para incorporar el guardado de archivos.
2. Para generar una APK independiente, desde `Obd2Demo/android`:
   ```powershell
   .\gradlew.bat assembleRelease
   ```
   Resultado: `android/app/build/outputs/apk/release/app-release.apk`.
3. En la pantalla tecnica, localizar **Prueba completa de DTC** dentro de
   **4. Comandos ELM327**. El boton antiguo se llama **DTC 03 · lector anterior**:
   ese boton conserva deliberadamente la implementacion anterior.
4. Si hay un informe de una prueba anterior, guardarlo antes de iniciar otra.
   El borrador interno conserva solamente el ultimo lote.

## En el taller

1. Vehiculo detenido y en condiciones acordadas con el tecnico. No provocar
   fallas, desconectar sensores ni borrar DTC para esta prueba.
2. En la app de referencia, registrar codigo, categoria/estado (pendiente,
   confirmado, permanente), hora y condiciones del motor. No pulsar Limpiar.
3. Desconectar/cerrar la otra app antes de usar SmartOBD. Una app a la vez.
4. Conectar el escaner y verificar los canales mediante ATI como de costumbre.
5. En el campo de notas, indicar vehiculo sin datos personales innecesarios,
   motor encendido/apagado y el resultado de la app de referencia.
6. Pulsar **Ejecutar prueba completa DTC** y esperar. Se consulta:
   - ATI, ajustes E0/L0/S1/CAF1 y cabeceras desactivadas.
   - 0101, ATDP y ATDPN para registrar estado y protocolo.
   - 03 (almacenados), 07 (pendientes), 0A (permanentes).
   - ATH1, seguido de 0101/03/07/0A con cabeceras.
   - ATH0 al finalizar, si la comunicacion permite hacerlo.
7. Pulsar **Guardar informe JSON** aunque aparezcan errores.
8. Elegir **Descargas** u otra carpeta local y confirmar Guardar en Android.
   No se necesita internet para guardar en una carpeta local.
9. Desde la aplicacion Archivos del telefono, enviar ese `.json` como documento
   adjunto. El boton existente **Compartir captura** comparte texto de una
   consulta anterior: NO reemplaza este informe completo.

No se usa Mode 04 ni se modifican actuadores. Se cambian ajustes de presentacion
del adaptador; al final se intenta dejar ATH0, no restaurar una configuracion
previa desconocida. La prueba no cambia el protocolo mediante ATSP ni reinicia
el adaptador con ATZ.

## Como leer el resultado

- **Corregido:** usa protocolo registrado, contador CAN y estructura del mensaje.
- **Original · EXPERIMENTAL:** replica el algoritmo del commit `cfdce32`. Puede
  inventar DTC al unir lineas. Nunca tomar esos codigos como diagnostico.
- **Por lineas · referencia anterior:** conserva el analisis previo al laboratorio.
- Los dos metodos historicos solo interpretan 03: para 07/0A muestran `no-aplica`.
- **Inspeccion cruda:** permite ver las respuestas, protocolo, ECU y errores.

Estados del interprete corregido:

| Estado | Significado |
| --- | --- |
| con-codigos | Mensajes interpretados con DTC para esa categoria |
| sin-codigos | Respuesta valida sin DTC para esa categoria, no para todo el auto |
| parcial | Hay evidencia util, pero tambien mensajes invalidos/incompletos |
| sin-datos | El adaptador respondio NO DATA; no equivale a cero DTC |
| no-soportado | El comando fue rechazado como no soportado/no reconocido |
| respuesta-negativa | La ECU devolvio un rechazo; se conserva el NRC |
| invalida | No es posible interpretar de forma confiable |
| protocolo-desconocido | Falta confirmar ATDPN o el protocolo esta fuera del soporte |

**Completada** describe el lote de consultas, no una validacion mecanica ni que
todas las categorias hayan respondido. El informe conserva cada estado por separado.

Si una consulta devuelve NO DATA o un rechazo terminado en `>`, el lote continua.
Si vence el tiempo sin `>`, se conserva la captura parcial y se detiene si no se
recupero la sincronizacion: no se atribuye una respuesta tardia al siguiente comando.
Se puede guardar el informe, reconectar e iniciar otra prueba en la misma visita.
El boton Detener espera a que termine el comando actual (hasta su timeout).

## Que contiene el JSON

Version de esquema y de la prueba, inicio/fin, escaner, canales GATT, notas,
comandos, fases, contexto de protocolo/cabeceras, bytes, ASCII, fragmentos BLE,
marcas de tiempo, metricas, errores y comparacion de interpretes. Los separadores
originales se conservan escapados como `\r` y `\n`; JSON.parse los recupera.

No se consulta VIN automaticamente. El identificador BLE y cualquier dato escrito
en notas permanecen en el archivo: revisar antes de compartir fuera del equipo.
Si la app se cierra, recupera el ultimo avance persistido como informe interrumpido.
Desinstalar o borrar datos de la app elimina ese borrador; exportar el archivo primero.

## Reanalisis sin auto

Desde `Obd2Demo`, con las dependencias del proyecto instaladas:

```powershell
npm run reanalizar:dtc -- "C:\ruta\SmartOBD_DTC_....json"
```

Muestra en la terminal el resultado guardado y el obtenido con el codigo actual.
No sobrescribe el archivo original ni consulta Bluetooth. Para probar la herramienta:

```powershell
npm run reanalizar:dtc -- "__tests__/fixtures/dtc-laboratorio-sintetico.json"
```

Ese fixture NO es una nueva lectura del taller. Incluye la cadena fotografiada
y ejemplos inventados de P0104; el protocolo CAN se proporciona como supuesto de prueba.

## Limites de esta version

Incluye casos automatizados de CAN 11/29 bits, contador DTC, trama simple,
reensamblado ISO-TP por ECU, bloques CAF1 ordenados y formatos sin contador.
Los bloques sin identificacion ECU que resulten ambiguos no se unen a ciegas.
No implementa diagnostico propietario ni certifica compatibilidad con todos los
adaptadores. Las pruebas automaticas no sustituyen la siguiente visita real.

## Referencias tecnicas

- [Manual ELM327: servicios, DTC, cabeceras y tramas](https://elmelectronics.com/wp-content/uploads/2020/05/ELM327DSL.pdf)
- [Android: guardar documentos con ACTION_CREATE_DOCUMENT](https://developer.android.com/training/data-storage/shared/documents-files)
