import express from 'express';
import { corsMiddleware } from './middlewares/cors.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFoundHandler } from './middlewares/notFound.js';
import { rejectDangerousPayload } from './middlewares/rejectDangerousPayload.js';
import { requestLogger } from './middlewares/requestLogger.js';
import routes from './routes/index.js';

const app = express();

app.use(requestLogger);
app.use(corsMiddleware);
app.use(express.json({ limit: '100kb' }));
app.use(rejectDangerousPayload);

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
