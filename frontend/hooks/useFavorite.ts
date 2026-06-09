import { useState, useEffect, useCallback } from "react";
import { getFavorites, addFavorite, removeFavorite } from "../lib/api";
import { Session } from "../types";
import { useToast } from "../lib/useToast";
import { useRouter } from "next/router";

export function useFavorite(session: Session | null, launchId: string) {
  const [isFavorite, setIsFavorite] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!session || !launchId) return;
    
    getFavorites()
      .then((r) => {
        const favs = r.launches || [];
        setIsFavorite(favs.some((f) => f.id === launchId));
      })
      .catch((err) => {
        console.error("Failed to fetch favorites", err);
      });
  }, [session, launchId]);

  const handleToggleFavorite = useCallback(async () => {
    if (!session) {
      router.push(`/auth?from=/token/${launchId}`);
      return;
    }
    
    try {
      if (isFavorite) {
        await removeFavorite(launchId);
        setIsFavorite(false);
        toast.success("Removed", "Removed from favorites!");
      } else {
        await addFavorite(launchId);
        setIsFavorite(true);
        toast.success("Added", "Added to favorites!");
      }
    } catch (err) {
      toast.error("Error", "Could not update favorites");
    }
  }, [isFavorite, session, launchId, router, toast]);

  return { isFavorite, handleToggleFavorite };
}
