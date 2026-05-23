import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

export const validate = (schema: ZodSchema) => 
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.body);
      req.body = parsed;
      next();
    } catch (error: any) {
      if (error instanceof ZodError) {
        const zErr = error as ZodError<any>;
        return res.status(400).json({
          error: "Erro de validação: " + zErr.issues.map((e: any) => `${e.path.join(".")}: ${e.message}`).join(", "),
          issues: zErr.issues
        });
      }
      return res.status(400).json({ error: "Erro de validação desconhecido" });
    }
  };
