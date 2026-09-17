/**
 * Web entry point. The native app starts from index.js via AppRegistry; the
 * browser starts here, rendering the same App component into the DOM.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('index.html is missing its #root element');
}

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
