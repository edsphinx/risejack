// WebAuthn polyfill must be loaded first (CSP-compliant external file)
import './lib/webauthn-polyfill';

import { render } from 'preact';
import { App } from './app';
import './styles/globals.css';

render(<App />, document.getElementById('app')!);
