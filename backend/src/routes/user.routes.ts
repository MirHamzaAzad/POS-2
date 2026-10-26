import { Router } from 'express';
import { getUsers, createUser, updateUser, toggleUserStatus } from '../controllers/user.controller';
import { authenticate, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('ADMIN', 'MANAGER'), getUsers);
router.post('/', requireRole('ADMIN'), createUser);
router.put('/:id', requireRole('ADMIN'), updateUser);
router.patch('/:id/toggle', requireRole('ADMIN'), toggleUserStatus);

export default router;
