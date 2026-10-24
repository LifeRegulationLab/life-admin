import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { StoreProvider, useStore } from './lib/store/StoreProvider';
import { Add, AddKind } from './pages/Add';
import { Everything } from './pages/Everything';
import { Help } from './pages/Help';
import { HelpWith } from './pages/HelpWith';
import { ItemFlow } from './pages/ItemFlow';
import { Me } from './pages/Me';
import { Pile } from './pages/Pile';
import { RecordPage } from './pages/Record';
import { RenewalEdit, Renewals } from './pages/Renewals';
import { SignIn } from './pages/SignIn';
import { Today } from './pages/Today';

/** The app opens straight on Today. Nothing has to be set up first. */
function Ready({ children }: { children: ReactNode }) {
  const { ready } = useStore();
  if (!ready) return <p className="muted p-6">Opening…</p>;
  return children;
}

export function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/signin" element={<SignIn />} />
          <Route path="/with/:code" element={<HelpWith />} />
          <Route
            element={
              <Ready>
                <Layout />
              </Ready>
            }
          >
            <Route index element={<Today />} />
            <Route path="add" element={<Add />} />
            <Route path="add/:kind" element={<AddKind />} />
            <Route path="pile" element={<Pile />} />
            <Route path="item/:id" element={<ItemFlow />} />
            <Route path="item/:id/record" element={<RecordPage />} />
            <Route path="renewals" element={<Renewals />} />
            <Route path="renewals/:id" element={<RenewalEdit />} />
            <Route path="all" element={<Everything />} />
            <Route path="help" element={<Help />} />
            <Route path="me" element={<Me />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  );
}
