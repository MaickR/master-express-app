import { useEffect, useRef, useState, type ChangeEvent, type ComponentProps, type ComponentType, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import AvisoAcceso from './aviso-acceso';
import { ErrorSesion, mensajeSesion } from './cliente-sesion';
import Button from './BotonAcceso';
import { MarcoAcceso } from './Home';
import CampoContrasena from './campo-contrasena';
import {
  errorNit, errorNumeroDocumento, permiteEditarNit, soloDigitosDocumento, tiposDocumento, validarCampoRegistro,
  type CampoRegistro, type DatosRegistro, type VistaRegistro,
} from './vistas-registro';
import { camposDelServidor, datosDeCuenta, normalizarCorreo, useRegistroPublico } from './use-registro-graduando';
import { tiposInstitucion } from './validacion-institucion';
import { useSesion } from './contexto-sesion';

const Campo = Input as ComponentType<ComponentProps<'input'>>;
const Etiqueta = Label as ComponentType<ComponentProps<'label'>>;
const autocompletado: Partial<Record<CampoRegistro['id'], string>> = {
  nombres: 'given-name', apellidos: 'family-name', correo: 'email', telefono: 'tel',
};
const erroresDeAlta: Partial<Record<CampoRegistro['id'], string>> = {
  correo: 'Ingresa un correo electrónico válido.',
  nombres: 'Usa letras y signos propios del nombre.',
  apellidos: 'Usa letras y signos propios del apellido.',
  telefono: 'Ingresa entre 7 y 15 dígitos. Puedes incluir el indicativo.',
  tipoDocumento: 'Selecciona Cédula de ciudadanía o Tarjeta de identidad.',
  numeroDocumento: 'Ingresa hasta 32 dígitos del 0 al 9.',
  contrasena: 'Usa al menos 12 caracteres y una contraseña de hasta 72 bytes.',
  razonSocial: 'Ingresa la razón social (hasta 200 caracteres).',
  nit: 'Ingresa el NIT con dígitos. Si usas un guion, debe separar dos grupos.',
  sede: 'Ingresa la sede (hasta 150 caracteres).',
  responsable: 'Ingresa el nombre completo con letras y signos propios del nombre.',
  tipoInstitucion: 'Selecciona Colegio o Universidad.',
};

function errorDeEntrada(id: CampoRegistro['id'], valor: string) {
  if (id === 'numeroDocumento' && !soloDigitosDocumento(valor)) return errorNumeroDocumento;
  if (id === 'nit' && !permiteEditarNit(valor)) return errorNit;
}

function enmascararCorreo(correo: string) {
  const separador = correo.lastIndexOf('@');
  return separador > 0 ? [...correo.slice(0, separador)][0] + '•••' + correo.slice(separador) : '';
}

export default function RegistroVistaPrevia({ vista }: { vista: VistaRegistro }) {
  const { estado } = useSesion();
  const institucional = Boolean(vista.solicitudPublica);
  const sesion = institucional && estado.tipo === 'autenticado' ? estado.identidad : null;
  const [indice, establecerIndice] = useState(0);
  const [editandoRevision, establecerEditandoRevision] = useState(false);
  const [datos, establecerDatos] = useState<DatosRegistro>({});
  const [errores, establecerErrores] = useState<DatosRegistro>({});
  const [verificando, establecerVerificando] = useState(false);
  const [verificado, establecerVerificado] = useState('');
  const [codigo, establecerCodigo] = useState('');
  const [errorCodigo, establecerErrorCodigo] = useState('');
  const envioAutomatico = useRef('');
  const [aviso, establecerAviso] = useState('');
  const [creada, establecerCreada] = useState(false);
  const tituloPaso = useRef<HTMLHeadingElement>(null);
  const campoCodigo = useRef<HTMLInputElement>(null);
  const campoConError = useRef<CampoRegistro['id']>();
  const registro = useRegistroPublico(institucional ? 'institucion' : 'graduando');
  const { enviandoCodigo } = registro;
  const correo = normalizarCorreo(datos.correo);
  const correoConfirmado = Boolean(verificado && verificado === correo);
  const verificaPorCodigo = (vista.registroPublico || institucional) && !sesion;
  const paso = vista.pasos[indice];
  const pasos = [...vista.pasos.map(({ corto }) => corto), 'Revisión'];

  useEffect(() => {
    if (campoConError.current) {
      document.getElementById(campoConError.current)?.focus();
      campoConError.current = undefined;
    } else {
      tituloPaso.current?.focus();
    }
  }, [indice, verificando, creada]);

  useEffect(() => {
    if (!sesion) return;
    establecerDatos(anteriores => anteriores.correo === sesion.correo ? anteriores : { ...anteriores, correo: sesion.correo });
  }, [sesion]);

  useEffect(() => {
    if (verificando && !enviandoCodigo && registro.solicitado === correo) campoCodigo.current?.focus();
  }, [verificando, enviandoCodigo, registro.solicitado, correo]);

  const actualizar = (id: CampoRegistro['id'], valor: string) => {
    const error = errorDeEntrada(id, valor);
    if (error) {
      establecerErrores(anteriores => ({ ...anteriores, [id]: error }));
      return;
    }

    if (id === 'correo' && sesion) return;
    if (id === 'correo' && normalizarCorreo(valor) !== correo) {
      establecerVerificado('');
      establecerCodigo('');
      establecerErrorCodigo('');
      envioAutomatico.current = '';
      registro.cambiarCorreo();
    }
    const limpiarNumero = id === 'tipoDocumento' && !valor;
    establecerDatos(anteriores => limpiarNumero
      ? { ...anteriores, tipoDocumento: '', numeroDocumento: '' }
      : { ...anteriores, [id]: valor });
    establecerErrores(anteriores => limpiarNumero
      ? { ...anteriores, tipoDocumento: undefined, numeroDocumento: undefined }
      : { ...anteriores, [id]: undefined, ...(id === 'contrasena' ? { confirmacion: undefined } : {}) });
  };

  const avanzar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!paso || registro.ocupado || (institucional && estado.tipo === 'comprobando')) return;

    const formulario = evento.currentTarget;
    const siguientes: DatosRegistro = {};
    for (const campo of paso.campos) {
      const control = formulario.elements.namedItem(campo.id);
      const error = validarCampoRegistro(campo, datos, control instanceof HTMLInputElement && control.validity.typeMismatch);
      if (error) siguientes[campo.id] = error;
    }

    establecerErrores(siguientes);
    const primerError = paso.campos.find(campo => siguientes[campo.id]);
    if (primerError) {
      const control = formulario.elements.namedItem(primerError.id);
      if (control instanceof HTMLElement) control.focus();
      return;
    }
    if (verificaPorCodigo && indice === 1 && !correoConfirmado) {
      establecerVerificando(true);
      establecerAviso('');
      establecerEditandoRevision(false);
      if (envioAutomatico.current !== correo && registro.solicitado !== correo) {
        envioAutomatico.current = correo;
        void enviarCodigo();
      }
      return;
    }
    establecerIndice(editandoRevision && (!verificaPorCodigo || correoConfirmado) ? vista.pasos.length : indice + 1);
    establecerEditandoRevision(false);
  };

  const irAlPaso = (destino: number, desdeRevision = false) => {
    establecerEditandoRevision(desdeRevision);
    establecerErrores({});
    establecerVerificando(false);
    establecerAviso('');
    establecerIndice(destino);
  };

  function avisoDeRegistro(fallo: ErrorSesion) {
    if (fallo.estado === 419) return 'La protección de la sesión venció. Vuelve a intentar. Tus datos siguen en el formulario.';
    if (fallo.estado >= 500) return 'El servicio de registro no pudo completar la solicitud. Vuelve a intentar.';
    return mensajeSesion(fallo);
  }

  async function enviarCodigo() {
    if (registro.ocupado || registro.espera('codigo', correo)) return;
    establecerAviso('');
    establecerErrorCodigo('');
    const resultado = await registro.operar('codigo', { email: correo });
    if (resultado === true) {
      establecerCodigo('');
    } else if (resultado instanceof ErrorSesion) {
      if (resultado.estado === 422 && resultado.campos.includes('email')) {
        campoConError.current = 'correo';
        irAlPaso(institucional ? 1 : 0);
        establecerErrores({ correo: institucional
          ? 'Revisa el correo. Si ya tienes una cuenta, inicia sesión para solicitar la representación.'
          : erroresDeAlta.correo });
      } else {
        establecerAviso(avisoDeRegistro(resultado));
      }
    }
  }

  async function confirmarCodigo(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    establecerAviso('');
    establecerErrorCodigo('');
    if (!/^[0-9]{6}$/.test(codigo)) {
      establecerErrorCodigo('Ingresa el código de seis dígitos.');
      campoCodigo.current?.focus();
      return;
    }
    const resultado = await registro.operar('confirmacion', { email: correo, codigo });
    if (resultado === true) {
      establecerVerificado(correo);
      establecerCodigo('');
      establecerVerificando(false);
      establecerIndice(vista.pasos.length);
    } else if (resultado instanceof ErrorSesion) {
      if (resultado.estado === 422) {
        establecerErrorCodigo('El código no es válido o venció. Revisa el último correo o solicita otro código.');
        requestAnimationFrame(() => campoCodigo.current?.focus());
      } else {
        establecerAviso(avisoDeRegistro(resultado));
      }
    }
  }

  async function crearCuenta() {
    if (!correoConfirmado || registro.ocupado) return;
    establecerAviso('');
    const resultado = await registro.operar('cuenta', datosDeCuenta(datos));
    if (resultado === true) {
      establecerDatos({});
      establecerCodigo('');
      establecerCreada(true);
    } else if (resultado instanceof ErrorSesion) {
      if (resultado.estado === 422 && resultado.campos.includes('email')) {
        establecerVerificado('');
        registro.cambiarCorreo();
        establecerVerificando(true);
        establecerIndice(1);
        establecerAviso('Verifica tu correo otra vez para terminar el registro.');
        return;
      }
      if (resultado.estado === 422) {
        const campos = Object.entries(camposDelServidor)
          .filter(([servidor]) => resultado.campos.includes(servidor)).map(([, local]) => local);
        const primero = campos[0];
        if (primero) {
          campoConError.current = primero;
          establecerEditandoRevision(true);
          establecerErrores(Object.fromEntries(campos.map(campo => [campo, erroresDeAlta[campo]])));
          establecerIndice(vista.pasos[0].campos.some(campo => campo.id === primero) ? 0 : 1);
          return;
        }
        establecerAviso('Revisa tus datos antes de volver a enviar la solicitud.');
      } else {
        establecerAviso(avisoDeRegistro(resultado));
      }
    }
  }

  const camposServidorInstitucion = {
    tipo: 'tipoInstitucion', razon_social: 'razonSocial', nit: 'nit', sede: 'sede',
    representante: 'responsable', telefono: 'telefono', email: 'correo',
  } as const;

  async function enviarSolicitud() {
    if (registro.ocupado || (!sesion && !correoConfirmado)) return;
    establecerAviso('');
    const cuerpo = {
      tipo: datos.tipoInstitucion ?? '',
      razon_social: datos.razonSocial?.trim() ?? '',
      nit: datos.nit?.trim() ?? '',
      sede: datos.sede?.trim() ?? '',
      representante: datos.responsable?.trim() ?? '',
      telefono: datos.telefono?.trim() ?? '',
    };
    const resultado = sesion
      ? await registro.representar(cuerpo, correo)
      : await registro.operar('solicitud', { ...cuerpo, email: correo });
    if (resultado === true) {
      establecerCodigo('');
      establecerCreada(true);
      return;
    }
    if (!(resultado instanceof ErrorSesion)) return;
    if (resultado.estado === 409) {
      establecerAviso('Ya hay una solicitud en curso para este correo. Sigue pendiente de revisión.');
      return;
    }
    if (resultado.estado === 403) {
      establecerAviso('Esta cuenta no puede solicitar la representación hasta tener el correo verificado.');
      return;
    }
    if (resultado.estado === 422 && resultado.campos.includes('email') && !sesion) {
      establecerVerificado('');
      registro.cambiarCorreo();
      establecerVerificando(true);
      establecerIndice(1);
      establecerAviso('Verifica el correo otra vez para enviar la solicitud.');
      return;
    }
    if (resultado.estado === 422) {
      const locales = resultado.campos
        .map(campo => camposServidorInstitucion[campo as keyof typeof camposServidorInstitucion])
        .filter(Boolean);
      const primero = locales[0];
      if (primero) {
        campoConError.current = primero;
        establecerEditandoRevision(true);
        establecerErrores(Object.fromEntries(locales.map(campo => [campo, erroresDeAlta[campo]])));
        establecerIndice(vista.pasos[0].campos.some(campo => campo.id === primero) ? 0 : 1);
        return;
      }
      establecerAviso('Revisa los datos antes de volver a enviar la solicitud.');
      return;
    }
    establecerAviso(avisoDeRegistro(resultado));
  }

  const renderCampo = (campo: CampoRegistro) => {
    const confirmacionDistinta = vista.registroPublico && campo.id === 'confirmacion'
      && Boolean(datos.confirmacion) && datos.confirmacion !== datos.contrasena;
    const error = confirmacionDistinta ? erroresDeAlta.confirmacion : errores[campo.id];
    const descripcion = [campo.id === 'contrasena' && 'ayuda-contrasena-registro',
      campo.id === 'correo' && sesion && 'correo-sesion', error && campo.id + '-error']
      .filter(Boolean).join(' ') || undefined;
    const esNumeroDocumento = campo.tipo === 'numeroDocumento';
    const habilitado = !esNumeroDocumento || Boolean(datos.tipoDocumento);
    const props = {
      id: campo.id, name: campo.id, required: !campo.opcional && habilitado, maxLength: campo.limite ?? 150,
      disabled: !habilitado,
      'aria-invalid': Boolean(error), 'aria-describedby': descripcion, value: datos[campo.id] ?? '',
      onChange: (evento: ChangeEvent<HTMLInputElement>) => actualizar(campo.id, evento.target.value),
    };
    return (
      <div key={campo.id} className="grid min-w-0 gap-2">
        <Etiqueta htmlFor={campo.id}>{campo.etiqueta}{campo.opcional && ' (opcional)'}</Etiqueta>
        {campo.id === 'correo' && sesion && (
          <p id="correo-sesion" className="text-sm text-muted-foreground">
            Usaremos el correo de tu sesión. No se crea otra cuenta ni se cambian tus roles.
          </p>
        )}
        {campo.id === 'contrasena' && (
          <p id="ayuda-contrasena-registro" className="text-sm text-muted-foreground">
            {vista.registroPublico
              ? 'Usa al menos 12 caracteres. Puedes combinar varias palabras en una frase fácil de recordar.'
              : 'Usa al menos 12 caracteres ficticios.'}
          </p>
        )}
        {campo.tipo === 'tipoInstitucion' ? (
          <select id={props.id} name={props.name} value={props.value} required
            aria-invalid={props['aria-invalid']} aria-describedby={descripcion}
            className="acceso__campo h-12 w-full min-w-0 rounded-md border border-input px-3 text-base aria-[invalid=true]:border-error focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            onChange={evento => actualizar(campo.id, evento.target.value)}>
            <option value="">Selecciona Colegio o Universidad</option>
            {tiposInstitucion.map(tipo => <option key={tipo.valor} value={tipo.valor}>{tipo.etiqueta}</option>)}
          </select>
        ) : campo.tipo === 'tipoDocumento' ? (
          <select id={props.id} name={props.name} value={props.value}
            aria-invalid={props['aria-invalid']} aria-describedby={descripcion}
            className="acceso__campo h-12 w-full min-w-0 rounded-md border border-input px-3 text-base aria-[invalid=true]:border-error focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            onChange={evento => actualizar(campo.id, evento.target.value)}>
            <option value="">Selecciona un tipo</option>
            {tiposDocumento.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
          </select>
        ) : campo.tipo === 'password' ? (
          <CampoContrasena {...props} etiqueta={campo.id === 'contrasena' ? 'contraseña' : 'confirmación de contraseña'}
            autoComplete={vista.registroPublico ? 'new-password' : 'off'} />
        ) : (
          <Campo {...props} type={campo.tipo === 'tel' || campo.tipo === 'email' ? campo.tipo : 'text'}
            readOnly={campo.id === 'correo' && Boolean(sesion)}
            autoComplete={vista.registroPublico || institucional ? autocompletado[campo.id] : undefined}
            inputMode={esNumeroDocumento ? 'numeric' : undefined}
            onPaste={esNumeroDocumento || campo.tipo === 'nit' ? evento => {
              const { value, selectionStart, selectionEnd } = evento.currentTarget;
              const texto = evento.clipboardData.getData('text');
              const valor = value.slice(0, selectionStart ?? value.length) + texto
                + value.slice(selectionEnd ?? value.length);
              const error = errorDeEntrada(campo.id, valor);
              if (error) {
                evento.preventDefault();
                establecerErrores(anteriores => ({ ...anteriores, [campo.id]: error }));
              }
            } : undefined}
            className="acceso__campo h-12 px-3.5 md:text-base" />
        )}
        {error && <p id={campo.id + '-error'} role="alert" className="text-sm text-error">{error}</p>}
      </div>
    );
  };

  const valorRevision = (campo: CampoRegistro) => {
    const valor = datos[campo.id]?.trim();
    if (!valor) return 'Sin indicar';
    if (campo.id === 'contrasena') return vista.registroPublico ? 'Definida' : 'Definida para esta vista previa';
    if (campo.id === 'tipoInstitucion') {
      return tiposInstitucion.find(tipo => tipo.valor === valor)?.etiqueta ?? valor;
    }
    if (campo.id === 'numeroDocumento') return valor.length > 4 ? '•••• ' + valor.slice(-4) : '••••';
    return valor;
  };

  if (creada && institucional) return (
    <MarcoAcceso>
      <h1 ref={tituloPaso} tabIndex={-1} className="acceso__titulo">Solicitud recibida</h1>
      <div className="mt-4">
        <AvisoAcceso tono="confirmacion">Solicitud recibida y pendiente de revisión.</AvisoAcceso>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Un administrador autorizado revisará la solicitud. Este envío no activa el acceso institucional.
      </p>
      <Link to="/" className="acceso__enlace mt-4 inline-flex min-h-11 items-center text-sm">Volver al inicio</Link>
    </MarcoAcceso>
  );

  if (creada) return (
    <MarcoAcceso>
      <h1 ref={tituloPaso} tabIndex={-1} className="acceso__titulo">Registro completado</h1>
      <div className="mt-4"><AvisoAcceso tono="confirmacion">Ya puedes iniciar sesión con los datos de tu cuenta.</AvisoAcceso></div>
      <Link to="/" className="acceso__enlace mt-4 inline-flex min-h-11 items-center text-sm">Ir a iniciar sesión</Link>
    </MarcoAcceso>
  );

  return (
    <MarcoAcceso>
      <h1 className="acceso__titulo text-center lg:text-left lg:text-[2rem]">{vista.titulo}</h1>
      <p id="registro-vista-previa" className="mt-2 text-center text-sm text-muted-foreground lg:text-left">
        {estado.tipo === 'comprobando' && institucional
        ? 'Comprobando si ya hay una sesión…'
        : vista.registroPublico
          ? 'Crea tu cuenta y verifica tu correo electrónico.'
          : institucional
            ? 'La solicitud queda pendiente hasta que un administrador la revise.'
            : 'Vista previa · Envío aún no habilitado.'}
      </p>

      <ol aria-label="Progreso del registro" className="mt-5 grid list-none grid-cols-3 gap-2 text-xs sm:text-sm">
        {pasos.map((nombre, posicion) => (
          <li key={nombre} aria-current={indice === posicion ? 'step' : undefined}
            className={'min-w-0 rounded-md border px-1.5 py-2 text-center [overflow-wrap:anywhere] ' +
              (indice === posicion ? 'border-ring bg-accent font-semibold text-accent-foreground' : 'text-muted-foreground')}>
            <span className="block" aria-hidden="true">{posicion + 1}</span>
            <span className="sr-only">{'Paso ' + (posicion + 1) + '. '}</span>
            {nombre}
            {posicion < indice && <span className="sr-only">. Completado.</span>}
          </li>
        ))}
      </ol>

      <h2 ref={tituloPaso} tabIndex={-1} className="mt-5 text-xl font-semibold leading-tight">
        {verificando ? (registro.solicitado === correo ? 'Revisa tu correo' : 'Verifica tu correo') : paso?.titulo ?? vista.revision}
      </h2>
      {verificando ? (
        <div className="mt-4 grid gap-4">
          <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">Destino: <strong>{enmascararCorreo(correo)}</strong></p>
          {enviandoCodigo && <p className="text-sm" role="status">Enviando código…</p>}
          {!enviandoCodigo && registro.solicitado === correo && (
            <AvisoAcceso tono="informacion">Si corresponde, recibirás un código de seis dígitos. Revisa también el correo no deseado.</AvisoAcceso>
          )}
          {aviso && <AvisoAcceso>{aviso}</AvisoAcceso>}
          {!enviandoCodigo && (
            <Button type="button" variant="ghost" className="min-h-11 w-full border border-border" onClick={() => void enviarCodigo()}
              disabled={registro.ocupado || registro.espera('codigo', correo) > 0}>
              {registro.solicitado === correo ? 'Reenviar código' : 'Reintentar envío'}
            </Button>
          )}
          {registro.espera('codigo', correo) > 0 && <p className="text-sm text-muted-foreground" role="status">
            Podrás solicitar otro código en {registro.espera('codigo', correo)} segundos.
          </p>}
          <form className="grid gap-2" onSubmit={confirmarCodigo} noValidate>
            <Etiqueta htmlFor="codigo-registro">Código de verificación</Etiqueta>
            <Campo ref={campoCodigo} id="codigo-registro" type="text" inputMode="numeric" autoComplete="one-time-code"
              maxLength={6} value={codigo} disabled={registro.ocupado} aria-invalid={Boolean(errorCodigo)}
              aria-describedby={errorCodigo ? 'error-codigo-registro' : undefined}
              className="acceso__campo h-12 px-3.5 md:text-base"
              onChange={evento => { establecerCodigo(evento.target.value); establecerErrorCodigo(''); }} />
            {errorCodigo && <p id="error-codigo-registro" role="alert" className="text-sm text-error">{errorCodigo}</p>}
            <Button type="submit" className="acceso__accion min-h-11 w-full"
              disabled={registro.ocupado || registro.espera('confirmacion') > 0}>Confirmar correo</Button>
          </form>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" className="min-h-11" disabled={registro.ocupado} onClick={() => irAlPaso(1)}>Anterior</Button>
            <Button type="button" variant="ghost" className="min-h-11" disabled={registro.ocupado} onClick={() => irAlPaso(0)}>Cambiar correo</Button>
          </div>
        </div>
      ) : paso ? (
        <form onSubmit={avanzar} noValidate autoComplete={vista.registroPublico ? undefined : 'off'}
          aria-describedby="registro-vista-previa" className="mt-4 grid gap-4">
          {paso.campos.map(renderCampo)}
          {paso.verificacion && !verificaPorCodigo && !sesion && (
            <AvisoAcceso tono="advertencia">
              <strong>Verificación por correo pendiente.</strong> El correo se podrá verificar cuando el servicio esté habilitado.
            </AvisoAcceso>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {indice > 0 && !editandoRevision && (
              <Button type="button" variant="ghost" className="min-h-11" onClick={() => irAlPaso(indice - 1)}>Anterior</Button>
            )}
            <Button type="submit" className="acceso__accion min-h-11">
              {editandoRevision ? 'Guardar cambios' : 'Continuar'}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div className="mt-4 grid gap-3">
            {vista.pasos.map((seccion, posicion) => (
              <section key={seccion.corto} className="rounded-lg border border-border bg-background px-3 pb-2">
                <div className="flex min-w-0 items-center justify-between gap-2 border-b border-border">
                  <h3 className="py-2 text-sm font-semibold">{seccion.titulo}</h3>
                  <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0"
                    aria-label={'Editar ' + seccion.titulo.toLowerCase()} disabled={registro.ocupado}
                    onClick={() => irAlPaso(posicion, true)}>
                    <Pencil aria-hidden="true" />
                  </Button>
                </div>
                <dl className="divide-y divide-border">
                  {seccion.campos.filter(campo => campo.id !== 'confirmacion').map(campo => (
                    <div key={campo.id} className="py-2">
                      <dt className="text-sm font-medium">{campo.etiqueta}</dt>
                      <dd className="mt-0.5 text-sm text-muted-foreground [overflow-wrap:anywhere]">{valorRevision(campo)}</dd>
                    </div>
                  ))}
                  {seccion.verificacion && (
                    <div className="py-2">
                      <dt className="text-sm font-medium">Verificación por correo</dt>
                      <dd className={'mt-0.5 text-sm ' + (correoConfirmado ? 'text-muted-foreground' : 'text-aviso')}>
                        {correoConfirmado ? 'Correo verificado' : sesion ? 'Sesión de esta cuenta' : 'Pendiente'}
                      </dd>
                    </div>
                  )}
                </dl>
              </section>
            ))}
          </div>
          {vista.registroPublico ? (
            <>
              {aviso && <div className="mt-4"><AvisoAcceso>{aviso}</AvisoAcceso></div>}
              <Button type="button" onClick={() => void crearCuenta()}
                disabled={registro.ocupado || !correoConfirmado || registro.espera('cuenta') > 0}
                className="acceso__accion mt-3 min-h-11 w-full">{registro.ocupado ? 'Creando cuenta…' : vista.accion}</Button>
            </>
          ) : vista.solicitudPublica ? (
            <>
              {aviso && <div className="mt-4"><AvisoAcceso>{aviso}</AvisoAcceso></div>}
              <Button type="button" onClick={() => void enviarSolicitud()}
                disabled={registro.ocupado || (!sesion && !correoConfirmado) || registro.espera('solicitud') > 0}
                className="acceso__accion mt-3 min-h-11 w-full">{registro.ocupado ? 'Enviando solicitud…' : vista.accion}</Button>
            </>
          ) : (
            <>
              <p id="registro-accion-pendiente" className="mt-4 text-sm text-muted-foreground">
                <strong>Acción deshabilitada en la vista previa.</strong> {vista.avisoFinal}
              </p>
              <Button type="button" disabled aria-describedby="registro-accion-pendiente"
                className="acceso__accion mt-3 min-h-11 w-full">{vista.accion}</Button>
            </>
          )}
        </>
      )}
      <Link to="/" className="acceso__enlace mt-2 inline-flex min-h-11 items-center text-sm">Volver al inicio</Link>
    </MarcoAcceso>
  );
}
