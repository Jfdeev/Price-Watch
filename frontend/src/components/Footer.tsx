import { Link } from "react-router-dom";
import { TrendingDown, Mail } from "lucide-react";

function GithubIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function XIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="border-t bg-gray-50/50 mt-auto">
      <div className="container px-4 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600">
                <TrendingDown className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold">PriceWatch</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Monitore preços e economize dinheiro nas suas compras online.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-gray-100 transition-colors"
                aria-label="GitHub"
              >
                <GithubIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-gray-100 transition-colors"
                aria-label="Twitter"
              >
                <XIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-gray-100 transition-colors"
                aria-label="Email"
              >
                <Mail className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Produto</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <Link to="/dashboard" className="hover:text-foreground transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link to="/alerts" className="hover:text-foreground transition-colors">
                  Alertas
                </Link>
              </li>
              <li>
                <Link to="/favorites" className="hover:text-foreground transition-colors">
                  Favoritos
                </Link>
              </li>
              <li>
                <span className="hover:text-foreground transition-colors">Extensão Chrome</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Empresa</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <span className="hover:text-foreground transition-colors">Sobre</span>
              </li>
              <li>
                <span className="hover:text-foreground transition-colors">Blog</span>
              </li>
              <li>
                <span className="hover:text-foreground transition-colors">Carreiras</span>
              </li>
              <li>
                <span className="hover:text-foreground transition-colors">Contato</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Legal</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>
                <span className="hover:text-foreground transition-colors">Privacidade</span>
              </li>
              <li>
                <span className="hover:text-foreground transition-colors">Termos de Uso</span>
              </li>
              <li>
                <span className="hover:text-foreground transition-colors">Cookies</span>
              </li>
              <li>
                <span className="hover:text-foreground transition-colors">Licenças</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
          <p>© 2026 PriceWatch. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
