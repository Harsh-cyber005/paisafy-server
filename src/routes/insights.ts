import { Router } from 'express';
import { protect } from '../middlewares/auth';
import { getUserInsights } from '../controllers/insightController';

const insightsRouter = Router();

insightsRouter.get("/", (req, res) => {
    res.send("Insights Home");
});

insightsRouter.use(protect);

insightsRouter.post('/insights', getUserInsights);

export default insightsRouter;