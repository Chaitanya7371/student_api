import { Router, type Request, type Response } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { requirePermission } from '../../middlewares/authorize.js';
import { validateBody } from '../../middlewares/validate.js';
import { sendSuccess } from '../../utils/sendSuccess.js';
import { studentLinkDto, teacherClassDto, type StudentLinkDto, type TeacherClassDto } from './admin.dto.js';
import * as adminService from './admin.service.js';

const router = Router();

router.use(authenticate);

router.post(
  '/teacher-classes',
  requirePermission('admin:manage'),
  validateBody(teacherClassDto),
  async (req: Request<unknown, unknown, TeacherClassDto>, res: Response) => {
    sendSuccess(res, await adminService.assignTeacherClass(req.body), 201);
  },
);

router.post(
  '/student-links',
  requirePermission('admin:manage'),
  validateBody(studentLinkDto),
  async (req: Request<unknown, unknown, StudentLinkDto>, res: Response) => {
    sendSuccess(res, await adminService.linkStudentAccount(req.body), 201);
  },
);

export default router;
