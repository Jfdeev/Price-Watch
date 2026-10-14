import { Heart } from "lucide-react";
import { ProductCard } from "../components/ProductCard";
import { EmptyState } from "../components/EmptyState";
import { useNavigate } from "react-router-dom";
import { listFavorites, mapProductToCard, type Favorite } from "../services/api";
import { useEffect, useState } from "react";

export function FavoritesPage() {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await listFavorites();
        setFavorites(res);
      } catch (err) {
        console.error("Failed to load favorites", err);
        setFavorites([]);
      }
    }

    void load();
  }, []);

  function handleFavoriteRemoved(favoriteId: string) {
    setFavorites((prev) => prev.filter((fav) => fav.id !== favoriteId));
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Favoritos</h1>
        <p className="text-muted-foreground mt-2">
          Veja os produtos que você salvou para acompanhar depois.
        </p>
      </div>

      {favorites.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Você ainda não salvou nenhum produto"
          description="Quando encontrar um item interessante, clique em favoritar para guardá-lo aqui e comparar depois."
          actionLabel="Buscar produtos"
          onAction={() => navigate("/")}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {favorites.map((fav) => (
            <ProductCard
              key={fav.id}
              {...mapProductToCard(fav.product)}
              isFavorite={true}
              favoriteId={fav.id}
              onFavoriteRemoved={handleFavoriteRemoved}
            />
          ))}
        </div>
      )}
    </div>
  );
}
