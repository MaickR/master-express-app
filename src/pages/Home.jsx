import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { GraduationCap, Shield, User, ChevronRight, LogIn, AlertCircle } from "lucide-react";
import DarkModeToggle from "@/components/DarkModeToggle";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  const navigate = useNavigate();
  const [mode, setMode] = useState(null); // null | "admin" | "colaborador"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [validando, setValidando] = useState(false);

  const resetForm = () => { setUsername(""); setPassword(""); setError(""); };

  // Normaliza el usuario: sin espacios al inicio/fin, sin distinción de mayúsculas
  const normalizeUsername = (u) => u.trim().toLowerCase();

  const handleAdminLogin = async () => {
    if (!username.trim() || !password) {
      setError("Ingrese usuario y contraseña");
      return;
    }
    setValidando(true);
    setError("");
    try {
      const admins = await base44.entities.Administrador.list();
      // Comparación case-insensitive para usuario, estricta para contraseña
      const found = admins.find(
        a => normalizeUsername(a.username) === normalizeUsername(username) && a.password === password
      );
      if (!found) {
        setError("Usuario o contraseña incorrectos");
        setValidando(false);
        return;
      }
      localStorage.setItem("admin_id", found.id);
      localStorage.setItem("admin_nombre", found.nombre_completo || found.username);
      localStorage.setItem("admin_rol", found.rol || "presidente");
      navigate('/AdminDashboard');
    } catch (e) {
      setError("Error al validar credenciales. Intente de nuevo.");
    }
    setValidando(false);
  };

  const handleColaboradorLogin = async () => {
    if (!username.trim() || !password) {
      setError("Ingrese usuario y contraseña");
      return;
    }
    setValidando(true);
    setError("");
    try {
      const colaboradores = await base44.entities.Colaborador.list();
      // Comparación case-insensitive para usuario, estricta para contraseña
      const found = colaboradores.find(
        c => normalizeUsername(c.username) === normalizeUsername(username) &&
             c.password === password &&
             c.activo !== false
      );
      if (!found) {
        setError("Usuario o contraseña incorrectos. Verifique sus credenciales.");
        setValidando(false);
        return;
      }
      localStorage.setItem("colaborador_id", found.id);
      localStorage.setItem("colaborador_nombre", found.nombre_completo || found.username);
      navigate('/ColaboradorDashboard');
    } catch (e) {
      setError("Error al validar credenciales. Intente de nuevo.");
    }
    setValidando(false);
  };

  const handleLogin = mode === "admin" ? handleAdminLogin : handleColaboradorLogin;

  return (
    <div className="min-h-screen safe-min-h bg-gradient-to-br from-background via-primary/5 to-background flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Logo Header */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 bg-accent rounded-2xl shadow-xl shadow-accent/20 mb-6">
            <GraduationCap className="w-10 h-10 text-accent-foreground" />
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold text-foreground font-heading tracking-tight mb-2">
            MASTER EXPRESS EVENTOS
          </h1>
          <p className="text-base text-muted-foreground max-w-md mx-auto">
            Sistema de gestión de graduandos y fotografía profesional
          </p>
        </motion.div>

        {!mode ? (
          <>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="text-center text-foreground/80 text-lg font-medium mb-8"
            >
              Seleccione su tipo de acceso
            </motion.p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.button
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                onClick={() => { setMode("admin"); resetForm(); }}
                className="group relative overflow-hidden rounded-2xl border-2 border-accent/30 bg-accent/5 p-8 text-left transition-all duration-300 hover:bg-accent/10 hover:shadow-xl hover:shadow-accent/10 cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-bl-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500" />
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                    <Shield className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground font-heading mb-2">Soy Administrador</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Acceso completo al sistema. Gestione colaboradores, eventos, gastos y reportes.
                  </p>
                  <div className="flex items-center gap-2 text-sm font-medium text-accent">
                    Ingresar <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </motion.button>

              <motion.button
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
                onClick={() => { setMode("colaborador"); resetForm(); }}
                className="group relative overflow-hidden rounded-2xl border-2 border-primary/20 bg-card p-8 text-left transition-all duration-300 hover:bg-secondary/10 hover:shadow-xl hover:shadow-primary/5 cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500" />
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground font-heading mb-2">Soy Colaborador</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Registre graduandos, capture comprobantes y gestione pagos de sus registros.
                  </p>
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    Ingresar <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </motion.button>
            </div>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-md mx-auto"
          >
            <Card className="border-border/50 shadow-xl">
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 ${mode === "admin" ? "bg-accent/10" : "bg-primary/10"}`}>
                    {mode === "admin"
                      ? <Shield className="w-7 h-7 text-accent" />
                      : <LogIn className="w-7 h-7 text-primary" />}
                  </div>
                  <h2 className="text-xl font-bold text-foreground font-heading">
                    {mode === "admin" ? "Acceso Administrador" : "Acceso Colaborador"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">Ingrese sus credenciales</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Usuario</Label>
                    <Input
                      id="username"
                      placeholder="Su nombre de usuario"
                      value={username}
                      onChange={e => { setUsername(e.target.value); setError(""); }}
                      onKeyDown={e => e.key === 'Enter' && handleLogin()}
                      autoCapitalize="none"
                      autoCorrect="off"
                      autoComplete="username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Contraseña</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Su contraseña"
                      value={password}
                      onChange={e => { setPassword(e.target.value); setError(""); }}
                      onKeyDown={e => e.key === 'Enter' && handleLogin()}
                      autoComplete="current-password"
                    />
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-center gap-2 text-sm text-destructive"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </motion.div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => { setMode(null); resetForm(); }}
                    >
                      Volver
                    </Button>
                    <Button
                      className={`flex-1 text-primary-foreground ${mode === "admin" ? "bg-accent hover:bg-accent/90" : "bg-primary hover:bg-primary/90"}`}
                      onClick={handleLogin}
                      disabled={validando}
                    >
                      {validando ? (
                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div> Validando...</>
                      ) : (
                        <><LogIn className="w-4 h-4 mr-2" /> Ingresar</>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="text-center text-xs text-muted-foreground mt-10"
        >
          Master Express Eventos &copy; {new Date().getFullYear()} — Sistema de gestión integral
        </motion.p>
        <div className="flex justify-center mt-4">
          <DarkModeToggle />
        </div>
      </div>
    </div>
  );
}