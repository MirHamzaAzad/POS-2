import { Router } from 'express';
import {
  getProducts, getProductByBarcode, createProduct, updateProduct, deleteProduct
} from '../controllers/product.controller';
import { authenticate, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', getProducts);
router.get('/barcode/:code', getProductByBarcode);
router.post('/', requireRole('ADMIN', 'MANAGER', 'INVENTORY'), createProduct);
router.put('/:id', requireRole('ADMIN', 'MANAGER', 'INVENTORY'), updateProduct);
router.delete('/:id', requireRole('ADMIN'), deleteProduct);

export default router;
