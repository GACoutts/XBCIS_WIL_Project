import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import './styles/index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

const root = createRoot(document.getElementById('root'));

root.render(
  <BrowserRouter>
    <AuthProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </AuthProvider>
  </BrowserRouter>
);
