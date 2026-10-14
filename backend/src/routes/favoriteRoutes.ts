import { Router } from "express";
import {
  createFavoriteController,
  deleteFavoriteController,
  getFavoriteForProductController,
  listFavoritesController,
  lookupFavoritesController,
} from "../controllers/favoriteController";
import { authenticate } from "../middleware/authMiddleware";

export const favoriteRoutes = Router();

favoriteRoutes.use(authenticate);
favoriteRoutes.post("/", createFavoriteController);
favoriteRoutes.get("/", listFavoritesController);
favoriteRoutes.get("/product/:productId", getFavoriteForProductController);
favoriteRoutes.post("/lookup", lookupFavoritesController);
favoriteRoutes.delete("/:id", deleteFavoriteController);
