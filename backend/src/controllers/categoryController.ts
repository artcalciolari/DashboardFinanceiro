import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { HttpError } from '../utils/httpError';

const CategorySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.enum(['INCOME', 'EXPENSE']),
  color: z.string().default('#10B981'),
  icon: z.string().optional(),
});

export async function getCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
    res.json(categories);
  } catch (err) {
    next(err);
  }
}

export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const data = CategorySchema.parse(req.body);
    const category = await prisma.category.create({ data });
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
}

export async function updateCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const data = CategorySchema.partial().parse(req.body);
    if (data.type) {
      const existing = await prisma.category.findUniqueOrThrow({
        where: { id: req.params.id },
        include: { _count: { select: { transactions: true, installmentGroups: true, subscriptions: true, alerts: true } } },
      });
      if (existing.type !== data.type && Object.values(existing._count).some((count) => count > 0)) {
        throw new HttpError(409, 'Uma categoria em uso não pode mudar de tipo. Crie outra categoria.', 'CATEGORY_IN_USE');
      }
    }
    const category = await prisma.category.update({
      where: { id: req.params.id },
      data,
    });
    res.json(category);
  } catch (err) {
    next(err);
  }
}

export async function deleteCategory(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
