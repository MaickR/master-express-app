import { useEffect, useRef, useState, type ChangeEvent, type ComponentProps, type ComponentType, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import AvisoAcceso from './aviso-acceso';
import Button from './BotonAcceso';
import { MarcoAcceso } from './Home';
import CampoContrasena from './campo-contrasena';
import {
  errorNit, errorNumeroDocumento, permiteEditarNit, soloDigitosDocumento, tiposDocumento, validarCampoRegistro,
  type CampoRegistro, type DatosRegistro, type VistaRegistro,
} from './vistas-registro';

const Campo = Input as ComponentType<ComponentProps<'input'>>;
const Etiqueta = Label as ComponentType<ComponentProps<'label'>>;

function errorDeEntrada(id: CampoRegistro['id'], valor: string) {
  if (id === 'numeroDocumento' && !soloDigitosDocumento(valor)) return errorNumeroDocumento;
  if (id === 'nit' && !permiteEditarNit(valor)) return errorNit;
}

export default function RegistroVistaPrevia({ vista }: { vista: VistaRegistro }) {
  const [indice, establecerIndice] = useState(0);
  const [editandoRevision, establecerEditandoRevision] = useState(false);
  const [datos, establecerDatos] = useState<DatosRegistro>({});
  const [errores, establecerErrores] = useState<DatosRegistro>({});
  const tituloPaso = useRef<HTMLHeadingElement>(null);
  const paso = vista.pasos[indice];
  const pasos = [...vista.pasos.map(({ corto }) => corto), 'Revisión'];

  useEffect(() => tituloPaso.current?.focus(), [indice]);

  const actualizar = (id: CampoRegistro['id'], valor: string) => {
    const error = errorDeEntrada(id, valor);
    if (error) {
      establecerErrores(anteriores => ({ ...anteriores, [id]: error }));
      return;
    }

    const limpiarNumero = id === 'tipoDocumento' && !valor;
    establecerDatos(anteriores => limpiarNumero
      ? { ...anteriores, tipoDocumento: '', numeroDocumento: '' }
      : { ...anteriores, [id]: valor });
    establecerErrores(anteriores => limpiarNumero
      ? { ...anteriores, tipoDocumento: undefined, numeroDocumento: undefined }
      : { ...anteriores, [id]: undefined });
  };

  const avanzar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!paso) return;

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
    establecerIndice(editandoRevision ? vista.pasos.length : indice + 1);
    establecerEditandoRevision(false);
  };

  const irAlPaso = (destino: number, desdeRevision = false) => {
    establecerEditandoRevision(desdeRevision);
    establecerErrores({});
    establecerIndice(destino);
  };

  const renderCampo = (campo: CampoRegistro) => {
    const error = errores[campo.id];
    const descripcion = [campo.id === 'contrasena' && 'ayuda-contrasena-registro', error && campo.id + '-error']
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
        {campo.id === 'contrasena' && (
          <p id="ayuda-contrasena-registro" className="text-sm text-muted-foreground">Usa al menos 12 caracteres ficticios.</p>
        )}
        {campo.tipo === 'tipoDocumento' ? (
          <select id={props.id} name={props.name} value={props.value}
            aria-invalid={props['aria-invalid']} aria-describedby={descripcion}
            className="acceso__campo h-12 w-full min-w-0 rounded-md border border-input px-3 text-base aria-[invalid=true]:border-error focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            onChange={evento => actualizar(campo.id, evento.target.value)}>
            <option value="">Selecciona un tipo</option>
            {tiposDocumento.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
          </select>
        ) : campo.tipo === 'password' ? (
          <CampoContrasena {...props} etiqueta={campo.id === 'contrasena' ? 'contraseña' : 'confirmación de contraseña'}
            autoComplete="off" />
        ) : (
          <Campo {...props} type={campo.tipo === 'tel' || campo.tipo === 'email' ? campo.tipo : 'text'}
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
    if (campo.id === 'contrasena') return 'Definida para esta vista previa';
    if (campo.id === 'numeroDocumento') return valor.length > 4 ? '•••• ' + valor.slice(-4) : '••••';
    return valor;
  };

  return (
    <MarcoAcceso>
      <h1 className="acceso__titulo text-center lg:text-left lg:text-[2rem]">{vista.titulo}</h1>
      <p id="registro-vista-previa" className="mt-2 text-center text-sm text-muted-foreground lg:text-left">
        Vista previa · Envío aún no habilitado.
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
        {paso?.titulo ?? vista.revision}
      </h2>
      {paso ? (
        <form onSubmit={avanzar} noValidate autoComplete="off"
          aria-describedby="registro-vista-previa" className="mt-4 grid gap-4">
          {paso.campos.map(renderCampo)}
          {paso.verificacion && (
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
                    aria-label={'Editar ' + seccion.titulo.toLowerCase()} onClick={() => irAlPaso(posicion, true)}>
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
                      <dd className="mt-0.5 text-sm text-aviso">Pendiente</dd>
                    </div>
                  )}
                </dl>
              </section>
            ))}
          </div>
          <p id="registro-accion-pendiente" className="mt-4 text-sm text-muted-foreground">
            <strong>Acción deshabilitada en la vista previa.</strong> {vista.avisoFinal}
          </p>
          <Button type="button" disabled aria-describedby="registro-accion-pendiente"
            className="acceso__accion mt-3 min-h-11 w-full">{vista.accion}</Button>
        </>
      )}
      <Link to="/" className="acceso__enlace mt-2 inline-flex min-h-11 items-center text-sm">Volver al inicio</Link>
    </MarcoAcceso>
  );
}
