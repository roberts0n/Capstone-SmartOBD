# Catalogo Mode 01: alcance, diseno y pruebas

## Alcance de esta integracion

93 identificadores entre 0101 y 015F, excluyendo 0120 y 0140, que son consultas de compatibilidad. 0100 tambien es descubrimiento. El catalogo anterior tenia 23: se conservan y se agregan 70. No son 93 sensores distintos ni significa soporte completo de todo Mode 01.

La deteccion sigue recorriendo bloques posteriores a 015F si el vehiculo los anuncia; esos PID se muestran como pendientes. No se agregan otros modos ni comandos propietarios. El laboratorio DTC y su pendiente de validacion fisica no cambian. El nuevo PID 0102 entrega el codigo asociado al cuadro congelado: no sustituye la consulta DTC de servicio 03.

## Responsabilidades

- `src/obd/CatalogoPidsMode01.ts`: punto de entrada, indice de definiciones y traduccion con validacion.
- `src/obd/mode01/TiposPid.ts`: contrato compartido, categorias, conversion de dos bytes y redondeo.
- `src/obd/mode01/Mediciones.ts`: magnitudes numericas y formulas.
- `src/obd/mode01/Oxigeno.ts`: familias de sensores y ajustes de combustible de uno o dos bancos por respuesta.
- `src/obd/mode01/Estados.ts`: monitores, enumeraciones, ubicacion de sensores y configuracion de escalas.
- `src/obd/mode01/ExtraerRespuestaPid.ts`: mensajes individuales con o sin cabecera. No concatena ECU ni completa bytes ausentes.
- `src/obd/mode01/usarCatalogoVehiculo.ts`: deteccion visible y configuracion transitoria de una conexion.
- `src/componentes/PanelPidsCompatibles.tsx`: botones derivados del catalogo y de los PID anunciados. No envia nada al renderizar.
- `src/pantallas/PantallaEscanerObd.tsx`: coordina las consultas secuenciales y conserva consola, JSON y metricas.

El uso de `map` en las familias evita copiar ocho veces la misma formula: cada entrada tiene su propio comando y nombre. El `Map` del catalogo permite buscar una definicion por comando sin recorrer listas en cada lectura. El `Set` del panel elimina duplicados y cruza capacidades. Los `for`/`while` de comunicacion usan `await`: nunca deben convertirse en un `Promise.all`, pues la conexion ELM comparte un solo flujo de respuestas.

## Funcionamiento visible

1. Conectar y verificar los canales del adaptador como antes.
2. Inicializar ELM327 si procede.
3. Pulsar **Detectar PID compatibles**. RPM y temperatura ya no son botones fijos previos a la deteccion.
4. La app descubre los bloques y consulta 011D, 014F y 0150 solo si fueron anunciados. Es configuracion puntual, no sondeo continuo.
5. Se muestran los botones traducibles agrupados por categoria. Los PID anunciados fuera del catalogo quedan visibles como pendientes.
6. Al pulsar un boton se solicita ese PID. Se mantienen respuesta cruda, datoTraducido, unidad, errores y metricas.

La deteccion representa la union de las ECU que respondan, no una ECU identificada por el usuario. Las lecturas siguen seleccionando una respuesta individual valida; no agregan valores numericos de diferentes ECU. No existe seleccion manual de ECU en esta integracion.

La deteccion/configuracion se limpia al conectar de nuevo, desconectar, perder Bluetooth, repetir la deteccion o cambiar formato mediante los botones ATZ/ATH0/ATH1/ATSP0. Una respuesta tardia no debe restaurar los botones de la sesion terminada. Si se cambia el adaptador de un vehiculo a otro sin cerrar BLE, repetir la deteccion: no inferimos ese cambio automaticamente.

## Casos importantes

- 014F: configura escalas de MAP, lambda y sensores O2 de rango amplio. No representa maximos registrados en un viaje.
- 0150: configura la escala MAF. Se esperan cuatro bytes; B, C y D son reservados.
- Cero en un campo de 014F/0150 solicita la escala base. En su JSON se presenta como `null` con una explicacion, no como un limite fisico cero.
- Si la configuracion anunciada no se recibe o no puede asociarse al origen de una lectura, esta se rechaza con una explicacion. Con varias respuestas sin cabecera, pulsar **Cabeceras ON - ATH1** y repetir **Detectar PID compatibles**. No se aplican escalas globales de una ECU a otra.
- Con cabeceras, una ECU sin respuesta de configuracion propia tambien queda sin traducir en las magnitudes dependientes si el vehiculo anuncio esa configuracion. Es una limitacion conservadora: la mascara agregada no demuestra que dicha ECU use las escalas base.
- 011D identifica la distribucion de sensores en cuatro bancos. Su informacion determina si los ajustes 0106..0109 y 0155..0158 necesitan un segundo byte. La ausencia de ese byte no se traduce como cero.
- 0141 informa habilitacion y finalizacion de monitores en este ciclo, no cantidad de DTC ni MIL. Un monitor deshabilitado no equivale a no soportado permanentemente.
- FF indica ajuste no disponible en el segundo byte de 0114..011B. No se aplica esa regla a todos los PID: FF es valido para otros porcentajes.
- 0132 es un entero con signo en complemento a dos. 0154 tiene un desplazamiento de 32767: no comparten la misma formula.
- 015B se presenta como carga restante (SOC), no vida util ni salud de la bateria.
- 015F preserva el codigo numerico y reconoce las etiquetas de la referencia SAE 2011. Un codigo posterior/desconocido no recibe una etiqueta inventada.
- Los extremos de una medicion no permiten distinguir siempre un valor real de un valor de sustitucion enviado por una ECU. La app no convierte universalmente 00 o FF en 'sensor averiado'.

La extraccion admite texto ELM sin espacios, cabeceras CAN de 11/29 bits y tramas simples con longitud, y cabeceras tradicionales de tres bytes. Excluye el checksum de estas ultimas, pero no verifica su CRC/checksum. No implementa un reensamblador nuevo ISO-TP: estos PID del rango acordado caben en respuestas CAN simples. Formatos no reconocidos se rechazan, no se adivinan.

## Pruebas reproducibles sin vehiculo

Desde la raiz de Obd2Demo:

```powershell
npm.cmd test -- --runInBand
npx.cmd tsc --noEmit
npm.cmd run lint
```

- Catalogo exacto de 93 entradas sin duplicados ni consultas de descubrimiento como mediciones.
- Pruebas de regresion de los 23 PID originales.
- Bytes validos, incompletos e invalidos para las 93 definiciones, mas vectores de formulas y estados.
- Configuracion ampliada, valores con signo, bancos adicionales, cabeceras y respuestas separadas.
- Panel sin botones previos, filtro real, pendientes, bloqueo y limpieza de estado.
- Integracion de pantalla con Bluetooth simulado: deteccion, configuracion, consulta, reconexion y respuesta tardia.
- Mascaras de las fotos del segundo vehiculo: 28 soportados, 28 interpretables, 0 pendientes de catalogo. Esto no demuestra que las 28 lecturas reales ya funcionen.

## Validacion fisica pendiente

1. Probar en el primer vehiculo que se mantienen los 23 PID anunciados anteriormente.
2. Probar en el segundo que los 28 aparecen; comprobar especialmente 0110 (MAF), 011F (tiempo), 0142 (voltaje) y 0146 (ambiente).
3. Si un dato depende de escalas, confirmar que el JSON de deteccion contiene las consultas auxiliares. Si hay ambiguedad, repetir con ATH1 y conservar las capturas crudas.
4. Consultar estados/O2 y revisar que el JSON conserve varios campos y unidades, incluidos los nulos explicados.
5. Desconectar y comprobar que desaparecen los botones. Reconectar requiere detectar de nuevo.
6. Comparar con otra herramienta bajo las mismas condiciones del vehiculo. No manipular telefono o escaner mientras se conduce ni provocar fallas para esta prueba.

Registrar por PID: vehiculo, respuesta cruda, valor/unidad, condiciones de prueba y comparacion. Las pruebas sinteticas verifican implementacion; no certifican exactitud del sensor ni compatibilidad universal.

## Referencias y limites documentales

- [python-OBD: Command Tables](https://python-obd.readthedocs.io/en/latest/Command%20Tables/): guia de alcance y comparacion; no unica fuente de formulas.
- [CSS Electronics: tabla tecnica Mode 01](https://www.csselectronics.com/pages/obd2-pid-table-on-board-diagnostics-j1979): consulta de formulas, contrastadas en casos especiales.
- [SAE J1979-DA OCT2011, anexo B (copia publica)](https://www.e90post.com/forums/attachment.php?attachmentid=1509324&d=1476497126): estructura de datos, escalas y estados. Referencia fijada a 2011, no declaracion de cumplimiento con la ultima revision SAE. No se distribuye el PDF dentro del repositorio.

Las pruebas y decodificadores son propios del proyecto; no se incorpora la biblioteca python-OBD ni se copian sus implementaciones. No se anaden dependencias de ejecucion.
