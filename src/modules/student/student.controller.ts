import { Router, type Request, type Response } from 'express';
import { env } from '../../config/env.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { requirePermission } from '../../middlewares/authorize.js';
import { createRateLimiter } from '../../middlewares/rateLimit.js';
import { validateBody } from '../../middlewares/validate.js';
import { idParam } from '../../utils/validators.js';
import { sendSuccess } from '../../utils/sendSuccess.js';
import { createMarksDto, type CreateMarksDto } from '../mark/mark.dto.js';
import * as markService from '../mark/mark.service.js';
import { createStudentDto, listStudentsQueryDto, updateStudentDto, type CreateStudentDto, type UpdateStudentDto } from './student.dto.js';
import * as studentService from './student.service.js';

const router = Router();

function one(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function actor(req: Request) {
  if (!req.user) throw new Error('authenticate must run first');
  return req.user;
}

/** Per-user limit on entering marks. Keyed by user id (schools share one IP). */
export const marksWriteLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: env.MARKS_RATE_LIMIT_MAX,
  keyFn: (req) => `marks-write:${req.user?.id ?? 'anonymous'}`,
});

router.use(authenticate);

router.get(
  '/',
  requirePermission('students:read:own', 'students:read:class', 'students:read:any'),
  async (req: Request, res: Response) => {
    const query = listStudentsQueryDto.parse({
      className: one(req.query.className),
      section: one(req.query.section),
      search: one(req.query.search),
      limit: one(req.query.limit),
      offset: one(req.query.offset),
    });
    sendSuccess(res, await studentService.findStudents(actor(req), query));
  },
);

router.get(
  '/:id',
  requirePermission('students:read:own', 'students:read:class', 'students:read:any'),
  async (req: Request, res: Response) => {
    const { id } = idParam.parse(req.params);
    sendSuccess(res, await studentService.findStudent(actor(req), id));
  },
);

router.post(
  '/',
  requirePermission('students:write:any'),
  validateBody(createStudentDto),
  async (req: Request, res: Response) => {
    sendSuccess(res, await studentService.createStudent(actor(req), req.body as CreateStudentDto), 201);
  },
);

router.patch(
  '/:id',
  requirePermission('students:write:any'),
  validateBody(updateStudentDto),
  async (req: Request<{ id: string }, unknown, UpdateStudentDto>, res: Response) => {
    const { id } = idParam.parse(req.params);
    sendSuccess(res, await studentService.updateStudent(actor(req), id, req.body));
  },
);

router.delete('/:id', requirePermission('students:write:any'), async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  await studentService.deleteStudent(actor(req), id);
  sendSuccess(res, null, 204);
});

router.post(
  '/:id/marks',
  requirePermission('marks:write:class', 'marks:write:any'),
  marksWriteLimiter,
  validateBody(createMarksDto),
  async (req: Request<{ id: string }, unknown, CreateMarksDto>, res: Response) => {
    const { id } = idParam.parse(req.params);
    sendSuccess(res, await markService.addMarks(actor(req), id, req.body), 201);
  },
);

export default router;
