import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { deleteCurrentUser, updateCurrentUser } from "../services/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

export function ProfilePage() {
  const { user, logout, loginWithToken } = useAuth();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(user?.name ?? "");
  }, [user?.name]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password && password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    setIsSaving(true);

    try {
      const res = await updateCurrentUser({
        name: name.trim() || undefined,
        password: password.trim() || undefined
      });

      const token = localStorage.getItem("pw_token");
      if (token) {
        loginWithToken(token, res.user);
      }

      setPassword("");
      setConfirmPassword("");
      toast.success("Perfil atualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar perfil");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteAccount() {
    const confirmed = globalThis.confirm(
      "Tem certeza que deseja excluir sua conta? Essa ação não pode ser desfeita."
    );
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);

    try {
      await deleteCurrentUser();
      logout();
      toast.success("Conta excluída");
      navigate("/register");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir conta");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-violet-600">Conta</p>
        <h1 className="text-3xl font-bold tracking-tight">Meu perfil</h1>
        <p className="text-sm text-muted-foreground">
          Atualize seus dados e acesse os fluxos principais do app.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border bg-white p-6 shadow-sm"
        >
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Dados da conta</h2>
            <p className="text-sm text-muted-foreground">Edite o nome e a senha da sua conta.</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="profile-name" className="text-sm font-medium text-slate-700">
              Nome
            </label>
            <Input
              id="profile-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Seu nome"
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="profile-email" className="text-sm font-medium text-slate-700">
              Email
            </label>
            <Input
              id="profile-email"
              value={user?.email ?? ""}
              disabled
              className="h-12 bg-slate-100"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="profile-password" className="text-sm font-medium text-slate-700">
                Nova senha
              </label>
              <Input
                id="profile-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Deixe em branco para manter"
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="profile-confirm-password"
                className="text-sm font-medium text-slate-700"
              >
                Confirmar nova senha
              </label>
              <Input
                id="profile-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repita a nova senha"
                className="h-12"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="submit" className="bg-violet-600 hover:bg-violet-700" disabled={isSaving}>
              {isSaving ? "Salvando..." : "Salvar perfil"}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate("/")}>
              Voltar para a home
            </Button>
          </div>
        </form>

        <div className="space-y-6 rounded-2xl border bg-slate-50 p-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Atalhos</h2>
            <p className="text-sm text-muted-foreground">
              Continue de onde parou sem perder o fluxo.
            </p>
          </div>

          <div className="space-y-3">
            <Link
              to="/dashboard"
              className="block rounded-xl border bg-white px-4 py-3 font-medium hover:border-violet-300 hover:bg-violet-50"
            >
              Ver painel
            </Link>
            <Link
              to="/favorites"
              className="block rounded-xl border bg-white px-4 py-3 font-medium hover:border-violet-300 hover:bg-violet-50"
            >
              Abrir favoritos
            </Link>
            <Link
              to="/alerts"
              className="block rounded-xl border bg-white px-4 py-3 font-medium hover:border-violet-300 hover:bg-violet-50"
            >
              Gerenciar alertas
            </Link>
            {user?.role === "ADMIN" && (
              <Link
                to="/admin/users"
                className="block rounded-xl border bg-white px-4 py-3 font-medium hover:border-violet-300 hover:bg-violet-50"
              >
                Gerenciar usuários
              </Link>
            )}
          </div>

          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <p className="font-semibold text-rose-900">Zona de risco</p>
            <p className="mt-1 text-sm text-rose-800">
              Excluir sua conta remove o acesso imediatamente.
            </p>
            <Button
              type="button"
              variant="destructive"
              className="mt-4 w-full"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
            >
              {isDeleting ? "Excluindo..." : "Excluir conta"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
