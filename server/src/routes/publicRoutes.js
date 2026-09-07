import { Router } from 'express';
import * as pub from '../controllers/publicController.js';
import * as books from '../controllers/bookController.js';
import * as extras from '../controllers/catalogExtrasController.js';
import { optionalProtect } from '../middleware/auth.js';

const r = Router();
r.get('/stats', pub.publicStats);
r.get('/reviews', pub.recentReviews);
r.get('/books', optionalProtect, books.listBooks);
r.get('/books/visitor', extras.listVisitorBooks);
r.get('/books/free', optionalProtect, extras.listFreeBooks);
r.get('/books/categories', extras.listCategories);
r.get('/books/upcoming', books.listUpcoming);
export default r;
