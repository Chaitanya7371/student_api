import { Router, type Request, type Response } from 'express';
import { validateBody } from '../../middlewares/validate.js';
import { sendSuccess } from '../../utils/sendSuccess.js';
import { loginDto, registerDto, type LoginDto, type RegisterDto } from './auth.dto.js';
import * as authService from './auth.service.js';

const router = Router();

router.post('/register', validateBody(registerDto), async (req: Request<unknown, unknown, RegisterDto>, res: Response) => {
  sendSuccess(res, await authService.register(req.body), 201);
});

router.post('/login', validateBody(loginDto), async (req: Request<unknown, unknown, LoginDto>, res: Response) => {
  sendSuccess(res, await authService.login(req.body));
});

export default router;
