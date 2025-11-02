const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const router = express.Router();
const dbPath = path.join(__dirname, '../database/restaurant.db');

// Configurazione multer per l'upload del logo
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/logos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Mantieni solo un logo, sovrascrivendo quello esistente
    const ext = path.extname(file.originalname);
    cb(null, 'logo' + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  },
  fileFilter: function (req, file, cb) {
    // Accetta solo immagini
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo file immagine sono permessi'), false);
    }
  }
});

// GET /api/business - Recupera i dati dell'attività
router.get('/', (req, res) => {
  const db = new sqlite3.Database(dbPath);
  
  db.get('SELECT * FROM business_info WHERE id = 1', (err, row) => {
    if (err) {
      console.error('Errore nel recupero dei dati dell\'attività:', err);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
    
    if (!row) {
      // Se non esiste un record, ne creiamo uno di default
      const defaultData = {
        id: 1,
        name: 'La Mia Attività',
        description: 'Inserisci qui la descrizione della tua attività',
        address: '',
        city: '',
        postal_code: '',
        phone: '',
        email: '',
        vat_number: '',
        website: '',
        instagram: '',
        facebook: '',
        google_business: '',
        logo_path: ''
      };
      return res.json(defaultData);
    }
    
    res.json(row);
  });
  
  db.close();
});

// POST /api/business/logo - Upload logo
router.post('/logo', upload.single('logo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nessun file caricato' });
  }

  const logoPath = `/uploads/logos/${req.file.filename}`;
  const db = new sqlite3.Database(dbPath);
  
  // Aggiorna il logo_path nel database
  db.run('UPDATE business_info SET logo_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1', 
    [logoPath], 
    function(err) {
      if (err) {
        console.error('Errore nell\'aggiornamento del logo:', err);
        return res.status(500).json({ error: 'Errore interno del server' });
      }
      
      res.json({ 
        message: 'Logo caricato con successo',
        logo_path: logoPath
      });
    }
  );
  
  db.close();
});

// PUT /api/business - Aggiorna i dati dell'attività
router.put('/', (req, res) => {
  const {
    name,
    description,
    address,
    city,
    postal_code,
    phone,
    email,
    vat_number,
    website,
    instagram,
    facebook,
    google_business,
    whatsapp,
    logo_path
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Il nome dell\'attività è obbligatorio' });
  }

  const db = new sqlite3.Database(dbPath);
  
  const query = `
    INSERT OR REPLACE INTO business_info (
      id, name, description, address, city, postal_code, 
      phone, email, vat_number, website, instagram, 
      facebook, google_business, whatsapp, logo_path, updated_at
    ) VALUES (
      1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
    )
  `;
  
  db.run(query, [
    name, description, address, city, postal_code,
    phone, email, vat_number, website, instagram,
    facebook, google_business, whatsapp, logo_path
  ], function(err) {
    if (err) {
      console.error('Errore nell\'aggiornamento dei dati dell\'attività:', err);
      return res.status(500).json({ error: 'Errore interno del server' });
    }
    
    res.json({ 
      message: 'Dati dell\'attività aggiornati con successo',
      id: this.lastID || 1
    });
  });
  
  db.close();
});

module.exports = router;