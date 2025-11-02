const { body, validationResult } = require('express-validator');
const database = require('../config/database');
const { translateToEnglish } = require('../services/translationService');

// Validazione per categorie
const categoryValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Il nome deve essere tra 1 e 100 caratteri'),
  body('parent_id')
    .optional({ nullable: true })
    .custom((value) => {
      if (value !== null && value !== undefined && value !== '') {
        if (!Number.isInteger(Number(value)) || Number(value) <= 0) {
          throw new Error('L\'ID del genitore deve essere un numero intero positivo');
        }
      }
      return true;
    }),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('Il campo is_active deve essere un valore booleano')
];

// Funzione ricorsiva per costruire l'albero delle categorie
const buildCategoryTree = (categories, parentId = null) => {
  return categories
    .filter(category => category.parent_id === parentId)
    .map(category => ({
      ...category,
      children: buildCategoryTree(categories, category.id)
    }));
};

// GET /api/categories/public - Ottieni solo le categorie parent che hanno prodotti (per il menu pubblico)
const getPublicCategories = async (req, res) => {
  try {
    // Query per ottenere solo le categorie parent che hanno prodotti disponibili
    // (direttamente o attraverso le loro sottocategorie)
    const query = `
      SELECT DISTINCT c.* 
      FROM categories c 
      WHERE c.parent_id IS NULL 
        AND c.is_active = 1 
        AND (
          -- Ha prodotti diretti
          EXISTS (
            SELECT 1 FROM products p 
            WHERE p.category_id = c.id AND p.is_available = 1
          )
          OR 
          -- Ha prodotti nelle sottocategorie
          EXISTS (
            SELECT 1 FROM categories sub 
            INNER JOIN products p ON p.category_id = sub.id 
            WHERE sub.parent_id = c.id AND sub.is_active = 1 AND p.is_available = 1
          )
        )
      ORDER BY c.name ASC
    `;
    
    const categories = await database.all(query);
    
    res.json({
      success: true,
      data: { categories }
    });
  } catch (error) {
    console.error('Errore nel recupero delle categorie pubbliche:', error);
    res.status(500).json({
      success: false,
      message: 'Errore interno del server'
    });
  }
};

// GET /api/categories - Ottieni tutte le categorie (struttura piatta o ad albero)
const getCategories = async (req, res) => {
  try {
    const { tree = 'false', concatenated = 'false', with_products = 'false' } = req.query;
    
    let categories;
    
    if (with_products === 'true') {
      // Ottieni solo le categorie che hanno prodotti associati
      const query = `
        SELECT DISTINCT c.* 
        FROM categories c 
        INNER JOIN products p ON c.id = p.category_id 
        WHERE p.is_available = 1 
        ORDER BY c.name ASC
      `;
      categories = await database.all(query);
    } else {
      // Prima ottieni tutte le categorie
      categories = await database.select('categories', '*', 'ORDER BY name ASC');
    }
    
    // Se richieste solo le categorie concatenate
    if (concatenated === 'true') {
      return getConcatenatedCategories(req, res);
    }

    
    // Aggiungi il nome del genitore per ogni categoria
    const categoriesWithParent = await Promise.all(
      categories.map(async (category) => {
        let parent_name = null;
        if (category.parent_id) {
          const parent = await database.select('categories', 'name', 'WHERE id = ?', [category.parent_id]);
          if (parent && parent.length > 0) {
            parent_name = parent[0].name;
          }
        }
        
        return {
          ...category,
          parent_name
        };
      })
    );
    
    if (tree === 'true') {
      // Restituisci la struttura ad albero
      const categoryTree = buildCategoryTree(categoriesWithParent);
      res.json({
        success: true,
        data: { categories: categoryTree }
      });
    } else {
      // Restituisci la struttura piatta
      res.json({
        success: true,
        data: { categories: categoriesWithParent }
      });
    }
  } catch (error) {
    console.error('Errore nel recupero delle categorie:', error);
    res.status(500).json({
      success: false,
      message: 'Errore interno del server'
    });
  }
};

// GET /api/categories/concatenated - Ottieni solo le categorie concatenate (figlie con nome del genitore)
const getConcatenatedCategories = async (req, res) => {
  try {
    // Ottieni tutte le categorie
    const allCategories = await database.select('categories', '*', 'ORDER BY parent_id ASC, name ASC');
    
    // Separa le categorie principali da quelle figlie
    const parentCategories = allCategories.filter(cat => cat.parent_id === null);
    const childCategories = allCategories.filter(cat => cat.parent_id !== null);
    
    // Crea un array per le categorie da mostrare
    const categoriesToShow = [];
    
    // Aggiungi le categorie principali che NON hanno figli
    for (const parentCategory of parentCategories) {
      const hasChildren = childCategories.some(child => child.parent_id === parentCategory.id);
      if (!hasChildren) {
        categoriesToShow.push({
          ...parentCategory,
          display_name: parentCategory.name
        });
      }
    }
    
    // Aggiungi le categorie figlie con nome concatenato
    const concatenatedChildren = await Promise.all(
      childCategories.map(async (category) => {
        const parent = await database.select('categories', 'name', 'WHERE id = ?', [category.parent_id]);
        const parent_name = parent && parent.length > 0 ? parent[0].name : '';
        
        return {
          ...category,
          parent_name,
          // Nome concatenato nel formato "Genitore -- Figlia"
          display_name: `${parent_name} -- ${category.name}`
        };
      })
    );
    
    // Combina le categorie principali senza figli e quelle concatenate
    const finalCategories = [...categoriesToShow, ...concatenatedChildren];
    
    // Ordina per display_name
    finalCategories.sort((a, b) => a.display_name.localeCompare(b.display_name));
    
    res.json({
      success: true,
      data: { categories: finalCategories }
    });
  } catch (error) {
    console.error('Errore nel recupero delle categorie concatenate:', error);
    res.status(500).json({
      success: false,
      message: 'Errore interno del server'
    });
  }
};

// GET /api/categories/:id - Ottieni una categoria specifica con i suoi figli
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const category = await database.select('categories', '*', 'WHERE id = ?', [id]);
    
    if (!category || category.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Categoria non trovata'
      });
    }
    
    // Ottieni il nome del genitore se esiste
    let parent_name = null;
    if (category[0].parent_id) {
      const parent = await database.select('categories', 'name', 'WHERE id = ?', [category[0].parent_id]);
      if (parent && parent.length > 0) {
        parent_name = parent[0].name;
      }
    }
    
    // Ottieni le categorie figlie
    const children = await database.select('categories', '*', 'WHERE parent_id = ? ORDER BY name ASC', [id]);
    
    const result = {
      ...category[0],
      parent_name,
      children: children || []
    };
    
    res.json({
      success: true,
      data: { category: result }
    });
  } catch (error) {
    console.error('Errore nel recupero della categoria:', error);
    res.status(500).json({
      success: false,
      message: 'Errore interno del server'
    });
  }
};

// POST /api/categories - Crea una nuova categoria
const createCategory = async (req, res) => {
  try {
    // Log dei dati ricevuti per debug
    console.log('=== DEBUG CATEGORY CREATION ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('parent_id type:', typeof req.body.parent_id);
    console.log('parent_id value:', req.body.parent_id);
    console.log('===============================');
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Dati non validi',
        errors: errors.array()
      });
    }
    
    const { name, parent_id, name_en: providedNameEn, is_active } = req.body;
    
    // Usa i valori inglesi forniti dal frontend, altrimenti traduci automaticamente
    let name_en = providedNameEn && providedNameEn.trim() ? providedNameEn.trim() : await translateToEnglish(name);
    
    console.log(`Debug - Traduzione categoria: '${name}' -> '${name_en}'`);
    
    // Verifica se esiste già una categoria con lo stesso nome nello stesso livello
    let whereClause = 'WHERE LOWER(name) = LOWER(?)';
    let params = [name];
    
    if (parent_id) {
      // Verifica che la categoria genitore esista
      const parentCategory = await database.select('categories', '*', 'WHERE id = ?', [parent_id]);
      if (!parentCategory || parentCategory.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'La categoria genitore specificata non esiste'
        });
      }
      
      whereClause += ' AND parent_id = ?';
      params.push(parent_id);
    } else {
      whereClause += ' AND parent_id IS NULL';
    }
    
    const existing = await database.select('categories', '*', whereClause, params);
    if (existing && existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Esiste già una categoria con questo nome nello stesso livello'
      });
    }
    
    const result = await database.insert('categories', {
      name: name.trim(),
      parent_id: parent_id || null,
      name_en: name_en,
      is_active: is_active !== undefined ? is_active : true
    });
    
    const newCategory = await database.select('categories', '*', 'WHERE id = ?', [result.lastID]);
    
    // Ottieni il nome del genitore se esiste
    let parent_name = null;
    if (newCategory[0].parent_id) {
      const parent = await database.select('categories', 'name', 'WHERE id = ?', [newCategory[0].parent_id]);
      if (parent && parent.length > 0) {
        parent_name = parent[0].name;
      }
    }
    
    res.status(201).json({
      success: true,
      message: 'Categoria creata con successo',
      data: { 
        category: {
          ...newCategory[0],
          parent_name
        }
      }
    });
  } catch (error) {
    console.error('Errore nella creazione della categoria:', error);
    res.status(500).json({
      success: false,
      message: 'Errore interno del server'
    });
  }
};

// PUT /api/categories/:id - Aggiorna una categoria
const updateCategory = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Dati non validi',
        errors: errors.array()
      });
    }
    
    const { id } = req.params;
    const { name, parent_id, name_en: providedNameEn, is_active } = req.body;
    
    // Usa i valori inglesi forniti dal frontend, altrimenti traduci automaticamente
    let name_en = providedNameEn && providedNameEn.trim() ? providedNameEn.trim() : await translateToEnglish(name);
    
    console.log(`Debug - Aggiornamento categoria: '${name}' -> '${name_en}'`);
    
    // Verifica se la categoria esiste
    const existing = await database.select('categories', '*', 'WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Categoria non trovata'
      });
    }
    
    // Verifica che non si stia tentando di impostare se stessa come genitore
    if (parent_id && parseInt(parent_id) === parseInt(id)) {
      return res.status(400).json({
        success: false,
        message: 'Una categoria non può essere genitore di se stessa'
      });
    }
    
    // Verifica che la categoria genitore esista (se specificata)
    if (parent_id) {
      const parentCategory = await database.select('categories', '*', 'WHERE id = ?', [parent_id]);
      if (!parentCategory || parentCategory.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'La categoria genitore specificata non esiste'
        });
      }
      
      // Verifica che non si stia creando un ciclo (la categoria genitore non deve essere figlia di questa categoria)
      const checkCycle = async (categoryId, targetParentId) => {
        const parent = await database.select('categories', 'parent_id', 'WHERE id = ?', [targetParentId]);
        if (!parent || parent.length === 0) return false;
        
        if (parent[0].parent_id === null) return false;
        if (parseInt(parent[0].parent_id) === parseInt(categoryId)) return true;
        
        return await checkCycle(categoryId, parent[0].parent_id);
      };
      
      const hasCycle = await checkCycle(id, parent_id);
      if (hasCycle) {
        return res.status(400).json({
          success: false,
          message: 'Impossibile impostare questa categoria come genitore: si creerebbe un ciclo'
        });
      }
    }
    
    // Verifica se esiste già una categoria con lo stesso nome nello stesso livello
    let whereClause = 'WHERE LOWER(name) = LOWER(?) AND id != ?';
    let params = [name, id];
    
    if (parent_id) {
      whereClause += ' AND parent_id = ?';
      params.push(parent_id);
    } else {
      whereClause += ' AND parent_id IS NULL';
    }
    
    const duplicate = await database.select('categories', '*', whereClause, params);
    if (duplicate && duplicate.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Esiste già una categoria con questo nome nello stesso livello'
      });
    }
    
    await database.update('categories', {
      name: name.trim(),
      parent_id: parent_id || null,
      name_en: name_en,
      is_active: is_active !== undefined ? is_active : existing[0].is_active
    }, 'WHERE id = ?', [id]);
    
    const updatedCategory = await database.select('categories', '*', 'WHERE id = ?', [id]);
    
    // Ottieni il nome del genitore se esiste
    let parent_name = null;
    if (updatedCategory[0].parent_id) {
      const parent = await database.select('categories', 'name', 'WHERE id = ?', [updatedCategory[0].parent_id]);
      if (parent && parent.length > 0) {
        parent_name = parent[0].name;
      }
    }
    
    res.json({
      success: true,
      message: 'Categoria aggiornata con successo',
      data: { 
        category: {
          ...updatedCategory[0],
          parent_name
        }
      }
    });
  } catch (error) {
    console.error('Errore nell\'aggiornamento della categoria:', error);
    res.status(500).json({
      success: false,
      message: 'Errore interno del server'
    });
  }
};

// DELETE /api/categories/:id - Elimina una categoria
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verifica se la categoria esiste
    const existing = await database.select('categories', '*', 'WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Categoria non trovata'
      });
    }
    
    // Verifica se la categoria ha delle sottocategorie
    const children = await database.select('categories', '*', 'WHERE parent_id = ?', [id]);
    if (children && children.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Impossibile eliminare la categoria: contiene delle sottocategorie'
      });
    }
    
    await database.delete('categories', 'WHERE id = ?', [id]);
    
    res.json({
      success: true,
      message: 'Categoria eliminata con successo'
    });
  } catch (error) {
    console.error('Errore nell\'eliminazione della categoria:', error);
    res.status(500).json({
      success: false,
      message: 'Errore interno del server'
    });
  }
};

module.exports = {
  getCategories,
  getPublicCategories,
  getConcatenatedCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  categoryValidation
};