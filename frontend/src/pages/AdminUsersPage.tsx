import React, { useEffect, useState } from "react";
import { getUsers, updateUserRole } from "../services/api";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

export function AdminUsersPage() {
  const [users, setUsers] = useState<
    Array<{ id: string; email: string; name?: string; role: string }>
  >([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await getUsers();
      setUsers(res.users);
    } catch (err) {
      console.error("Failed to load users", err);
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function changeRole(id: string, role: "ADMIN" | "USER") {
    try {
      const res = await updateUserRole(id, role);
      setUsers((prev) => prev.map((u) => (u.id === id ? res.user : u)));
      toast.success("Perfil atualizado");
    } catch (err) {
      console.error("Failed to update role", err);
      toast.error("Erro ao atualizar");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2 sm:mb-4">Usuários</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie contas e permissões de forma simples.
        </p>
      </div>
      {loading ? (
        <Card className="p-6">Carregando...</Card>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-white">
          <table className="w-full min-w-[720px] table-auto">
            <thead>
              <tr className="text-left">
                <th className="p-3">Email</th>
                <th className="p-3">Nome</th>
                <th className="p-3">Papel</th>
                <th className="p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="p-3 break-all">{u.email}</td>
                  <td className="p-3">{u.name ?? "-"}</td>
                  <td className="p-3">{u.role}</td>
                  <td className="p-3">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      {u.role === "ADMIN" ? (
                        <Button
                          onClick={() => changeRole(u.id, "USER")}
                          variant="destructive"
                          className="w-full sm:w-auto"
                        >
                          Revogar admin
                        </Button>
                      ) : (
                        <Button
                          onClick={() => changeRole(u.id, "ADMIN")}
                          className="w-full sm:w-auto"
                        >
                          Tornar admin
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
