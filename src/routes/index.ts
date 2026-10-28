import { Router } from 'express';
import adminController from '../modules/admin/admin.controller.js';
import authController from '../modules/auth/auth.controller.js';
import markController from '../modules/mark/mark.controller.js';
import studentController from '../modules/student/student.controller.js';
import userController from '../modules/user/user.controller.js';
import { noStore } from '../middlewares/noStore.js';
import { curlResponse } from '../utils/curlResponse.js';
import { sendSuccess } from '../utils/sendSuccess.js';

const router = Router();

router.get('/health', (_req, res) => {
  sendSuccess(res, { status: 'ok' });
});

router.use('/auth', noStore, curlResponse, authController);
router.use('/admin', noStore, curlResponse, adminController);
router.use('/users', curlResponse, userController);
router.use('/students', noStore, curlResponse, studentController);
router.use('/marks', noStore, curlResponse, markController);

router.get('/demo/async-error', async () => {
  await new Promise((resolve) => setTimeout(resolve, 10));
  throw new Error('Boom! Async failure inside a route');
});

export default router;
