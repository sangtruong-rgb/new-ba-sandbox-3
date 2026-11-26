import { createRoot } from 'react-dom/client';
import './app/styles/tokens.css';
import './app/styles/base.css';
import { App } from './app/App';
import { featuresOnDisk } from './app/features';
import { createRegistry } from './app/registry';

// Every feature's index.ts is evaluated once here, before the first render.
const registry = createRegistry(featuresOnDisk());

createRoot(document.getElementById('root')!).render(<App registry={registry} />);
