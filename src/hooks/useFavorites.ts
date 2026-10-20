import { useCallback, useState } from 'react';

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);

  const isFavorite = useCallback(
    (id: string) => favorites.includes(id),
    [favorites]
  );

  const toggle = useCallback((id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  return { favorites, isFavorite, toggle };
}