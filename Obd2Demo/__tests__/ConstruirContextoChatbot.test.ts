import { construirContextoChatbot } from '../src/chatbot/ConstruirContextoChatbot';
import type { EntradaContextoChatbot } from '../src/chatbot/TiposChatbot';

function crearEntrada(): EntradaContextoChatbot {
  return {
    cliente: {
      id: 'cliente-1',
      nombre: 'Carlos Perez',
      telefono: '+56 9 1111 2222',
      correo: 'carlos@correo.cl',
      observaciones: 'Prefiere contacto por telefono.',
    },
    vehiculo: {
      id: 'vehiculo-1',
      clienteId: 'cliente-1',
      patente: ' abcd12 ',
      marca: ' Chevrolet ',
      modelo: ' Sail ',
      anio: 2018,
      combustible: ' Gasolina ',
      vinEscaneado: ' kl1jm5e55dk123456 ',
    },
    caso: {
      id: 'caso-actual',
      tallerId: 'taller-1',
      vehiculoId: 'vehiculo-1',
      estado: 'diagnostico_inicial',
      recepcionId: 'recepcion-1',
      mecanicoAsignadoId: null,
      motivoIngreso: ' Perdida de potencia ',
      sintomasInformados: ' Falla al acelerar ',
      prioridad: 'normal',
      fechaCreacion: '2026-09-19T15:00:00.000Z',
    },
    dtc: [
      {
        casoId: 'caso-actual',
        codigo: ' p0325 ',
        estado: 'confirmado',
        fecha: '2026-09-19T15:10:00.000Z',
        valido: true,
      },
      {
        casoId: 'caso-actual',
        codigo: 'P0325',
        estado: 'confirmado',
        fecha: '2026-09-19T15:11:00.000Z',
        valido: true,
      },
      {
        casoId: 'caso-actual',
        codigo: 'CODIGO-RARO',
        estado: 'pendiente',
        fecha: '2026-09-19T15:12:00.000Z',
        valido: true,
      },
      {
        casoId: 'otro-caso',
        codigo: 'P0104',
        estado: 'confirmado',
        fecha: '2026-09-18T15:10:00.000Z',
        valido: true,
      },
    ],
    lecturas: [
      {
        casoId: 'caso-actual',
        pid: ' 010c ',
        nombre: ' RPM del motor ',
        valor: 820,
        unidad: ' rpm ',
        fecha: '2026-09-19T15:15:00.000Z',
        origen: 'en-vivo',
        compatible: true,
        valida: true,
      },
      {
        casoId: 'caso-actual',
        pid: '0105',
        nombre: 'Temperatura del refrigerante',
        valor: 91,
        unidad: 'C',
        fecha: '2026-09-19T15:15:01.000Z',
        origen: 'captura',
        compatible: true,
        valida: false,
      },
      {
        casoId: 'caso-actual',
        pid: '0110',
        nombre: 'Flujo MAF',
        valor: 4.2,
        unidad: 'g/s',
        fecha: '2026-09-19T15:15:02.000Z',
        origen: 'captura',
        compatible: false,
        valida: true,
      },
      {
        casoId: 'otro-caso',
        pid: '010D',
        nombre: 'Velocidad',
        valor: 40,
        unidad: 'km/h',
        fecha: '2026-09-18T15:15:00.000Z',
        origen: 'captura',
        compatible: true,
        valida: true,
      },
    ],
    antecedentes: [
      {
        casoId: 'caso-anterior',
        vehiculoId: 'vehiculo-1',
        fecha: '2026-08-10T12:00:00.000Z',
        motivoIngreso: ' Testigo de motor encendido ',
        dtc: [' p0104 ', 'dato-invalido'],
        conclusionTecnica: ' Se reparo el cableado del sensor. ',
        cerrado: true,
      },
      {
        casoId: 'caso-abierto',
        vehiculoId: 'vehiculo-1',
        fecha: '2026-09-01T12:00:00.000Z',
        motivoIngreso: 'Revision pendiente',
        dtc: [],
        conclusionTecnica: null,
        cerrado: false,
      },
      {
        casoId: 'caso-otro-auto',
        vehiculoId: 'vehiculo-2',
        fecha: '2026-07-01T12:00:00.000Z',
        motivoIngreso: 'No corresponde',
        dtc: ['P0300'],
        conclusionTecnica: 'No debe aparecer.',
        cerrado: true,
      },
    ],
  };
}

describe('construccion del contexto del chatbot', () => {
  test('entrega solo los datos necesarios del caso seleccionado', () => {
    const contexto = construirContextoChatbot(crearEntrada());

    expect(contexto.vehiculo).toEqual({
      id: 'vehiculo-1',
      patente: 'abcd12',
      marca: 'Chevrolet',
      modelo: 'Sail',
      anio: 2018,
      combustible: 'Gasolina',
      vin: 'KL1JM5E55DK123456',
    });
    expect(contexto.caso).toMatchObject({
      id: 'caso-actual',
      motivoIngreso: 'Perdida de potencia',
      sintomasInformados: 'Falla al acelerar',
    });
    expect(contexto.dtc).toEqual([
      {
        codigo: 'P0325',
        estado: 'confirmado',
        fecha: '2026-09-19T15:10:00.000Z',
      },
    ]);
    expect(contexto.lecturas).toEqual([
      {
        pid: '010C',
        nombre: 'RPM del motor',
        valor: 820,
        unidad: 'rpm',
        fecha: '2026-09-19T15:15:00.000Z',
        origen: 'en-vivo',
      },
    ]);
  });

  test('no expone informacion personal del cliente', () => {
    const contexto = construirContextoChatbot(crearEntrada());
    const serializado = JSON.stringify(contexto);

    expect(contexto).not.toHaveProperty('cliente');
    expect(serializado).not.toContain('+56 9 1111 2222');
    expect(serializado).not.toContain('carlos@correo.cl');
    expect(serializado).not.toContain('Prefiere contacto');
  });

  test('solo incluye antecedentes cerrados del mismo vehiculo', () => {
    const contexto = construirContextoChatbot(crearEntrada());

    expect(contexto.antecedentes).toEqual([
      {
        casoId: 'caso-anterior',
        fecha: '2026-08-10T12:00:00.000Z',
        motivoIngreso: 'Testigo de motor encendido',
        dtc: ['P0104'],
        conclusionTecnica: 'Se reparo el cableado del sensor.',
      },
    ]);
  });

  test('rechaza un caso asociado a otro vehiculo', () => {
    const entrada = crearEntrada();
    entrada.caso.vehiculoId = 'vehiculo-otro';

    expect(() => construirContextoChatbot(entrada)).toThrow(
      'El caso no pertenece al vehiculo seleccionado.',
    );
  });

  test('rechaza un vehiculo asociado a otro cliente', () => {
    const entrada = crearEntrada();
    entrada.vehiculo.clienteId = 'cliente-otro';

    expect(() => construirContextoChatbot(entrada)).toThrow(
      'El vehiculo no pertenece al cliente seleccionado.',
    );
  });
});
