# Contrato de identidad y roles

## Implementado

- `App\Models\User` usa `users` como identidad central. El esquema actual exige nombre, correo único y contraseña. Laravel aplica el hash de la contraseña y excluye la contraseña y el token de recuerdo de la serialización.
- `App\Models\Rol` usa `roles`, con un identificador interno y un código único. Los códigos son `administrador`, `colaborador`, `vendedor`, `finanzas`, `inventario`, `graduando` e `institucion`. Inventario incluye Taller y Producción. Graduando incluye el portal Cliente/Graduando.
- `User::roles()` y `Rol::usuarios()` son relaciones Eloquent de muchos a muchos. `rol_user` registra las fechas de la asignación y usa una clave primaria compuesta por `user_id` y `rol_id` para impedir duplicados. Borrar una cuenta elimina sus vínculos. Borrar un rol asignado se rechaza.
- `RolSeeder` agrega los códigos ausentes y conserva los identificadores y las fechas de los ya existentes. La asignación de roles se reserva al servidor. El modelo excluye los roles de la asignación masiva y la API carece de rutas que puedan concederlos.

## Sesiones internas desde ME-AUTH1A

- Administrador y Colaborador usan la identidad existente para ingresar por contraseña. La sesión autoriza los códigos vigentes de `rol_user` para el hito. Consulte el [contrato de autenticación](AUTENTICACION.md).

## Alta pública de Graduandos desde ME-REG1A

- El [registro público](ME-REG1A.md) verifica la posesión del correo y concede exclusivamente el rol `graduando`. Conserva nombres, apellidos, teléfono y documento opcional en la cuenta. La cuenta queda sin un vínculo operativo con el catálogo de graduandos.

## Pendiente para etapas posteriores

- Definir el alta productiva y la verificación de correo del personal interno.
- Definir cómo se verifica a un representante institucional y cómo se vincula su identidad a las instituciones autorizadas. El alta y la aprobación provisionales están en [ME-REG2A](ME-REG2A.md): el rol `institucion` sigue sin alcance global y solo opera junto a un vínculo activo. El portal de ME-REG2B muestra los datos propios de la institución y la sede autorizadas.
- Acordar el identificador del graduando operativo y su vínculo con la cuenta. El perfil de graduando y la relación con el comprador requieren definiciones separadas.
- Acordar la matriz de permisos, el actor que puede asignar o revocar roles y las relaciones que determinan acceso por institución y ceremonia. Las Policies deben validar la operación y el registro con esos vínculos, aunque la cuenta ya tenga un rol.

Las tablas y relaciones comerciales se incorporarán cuando su contrato esté aprobado. Consulte el [alcance V1](../product/ME-SCOPE-V1.md) y los [entornos de QA](../../README.md#pruebas).
