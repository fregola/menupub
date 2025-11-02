import React, { useState } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../common/Button';
import Input from '../common/Input';
import Logo from '../common/Logo';

const LoginContainer = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  padding: 20px;
`;

const LoginCard = styled.div`
  background: white;
  padding: 40px;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  width: 100%;
  max-width: 400px;
  border: 1px solid #e5e7eb;
`;

const LogoContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 32px;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: #1f2937;
  text-align: center;
  margin-bottom: 8px;
`;

const Subtitle = styled.p`
  color: #6b7280;
  text-align: center;
  margin-bottom: 32px;
  font-size: 15px;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const ErrorMessage = styled.div`
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  text-align: center;
`;

const LoginForm: React.FC = () => {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loginError, setLoginError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    
    // Rimuovi l'errore del campo quando l'utente inizia a digitare
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: '',
      }));
    }
    
    // Rimuovi l'errore di login
    if (loginError) {
      setLoginError('');
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Il nome utente è obbligatorio';
    }

    if (!formData.password) {
      newErrors.password = 'La password è obbligatoria';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const success = await login(formData);
    
    if (success) {
      // Reindirizza alla dashboard dopo il login riuscito
      navigate('/dashboard');
    } else {
      setLoginError('Credenziali non valide. Riprova.');
    }
  };

  return (
    <LoginContainer>
      <LoginCard>
        <LogoContainer>
          <Logo size={80} />
        </LogoContainer>
        
        <Title>Accedi</Title>
        <Subtitle>Benvenuto nel sistema di gestione menu</Subtitle>
        
        <Form onSubmit={handleSubmit}>
          {loginError && (
            <ErrorMessage>{loginError}</ErrorMessage>
          )}
          
          <Input
            label="Nome utente"
            name="username"
            type="text"
            placeholder="Inserisci il tuo nome utente"
            value={formData.username}
            onChange={handleChange}
            error={errors.username}
            fullWidth
            required
          />
          
          <Input
            label="Password"
            name="password"
            type="password"
            placeholder="Inserisci la tua password"
            value={formData.password}
            onChange={handleChange}
            error={errors.password}
            fullWidth
            required
          />
          
          <Button
            type="submit"
            fullWidth
            loading={isLoading}
            disabled={isLoading}
          >
            {isLoading ? 'Accesso in corso...' : 'Accedi'}
          </Button>
        </Form>
      </LoginCard>
    </LoginContainer>
  );
};

export default LoginForm;