import React from 'react';
import styled from 'styled-components';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../common/Button';
import Logo from '../common/Logo';

const HeaderContainer = styled.header`
  background: white;
  border-bottom: 1px solid #e5e7eb;
  padding: 0 24px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
`;

const LogoSection = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const LogoText = styled.h1`
  font-size: 20px;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
`;

const UserSection = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const UserInfo = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
`;

const UserName = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
`;

const UserRole = styled.span`
  font-size: 12px;
  color: #6b7280;
  text-transform: capitalize;
`;

const Header: React.FC = () => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <HeaderContainer>
      <LogoSection>
        <Logo size={32} />
        <LogoText>Menu Manager</LogoText>
      </LogoSection>
      
      <UserSection>
        {user && (
          <UserInfo>
            <UserName>{user.username}</UserName>
            <UserRole>{user.role}</UserRole>
          </UserInfo>
        )}
        <Button
          variant="secondary"
          size="small"
          onClick={handleLogout}
        >
          Esci
        </Button>
      </UserSection>
    </HeaderContainer>
  );
};

export default Header;