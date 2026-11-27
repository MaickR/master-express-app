<?php

namespace Tests\Feature;

use App\Actions\Autenticacion\TransporteDeCorreoSeguro;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Mail\Message;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class CorreoTransaccionalTest extends TestCase
{
    public function test_qa_solo_admite_destinatarios_ficticios_aun_con_la_opcion_real_activa(): void
    {
        $guardia = app(TransporteDeCorreoSeguro::class);
        config([
            'mail.default' => 'array',
            'mail.transaccional.prueba_real_local' => true,
            'mail.transaccional.destinatarios_locales' => ['permitido@bandeja.test'],
        ]);
        $this->assertTrue($guardia->habilitar('persona@example.invalid'));
        $this->assertFalse($guardia->permiteDestinatario('permitido@bandeja.test'));
        $this->assertFalse($guardia->habilitar('ajeno@bandeja.test'));

        config(['mail.default' => 'log']);
        $this->assertFalse($guardia->habilitar('persona@example.invalid'));
    }

    public function test_local_exige_activacion_destinatario_y_configuracion_resend_exactos(): void
    {
        $this->app->instance('env', 'local');
        $guardia = app(TransporteDeCorreoSeguro::class);
        $permitido = 'permitido@bandeja.test';
        $credencialFicticia = 'credencial-de-pruebas-sin-valor';
        config([
            'mail.default' => 'smtp',
            'mail.mailers.smtp' => [
                'transport' => 'smtp', 'host' => 'smtp.resend.com', 'port' => 465,
                'scheme' => 'smtps', 'username' => 'resend', 'password' => $credencialFicticia,
            ],
            'services.resend.key' => $credencialFicticia,
            'mail.from.address' => 'control@envios.example.com',
            'mail.transaccional.dominio_verificado' => 'envios.example.com',
            'mail.transaccional.destinatarios_locales' => [$permitido],
            'mail.transaccional.prueba_real_local' => false,
        ]);
        $this->assertFalse($guardia->habilitar($permitido));
        config(['mail.transaccional.prueba_real_local' => true]);
        $this->assertFalse($guardia->habilitar('ajeno@bandeja.test'));

        // La construcción del transporte no abre conexiones. Esta prueba nunca llama a send().
        $this->assertTrue($guardia->habilitar(strtoupper($permitido)));
        $this->assertFalse($guardia->habilitar('persona@example.invalid'));

        foreach ([
            'services.resend.key' => null,
            'mail.from.address' => 'control@otro.example.com',
            'mail.transaccional.dominio_verificado' => '',
            'mail.mailers.smtp.host' => 'smtp.resend.com.example.com',
            'mail.mailers.smtp.port' => 587,
            'mail.mailers.smtp.scheme' => 'smtp',
            'mail.mailers.smtp.username' => 'inesperado',
            'mail.mailers.smtp.url' => 'smtp://127.0.0.1:2525',
        ] as $opcion => $invalido) {
            $original = config($opcion);
            config([$opcion => $invalido]);
            $this->assertFalse($guardia->habilitar($permitido));
            config([$opcion => $original]);
        }

        $this->app->instance('env', 'production');
        $this->assertFalse($guardia->habilitar('persona@example.invalid'));
        $this->assertTrue($guardia->habilitar('otro@bandeja.test'));

        config([
            'mail.from.address' => 'onboarding@resend.dev',
            'mail.transaccional.dominio_verificado' => null,
        ]);
        $this->app->instance('env', 'local');
        $this->assertFalse($guardia->habilitar($permitido));
        config(['mail.transaccional.resend_sandbox' => true]);
        $this->assertTrue($guardia->habilitar($permitido));
        $this->assertFalse($guardia->habilitar('ajeno@bandeja.test'));
        $this->assertFalse($guardia->habilitar('persona@example.invalid'));
        foreach (['testing', 'production'] as $entorno) {
            $this->app->instance('env', $entorno);
            $this->assertFalse($guardia->habilitar($permitido));
        }
    }

    public function test_html_escapa_el_codigo_y_adjunta_el_logotipo_sin_recursos_http(): void
    {
        $codigoFicticio = '<script>012345</script>';
        $mensaje = Mail::send(
            ['html' => 'correo.verificacion', 'text' => 'correo.verificacion-texto'],
            ['codigo' => $codigoFicticio, 'vigencia' => 10],
            fn (Message $mensaje) => $mensaje->to('persona@example.invalid'),
        )->getSymfonySentMessage()->getOriginalMessage();

        $html = $mensaje->getHtmlBody();
        $this->assertStringContainsString('&lt;script&gt;012345&lt;/script&gt;', $html);
        $this->assertStringNotContainsString('<script>', $html);
        $this->assertStringNotContainsString('http:', $html);
        $this->assertStringContainsString('src="cid:', $html);
        $this->assertStringContainsString('alt="Logotipo de MasterExpress"', $html);
        $this->assertCount(1, $mensaje->getAttachments());
        $this->assertStringContainsString('Vence 10 minutos', $mensaje->getTextBody());
        $this->assertTrue(str_contains($mensaje->toString(), 'multipart/alternative'));
    }

    public function test_recuperacion_multiparte_usa_el_plazo_del_broker_y_el_enlace_correcto(): void
    {
        config(['auth.passwords.users.expire' => 37]);
        $usuario = new User(['email' => 'persona+qa@example.invalid']);
        $notificacion = new ResetPassword(str_repeat('a', 64));
        $usuario->notify($notificacion);
        $mensaje = Mail::mailer()->getSymfonyTransport()->messages()->sole()->getOriginalMessage();

        $this->assertSame('Restablece tu contraseña | MasterExpress', $mensaje->getSubject());
        $this->assertStringContainsString('vence 37 minutos', $mensaje->getHtmlBody());
        $this->assertStringContainsString('vence 37 minutos', $mensaje->getTextBody());
        $this->assertStringContainsString('Restablecer mi contraseña', $mensaje->getHtmlBody());
        $this->assertStringContainsString('enlace directo de recuperación', $mensaje->getHtmlBody());
        $this->assertStringContainsString('src="cid:', $mensaje->getHtmlBody());
        $this->assertTrue(str_contains($mensaje->getHtmlBody(), '&amp;email=persona%2Bqa%40example.invalid'));
        $this->assertTrue(str_contains($mensaje->getTextBody(), '&email=persona%2Bqa%40example.invalid'));
        $this->assertTrue(str_contains($mensaje->toString(), 'multipart/alternative'));
    }

    public function test_recuperacion_real_en_local_exige_un_origen_https_definido(): void
    {
        $this->app->instance('env', 'local');
        $usuario = new User(['email' => 'permitido@bandeja.test']);
        $notificacion = new ResetPassword(str_repeat('a', 64));
        config(['mail.transaccional.origen_recuperacion_local' => 'https://qa.example.test/']);
        $this->assertTrue(str_starts_with(
            $notificacion->toMail($usuario)->viewData['url'], 'https://qa.example.test/restablecer-contrasena#',
        ));

        config(['mail.transaccional.origen_recuperacion_local' => 'https://127.0.0.1:5173']);
        $this->expectException(\LogicException::class);
        $notificacion->toMail($usuario);
    }

    public function test_recuperacion_sandbox_admite_solo_el_origen_loopback_y_destino_autorizados(): void
    {
        $this->app->instance('env', 'local');
        config([
            'mail.from.address' => 'onboarding@resend.dev',
            'mail.transaccional.prueba_real_local' => true,
            'mail.transaccional.resend_sandbox' => true,
            'mail.transaccional.origen_recuperacion_local' => 'http://127.0.0.1:5173',
            'mail.transaccional.destinatarios_locales' => ['permitido@bandeja.test'],
        ]);
        $usuario = new User(['email' => 'permitido@bandeja.test']);
        $notificacion = new ResetPassword(str_repeat('a', 64));
        $this->assertTrue(str_starts_with(
            $notificacion->toMail($usuario)->viewData['url'], 'http://127.0.0.1:5173/restablecer-contrasena#',
        ));

        config(['auth.url_spa' => 'http://127.0.0.1:5173']);
        $this->app->instance('env', 'production');
        $this->expectException(\LogicException::class);
        $notificacion->toMail($usuario);
    }
}
