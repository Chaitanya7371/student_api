import { Router, type Request, type Response } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { requirePermission } from '../../middlewares/authorize.js';
import { validateBody } from '../../middlewares/validate.js';
import { idParam } from '../../utils/validators.js';
import { sendSuccess } from '../../utils/sendSuccess.js';
import { averagesQueryDto, updateMarkDto, type UpdateMarkDto } from './mark.dto.js';
import * as markService from './mark.service.js';

const router = Router();

function one(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function actor(req: Request) {
  if (!req.user) throw new Error('authenticate must run first');
  return req.user;
}

router.use(authenticate);

router.get(
  '/averages',
  requirePermission('marks:averages:class', 'marks:averages:any'),
  async (req: Request, res: Response) => {
    const query = averagesQueryDto.parse({
      className: one(req.query.className),
      exam: one(req.query.exam),
      section: one(req.query.section),
    });
    sendSuccess(res, await markService.averageMarks(actor(req), query));
  },
);

router.patch(
  '/:id',
  requirePermission('marks:write:class', 'marks:write:any'),
  validateBody(updateMarkDto),
  async (req: Request<{ id: string }, unknown, UpdateMarkDto>, res: Response) => {
    const { id } = idParam.parse(req.params);
    sendSuccess(res, await markService.updateMark(actor(req), id, req.body));
  },
);

router.delete('/:id', requirePermission('marks:write:class', 'marks:write:any'), async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  await markService.deleteMark(actor(req), id);
  sendSuccess(res, null, 204);
});

export default router;
