<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token', 'version_sesion', 'nombres', 'apellidos', 'telefono', 'tipo_documento', 'numero_documento'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    public const array ROLES_DE_ACCESO = ['administrador', 'colaborador'];

    /**
     * @return BelongsToMany<Rol, $this>
     */
    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Rol::class, 'rol_user')->withTimestamps();
    }

    /** @return list<string> */
    public function codigosDeAcceso(): array
    {
        return $this->roles()->whereIn('codigo', self::ROLES_DE_ACCESO)
            ->orderBy('codigo')->pluck('codigo')->all();
    }

    /** @return list<string> */
    public function codigosDeSesion(): array
    {
        $internos = $this->codigosDeAcceso();
        if ($internos !== []) {
            return $internos;
        }
        $roles = $this->puedeAccederComoGraduando() ? ['graduando'] : [];
        if ($this->puedeAccederComoInstitucion()) {
            $roles[] = 'institucion';
        }

        return $roles;
    }

    public function puedeRecuperarContrasena(): bool
    {
        return $this->codigosDeAcceso() !== [] || $this->puedeAccederComoGraduando()
            || $this->puedeAccederComoInstitucion();
    }

    /**
     * @return HasMany<VinculoInstitucional, $this>
     */
    public function vinculosInstitucionales(): HasMany
    {
        return $this->hasMany(VinculoInstitucional::class);
    }

    public function operaEnInstitucion(int $institucionId): bool
    {
        return $this->accesoInstitucionalVerificado()
            && $this->vinculosInstitucionales()->where('estado', VinculoInstitucional::ACTIVO)
                ->where('institucion_id', $institucionId)->exists();
    }

    private function puedeAccederComoGraduando(): bool
    {
        return $this->activa && $this->email_verified_at !== null
            && $this->roles()->where('codigo', 'graduando')->exists();
    }

    private function puedeAccederComoInstitucion(): bool
    {
        return $this->accesoInstitucionalVerificado()
            && $this->vinculosInstitucionales()->where('estado', VinculoInstitucional::ACTIVO)->exists();
    }

    private function accesoInstitucionalVerificado(): bool
    {
        return $this->activa && $this->email_verified_at !== null
            && $this->roles()->where('codigo', 'institucion')->exists();
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'activa' => 'boolean',
            'version_sesion' => 'integer',
        ];
    }
}
