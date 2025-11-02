const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const {
  getIngredients,
  getIngredientById,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  ingredientValidation
} = require('../controllers/ingredientController');

// GET /api/ingredients - Ottieni tutti gli ingredienti (pubblico)
router.get('/', getIngredients);

// GET /api/ingredients/:id - Ottieni un ingrediente specifico (pubblico)
router.get('/:id', getIngredientById);

// POST /api/ingredients - Crea un nuovo ingrediente (solo admin)
router.post('/', authenticateToken, requireAdmin, ingredientValidation, createIngredient);

// PUT /api/ingredients/:id - Aggiorna un ingrediente (solo admin)
router.put('/:id', authenticateToken, requireAdmin, ingredientValidation, updateIngredient);

// DELETE /api/ingredients/:id - Elimina un ingrediente (solo admin)
router.delete('/:id', authenticateToken, requireAdmin, deleteIngredient);

module.exports = router;