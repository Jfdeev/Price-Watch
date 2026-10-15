import type { Request, Response } from "express";
import {
  createPriceAlert,
  deletePriceAlert,
  listPriceAlerts,
  updatePriceAlert,
} from "../services/alertService";

type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
  };
};

export async function createPriceAlertController(
  request: Request,
  response: Response,
) {
  try {
    const userId = (request as AuthenticatedRequest).user?.id;
    if (userId !== undefined) {
      const alert = await createPriceAlert({
        productId: request.body.productId,
        userId,
        targetPrice: Number(request.body.targetPrice),
        email: request.body.email,
      });

      return response.status(201).json(alert);
    }

    return response.status(401).json({ message: "Unauthorized" });
  } catch (error) {
    return response.status(400).json({
      message: error instanceof Error ? error.message : "Erro ao criar alerta.",
    });
  }
}

export async function listPriceAlertsController(
  request: Request,
  response: Response,
) {
  const userId = (request as AuthenticatedRequest).user?.id;
  if (userId !== undefined) {
    const alerts = await listPriceAlerts(userId);
    return response.json(alerts);
  }

  return response.status(401).json({ message: "Unauthorized" });
}

export async function updatePriceAlertController(
  request: Request,
  response: Response,
) {
  const userId = (request as AuthenticatedRequest).user?.id;
  if (userId === undefined) {
    return response.status(401).json({ message: "Unauthorized" });
  }

  const { targetPrice, email, isActive } = request.body ?? {};
  const parsedTargetPrice =
    targetPrice !== undefined ? Number(targetPrice) : undefined;

  if (parsedTargetPrice !== undefined) {
    const isTargetPriceValid =
      Number.isFinite(parsedTargetPrice) && parsedTargetPrice > 0;
    if (!isTargetPriceValid) {
      return response.status(400).json({ message: "Preço alvo inválido." });
    }
  }

  if (email !== undefined && String(email).trim().length === 0) {
    return response.status(400).json({ message: "E-mail inválido." });
  }

  const updated = await updatePriceAlert(
    request.params.id,
    {
      targetPrice: parsedTargetPrice,
      email: email !== undefined ? String(email).trim() : undefined,
      isActive: typeof isActive === "boolean" ? isActive : undefined,
    },
    userId,
  );

  if (updated !== null) {
    return response.json(updated);
  }

  return response.status(404).json({ message: "Alerta não encontrado." });
}

export async function deletePriceAlertController(
  request: Request,
  response: Response,
) {
  const userId = (request as AuthenticatedRequest).user?.id;
  if (userId === undefined) {
    return response.status(401).json({ message: "Unauthorized" });
  }

  const deleted = await deletePriceAlert(request.params.id, userId);

  if (deleted !== null) {
    return response.status(204).send();
  }

  return response.status(404).json({ message: "Alerta não encontrado." });
}
