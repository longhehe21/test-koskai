import { HashRouter } from 'react-router-dom';
import { AppRoutes } from './router';
import { AiProvider } from './providers/AiProvider';
import { VirtualKeyboard } from '@components/virtual-keyboard/VirtualKeyboard';

export function App() {
  return (
    <HashRouter>
      <AiProvider>
        <AppRoutes />
      </AiProvider>
      <VirtualKeyboard />
    </HashRouter>
  );
}
