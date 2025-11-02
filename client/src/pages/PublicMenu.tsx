import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { businessService, categoryService } from '../services/api';
import { useProductEvents } from '../hooks/useSocket';
import SharedFooter from '../components/SharedFooter';
import './PublicMenu.css';

// URL base per le risorse statiche
const SERVER_BASE_URL = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5001';

interface BusinessInfo {
  id: number;
  name: string;
  description?: string;
  logo_path?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
}

interface Category {
  id: number;
  name: string;
  name_en?: string;
  description?: string;
  description_en?: string;
  parent_id: number | null;
  is_active: number;
  parent_name?: string;
}

const PublicMenu: React.FC = () => {
  const navigate = useNavigate();
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Funzione per ricaricare le categorie
  const reloadCategories = useCallback(async () => {
    try {
      console.log('🔄 Ricaricamento categorie in corso...');
      const categoriesResponse = await categoryService.getPublic();
      if (categoriesResponse.success) {
        setCategories(categoriesResponse.data.categories);
        setLastUpdate(new Date());
        console.log('✅ Categorie ricaricate con successo');
      }
    } catch (err) {
      console.error('❌ Errore nel ricaricamento delle categorie:', err);
    }
  }, []);

  // Gestione eventi Socket.IO per aggiornamenti in tempo reale
  useProductEvents({
    onProductAdded: (data) => {
      console.log('🆕 Prodotto aggiunto, ricaricamento menu...', data);
      reloadCategories();
    },
    onProductUpdated: (data) => {
      console.log('✏️ Prodotto aggiornato, ricaricamento menu...', data);
      reloadCategories();
    },
    onProductDeleted: (data) => {
      console.log('🗑️ Prodotto eliminato, ricaricamento menu...', data);
      reloadCategories();
    }
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch business info
        const businessResponse = await businessService.get();
        setBusinessInfo(businessResponse);

        // Fetch public categories (only parent categories with products)
        const categoriesResponse = await categoryService.getPublic();
        if (categoriesResponse.success) {
          setCategories(categoriesResponse.data.categories);
        } else {
          setError('Errore nel caricamento delle categorie');
        }
      } catch (err) {
        console.error('Errore nel caricamento dei dati:', err);
        setError('Errore nel caricamento del menu');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleCategoryClick = (category: Category) => {
    navigate(`/menu/category/${category.id}`);
  };

  if (loading) {
    return (
      <div className="public-menu-loading">
        <div className="loading-spinner"></div>
        <p>Caricamento menu...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="public-menu-error">
        <h2>Errore</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="public-menu-container">
      {loading && (
        <div className="loading-state">
          <p>Caricamento menu...</p>
        </div>
      )}

      {error && (
        <div className="error-state">
          <p>Errore nel caricamento del menu: {error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Header with logo */}
          <header className="public-menu-header">
            {businessInfo?.logo_path && (
              <div className="logo-container">
                <img 
                  src={`${SERVER_BASE_URL}${businessInfo.logo_path}`} 
                  alt={businessInfo.name || 'Logo'}
                  className="business-logo"
                  onLoad={() => {
                    console.log('Logo caricato con successo:', `${SERVER_BASE_URL}${businessInfo.logo_path}`);
                  }}
                  onError={(e) => {
                    console.error('Errore nel caricamento del logo:', `${SERVER_BASE_URL}${businessInfo.logo_path}`);
                  }}
                />
              </div>
            )}
            <div className="business-name">
              Menu
              <span className="last-update" title={`Ultimo aggiornamento: ${lastUpdate.toLocaleTimeString()}`}>
                🔄
              </span>
            </div>
            {businessInfo?.description && (
              <div className="business-subtitle">
                <p className="business-description">{businessInfo.description}</p>
              </div>
            )}
          </header>

          {/* Main content */}
          <main className="public-menu-content">
            <div className="categories-container">
              {categories.map((category) => (
                <button
                  key={category.id}
                  className="category-button"
                  onClick={() => handleCategoryClick(category)}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </main>

          {/* Footer */}
          <SharedFooter />
        </>
      )}
    </div>
  );
};

export default PublicMenu;