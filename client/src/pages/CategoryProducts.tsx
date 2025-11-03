import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { categoryService, productService, businessService } from '../services/api';
import { useProductEvents } from '../hooks/useSocket';
import SharedFooter from '../components/SharedFooter';

// URL base per le risorse statiche
const SERVER_BASE_URL = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5001';

interface Product {
  id: number;
  name: string;
  name_en?: string;
  description?: string;
  description_en?: string;
  price: number;
  image_path?: string;
  is_active: number;
  category_id: number;
  category_name: string;
  allergens: Array<{
    id: number;
    name: string;
    name_en?: string;
  }>;
  ingredients: Array<{
    id: number;
    name: string;
    name_en?: string;
  }>;
}

interface BusinessInfo {
  id: number;
  name: string;
  description: string;
  address: string;
  city: string;
  postal_code: string;
  phone: string;
  email: string;
  website: string;
  logo_url?: string;
}

interface Allergen {
  id: number;
  name: string;
  name_en?: string;
  icon?: string;
}

interface Ingredient {
  id: number;
  name: string;
  name_en?: string;
  icon?: string;
}

interface Category {
  id: number;
  name: string;
  name_en?: string;
  description?: string;
}

const PageContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 20px;
  padding-bottom: 120px; /* Spazio per il footer fisso */
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 30px;
  gap: 20px;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
`;

const BackButton = styled.button`
  background: rgba(204, 157, 109, 0.1);
  border: 2px solid rgba(204, 157, 109, 0.3);
  color: #cc9d6d;
  padding: 12px 20px;
  border-radius: 12px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;

  &:hover {
    background: rgba(204, 157, 109, 0.2);
    transform: translateY(-2px);
  }
`;

const CategoryTitle = styled.h1`
  color: #cc9d6d;
  font-size: 2.5rem;
  font-weight: 700;
  margin: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const ProductsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 25px;
  max-width: 1200px;
  margin: 0 auto;
`;

const ProductCard = styled.div`
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  padding: 25px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
  border: 1px solid rgba(255, 255, 255, 0.2);

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 15px 40px rgba(0, 0, 0, 0.3);
  }
`;

const ProductImage = styled.div.withConfig({
  shouldForwardProp: (prop) => prop !== 'hasImage',
})<{ hasImage: boolean }>`
  width: 100%;
  height: 200px;
  border-radius: 15px;
  margin-bottom: 20px;
  background: ${props => props.hasImage ? 'none' : 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'};
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 15px;
  }
`;

const ProductName = styled.h3`
  color: #2d3748;
  font-size: 1.4rem;
  font-weight: 600;
  margin: 0 0 10px 0;
  line-height: 1.3;
`;

const ProductPrice = styled.div`
  color: #cc9d6d;
  font-size: 1.3rem;
  font-weight: 700;
  margin-bottom: 15px;
`;

const ProductDescription = styled.p`
  color: #4a5568;
  font-size: 0.95rem;
  line-height: 1.5;
  margin-bottom: 15px;
`;

const TagsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 15px;
`;

const IngredientsSection = styled.div`
  margin-bottom: 10px;
`;

const AllergensSection = styled.div`
  margin-bottom: 10px;
`;

const SectionTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  color: #4a5568;
  margin-bottom: 5px;
`;

const ItemsList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const Tag = styled.span.withConfig({
  shouldForwardProp: (prop) => prop !== 'type',
})<{ type: 'allergen' | 'ingredient' }>`
  background: ${props => props.type === 'allergen' ? '#fed7d7' : '#e6fffa'};
  color: ${props => props.type === 'allergen' ? '#c53030' : '#00695c'};
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
  border: 1px solid ${props => props.type === 'allergen' ? '#feb2b2' : '#b2dfdb'};
`;

const LoadingState = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 50vh;
  color: #666;
  font-size: 1.2rem;
`;

const EmptyState = styled.div`
  text-align: center;
  color: #666;
  font-size: 1.2rem;
  margin-top: 50px;
`;

const FixedNavigation = styled.div`
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
`;

const FloatingBackButton = styled.button`
  background: #cc9d6d;
  color: white;
  border: none;
  padding: 15px 20px;
  border-radius: 50px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  box-shadow: 0 4px 20px rgba(204, 157, 109, 0.3);
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;

  &:hover {
    background: #b8906b;
    transform: translateY(-2px);
    box-shadow: 0 6px 25px rgba(204, 157, 109, 0.4);
  }
`;

const CategoryProducts: React.FC = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [language] = useState<'it' | 'en'>(
    (typeof window !== 'undefined' && localStorage.getItem('menu-language') === 'en') ? 'en' : 'it'
  );

  // Funzione per ricaricare i prodotti
  const reloadProducts = useCallback(async () => {
    if (!categoryId) return;
    
    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Ricaricamento prodotti in corso...');
      }
      const productsResponse = await productService.getByCategory(parseInt(categoryId));
      
      if (productsResponse.success) {
        setProducts(productsResponse.data.products);
        setCategory(productsResponse.data.category);
        if (process.env.NODE_ENV !== 'production') {
          console.log('Prodotti ricaricati con successo');
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Errore nel ricaricamento dei prodotti:', err);
      }
    }
  }, [categoryId]);

  // Gestione eventi Socket.IO per aggiornamenti in tempo reale
  useProductEvents({
    onProductAdded: (data) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Prodotto aggiunto, ricaricamento prodotti...', data);
      }
      reloadProducts();
    },
    onProductUpdated: (data) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Prodotto aggiornato, ricaricamento prodotti...', data);
      }
      reloadProducts();
    },
    onProductDeleted: (data) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Prodotto eliminato, ricaricamento prodotti...', data);
      }
      reloadProducts();
    }
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!categoryId) return;
      
      try {
        setLoading(true);
        
        // Carica prodotti e informazioni business in parallelo
        const [productsResponse, businessResponse] = await Promise.all([
          productService.getByCategory(parseInt(categoryId)),
          businessService.get()
        ]);
        
        if (productsResponse.success) {
          setProducts(productsResponse.data.products);
          setCategory(productsResponse.data.category);
        } else {
          setError('Errore nel caricamento dei prodotti');
        }

        // Il businessService restituisce direttamente i dati
        if (businessResponse) {
          setBusinessInfo(businessResponse);
        }
        
      } catch (err) {
        console.error('Errore nel caricamento dei dati:', err);
        setError('Errore nel caricamento dei dati');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [categoryId]);

  const handleBack = () => {
    navigate('/menu');
  };

  if (loading) {
    return (
      <PageContainer>
        <LoadingState>Caricamento prodotti...</LoadingState>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <Header>
          <BackButton onClick={handleBack}>
            ← Torna al Menu
          </BackButton>
        </Header>
        <EmptyState>{error}</EmptyState>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Header>
        <HeaderLeft>
          <BackButton onClick={() => navigate('/menu')}>
            ← Torna al Menu
          </BackButton>
          <CategoryTitle>{language === 'en' ? (category?.name_en || category?.name) : (category?.name || 'Categoria')}</CategoryTitle>
        </HeaderLeft>
      </Header>

      {products.length === 0 ? (
        <EmptyState>Nessun prodotto disponibile in questa categoria.</EmptyState>
      ) : (
        <ProductsGrid>
          {products.map((product) => (
            <ProductCard key={product.id}>
              <ProductImage hasImage={true}>
                {product.image_path ? (
                  <img 
                    src={`${SERVER_BASE_URL}${product.image_path}`}
                    alt={product.name}
                    onError={(e) => {
                      // Se l'immagine del prodotto non si carica, mostra l'immagine di default
                      e.currentTarget.src = '/nofoto.jpg';
                    }}
                  />
                ) : (
                  <img 
                    src="/nofoto.jpg"
                    alt="Immagine non disponibile"
                  />
                )}
              </ProductImage>
              
              <ProductName>{language === 'en' ? (product.name_en || product.name) : product.name}</ProductName>
              
              <ProductPrice>€ {product.price.toFixed(2)}</ProductPrice>
              
              {(language === 'en' ? (product.description_en || product.description) : product.description) && (
                <ProductDescription>
                  {language === 'en' ? (product.description_en || product.description) : product.description}
                </ProductDescription>
              )}
              
              {/* Ingredienti */}
              {product.ingredients && product.ingredients.length > 0 && (
                <IngredientsSection>
                  <SectionTitle>
                    <span>🥄</span>
                    <span>Ingredienti:</span>
                    <ItemsList>
                      {product.ingredients.map((ingredient, index) => (
                        <span key={`ingredient-${ingredient.id}`}>
                          {ingredient.name}
                          {index < product.ingredients.length - 1 && ', '}
                        </span>
                      ))}
                    </ItemsList>
                  </SectionTitle>
                </IngredientsSection>
              )}
              
              {/* Allergeni */}
              {product.allergens && product.allergens.length > 0 && (
                <AllergensSection>
                  <SectionTitle>
                    <span>⚠️</span>
                    <span>Allergeni:</span>
                    <ItemsList>
                      {product.allergens.map((allergen, index) => (
                        <span key={`allergen-${allergen.id}`}>
                          {allergen.name}
                          {index < product.allergens.length - 1 && ', '}
                        </span>
                      ))}
                    </ItemsList>
                  </SectionTitle>
                </AllergensSection>
              )}
            </ProductCard>
          ))}
        </ProductsGrid>
      )}
      
      {/* Pulsante fisso per tornare al menu */}
      <FixedNavigation>
        <FloatingBackButton onClick={() => navigate('/menu')}>
          ← Menu
        </FloatingBackButton>
      </FixedNavigation>
      
      {/* Footer condiviso */}
      <SharedFooter />
    </PageContainer>
  );
};

export default CategoryProducts;